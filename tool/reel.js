// The timeline brimm-video pushes to Final Cut for a Reel. For an episode the import made with Reel candidates (phase 3), it
// is the Reel's own project: its stretches of the raw video on an upright timeline, each filled into the frame and moved onto
// the face by the crop reels.json holds (reels.js reelProject). For an episode imported before that, with no reels.json, it
// is still the clip the import cut, whole: upright already, with its captions on the clip's own clock (phase 2).
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { probeArgs, factsOf, roughRate, colourOf } from "./cuts.js";
import { captionsOf } from "./lib.js";
import { lastLine, runProgram } from "./run.js";
import { fcpxml, checkFcpxml, colorSpaceOf } from "./fcpxml.js";
import { readReels, reelProject, REELS_FILE } from "./reels.js";
import { eventName, timelineFile } from "./names.js";
import { soundOf, findPrograms, sameVideo, described } from "./unedited.js";
import { relativeMedia } from "./portable.js";
import { runsFolder } from "./settings.js";

/** The stored timeline of a Reel, as text that names its media relative to the episode's edit/ folder and no library:
    {xml}; {coming, bring}, the file's name and the files to bring, when Dropbox has not brought it over to this Mac yet; or
    {why} there is none, in plain words. It is decided for each Reel, in this order:
    - the project written when the Reel was picked, edit/reel-<n>.v0.fcpxml, once the record lists it: so a picked Reel is
      pushed as it was picked, whatever happens to reels.json after;
    - the Reel's own project (ownProject), when reels.json has its candidate;
    - the clip the import cut, for a Reel of an episode imported before phase 3, when the Reel has one. */
export async function reelTimeline(found, reel, ctx) {
  const v0 = timelineFile({ part: { reel: reel.n }, v: 0 });
  if (found.record.files && v0 in found.record.files && existsSync(join(found.folder, v0))) {
    if (!ctx.isWhole(join(found.folder, v0))) return { coming: v0, bring: [v0] };
    return { xml: readFileSync(join(found.folder, v0), "utf8") };
  }
  const listed = existsSync(join(found.folder, REELS_FILE));
  const read = listed ? readReels(readFileSync(join(found.folder, REELS_FILE), "utf8")) : null;
  const candidate = read && read.reels ? read.reels.candidates.find((c) => c.n === reel.n) : null;
  if (candidate) return ownProject(found, reel, candidate, ctx);
  const clipped = (Array.isArray(reel.files) ? reel.files : []).some((f) => /\.reel-\d+\.mp4$/i.test(f));
  if (!clipped && !listed && found.record.files && REELS_FILE in found.record.files) return { why: `${REELS_FILE} is missing from this episode, though its record lists it.` };
  if (!clipped && read && read.why) return { why: `The list of Reel candidates cannot be read: ${read.why.replace(/\.$/, "")}.` };
  if (!clipped && listed) return { why: `reels.json has no Reel ${reel.n}.` };
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

/** The Reel's own project (phase 3): the stretches and crops of its candidate in reels.json, cut from the raw video as the cut
    plan says, on an upright timeline (reelProject). The raw video's facts are the plan's, so its stretches fall where the
    plan put them; ffprobe is asked of it too, for its sound and its colour, and to be sure it is the video the plan was made
    of. A plan's facts and ffprobe's may differ in length by a tenth of a second at most, as another ffprobe may read it. */
async function ownProject(found, reel, candidate, ctx) {
  if (!candidate.ranges.length) return { why: `Reel ${reel.n} has nothing to show: ${candidate.failed || "it has no stretch"}.` };
  const name = found.record.video.file;
  const video = join(found.folder, name);
  const stem = name.replace(/\.[^.]*$/, "");
  const planAt = join(found.folder, `${stem}.cut-plan.json`);
  if (!existsSync(video)) return { why: `${name} is not in the episode's folder.` };
  if (!existsSync(planAt)) return { why: `${stem}.cut-plan.json is not in the episode's folder.` };
  if (!ctx.isWhole(video)) return { coming: name, bring: [name] };
  let plan;
  try {
    plan = JSON.parse(readFileSync(planAt, "utf8"));
  } catch (e) {
    return { why: `${stem}.cut-plan.json cannot be read.` };
  }
  const run = ctx.deps.run || runProgram;
  const tools = ctx.deps.tools || findPrograms();
  // Named for this process, so a run that dies leaves nothing clearRuns keeps.
  const work = join(runsFolder(ctx.home), `reel-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  try {
    const out = join(work, "facts.json");
    const probe = await run(tools.ffprobe, probeArgs(video, out));
    const printed = probe.code === 0 && existsSync(out) ? readFileSync(out, "utf8") : "";
    const now = printed ? factsOf(printed) : null;
    if (!now || !now.height) return { why: `${name} could not be read (${lastLine(probe.stderr)}).` };
    if (!sameVideo(plan.facts, now)) return { why: `${name} is not the video its cut plan was made of: it is ${described(now)}, and the plan's is ${described(plan.facts)}.` };
    const more = { ...soundOf(printed), colorSpace: colorSpaceOf(colourOf(printed)) || undefined };
    const made = reelProject({ video, facts: plan.facts, candidate, plan, project: `reel ${reel.n}`, event: eventName(found.name), more });
    if (made.why) return { why: `Reel ${reel.n}'s project could not be made: ${made.why}.` };
    const kept = join(found.folder, timelineFile({ part: { reel: reel.n }, v: 0 }));
    return { xml: relativeMedia(made.text, { from: kept, to: kept, episode: found.folder }).xml };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
