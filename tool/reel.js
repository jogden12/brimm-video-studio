// The timeline brimm-video pushes to Final Cut for a Reel (spec section 7, phase 2). Until phase 3 writes a Reel's own
// project, it is the clip the import cut, whole: upright already, each stretch cropped on the speaker, with its captions on
// the clip's own clock. This is the one function phase 3 replaces.
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { probeArgs, factsOf, roughRate } from "./cuts.js";
import { captionsOf } from "./lib.js";
import { lastLine, runProgram } from "./run.js";
import { fcpxml, checkFcpxml } from "./fcpxml.js";
import { soundOf, findPrograms } from "./unedited.js";
import { relativeMedia } from "./portable.js";
import { runsFolder } from "./settings.js";

/** The stored timeline of a Reel, as text that names its media relative to the episode's edit/ folder and no library:
    {xml}; {coming}, the clip's name, when Dropbox has not brought it over to this Mac yet; or {why} there is none, in plain
    words. */
export async function reelTimeline(found, reel, ctx) {
  const run = ctx.deps.run || runProgram;
  const tools = ctx.deps.tools || findPrograms();
  const files = Array.isArray(reel.files) ? reel.files : [];
  const video = files.find((f) => /\.reel-\d+\.mp4$/i.test(f));
  const srt = files.find((f) => /\.reel-\d+\.srt$/i.test(f));
  if (!video) return { why: `Reel ${reel.n} has no clip: the import could not cut it.` };
  const at = join(found.folder, video);
  if (!existsSync(at)) return { why: `${video} is not in the episode's folder.` };
  if (!ctx.isWhole(at)) return { coming: video };
  // Named for this process, so a run that dies leaves nothing clearRuns keeps.
  const work = join(runsFolder(ctx.home), `reel-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  try {
    const out = join(work, "facts.json");
    const probe = await run(tools.ffprobe, probeArgs(at, out));
    const printed = probe.code === 0 && existsSync(out) ? readFileSync(out, "utf8") : "";
    const facts = printed ? factsOf(printed) : null;
    if (!facts || !facts.height) return { why: `${video} could not be read (${lastLine(probe.stderr)}).` };
    const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound, ...soundOf(printed) };
    const captions = srt && existsSync(join(found.folder, srt)) ? captionsOf(readFileSync(join(found.folder, srt), "utf8")) : [];
    const whole = fcpxml({ video: at, facts: said, ranges: [{ start: 0, end: facts.duration }], captions, project: `reel ${reel.n}`, event: found.name });
    const wrong = checkFcpxml(whole, said);
    if (wrong.length) return { why: `its timeline did not pass its own check (${wrong.join(" ")})` };
    // The timeline as it is kept in edit/: its media named from there.
    const kept = join(found.folder, "edit", `reel-${reel.n}.fcpxml`);
    return { xml: relativeMedia(whole, { from: kept, to: kept, episode: found.folder }).xml };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
