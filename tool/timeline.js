// The timeline a push hands to Final Cut (phase 4): built from the record whenever the session has laid something over it,
// spelled a word, cut it again or picked its preset, and otherwise the one kept as it was made (the import's
// edit/main.v0.fcpxml, or a Reel's as reel.js gives it). Built, it is the main video's project (projects.js) or the Reel's
// (reels.js), with its pieces as the cuts asked for leave them (recut.js) and what lies over them (layers.js), in the face
// this Mac has (styles.js).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { probeArgs, factsOf, colourOf, KEPT } from "./cuts.js";
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
import { filesProblems, layoutOf } from "./episode.js";
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

/** Whether a record keeps the whole of its video, for reading a time on it or cutting it again: a finished video, a client or
    group session, and an iPhone clip once it is answered (layout 3). Nothing of such a video is cut by brimm-video, whatever
    its cut plan says of silences and retakes (the plan was made for a raw video). A raw video does not, and neither does an
    iPhone clip from before the switch (layout 1 or 2), whose clock still comes from its plan's cuts. */
const keepsWhole = (record) => record.kind === "finished" || record.kind === "session" || (record.kind === "short video" && layoutOf(record) === 3);

/** A plan as it would be had the whole video been kept: every phrase kept, and one kept range from 0 to the video's length that
    holds them all, in the shape of the plan's own ranges (cuts.js rangesOf). Her own cuts are then made from it as they are
    from any plan (recut.js rangesWith). The plan given is not changed. */
function wholePlan(plan) {
  const phrases = plan.phrases.map((p) => ({ ...p, ...KEPT }));
  const range = { start: 0, end: plan.facts.duration, ...KEPT, phrases: phrases.map((p) => p.id), text: phrases.map((p) => p.text).filter(Boolean).join(" ") };
  return { ...plan, phrases, ranges: [range] };
}

/** What a timeline is made of now, read from the episode's folder: { plan, words, hasWords, wordsFile, stem, ranges, pieces,
    picked, need }, where `ranges` are the whole recording's ranges as its cuts leave them, `pieces` its kept pieces, and
    `need` the files it is built from; or { coming, bring } while Dropbox has not brought one over yet, { why } when one is
    missing or cannot be read, or { old: true } for a Reel the import cut as a clip, before Reels had projects of their own,
    which is shown as it was, with nothing over it. A Reel is built on the project written when it was picked, so it shows
    the stretches it was picked with whatever reels.json says after (phase 3); a Reel picked before that is built on its
    candidate. `extra` are more files it needs, its pictures. `given` is a cut plan to build it from in place of the one in the
    episode's folder, as a reading has it before it puts it there (reading.js); its file is still one it needs.
    A record that keeps the whole video (keepsWhole) has its ranges made from the plan with the whole video kept, her own cuts
    still taken off it; the `plan` given back is the one read, as it is, and the plan's file is never rewritten. With `clock`,
    for reading a time, a video of layout 3 needs neither the raw video nor its captions on this Mac: a time is read from the
    plan, the words and the stored timelines alone. Every other case needs the files a build needs. */
export function piecesOf(found, part, ctx, extra = [], given = null, { clock = false } = {}) {
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
  const unneeded = clock && layoutOf(record) === 3;
  const need = [...(unneeded ? [] : [name]), `${stem}.cut-plan.json`, ...(hasWords ? [wordsFile] : []), ...(part === "main" ? (unneeded ? [] : [`${stem}.srt`]) : picked ? [v0] : []), ...extra];
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
  // The plan's own ranges while no cut is asked for: a layer never cuts her video again (recut.js rangesWith). A video that keeps
  // all of it has none of the plan's: its cuts are made from the plan with the whole video kept.
  const ranges = rangesWith({ plan: keepsWhole(record) ? wholePlan(plan) : plan, cuts: target.cuts || [] });
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

/** Whether version `a` of a part is newer than version `b`: the higher number, and of two with one number (two Macs numbering one
    before Dropbox brought them the other's) the later time. */
const newer = (a, b) => a.v > b.v || (a.v === b.v && Date.parse(a.at) > Date.parse(b.at));

/** The newest version in a part's list of `pushed` versions, from either Mac: the highest number, and of two with one number the
    later `at`; the first listed when they are the same. null for none, and for what is not a list. */
export function newestOf(pushed) {
  if (!Array.isArray(pushed)) return null;
  return pushed.reduce((best, p) => (!best || newer(p, best) ? p : best), null);
}

/** Whether the newest version a part lists, from either Mac, was rendered (`how` is "render") and not pushed: false for a push,
    for a version with no `how` (every one before the switch is a push), and when none is listed or the Reel is not in the
    record. `part` is "main" or { reel: n }. A person is asked whether she changed the timeline in Final Cut only when it was not
    (the guard, edit.js). */
export function newestIsRender(record, part) {
  const target = targetOf(record, part);
  const top = target ? newestOf(target.pushed) : null;
  return Boolean(top) && top.how === "render";
}

/** Whether a version has been shown on this Mac, which is what a time is read on: any push, from either Mac, since a push is
    shown in Final Cut by the Mac that makes it and brought to the other; and a render only when this Mac made it and it has
    opened in QuickTime Player (`opened`), since renders stay on the Mac that made them and one counts as shown once it has opened,
    not when its render ends. */
const shownHere = (ctx) => (p) => p.how !== "render" || (p.on === ctx.machine && typeof p.opened === "string" && p.opened.trim() !== "");

/** The clock a person reads a time on, for a part. For the main video of a video that keeps all of it (a finished video, a
    session, an answered clip: keepsWhole), the video's own: all of it, less the cuts she asked for, whatever versions are
    listed. For every other part, the newest version shown on this Mac (shownHere), as its stored file gives it, or the timeline
    as it is now when none was. { clock, on, pieces, words, plan } with `on` naming it for a person ("main v3", "Reel 2 v1", "the
    main video as it is now", "the video"), and `words` spelled as every timeline's captions spell them, so that words she
    quotes are found as she reads them; or what piecesOf gives when it cannot be read. When the newest version listed is a render
    on the other Mac, newer than the one read, `elsewhere` is { v, on } for it, for the command to say that it is there and to
    offer to render it here: data only. A time is read without the raw video or its captions on this Mac (piecesOf, `clock`). */
export function clockFor(found, part, ctx) {
  const pieces = piecesOf(found, part, ctx, [], null, { clock: true });
  if (pieces.old) return { why: `Reel ${part.reel} was cut as a clip before Reels had projects of their own, so a time on it cannot be read. Make this change by hand in Final Cut.` };
  if (pieces.why || pieces.coming) return pieces;
  const read = { ...pieces, words: spellWords(pieces.words, found.record.spellings) };
  if (part === "main" && keepsWhole(found.record)) return { ...read, clock: clockOfRanges(read.pieces), on: "the video" };
  const target = targetOf(found.record, part);
  const label = part === "main" ? "main" : `Reel ${part.reel}`;
  const listed = Array.isArray(target.pushed) ? target.pushed : [];
  const top = newestOf(listed.filter(shownHere(ctx)));
  const latest = newestOf(listed);
  const away = latest && latest.how === "render" && latest.on !== ctx.machine && (!top || newer(latest, top)) ? { elsewhere: { v: latest.v, on: latest.on } } : {};
  if (!top) return { ...read, clock: clockOfRanges(read.pieces), on: `${part === "main" ? "the main video" : label} as it is now`, ...away };
  const at = join(found.folder, top.file);
  if (!existsSync(at)) return { why: `${top.file} is not in the episode's folder.` };
  if (!ctx.isWhole(at)) return { coming: top.file, bring: [top.file] };
  return { ...read, clock: clockOf(readFileSync(at, "utf8")), on: `${label} v${top.v}`, ...away };
}
