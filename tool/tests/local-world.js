// A made-up episode kept on this Mac (Phase 3, L5): the worlds of the tests of the finish and its check on a video whose files are in its own
// folder, `video/`, in BRIMM Video Work. Built on episodes.js' setup(), as guide-world's and reels-world's are. Nothing here touches Dropbox,
// the real home, Downloads or a program.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { LOCAL_VERSION, readEpisode, recordFile, recordText } from "../episode.js";
import { importEpisodes, readPendingAt } from "../filing.js";
import { episodeFilesFolder, settingsFile, workFolder, writeSettings } from "../settings.js";
import { filePlace } from "../where.js";
import { FOLDER, ID, reread } from "./episodes.js";
import { exportOf, whisper } from "./exports-world.js";
import { guideWorld } from "./guide-world.js";

/** Make the episode of `w` ({ t, found }) a video kept on this Mac: each file its record lists that is kept on a Mac is moved into the episode's folder
    in BRIMM Video Work, video/; the next record says `local`; this Mac gets the drop folder of its own. */
export function makeLocal(w) {
  const { t } = w;
  const record = reread(w.found);
  const local = { on: "Mac Studio" };
  const own = episodeFilesFolder(t.home, basename(w.found.folder));
  for (const rel of Object.keys(record.files || {})) {
    if (filePlace({ ...record, local }, rel) !== "local") continue;
    const from = join(w.found.folder, rel);
    if (!existsSync(from)) continue;
    mkdirSync(dirname(join(own, rel)), { recursive: true });
    renameSync(from, join(own, rel));
  }
  writeFileSync(recordFile(w.found.folder, record.rev + 1), recordText({ ...record, rev: record.rev + 1, version: LOCAL_VERSION, local }));
  const drop = join(workFolder(t.home), "Drop");
  mkdirSync(drop, { recursive: true });
  let onDisk = {};
  try {
    onDisk = JSON.parse(readFileSync(settingsFile(t.home), "utf8"));
  } catch (e) {
    onDisk = { version: 1, machine: t.ctx.settings.machine, root: t.ctx.settings.root, checkout: t.ctx.settings.checkout };
  }
  writeSettings(t.home, { ...onDisk, drop: "Drop", dropPath: drop });
  t.ctx.settings = { ...t.ctx.settings, drop: "Drop", dropPath: drop };
  if (t.ctx.deps.settings) t.ctx.deps.settings = { ...t.ctx.deps.settings, drop: "Drop", dropPath: drop };
  w.found = { ...w.found, record: reread(w.found) };
  return w;
}

/** A raw video or an iPhone clip kept on this Mac, with the exports of its HyperFrames projects in Downloads, and finish asked with a yes. */
export async function localExported(kind = "raw", opts = {}) {
  const w = guideWorld({ kind, projects: kind === "raw" ? ["main", "reel 2"] : ["main"], programs: { WHISPER: whisper() }, ...opts });
  makeLocal(w);
  exportOf(w, "main");
  if (kind === "raw") exportOf(w, "reel 2");
  const code = await finishEpisode(w.t.ctx, w.found, { yes: true });
  if (code !== 0) throw new Error(w.t.said());
  return w;
}

/** Run the finish as the command line runs it: its code. */
export const finishRun = (w, over = {}) => editMain(["finish", "--now", FOLDER], { ...w.t.ctx.deps, ...over });

/** The launch agent's run at `at`: the loop on a drop folder of its own, with the deps the agent has, and a clock that its waits move. */
export async function agentRun(w, { at, over = {} }) {
  const drop = join(w.t.dir, "agent-drop");
  mkdirSync(drop, { recursive: true });
  const logs = [];
  const notices = [];
  const waits = [];
  let now = at;
  await importEpisodes(drop, {
    episode: { root: w.t.root, machine: "Mac Studio", home: w.t.home },
    clock: () => now,
    wait: async (ms) => { waits.push(ms); now += ms; },
    clone: w.t.ctx.deps.clone,
    sameDisk: () => true,
    keepAwake: () => {},
    log: (line) => logs.push(line),
    notify: (text) => notices.push(text),
    alive: () => false,
    ...over,
    // L6: a local finish's `original` pending holds no run of these tests open unless a test turns the check on.
    checks: { original: null, ...(over.checks || {}) }
  }, async () => { throw new Error("nothing is waiting"); });
  return { logs, notices, waits };
}

/** The `final` pending of a revision of the made-up episode. */
export const finalPending = (w, revision) => readPendingAt(w.t.home, `final/${ID}-${revision}.json`);

export { readdirSync, readFileSync, readEpisode };
