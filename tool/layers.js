// What brimm-video lays over a timeline's picture (spec section 4): its running captions, a Reel's title on screen, the texts
// and graphics a person asked for, and the logo, each from the record, as the titles and pictures the Final Cut writer takes
// (fcpxml.js). Each is on a role of brimm-video's own, with the episode's short id in its name, so a later version can tell
// it from hand work (spec section 4, "Roles"; phase 5). Every time here is in seconds of the raw video.
// Nothing here touches a disk or runs a program.
import { relativeUrl } from "./fcpxml.js";
import { shortId } from "./names.js";
import { defaultPreset, captionLook, titleLook, placeOf, lookFor } from "./styles.js";
import { captionsFor } from "./captions.js";
import { spellWords } from "./spelling.js";
import { clockOfRanges, rawAt, timelineAt, lengthOf } from "./clock.js";

/** The roles, and the lanes above the picture each goes on. A higher lane is drawn on top, so words go above pictures:
    graphics, then the logo, then the captions, then the titles. */
export const ROLES = { captions: "BRIMM captions", titles: "BRIMM titles" };
/** What a push says of a title at the top of an upright video. */
export const TOP_BAND = "A title at the top of an upright video can cover a face: check it by eye in Final Cut.";
const LANES = { graphics: 2, logo: 3, captions: 4, titles: 5 };
/** How long a Reel's title shows from its start, in seconds (the research's D1). */
export const HOOK_SECONDS = 3;
/** A title too wide for its lines is drawn smaller, down to this share of its size, and past it left out (rule 8). */
const SMALLEST = 0.7;

/** The part's own entry in the record: the main video's, or a Reel's. */
export const targetOf = (record, part) => (part === "main" ? record.main : (record.reels || []).find((r) => r.n === part.reel));
/** The part's preset: the one picked, or its default. */
export const presetOf = (record, part) => targetOf(record, part).preset || defaultPreset(record.kind, part);

/** Words in at most two lines of `chars` characters each, split where the longer line is shortest: the lines, or null. */
function twoLines(text, chars) {
  if (text.length <= chars) return [text];
  const words = text.split(" ");
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    if (pair.every((l) => l.length <= chars) && (!best || Math.max(...pair.map((l) => l.length)) < Math.max(...best.map((l) => l.length)))) best = pair;
  }
  return best;
}

/** The second of the raw video `seconds` after `at` on the timeline, or the timeline's end. */
const rawAfter = (clock, at, seconds) => {
  const t = timelineAt(clock, at);
  if (t === null) return null;
  const end = Math.min(t + seconds, lengthOf(clock));
  return rawAt(clock, end);
};

/** The titles and pictures over one timeline: { titles, stills, told }. `record` is the episode's record; `part` is "main" or
    { reel: n }; `frame` is the timeline's size; `ranges` its kept pieces, in order; `words` the recording's words; `face`
    the stand-in face to draw in; `pictures` the size of each picture the record names, by its path in the episode's
    folder ("media/chart.png"); `video` is the raw video's { height, hdr }, for its look; `lookPresets` the looks' presets, as
    styles.js LOOK_PRESETS unless given (a test gives its own). Gives { titles, stills, look, told }, `look` as the Final Cut
    writer takes it, or null. */
export function layersFor({ record, part, frame, ranges, words, face, pictures = {}, video = { height: frame.height, hdr: false }, lookPresets }) {
  const target = targetOf(record, part);
  const preset = presetOf(record, part);
  const short = shortId(record.id);
  const clock = clockOfRanges(ranges);
  const titles = [];
  const stills = [];
  const told = [];
  const shadowed = (fontSize, shadow) => ({ font: face, fontSize, shadow });

  // The running captions: a Reel's unless they are turned off, and the main video's as its preset says.
  if (part === "main" || target.captions !== false) {
    const look = captionLook({ style: preset.captions, job: preset.job, frame, face });
    if (look.told) told.push(look.told);
    if (look.draws) {
      const made = captionsFor({ words: spellWords(words, record.spellings), ranges, look });
      told.push(...made.told);
      made.captions.forEach((c, i) => titles.push({ start: c.start, end: c.end, lane: LANES.captions, role: ROLES.captions, name: `brimm caption ${i + 1} ${short}`, lines: c.lines.map((text) => ({ text, ...shadowed(Math.round(look.fontSize * c.scale), look.shadow), alignment: look.alignment })), position: look.position }));
    }
  }

  // A Reel's title on screen, from its start, in the top band (rule 8: drawn smaller to fit two lines, or left out).
  let hookEnd = null;
  if (part !== "main" && String(target.title || "").trim() && ranges.length) {
    const look = titleLook("hook", { style: preset.captions, frame, face });
    if (look.told) told.push(look.told);
    const text = look.caps ? target.title.trim().toLocaleUpperCase("en") : target.title.trim();
    let scale = 1;
    let lines = twoLines(text, look.chars);
    while (!lines && scale > SMALLEST + 0.001) {
      scale = Math.round((scale - 0.05) * 100) / 100;
      lines = twoLines(text, Math.floor(look.chars / scale));
    }
    if (!lines) told.push(`No title on screen: "${target.title.trim()}" does not fit two lines, even at the smallest size. About ${Math.floor((look.chars / SMALLEST) * 2)} characters fit. Give a shorter one.`);
    else {
      if (scale < 1) told.push(`The title on screen is drawn at ${Math.round(scale * 100)}% of its size to fit two lines.`);
      const end = rawAfter(clock, ranges[0].start, HOOK_SECONDS);
      hookEnd = end;
      titles.push({ start: ranges[0].start, end, lane: LANES.titles, role: ROLES.titles, name: `brimm hook ${short}`, lines: lines.map((l, i) => ({ text: l, ...shadowed(Math.round(look.lines[i].fontSize * scale), look.lines[i].shadow), alignment: look.lines[i].alignment })), position: look.position });
    }
  }

  // The texts a person asked for: a name over a role. On a Reel, one asked for while its title on screen shows waits for it to
  // end: both sit in the top band.
  // One whose moment a cut took out is left out first, where it was asked for, as on the main video: it never waits.
  for (const asked of target.texts || []) {
    if (rawAfter(clock, asked.at, asked.for) === null) {
      told.push(`The name title ${asked.id} ("${asked.lines[0]}") is in what is cut now, so it is not shown.`);
      continue;
    }
    const text = hookEnd !== null && asked.at < hookEnd ? { ...asked, at: hookEnd } : asked;
    if (text !== asked) told.push(`The name title ${asked.id} starts once Reel ${part.reel}'s title on screen ends, ${HOOK_SECONDS} seconds in: both sit at the top.`);
    const end = rawAfter(clock, text.at, text.for);
    if (end === null) {
      told.push(`The name title ${text.id} ("${text.lines[0]}") is in what is cut now, so it is not shown.`);
      continue;
    }
    const look = titleLook("name", { style: preset.captions, frame, face });
    if (look.told && !told.includes(look.told)) told.push(look.told);
    const lines = text.lines.map((l, i) => ({ text: look.caps && i === 0 ? l.toLocaleUpperCase("en") : l, ...shadowed(look.lines[Math.min(i, 1)].fontSize, look.lines[Math.min(i, 1)].shadow), alignment: look.lines[Math.min(i, 1)].alignment }));
    titles.push({ start: text.at, end, lane: LANES.titles, role: ROLES.titles, name: `brimm text ${text.id} ${short}`, template: look.template, lines, position: look.position });
  }

  // The research's rule 3 leaves out a title in the top band that meets the face; brimm-video does not read where the face is
  // in each frame yet (phase 6), so it is said instead (ruling 1).
  if (frame.height > frame.width && titles.some((t) => t.role === ROLES.titles)) told.push(TOP_BAND);

  // The graphics, each a picture from the episode's media/.
  const corners = [];
  for (const graphic of target.graphics || []) {
    const end = rawAfter(clock, graphic.at, graphic.for);
    const size = pictures[graphic.picture];
    if (end === null) {
      told.push(`The graphic ${graphic.id} (${graphic.picture.replace(/^media\//, "")}) is in what is cut now, so it is not shown.`);
      continue;
    }
    if (!size) {
      told.push(`The graphic ${graphic.id}'s picture, ${graphic.picture}, cannot be read, so it is not shown.`);
      continue;
    }
    const place = placeOf(graphic.place, { frame, picture: size });
    stills.push({ start: graphic.at, end, lane: LANES.graphics, role: ROLES.titles, name: `brimm graphic ${graphic.id} ${short}`, src: relativeUrl(`../${graphic.picture}`), width: size.width, height: size.height, ...place });
    if (graphic.place === "corner") corners.push([graphic.at, end]);
  }

  // The logo, over the whole main video, out of the way of a picture in its corner. A Reel's comes with the brand templates
  // (spec section 3: a Reel gains "the look and the logo in phase 6").
  const logo = record.brand && record.brand.logo;
  if (part === "main" && target.logo && logo && ranges.length) {
    const size = pictures[logo];
    if (!size) told.push(`The logo's picture, ${logo}, cannot be read, so it is not shown.`);
    else {
      let from = ranges[0].start;
      const spans = [];
      for (const [a, b] of [...corners].sort((x, y) => x[0] - y[0])) {
        if (a > from) spans.push([from, a]);
        from = Math.max(from, b);
      }
      spans.push([from, ranges[ranges.length - 1].end]);
      const place = placeOf("logo", { frame, picture: size });
      for (const [a, b] of spans.filter(([a, b]) => b > a)) stills.push({ start: a, end: b, lane: LANES.logo, role: ROLES.titles, name: `brimm logo ${short}`, src: relativeUrl(`../${logo}`), width: size.width, height: size.height, ...place });
    }
  }
  // The look, on the whole picture: Final Cut's own colour preset, with its Mix (styles.js lookFor). A Reel's is recorded, and
  // comes with the brand templates (spec section 3).
  if (part !== "main") {
    if (preset.look !== "natural") told.push(`A Reel's look comes with the brand templates, later: ${preset.look} is recorded for Reel ${part.reel}.`);
    // An HDR recording is said on a Reel too: Final Cut converts its colours for the upright timeline (rule 7).
    if (video.hdr) told.push(lookFor({ look: "natural", height: video.height, hdr: true }).told);
    return { titles, stills, look: null, told };
  }
  const graded = lookFor({ look: preset.look, height: video.height, hdr: video.hdr }, lookPresets);
  if (graded.told) told.push(graded.told);
  return { titles, stills, look: graded.effect, told };
}
