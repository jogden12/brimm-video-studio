// The timeline a push hands to Final Cut (phase 4): built from the record whenever the session has laid something over it,
// spelled a word, cut it again or picked its preset, and otherwise the one kept as it was made (the import's
// edit/main.v0.fcpxml, or a Reel's as reel.js gives it). Built, it is the main video's project (projects.js) or the Reel's
// (reels.js), with its pieces as the cuts asked for leave them (recut.js) and what lies over them (layers.js), in the face
// this Mac has (styles.js).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { probeArgs, factsOf, colourOf } from "./cuts.js";
import { colorSpaceOf } from "./fcpxml.js";
import { lastLine, runProgram } from "./run.js";
import { soundOf, findPrograms, sameVideo, described, ideaNotes } from "./unedited.js";
import { relativeMedia } from "./portable.js";
import { runsFolder } from "./settings.js";
import { eventName, timelineFile } from "./names.js";
import { readReels, reelProject, REELS_FILE, REEL_FRAME, GUESSED } from "./reels.js";
import { reelTimeline } from "./reel.js";
import { mainProject } from "./projects.js";
import { layersFor, targetOf, presetOf } from "./layers.js";
import { rangesWith, keptOf, croppedLike, cutPhrases } from "./recut.js";
import { clockOf, clockOfRanges, heardWords } from "./clock.js";
import { faceOnThisMac } from "./styles.js";
import { spellWords } from "./spelling.js";
import { filesProblems } from "./episode.js";
import { pictureSize } from "./pictures.js";

/** The folders a Mac keeps fonts in: Font Book installs a person's into the first. */
export const fontFolders = (home) => [join(home, "Library", "Fonts"), "/Library/Fonts", "/System/Library/Fonts", "/System/Library/Fonts/Supplemental"];
/** The names of the font files in a Mac's font folders: none from a folder that cannot be read. */
export const fontFiles = (home) => fontFolders(home).flatMap((dir) => {
  try {
    return readdirSync(dir);
  } catch (e) {
    return [];
  }
});

/** Is there anything to build this part from, beyond the timeline kept as it was made? Always for a Reel with a project of its
    own, which shows its title on screen and, unless they are turned off, its captions. For the main video: a spelling, a
    text, a graphic, a cut, the logo, a preset, or a job whose captions are drawn (a short video's default, as filmed). */
export function layered(record, part) {
  if (part !== "main") return true;
  const t = record.main;
  if ((record.spellings || []).length) return true;
  if (["texts", "graphics", "cuts"].some((k) => (t[k] || []).length) || t.logo || t.preset) return true;
  return presetOf(record, part).job !== "full-episode";
}

/** What the session has asked for on a timeline, as a push builds it (phase 4): the episode's spellings and the logo's
    picture, the part's own layers and preset, and a Reel's title on screen, as a short digest. A push keeps it, so that a
    finish can tell when something was asked for since the version she Shared. Nothing asked reads the same however the
    record holds it: no list, an empty one, the logo off, captions on. */
export function askedOf(record, part) {
  const target = targetOf(record, part) || {};
  const none = (k, v) => v === undefined || v === null || v === false || (Array.isArray(v) && !v.length) || (k === "captions" && v === true);
  const own = ["texts", "graphics", "cuts", "logo", "captions", "preset", ...(part === "main" ? [] : ["title"])].map((k) => (none(k, target[k]) ? null : target[k]));
  const brand = record.brand && record.brand.logo ? record.brand.logo : null;
  return createHash("sha1").update(JSON.stringify([record.spellings || [], brand, own])).digest("hex").slice(0, 12);
}

/** A picture's size as it is shown: null when it cannot be read. */
function sizeOf(path) {
  try {
    return pictureSize(readFileSync(path));
  } catch (e) {
    return null;
  }
}

/** What a timeline is made of now, read from the episode's folder: { plan, words, hasWords, wordsFile, stem, ranges, pieces,
    picked, need }, where `ranges` are the whole recording's ranges as its cuts leave them, `pieces` its kept pieces, and
    `need` the files it is built from; or { coming, bring } while Dropbox has not brought one over yet, { why } when one is
    missing or cannot be read, or { old: true } for a Reel the import cut as a clip, before Reels had projects of their own,
    which is shown as it was, with nothing over it. A Reel is built on the project written when it was picked, so it shows
    the stretches it was picked with whatever reels.json says after (phase 3); a Reel picked before that is built on its
    candidate. `extra` are more files it needs, its pictures. `given` is a cut plan to build it from in place of the one in the
    episode's folder, as a reading has it before it puts it there (reading.js); its file is still one it needs. */
export function piecesOf(found, part, ctx, extra = [], given = null) {
  const { record } = found;
  const target = targetOf(record, part);
  const name = record.video.file;
  const stem = name.replace(/\.[^.]*$/, "");
  const v0 = part === "main" ? "" : timelineFile({ part, v: 0 });
  const picked = Boolean(v0) && v0 in record.files && existsSync(join(found.folder, v0));
  let candidate = null;
  if (part !== "main" && !picked) {
    const listed = existsSync(join(found.folder, REELS_FILE));
    if (listed && !ctx.isWhole(join(found.folder, REELS_FILE))) return { coming: REELS_FILE, bring: [REELS_FILE] };
    const read = listed ? readReels(readFileSync(join(found.folder, REELS_FILE), "utf8")) : null;
    candidate = read && read.reels ? read.reels.candidates.find((c) => c.n === part.reel) || null : null;
    if (!candidate) return { old: true };
  }
  const wordsFile = `${stem}.words.json`;
  const hasWords = existsSync(join(found.folder, wordsFile));
  const need = [name, `${stem}.cut-plan.json`, ...(hasWords ? [wordsFile] : []), ...(part === "main" ? [`${stem}.srt`] : picked ? [v0] : []), ...extra];
  const gone = need.find((f) => !existsSync(join(found.folder, f)));
  if (gone) return { why: `${gone} is not in the episode's folder.` };
  const coming = need.filter((f) => !ctx.isWhole(join(found.folder, f)));
  if (coming.length) return { coming: coming[0], bring: coming };
  // The project written at the pick is read only when it is as the record lists it, as every push refuses a file that is not.
  const short = picked ? filesProblems(found.folder, { files: { [v0]: record.files[v0] } }) : [];
  if (short.length) return { why: `${found.name} is not whole in Dropbox: ${short.join(" ")}.` };
  let plan;
  let words = [];
  try {
    plan = given || JSON.parse(readFileSync(join(found.folder, `${stem}.cut-plan.json`), "utf8"));
    // Each word from when it is said: after a pause, not in it (clock.js heardWords).
    if (hasWords) words = heardWords(JSON.parse(readFileSync(join(found.folder, wordsFile), "utf8")).words, plan.phrases);
  } catch (e) {
    return { why: `${stem}.cut-plan.json or ${wordsFile} cannot be read.` };
  }
  // The plan's own ranges while no cut is asked for: a layer never cuts her video again (recut.js rangesWith).
  const ranges = rangesWith({ plan, cuts: target.cuts || [] });
  if (part === "main") return { plan, words, hasWords, wordsFile, stem, ranges, pieces: keptOf(ranges), picked, need };
  // The note that a stretch's crop is a guess goes with it (reels.js GUESSED), as the pick wrote it.
  const base = picked
    ? clockOf(readFileSync(join(found.folder, v0), "utf8")).map((p) => ({ start: p.from, end: p.to, position: p.position, guessed: p.notes.some((n) => n.split(" / ").includes(GUESSED)) }))
    : candidate.ranges;
  if (!base.length) return { why: picked ? `${v0} cannot be read.` : `Reel ${part.reel} has nothing to show: ${String(candidate.failed || "it has no stretch").replace(/\.$/, "")}.` };
  const span = { from: base[0].start, to: base[base.length - 1].end };
  const pieces = (target.cuts || []).length ? croppedLike(keptOf(ranges, span), base) : base;
  return { plan, words, hasWords, wordsFile, stem, ranges, pieces, span, picked, need };
}

/** The stored timeline of a part, as text that names its media from the episode's edit/ folder and no library: { xml, told },
    where `told` is what the person is told of how it was built; { coming, bring }, the file Dropbox has not brought over yet
    and the files to bring; or { why } there is none. `part` is "main" or { reel: n }. With `build`, it is built from the record
    and the plan whatever is asked for on it, and never read from a stored timeline: a raw video's reading builds the main
    video's version 0 so, from `plan`, the plan it read, before that plan is in the episode's folder (reading.js). */
export async function timelineFor(found, part, ctx, { build = false, plan: given = null } = {}) {
  const { record } = found;
  const target = targetOf(record, part);
  if (!target) return { why: `There is no Reel ${part.reel}.` };
  if (!build && !layered(record, part)) {
    if (part !== "main") return { told: [], ...(await reelTimeline(found, target, ctx)) };
    const v0 = timelineFile({ part: "main", v: 0 });
    if (!ctx.isWhole(join(found.folder, v0))) return { coming: v0, bring: [v0] };
    return { xml: readFileSync(join(found.folder, v0), "utf8"), told: [] };
  }
  const pictures = [...new Set([...(target.graphics || []).map((g) => g.picture), ...(target.logo && record.brand && record.brand.logo ? [record.brand.logo] : [])])];
  const read = piecesOf(found, part, ctx, pictures, given);
  if (read.old) {
    const asked = (record.spellings || []).length > 0 || ["texts", "graphics", "cuts"].some((k) => (target[k] || []).length) || Boolean(target.preset) || target.captions === false;
    return { told: asked ? [`Reel ${part.reel} was cut as a clip before Reels had projects of their own, so what was asked for on it is not shown. Change it by hand in Final Cut.`] : [], ...(await reelTimeline(found, target, ctx)) };
  }
  if (read.why || read.coming) return read;
  const { plan, words, hasWords, wordsFile, stem, ranges, pieces, span } = read;
  const name = record.video.file;
  const run = ctx.deps.run || runProgram;
  const tools = ctx.deps.tools || findPrograms();
  // A program that is not there is never run: findPrograms gives "" for it, which runProgram cannot start.
  if (!tools.ffprobe) return { why: "ffprobe is not installed. It comes with ffmpeg." };
  // Named for this process, so a run that dies leaves nothing clearRuns keeps.
  const work = join(runsFolder(ctx.home), `timeline-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  try {
    const video = join(found.folder, name);
    const out = join(work, "facts.json");
    const probe = await run(tools.ffprobe, probeArgs(video, out));
    const printed = probe.code === 0 && existsSync(out) ? readFileSync(out, "utf8") : "";
    const now = printed ? factsOf(printed) : null;
    if (!now || !now.height) return { why: `${name} could not be read (${lastLine(probe.stderr)}).` };
    if (!sameVideo(plan.facts, now)) return { why: `${name} is not the video its cut plan was made of: it is ${described(now)}, and the plan's is ${described(plan.facts)}.` };
    const more = { ...soundOf(printed), colorSpace: colorSpaceOf(colourOf(printed)) || undefined };
    const face = faceOnThisMac(ctx.deps.fontFiles ? ctx.deps.fontFiles() : fontFiles(ctx.home));
    const sizes = Object.fromEntries(pictures.map((p) => [p, sizeOf(join(found.folder, p))]));
    const frame = part === "main" ? { width: plan.facts.width, height: plan.facts.height } : REEL_FRAME;
    // HDR by the colour itself: HLG or PQ, or BT.2020 colour (the lead's review, L22).
    const colour = colourOf(printed) || {};
    const hdr = colour.primaries === "bt2020" || ["arib-std-b67", "smpte2084"].includes(colour.transfer);
    const layers = layersFor({ record, part, frame, ranges: pieces, words, face: face.face, pictures: sizes, video: { height: plan.facts.height, hdr }, lookPresets: ctx.deps.lookPresets });
    const made = part === "main"
      ? mainProject({ video, facts: plan.facts, more, plan, ranges, srt: readFileSync(join(found.folder, `${stem}.srt`), "utf8"), spellings: record.spellings, ideas: ideaNotes({ ...plan, phrases: cutPhrases(plan.phrases, target.cuts || []) }, (plan.claude && plan.claude.graphics) || []), titles: layers.titles, stills: layers.stills, look: layers.look, project: "main", event: eventName(found.name) })
      : reelProject({ video, facts: plan.facts, candidate: { start: span.from, end: span.to, ranges: pieces }, plan, planRanges: (target.cuts || []).length ? ranges : plan.ranges, titles: layers.titles, stills: layers.stills, look: layers.look, more, project: `reel ${part.reel}`, event: eventName(found.name) });
    if (made.why) return { why: `Its timeline could not be made: ${made.why}.` };
    const kept = join(found.folder, "edit", "timeline.fcpxml");
    const unworded = hasWords ? "" : `This episode has no ${wordsFile}, so no captions are drawn.`;
    return { xml: relativeMedia(made.text, { from: kept, to: kept, episode: found.folder }).xml, told: [face.told, unworded, ...layers.told].filter(Boolean) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The clock a person reads a time on, for a part: the newest version shown in Final Cut, on either Mac, as its stored file
    gives it, or the timeline as it is now when it was never shown. { clock, on, pieces, words, plan } with `on` naming it
    for a person ("main v3", "Reel 2 v1", "the main video as it is now"), and `words` spelled as every timeline's captions
    spell them, so that words she quotes are found as she reads them; or what piecesOf gives when it cannot be read. */
export function clockFor(found, part, ctx) {
  const pieces = piecesOf(found, part, ctx);
  if (pieces.old) return { why: `Reel ${part.reel} was cut as a clip before Reels had projects of their own, so a time on it cannot be read. Make this change by hand in Final Cut.` };
  if (pieces.why || pieces.coming) return pieces;
  const read = { ...pieces, words: spellWords(pieces.words, found.record.spellings) };
  const target = targetOf(found.record, part);
  const label = part === "main" ? "main" : `Reel ${part.reel}`;
  const top = (target.pushed || []).reduce((best, p) => (!best || p.v > best.v ? p : best), null);
  if (!top) return { ...read, clock: clockOfRanges(read.pieces), on: `${part === "main" ? "the main video" : label} as it is now` };
  const at = join(found.folder, top.file);
  if (!existsSync(at)) return { why: `${top.file} is not in the episode's folder.` };
  if (!ctx.isWhole(at)) return { coming: top.file, bring: [top.file] };
  return { ...read, clock: clockOf(readFileSync(at, "utf8")), on: `${label} v${top.v}` };
}
