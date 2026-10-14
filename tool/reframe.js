// Turning a wide video into a vertical one for Instagram Reels, and cutting short clips from it for Reels and Stories: where the
// crop goes, how long a clip may be, what the files are called, and what ffmpeg is asked to do.
// Nothing here touches a disk or runs a program, so all of it is tested without a video.
//
// What it can do: give each kept range of the video one fixed crop, placed on the speaker's face. That suits one speaker who
// stays seated.
// What it cannot do: it does not follow a speaker who moves inside a range, and with two people in the picture it does not
// know who is talking. It takes the larger face.
import { join } from "node:path";
import { QUALITY, encodeArgs, framesASecond } from "./cuts.js";

/** How far apart the stills are, in seconds, when nothing else is asked for. */
const EVERY = 2;

/** Write a still every `every` seconds, 640 pixels wide, as 0001.jpg, 0002.jpg and so on: what faces.swift looks for faces in.
    A still's time is its number times `every`. Tried on ffmpeg 9: with round=down, still 3 of a still every 2 seconds is the
    last frame before 6 seconds. Without it, it is the last frame before 5. */
export const stillsArgs = (video, folder, every = EVERY) => ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-an", "-vf", `fps=1/${every}:round=down,scale=640:-2`, "-q:v", "4", join(folder, "%04d.jpg")];

/** Does a video need a new shape for a Reel? Only a picture wider than it is tall. A vertical or square one is left as it is. */
export const needsReframe = (facts) => facts.width > facts.height;

/** The crop that makes a 9:16 picture of a wide one, as {x, y, w, h, found} in whole pixels of the source: its full height, and
    9/16 of that wide, rounded down to an even number. `facts` is the picture's {width, height} as it is shown, after any
    turning. `boxes` holds, for each still of the stretch, the list of face boxes found in it, each box {x, y, w, h} in
    fractions of the picture.
    The speaker is taken to be the largest face in a still, and the crop is placed with the speaker's face in its middle, side
    to side, as far as the picture's edges allow. Of all the stills it goes by the one in the middle, so one odd still does not
    move it. With an even number of them that is the lower of the two in the middle: a place a face was, and never the gap
    between two people. With no face found it is the middle of the picture, and `found` is false. */
export function cropFor(facts, boxes) {
  const w = Math.floor(facts.height * 9 / 32) * 2;
  const middles = boxes.filter((faces) => faces.length).map((faces) => {
    const speaker = faces.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    return speaker.x + speaker.w / 2;
  }).sort((a, b) => a - b);
  const found = middles.length > 0;
  const middle = found ? middles[Math.ceil(middles.length / 2) - 1] : 0.5;
  const x = Math.max(0, Math.min(facts.width - w, Math.round(middle * facts.width - w / 2)));
  return { x, y: 0, w, h: facts.height, found };
}

/** One fixed crop for each kept range of a video, each range a {start, end} in seconds. `stills` is what faces.swift printed
    for the stills of the whole video. A range's crop is placed by the stills whose time falls in it. A still shows the last
    frame before its time, so the still at a range's end counts for it and the one at its start does not. A range no face was
    found in takes the crop of the whole video's faces, which is the middle of the picture when there are none. Its `found` is
    false all the same: `found` says whether a face was found in the range itself, so a crop that is a guess can be told. */
export function cropsFor(facts, ranges, stills, every = EVERY) {
  const timed = stills.map((still) => ({ at: parseInt(still.file, 10) * every, faces: still.faces }));
  const whole = cropFor(facts, timed.map((still) => still.faces));
  return ranges.map((range) => {
    const own = cropFor(facts, timed.filter((still) => still.at > range.start && still.at <= range.end).map((still) => still.faces));
    return own.found ? own : { ...whole, found: false };
  });
}

/** The size of a Reel and of a Story, in pixels. */
const WIDTH = 1080;
const HEIGHT = 1920;

/** The quality an upright file is written at: QUALITY, and 2 more for each doubling of the crop's height to 1920. An enlarged
    picture has no more detail than its source, and at QUALITY x264 spends its bits keeping the enlarged grain and blocks of
    the source. Tried on ffmpeg 9 with a made-up 640x360 recording like a Zoom one, at 0.67 Mbit: the crop, 202x360 made
    1080x1920, came out at 1.43 Mbit at 23 and 0.63 at 28. Against the same crop enlarged without loss, its SSIM was 0.995 and
    0.994, and the two looked the same. 2160 lines and more are not enlarged: 23. 1080 lines are 25, 720 are 26, 360 are 28.
    A video that keeps its shape is not cropped, and is taken as not enlarged. */
export const uprightQuality = (crops) => {
  const enlarged = crops && crops.length ? HEIGHT / crops[0].h : 1;
  return enlarged > 1 ? Math.round(QUALITY + 2 * Math.log2(enlarged)) : QUALITY;
};

/** A time as it is written for ffmpeg: to the thousandth of a second, and never before 0. A computer's sums leave 0.1 + 0.2 -
    0.3 a hair off 0, JavaScript writes that as 5.551115123125783e-17, and ffmpeg cannot read it. */
const timeOf = (seconds) => Math.max(0, Math.round(seconds * 1000) / 1000);

/** Make the vertical video in one pass. The picture and the sound are each split once, at the times the kept ranges start and
    end, into pieces in time order. The gaps are thrown away, each kept range is cropped with its own crop, and the kept ones
    are joined with their sound and made 1080 by 1920. It is written as encodeArgs says, at the quality uprightQuality gives for
    the crops. Given no `crops`, for a video that needs no new shape, nothing is cropped and the picture is fitted inside
    1080 by 1920 without stretching it, to an even number of pixels each way.
    The ranges must be in rising order and must not overlap, though one may start where the one before it ends, and each must
    end after it starts. Any other list is refused: it throws an error that says which range. A later moment put first would
    have every frame before it wait in memory for its turn: tried on ffmpeg 9, two 50-second ranges took 2.7 GB with the later
    one first, and 240 MB in order. The crops must all be one size, as cropFor's are for one video, because the picture is
    scaled once, after the join.
    Why one split, and not a cut of the whole video for each range: then every frame goes down every branch, and each branch
    keeps a scaler of its own. Tried on ffmpeg 9 with a three-minute video, 300 ranges took 154 seconds and 2 GB that way. This
    way they take 8 seconds and 240 MB, as one range does, and the frames and the sound come out the same, sample for sample.
    One difference was found: when the sound starts later than the picture, the sound is cut on the edge of one of its own
    frames, which is up to about a fiftieth of a second after the time asked for.
    A crop is a hair narrower than 9:16, and setsar says the pixels are square all the same: without it the file asks to be
    shown a few pixels narrower than it is. The video must have sound: ffmpeg stops at one that has none.
    The file is told it is an mp4, so it can be written under another name and given its own when it is whole. */
export function verticalArgs({ video, ranges, crops, out }) {
  // The pieces the video is split into, in time order: for each one the number of the range it keeps, or -1 for a gap that is
  // thrown away. `points` are the times it is split at.
  const pieces = [];
  const points = [];
  let at = 0;
  ranges.forEach((range, i) => {
    const [start, end] = [timeOf(range.start), timeOf(range.end)];
    if (!(end > start && end < Infinity)) throw new Error(`A range must end after it starts, at times in seconds: this one runs from ${range.start} to ${range.end}.`);
    if (start < at) throw new Error(`The ranges must be in rising order and must not overlap: the one from ${range.start} to ${range.end} starts before the one before it ends.`);
    if (start > at) {
      pieces.push(-1);
      points.push(start);
    }
    pieces.push(i);
    points.push(end);
    at = end;
  });
  // What is left of the video after the last range.
  pieces.push(-1);
  const split = (kind, filter) => `[0:${kind}]${filter}=timestamps=${points.join("|")}${pieces.map((kept, j) => `[p${kind}${j}]`).join("")}`;
  const each = pieces.map((kept, j) => {
    if (kept < 0) return `[pv${j}]nullsink;[pa${j}]anullsink`;
    const crop = crops ? `,crop=${crops[kept].w}:${crops[kept].h}:${crops[kept].x}:${crops[kept].y}` : "";
    return `[pv${j}]setpts=PTS-STARTPTS${crop}[v${kept}];[pa${j}]asetpts=PTS-STARTPTS[a${kept}]`;
  });
  const joined = `${ranges.map((range, i) => `[v${i}][a${i}]`).join("")}concat=n=${ranges.length}:v=1:a=1[j][a]`;
  const sized = `[j]scale=${WIDTH}:${HEIGHT}${crops ? "" : ":force_original_aspect_ratio=decrease:force_divisible_by=2"},setsar=1[v]`;
  const graph = [split("v", "segment"), split("a", "asegment"), ...each, joined, sized].join(";");
  return ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-filter_complex", graph, "-map", "[v]", "-map", "[a]", ...encodeArgs(uprightQuality(crops)), "-f", "mp4", out];
}

/** Cut one short clip out of the video, the same way: with its crop, or with none for a video that needs no new shape. A clip
    is one range, and one that does not end after it starts is refused as a range is. */
export const clipArgs = ({ video, start, end, crop, out }) => verticalArgs({ video, ranges: [{ start, end }], crops: crop ? [crop] : null, out });

/** How long a clip may be, in seconds: a Reel clip is 15 to 90, and a part of a Story is at most 60. These are Instagram's
    limits as they were understood in October 2026. Instagram changes them, so check them before relying on these. */
export const REEL_MIN = 15;
export const REEL_MAX = 90;
export const STORY_MAX = 60;
/** How long before the 60 second mark a pause may be and still be where a Story is cut. */
const STORY_REACH = 15;

/** A clip's length in seconds, to the thousandth: a computer's sums leave 75.1 - 60.1 a hair under 15. */
const lengthOf = (clip) => Math.round((clip.end - clip.start) * 1000) / 1000;

/** Does a clip fit a Reel? {fits, why}: `why` says in plain words why it does not, and is empty when it does. A clip whose
    start or end is missing, is not a number, or is never reached has no length to go by, and does not fit. */
export function fitReel(clip) {
  const length = lengthOf(clip);
  const long = `It is ${length} second${length === 1 ? "" : "s"} long`;
  if (!Number.isFinite(length)) return { fits: false, why: "Its start or its end is not a time in seconds." };
  if (length <= 0) return { fits: false, why: "It has no length: it ends where it starts, or before." };
  if (length < REEL_MIN) return { fits: false, why: `${long}, and a Reel clip is at least ${REEL_MIN} seconds.` };
  if (length > REEL_MAX) return { fits: false, why: `${long}, and a Reel clip is at most ${REEL_MAX} seconds.` };
  return { fits: true, why: "" };
}

/** A clip as the parts of a Story, each a {start, end} of at most 60 seconds. A clip of 60 seconds or less is one part, as it
    is. A longer one is cut on the last pause edge before the 60 second mark: where the last pause ends, or where one that
    runs over the mark starts. `pauses` are [start, end] pairs in seconds. With no pause edge in the 15 seconds before the mark
    it is cut exactly at the mark. Each part's 60 seconds are counted from where the part before it was cut. A clip that never
    ends is one part, as it is: a silence that never ends has the end Infinity, and no number of cuts gets there. */
export function storyParts(clip, pauses) {
  if (!Number.isFinite(lengthOf(clip))) return [{ start: clip.start, end: clip.end }];
  const edges = pauses.flat();
  const parts = [];
  let from = clip.start;
  while (lengthOf({ start: from, end: clip.end }) > STORY_MAX) {
    const mark = from + STORY_MAX;
    const near = edges.filter((edge) => edge >= mark - STORY_REACH && edge <= mark);
    const cut = near.length ? Math.max(...near) : mark;
    parts.push({ start: from, end: cut });
    from = cut;
  }
  parts.push({ start: from, end: clip.end });
  return parts;
}

/** Where to cut a finished Reel into the parts of a Story, each {start, end} in seconds of the Reel, at most 60 seconds long
    (spec section 5, step 6). A part ends at the last pause edge (where a pause starts or ends) in the 15 seconds before its
    60 second mark. When no pause is heard there, as when music plays under the voice, it ends in the middle of the widest
    gap between two words there. With neither, it ends at the mark. `words` null, as the word pass gives when it dies, is
    no words. A cut is made only where a word starts after it, so no part is silence alone. Every cut is moved back to the
    start of the picture it falls in, `fps` being the frame rate as ffprobe gives it, so a part cut on whole pictures is
    never longer than 60 seconds. A Reel of 60 seconds or less is one part. `pauses` are [start, end] pairs and `words` {w, start, end}, both on the Reel's own clock. */
export function storyCuts(length, { pauses = [], words = [], fps = "" } = {}) {
  // The word pass gives no words when it dies: there are then no gaps between words to go by.
  words = Array.isArray(words) ? words : [];
  const rate = framesASecond(fps);
  const onPicture = (t) => (rate ? Math.floor(t * rate + 1e-6) / rate : t);
  const lastWord = words.length ? Math.max(...words.map((w) => w.start)) : Infinity;
  const parts = [];
  let from = 0;
  while (length - from > STORY_MAX) {
    const mark = from + STORY_MAX;
    const usable = (t) => t > from && t >= mark - STORY_REACH && t <= mark && t <= lastWord;
    const edges = pauses.flat().filter(usable);
    const gaps = words.slice(1).map((w, i) => ({ at: (words[i].end + w.start) / 2, wide: w.start - words[i].end })).filter((g) => g.wide > 0 && usable(g.at));
    const widest = gaps.reduce((best, g) => (!best || g.wide > best.wide ? g : best), null);
    const cut = onPicture(edges.length ? Math.max(...edges) : widest ? widest.at : mark);
    parts.push({ start: from, end: cut });
    from = cut;
  }
  parts.push({ start: from, end: length });
  return parts;
}

/** The file names of the clips cut from a video, for each clip a {reel, story}. `reel` is "<name>.reel-1.mp4", whether or not
    the clip fits a Reel: fitReel says that. `story` is a name for each part of its Story: "<name>.story-1.mp4" for one that is
    not cut, and "<name>.story-1-part-2.mp4" for the second part of one that is. `name` is the video's name without its ending.
    The parts are counted as storyParts cuts them, so it is given the same pauses. */
export const clipNames = (name, clips, pauses = []) => clips.map((clip, i) => {
  const parts = storyParts(clip, pauses);
  return { reel: `${name}.reel-${i + 1}.mp4`, story: parts.map((part, j) => `${name}.story-${i + 1}${parts.length > 1 ? `-part-${j + 1}` : ""}.mp4`) };
});
