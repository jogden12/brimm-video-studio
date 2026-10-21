// How words and pictures look on a timeline until The BRIMM's own templates exist (spec section 4, "What brimm-video writes
// for Final Cut"; phase 6 makes the templates). It holds the three lists a preset is picked from (the job, the caption
// style and the look, docs/research/2026-10-13-video-presets/presets.md, Part 2), the stand-in typeface, the look of the
// running captions and of the titles in a wide or an upright frame, and where a picture goes. Final Cut's built-in titles
// are used, and every one names its font and size: a built-in title given words only comes back Helvetica 6 (phase 0, B1).
// Every size and place here is the research's starting value, or a guess where it says so, to be judged by eye.
// Nothing here touches a disk or runs a program.

/** The jobs: what a video is and where it goes, with the caption style and look it takes unless others are picked. Each is
    kept in the record by its id, as the spec's record has them ("full-episode"), and named to a person with spaces. */
export const JOBS = {
  "full-episode": { says: "The whole show, wide. Calm cuts, no captions drawn on the picture", goes: ["YouTube"], captions: "file-only", look: "natural" },
  "solo-clip": { says: "A short upright clip of Sallie alone", goes: ["Reels", "Shorts", "Stories", "LinkedIn"], captions: "plain", look: "natural" },
  "interview-clip": { says: "A short upright clip cut from an interview", goes: ["Reels", "Shorts", "LinkedIn"], captions: "plain", look: "natural" },
  "teaching-clip": { says: "An upright clip of a framework or a list", goes: ["Reels", "Shorts", "LinkedIn"], captions: "plain", look: "natural" },
  "as-filmed": { says: "A quick thought, trimmed. Nothing added but captions", goes: ["Stories", "LinkedIn"], captions: "plain", look: "natural" }
};
/** The caption styles: how words in the picture look. */
export const CAPTION_STYLES = {
  "file-only": "No words drawn. The caption file only",
  plain: "Small white words, two to four at a time, soft shadow",
  boxed: "The same words in navy on a mist box",
  bold: "Big white capitals, two to four words on two lines",
  signature: "The brand's headline: spaced capitals on a navy block"
};
/** The looks: the colour of the picture, applied as Final Cut's own Color Grading Preset with its Mix, written as Final Cut
    writes one (LOOK_PRESETS, from by-hand checks 2 and 2b). */
export const LOOKS = {
  natural: "No change",
  bright: "A little lighter, softer in contrast",
  warm: "A touch warmer, slightly darker corners",
  moody: "A little darker, warmer and less colourful. It goes against the brand guide"
};

/** A job's, a caption style's or a look's name for a person: its id with spaces ("full episode"). */
export const nameOf = (id) => String(id).replace(/-/g, " ");
/** The id of what a person names, either way: "Full episode" and "full-episode" are both "full-episode". */
export const idOf = (said) => String(said ?? "").trim().toLowerCase().replace(/\s+/g, "-");

/** The preset a timeline has until one is picked: a wide episode's main video is the full episode; a short video's is as
    filmed; a Reel is a solo clip. Each with its job's own caption style and look. */
export function defaultPreset(kind, part) {
  const job = part !== "main" ? "solo-clip" : kind === "short video" ? "as-filmed" : "full-episode";
  return { job, captions: JOBS[job].captions, look: JOBS[job].look };
}

/** What is wrong with a preset, in plain words: "" when each of its three is one of its list's. */
export function presetFault(preset) {
  const named = (list, what, value) => (value in list ? "" : `"${nameOf(value)}" is not a ${what}. The ${what}s are: ${Object.keys(list).map(nameOf).join(", ")}.`);
  return named(JOBS, "job", preset.job) || named(CAPTION_STYLES, "caption style", preset.captions) || named(LOOKS, "look", preset.look);
}

/** The stand-in typefaces, in the order they are tried until the brand's own are bought: Varela, then Lucida Grande, which is
    on every Mac (spec section 4). `cap` is how tall a capital is, as a share of the font size: Varela's by the brand guide's
    PDF record, Lucida Grande's a guess. `fits` is how many characters of sentence case fit a line where Sweet Sans Pro fits
    18 (the research's count for Plain, upright), by each face's width against it. */
export const FACES = {
  Varela: { file: /^Varela-Regular\.(ttf|otf)$/i, cap: 0.698, width: 0.93 },
  "Lucida Grande": { file: /^LucidaGrande\.ttc$/i, cap: 0.716, width: 0.92 }
};

/** The face to draw in, of the files in this Mac's font folders (their names): Varela when its file is there, and otherwise
    Lucida Grande, with what the person is told then. The Mac does not say when a face is missing: Final Cut draws another
    without a word, so the files are looked for. */
export function faceOnThisMac(names) {
  if (names.some((n) => FACES.Varela.file.test(n))) return { face: "Varela", told: "" };
  return { face: "Lucida Grande", told: "Varela is not installed on this Mac, so the words are in Lucida Grande. Jason installs Varela with Font Book." };
}

/** Is a frame upright? */
const upright = (frame) => frame.height > frame.width;
/** The frame Final Cut draws a title's font size in: one of 1080 lines, scaled to the frame's own height (by-hand check 1, on
    2026-10-21: the same size drew capitals 1.78 times as tall in an upright 1920-line frame, and two thirds as tall at 720). */
const SIZE_LINES = 1080;
/** The font size that gives capitals of `share` of the frame's height, in the face, whatever the frame's height. */
const sizeFor = (share, face) => Math.round((share * SIZE_LINES) / FACES[face].cap);
/** How much taller than its font size a line is, a guess for both faces. */
const LINE_STEP = 1.2;
/** A title's move, so that its lines' lowest edge is `edge` of the frame's height down: Final Cut's position, "x y", in
    hundredths of the frame's height from its middle, with y up (phase 0, B1). A Basic Title's lines sit around the middle,
    their height as a share of the frame's that of their size in its 1080 lines. */
const placed = (edge, lines, fontSize, frame, x = 0) => {
  const middle = edge - (lines * fontSize * LINE_STEP) / 2 / SIZE_LINES;
  return `${round(x)} ${round((0.5 - middle) * 100)}`;
};
const round = (n) => Math.round(n * 100) / 100 || 0;
/** The soft shadow of Plain and Bold: black at 65%, blurred half a percent of the frame's height, with no offset. */
const shadowFor = (frame) => ({ color: "0 0 0 0.65", blur: Math.round(0.005 * frame.height) });

/** How the running captions of a timeline look, for its preset's caption style and job, in its frame and face:
    { draws: false, told } when none are drawn, or { draws: true, caps, lines, most, chars, fontSize, shadow, position,
    told }, where `most` is the words a caption holds at most and `chars` the characters a line holds. Three of the
    research's rules are applied here, and each is told:
    - a wide full episode goes to YouTube with its caption file, so no running captions are drawn into it (rule 9);
    - "file only" on a timeline that goes where no caption file is taken draws Plain (rule 2);
    - Boxed's mist box is Final Cut's own Subtitle title, whose settings an export made by hand will give (not yet asked
      for): until then Boxed's captions are Plain. Signature's running captions are Plain words that fade in line by line,
      and no fade is written yet: they are Plain without it (the research, T1). Bold is drawn in its capitals, without the
      box on its stressed word (that needs a template). */
export function captionLook({ style, job, frame, face }) {
  const wide = !upright(frame);
  if (wide && job === "full-episode") return { draws: false, told: style === "file-only" ? "" : `${capitalOf(nameOf(style))} was picked, but a full episode goes to YouTube with its caption file, so no captions are drawn into the picture.` };
  let told = "";
  let drawn = style;
  if (style === "file-only") {
    drawn = "plain";
    told = "File only was picked, but this goes where no caption file is taken, so Plain captions are drawn.";
  } else if (style === "boxed") {
    drawn = "plain";
    told = "Boxed's box is not drawn yet, so Plain captions are drawn.";
  } else if (style === "signature") {
    drawn = "plain";
    told = "Signature's captions fade in line by line, which is not drawn yet, so they are drawn Plain, without the fade.";
  }
  const bold = drawn === "bold";
  const share = bold ? (wide ? 0.045 : 0.035) : wide ? 0.033 : 0.025;
  const fontSize = sizeFor(share, face);
  const lines = bold && !wide ? 2 : 1;
  // How many characters a line holds. Wide, the research stores a caption standard's count, not a fit: 42 for Plain, 20 for
  // Bold. Upright it is a fit: Sweet Sans Pro's 18 for Plain and 9 capitals for Bold, by the face's width against it.
  const chars = wide ? (bold ? 20 : 42) : Math.floor((bold ? 9 : 18) / FACES[face].width);
  return { draws: true, caps: bold, lines, most: wide && !bold ? 8 : bold && wide ? 3 : 4, chars, fontSize, shadow: shadowFor(frame), alignment: "center", position: placed(wide ? 0.9 : 0.65, lines, fontSize, frame), told };
}

const capitalOf = (words) => words[0].toUpperCase() + words.slice(1);

/** How a title looks, by its kind, for the caption style, in the frame and face. Every title is white with the soft shadow,
    and its style's case (Bold's in capitals). Boxed's box and Signature's navy block behind a title are not drawn yet: such a
    title is drawn Plain, and `told` says so.
    - "hook": a Reel's title on screen, in the top band (15% to 30% down when upright, 8% to 25% when wide), capitals 3.5% of
      the height upright and 4.5% wide, two lines at most;
    - "name": a name over a role. Upright, in the top band, as a Basic Title of two lines, capitals 2.5% and 1.9%; wide, on
      Final Cut's Basic Lower Third, at its own place and alignment, capitals 3.3% and 2.5% (by-hand check 1).
    Gives { template, caps, lines: [{ fontSize, shadow }], chars, position, told }: `chars` is what a hook's line holds. */
export function titleLook(kind, { style, frame, face }) {
  const wide = !upright(frame);
  const caps = style === "bold";
  const shadow = shadowFor(frame);
  const told = style === "boxed" ? "Boxed's box behind a title is not drawn yet, so titles are drawn Plain." : style === "signature" ? "Signature's navy block behind a title is not drawn yet, so titles are drawn Plain." : "";
  if (kind === "hook") {
    const fontSize = sizeFor(wide ? 0.045 : 0.035, face);
    const band = wide ? [0.08, 0.25] : [0.15, 0.3];
    const chars = Math.floor((caps ? 10 : 13) / FACES[face].width);
    return { template: "title", caps, lines: [{ fontSize, shadow, alignment: "center" }, { fontSize, shadow, alignment: "center" }], chars, position: `0 ${round((0.5 - (band[0] + band[1]) / 2) * 100)}`, told };
  }
  const [name, role] = wide ? [0.033, 0.025] : [0.025, 0.019];
  // The Basic Lower Third places its lines at the left by its own params (phase 0, B1's export): its lines name no alignment,
  // so none of them is centred off the frame's edge. A Basic Title's lines are centred.
  const lines = [{ fontSize: sizeFor(name, face), shadow }, { fontSize: sizeFor(role, face), shadow }];
  if (wide) return { template: "lower-third", caps, lines, position: "0 0", told };
  return { template: "title", caps, lines: lines.map((l) => ({ ...l, alignment: "center" })), position: `0 ${round((0.5 - 0.225) * 100)}`, told };
}

/** Where a picture goes, and how big, by its place: Final Cut's { position, scale, fill } for a still. Final Cut fits a still
    into the frame unless told to fill it (by-hand check 3), so a scale is of the fitted picture.
    - "full" fills the frame: a picture of another shape loses its edges;
    - "corner": a quarter of the frame (half its width and height, as fitted), in the brand kit's corner, top right, and
      upright below the top band, where a Reel's title and a name title sit;
    - "lower": the lower third, fitted into a box 60% of the frame's width and 20% of its height, its lowest edge 85% down
      when wide, and 60% when upright, above the captions (a guess);
    - "logo": the brand kit's logo, top right: 15% of the width, its top edge 15% down and 6% in from the side upright; 8%,
      5% and 3% wide (the research's K3).
    `picture` is its size in pixels. */
export function placeOf(place, { frame, picture }) {
  const fit = Math.min(frame.width / picture.width, frame.height / picture.height);
  const shown = { width: picture.width * fit, height: picture.height * fit };
  const at = (x, y) => `${round((x / frame.height) * 100)} ${round((y / frame.height) * 100)}`;
  if (place === "full") return { position: "0 0", scale: 1, fill: true };
  if (place === "lower") {
    const box = { width: 0.6 * frame.width, height: 0.2 * frame.height };
    const scale = Math.min(box.width / shown.width, box.height / shown.height);
    const bottom = (upright(frame) ? 0.6 : 0.85) * frame.height;
    return { position: at(0, frame.height / 2 - (bottom - (shown.height * scale) / 2)), scale: round3(scale), fill: false };
  }
  // Upright, a corner picture starts below the top band (15% to 30% down), where a Reel's title and a name title sit.
  const corner = place === "logo" ? (upright(frame) ? { width: 0.15, top: 0.15, side: 0.06 } : { width: 0.08, top: 0.05, side: 0.03 }) : { width: 0.5, top: upright(frame) ? 0.31 : 0.05, side: upright(frame) ? 0.06 : 0.03 };
  const scale = place === "logo" ? (corner.width * frame.width) / shown.width : 0.5;
  const w = shown.width * scale;
  const h = shown.height * scale;
  const x = frame.width / 2 - corner.side * frame.width - w / 2;
  const y = frame.height / 2 - (corner.top * frame.height + h / 2);
  return { position: at(x, y), scale: round3(scale), fill: false };
}
const round3 = (n) => Math.round(n * 1000) / 1000;

/** Final Cut's effect Color Adjustments, as it wrote one in each of Jason's three exports of phase 4's by-hand check 2: its
    plug-in's data, and the two params it set the same in all three. It wrote two long params besides, which are left out:
    each one's own words give its value as its default. */
const COLOR_ADJUSTMENTS = { name: "Color Adjustments", uid: "FxPlug:7E2022A5-202B-4EEB-A311-AC2B585D01B0", data: [{ key: "effectConfig", value: "YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGlCwwVFhdVJG51bGzTDQ4PEBIUV05TLmtleXNaTlMub2JqZWN0c1YkY2xhc3OhEYACoROAA4AEXXBsdWdpblZlcnNpb24QA9IYGRobWiRjbGFzc25hbWVYJGNsYXNzZXNfEBNOU011dGFibGVEaWN0aW9uYXJ5oxocHVxOU0RpY3Rpb25hcnlYTlNPYmplY3QIERokKTI3SUxRU1lfZm55gIKEhoiKmJqfqrPJzdoAAAAAAAABAQAAAAAAAAAeAAAAAAAAAAAAAAAAAAAA4w==" }] };
const SET_FIRST = [["Control Range", 19, "0 (SDR)"], ["trigger Enhance", 18, 6]];
/** Its sliders, in the order Final Cut writes them, each with its key. */
const SLIDERS = [["Exposure", 3], ["Contrast", 17], ["Brightness", 2], ["Highlights", 7], ["Black Point", 1], ["Shadows", 4], ["Super Highlights", 25], ["Saturation", 16], ["Highlights Warmth", 10], ["Highlights Tint", 11], ["Midtones Warmth", 12], ["Midtones Tint", 13], ["Shadows Warmth", 14], ["Shadows Tint", 15]];
/** A preset as Final Cut writes it: Color Adjustments with the preset's value for each slider, given in SLIDERS' order, and
    the key of its Mix. */
const adjusted = (...values) => ({ ...COLOR_ADJUSTMENTS, mixKey: "99990", params: [...SET_FIRST, ...SLIDERS.map(([name, key], i) => [name, key, values[i]])].map(([name, key, value]) => ({ name, key: String(key), value: String(value) })) });

/** Final Cut's own colour preset for each look with a recipe, as Final Cut writes it in an export, read off Jason's export of
    each by phase 4's by-hand check 2: Final Cut writes a Color Grading Preset as Color Adjustments set to the preset's
    settings, with its Mix. A look with no entry here is recorded, and not applied yet. */
export const LOOK_PRESETS = {
  bright: adjusted(-95, 49, -36, 0, 82, -28, 0, 53, -35, -32, 47, 27, -54, -39),
  warm: adjusted(-76, -54, 0, 18, 0, -73, 0, 29, 63, 36, -16, -8, -39, -27),
  moody: adjusted(-37, 33, -43, -100, -29, -21, 0, -27, 49, 5, 100, 26, -6, -7)
};
/** Each look's preset and its Mix at full strength (the research's E4: the names were read in Final Cut's folders). */
export const LOOK_MIX = { bright: ["Clean Whites with Lifted Blacks", 0.25], warm: ["Warm Dusk with Low Contrast", 0.25], moody: ["Warmer Vintage with Dark Blacks", 0.5] };

/** The look on a timeline, as the Final Cut writer takes it: { effect, told }, `effect` null when nothing is applied.
    Natural changes nothing. Rule 7: an HDR recording gets no look, and is said, Natural too. Rule 6: under 1080 lines a look is applied at 75%, and
    under 720 at 50%. A look whose preset is not known yet (LOOK_PRESETS) is recorded only, and said. A preset's data and
    settings, where it has them, come before its Mix. `presets` is the table, for a test to give another. */
export function lookFor({ look, height, hdr }, presets = LOOK_PRESETS) {
  const named = capitalOf(look);
  if (hdr) return { effect: null, told: `This recording is HDR: Final Cut converts its colours for the timeline, and how well is not yet checked.${look === "natural" ? "" : ` ${named} was not applied: its colours are made for ordinary video.`}` };
  if (look === "natural") return { effect: null, told: "" };
  const known = presets[look];
  if (!known) return { effect: null, told: `${named} is recorded. Final Cut's colour preset for it is applied once Jason has checked how Final Cut takes one.` };
  const share = height < 720 ? 0.5 : height < 1080 ? 0.75 : 1;
  const mix = Math.round(LOOK_MIX[look][1] * share * 1000) / 1000;
  return { effect: { name: known.name, uid: known.uid, data: known.data ?? [], params: [...(known.params ?? []), { name: "Mix", key: known.mixKey, value: String(mix) }] }, told: share < 1 ? `${named} was applied at ${share * 100}% strength: the recording has ${height} lines.` : "" };
}
