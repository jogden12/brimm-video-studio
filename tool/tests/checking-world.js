// The made-up world the tests of what is said while a finish waits for its late check share (edit-guide-checking.test.js,
// edit-status-checking.test.js): a finish run as the command line runs it, holding the episode's lock, and a guide or status run asked
// while it waits. The lock is this process's, so those runs are told that this process is the finish run at work. The episode is
// guide-world.js's (exports-world.js's, read by Claude and its spellings answered), with stand-ins for ffprobe, ffmpeg, the transcriber
// and open: nothing here touches the real home, Downloads, Dropbox or a program.
import assert from "node:assert/strict";
import { editMain, finishEpisode } from "../edit.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { clockAt } from "../unedited.js";
import { FOLDER, reread } from "./episodes.js";
import { exportOf, whisper } from "./exports-world.js";
import { depsOf, guideWorld } from "./guide-world.js";

/** The made-up episode as `guide` names it, and its hand-off as the page's step names it. */
export const NAMED = "Pricing: what to charge? (3fa9c1)";
export const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
export const THIS_PROCESS = (pid) => pid === process.pid;

/** What Studio says of its late check: when it checks Dropbox's copies (`due`, ms) and then takes away what it took from `where`. */
export const studio = (due, where = "the export out of Downloads") => `Studio checks Dropbox's copies at ${clockAt(due)}${where ? `, and then takes ${where}` : ""}.`;
/** What the guide says of what waits for the check: she need not wait for it, but a spelling, handing the video off again and handing it
    over do (each is stopped until it is made: edit-checking-refusals.test.js). */
export const WAITS = "You do not need to wait for it. A spelling and handing it off again wait until then.";
/** The line the guide adds after its own lines. */
export const check = (due, where) => `${studio(due, where)} ${WAITS}`;

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
export async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** The deps of a run that sees this process as the finish run at work. */
export const seeing = (w, over = {}) => depsOf(w, { alive: THIS_PROCESS, ...over });
/** Have `then` run once, at the first wait of `waited` milliseconds: the late check's (15 minutes) unless another is given. */
export function atWait(t, then, waited = LATE_CHECK_MS) {
  const wait = t.ctx.deps.wait;
  let done = false;
  t.ctx.deps.wait = async (ms) => {
    if (ms === waited && !done) {
      done = true;
      await then();
    }
    return wait(ms);
  };
}
/** A raw video or an iPhone clip, with the exports of its HyperFrames projects in Downloads, and finish asked with a yes. */
export async function exported(kind = "raw") {
  const w = guideWorld({ kind, projects: kind === "raw" ? ["main", "reel 2"] : ["main"], programs: { WHISPER: whisper() } });
  exportOf(w, "main");
  if (kind === "raw") exportOf(w, "reel 2");
  assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
  return w;
}
/** Run the finish as the command line runs it. While it waits for its late check, run each of `asks` (a name for the ask, and the words
    of an edit.js run, with `over` laid over the deps it sees the finish by), and give back what each said, with `due`, the time the
    check is made. `before`, when it is given, is called first, as what happens meanwhile (a Reel exported, say). */
export async function whileChecking(w, asks, over = {}, before = null) {
  const heard = {};
  atWait(w.t, async () => {
    heard.due = w.t.now() + LATE_CHECK_MS;
    if (before) await before();
    for (const [name, argv] of Object.entries(asks)) heard[name] = await on(seeing(w, over), ...argv);
  });
  assert.equal(await editMain(["finish", "--now", FOLDER], w.t.ctx.deps), 0, w.t.said());
  return heard;
}
/** The episode's record, read again. */
export const record = (w) => reread(w.found);
