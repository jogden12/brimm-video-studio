// The working copy of a raw video: the video HyperFrames is given to edit (spec 2026-10-27, "the architecture", section 5.7). The
// recording as it was filed may be 4K, HDR, of a frame rate that wanders, or stored on its side. The app wants an ordinary video it
// can seek in at once, so the tool makes one: the longer side at most 1920, H.264 High at 8 bits, tagged BT.709, a constant frame
// rate, and AAC at 48 kHz. It has the raw video's own length and clock and is cut nowhere, so every time the tool and Claude have
// given for the recording is a time in the working copy. An HDR video (an iPhone records HDR by default) is made standard colour
// by the Mac's own hardware, VideoToolbox, because the ffmpeg on the Mac Studio has no zscale to tone-map it with in software.
//
// Two layers. The first is pure: from what ffprobe printed (and a switch for 4K) it decides the ffmpeg arguments, the words said
// when a video cannot be used, the key of the copy and where it goes. The second is the job, which has ffmpeg make the copy under
// the watchdog in the run's own folder and puts it in place only when it is whole. Everything the job touches is passed in, so no
// test runs ffmpeg or ffprobe.
//
// Where it goes: <episode folder>/working copy/<key>.mp4 in BRIMM Video Work, on this Mac's own disk and never in Dropbox, with
// <key>.json beside it, which holds its facts. The project's writer (project.js) renames the finished video into a project's
// media/recording.mp4, which is why the copy is made on the same disk as the project and is whole when it first appears there.
// The command that starts the job (`workcopy`, a detached run's alone) is wired in edit.js, not here.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { colourOf, encodeArgs, factsOf, framesASecond, probeArgs, streamsOf } from "./cuts.js";
import { runningCommand, startDetached } from "./detached.js";
import { runGuarded } from "./guard.js";
import { sizeText } from "./kinds.js";
import { noProgress } from "./progress.js";
import { STILL_EVERY } from "./reframe.js";
import { lastLine, runProgram } from "./run.js";
import { episodeWork, runsFolder } from "./settings.js";

const list = (v) => (Array.isArray(v) ? v : []);
const GB = 1024 ** 3;

// --- What is said: the one step of the work, and the two ways it ends ---

/** The step of the work, as the progress panel says it. The job has this one only: the run is the copy being made. */
export const WORK_COPY_STEP = "Making the video for HyperFrames";
export const WORK_COPY_STEPS = [WORK_COPY_STEP];
/** The second step of a Reel's copy (architecture 4.3, plan PR 5): once the video is in place, the faces are looked for in it, to be
    offered to the app for the upright crop. A copy that is given no finder has the first step alone. */
export const FACES_STEP = "Finding the faces";
export const REEL_COPY_STEPS = [WORK_COPY_STEP, FACES_STEP];
/** The step the progress panel shows while the run waits, before it makes the copy, for the import to have checked its copies of the
    video (edit.js workcopy): "how far is it?" says it. It is no step of the work, so it is not among WORK_COPY_STEPS: it is of any
    length, and the panel never measures it. */
export const WORK_COPY_WAIT_STEP = "Waiting for the import to check its copies";
/** What is said when the copy is made. */
export const WORK_COPY_DONE = "Done";

/** What is said when a video cannot be made into a working copy, from the reason in plain words. Nothing a person reads here holds
    a path, a flag or the name of a program: the reasons say what is wrong with the video or with this Mac, and the log says the
    rest. */
export const canNotBeUsed = (reason) => `It can't be used: ${reason}.`;

/** What was done to the video that the person who edits it may want to know, each as a part of the list of what was made: "its
    speed made steady at 30 pictures a second" for a video whose pictures came at uneven times (`steady` false, as rateOf says),
    and "its HDR colours made standard". A steady video of standard colour has none. */
export function workCopyNotes({ steady, rate, hdr }) {
  const perSecond = Math.round(framesASecond(rate) * 100) / 100;
  return [...(steady === false ? [`its speed made steady at ${perSecond} pictures a second`] : []), ...(hdr ? ["its HDR colours made standard"] : [])];
}

// --- How the working copy is written ---

/** The quality the working copy is written at, and how fast. A working copy is made to be edited, and the app writes its export
    from it, so its picture is written once more after this: at x264's 18, which the eye can hardly tell from lossless at 8 bits,
    little is lost to that second pass. And it is a copy to be thrown away, so it is written with `veryfast`, which x264 runs
    several times quicker than the rough cut's `medium` for a somewhat larger file at the same quality. Both are the plan's own
    suggestion. How quick it is on a real clip, and how large the file, is for plan step 5 to time on the Mac Studio. */
export const WORK_COPY_CRF = 18;
export const WORK_COPY_PRESET = "veryfast";

/** The rate a video is made at when its own cannot be told, or when it is not constant, as the rough cut's is for a picture that
    gives none. It is a rate every player and every export takes. */
export const FALLBACK_RATE = "30";
/** How far apart the two rates ffprobe gives may be, as a part of the larger, for a video to count as one of a constant rate. */
const RATE_TOLERANCE = 0.005;

/** A rate as ffmpeg's fps filter is given it: "24/1" is "24", and every other is as ffprobe printed it ("30000/1001"). */
const tidy = (fps) => {
  const whole = /^(\d+)\/1$/.exec(String(fps));
  return whole ? whole[1] : String(fps);
};

/** The frame rate a video is made at, from what ffprobe printed of it: { rate, steady }. ffprobe gives two rates. `r_frame_rate`
    is the finest the video's pictures can be told apart at, and `avg_frame_rate` how many there are in all for its length: for
    a video of a constant rate they are the same, and for one whose pictures come at uneven times, as a phone's and Zoom's do,
    they are not. So when both can be used and are within a half per cent of each other (a measured rate is a little off even
    for a steady video), the rate is the video's own and `steady` is true. When they are not, it is 30 and `steady` is false: the
    video is made a constant 30 a second, and the words say so (workCopyNotes). When only one can be used it is that one, and
    when neither can, it is 30, as the rough cut's is (roughRate); neither says the video varies. A rate that can be used is
    one to 120 a second: a file of the time base's own rate, thousands a second, is not a rate to make a video at. `rate` is ""
    for a file with no picture (a cover picture is none) or that cannot be read. */
export function rateOf(printed) {
  let told;
  try {
    told = JSON.parse(printed);
  } catch (e) {
    return { rate: "", steady: true };
  }
  const picture = list(told && told.streams).find((s) => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic));
  if (!picture) return { rate: "", steady: true };
  const given = [picture.r_frame_rate, picture.avg_frame_rate].filter((fps) => framesASecond(fps) >= 1 && framesASecond(fps) <= 120);
  if (given.length === 2) {
    const [a, b] = given.map(framesASecond);
    if (Math.abs(a - b) > RATE_TOLERANCE * Math.max(a, b)) return { rate: FALLBACK_RATE, steady: false };
  }
  return { rate: given.length ? tidy(given[0]) : FALLBACK_RATE, steady: true };
}

/** The longest a side of the working copy's picture may be: 1920, or 3840 when 4K is asked for. */
export const LONG_SIDE = 1920;
export const LONG_SIDE_4K = 3840;
/** A side made even, as H.264 needs, by taking one off an odd one: never more, so a picture is never made larger. */
const even = (side) => Math.max(2, side - (side % 2));

/** The size of the working copy's picture, from the size of the video's as it is shown (factsOf turns the sides of a clip that
    is stored on its side, so an upright iPhone clip of 2160 by 3840 is that): { width, height }. The longer side is made
    `LONG_SIDE` at most (`LONG_SIDE_4K` with `fourK`), the other in proportion and even, and a picture that is small enough is
    not made larger. The sizes are worked out here, and not left to ffmpeg's own expressions, so that a test can say what comes
    out and no comma of an expression is ever taken for the end of a filter. { width: 0, height: 0 } for a file with no picture. */
export function workCopySize({ width, height }, fourK = false) {
  if (!(width > 0 && height > 0)) return { width: 0, height: 0 };
  const most = fourK ? LONG_SIDE_4K : LONG_SIDE;
  const long = Math.max(width, height);
  // The sides are whole numbers, so this is exact where the answer is a whole number.
  const fit = (side) => (long > most ? Math.floor((side * most) / long) : side);
  return { width: even(fit(width)), height: even(fit(height)) };
}

// --- Colour ---

/** The transfers of HDR: HLG, which an iPhone writes, and PQ. */
const HDR_TRANSFERS = new Set(["arib-std-b67", "smpte2084"]);
/** Is this the colour of an HDR picture: BT.2020 primaries with an HLG or a PQ transfer, as colourOf reads it? Wide colour with an
    ordinary transfer is not. */
export const isHdr = (colour) => Boolean(colour) && colour.primaries === "bt2020" && HDR_TRANSFERS.has(colour.transfer);

/** Not used any more. It was the curve an HDR picture was tone-mapped with by software (Hable's, in the tonemap filter). The ffmpeg
    on the Mac Studio has no zscale, which that chain needed, so the working copy now makes an HDR picture standard with
    VideoToolbox, whose conversion (scale_vt) has no curve to choose. The name stays only so that a module that still imports it
    loads; nothing reads it, and it goes when nothing imports it. */
export const TONE_MAP = "hable";

/** How the picture of a video is stored, from what ffprobe printed of it: { turn, bits }. Of the picture, never of a cover picture
    or a sound. An HDR picture is decoded and converted on the Mac's hardware, where ffmpeg's own turning of a picture that is
    stored on its side does not happen, so it is turned by hand after, and these two say how.
    - `turn` is the degrees clockwise the picture is turned to be shown upright, 0 up to 360, as ffmpeg's own turning counts
      them. ffprobe's `rotation` in the display matrix counts the other way (anticlockwise), so the sign is changed: an iPhone's
      upright clip, which ffprobe says -90 of, is turned 90 clockwise, and Jason's, stored turned round, says -180 and is
      turned 180. The old `rotate` tag, which older ffprobe printed, counted clockwise already. The note in the side data wins
      over the tag, and 0 is none, as factsOf reads them for the sides.
    - `bits` is how many bits each sample of the picture's colour has, read from its pixel format: 10 for an iPhone's HDR, 8 for
      a plain 4:2:0. When ffprobe gave no pixel format it is 10, which is what an HDR picture is. */
export function storedOf(printed) {
  let picture;
  try {
    picture = list(JSON.parse(printed).streams).find((s) => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic));
  } catch (e) {
    picture = undefined;
  }
  if (!picture) return { turn: 0, bits: 10 };
  const noted = list(picture.side_data_list).map((d) => d.rotation).find((r) => r != null);
  const clockwise = noted != null ? -Number(noted) : Number(picture.tags && picture.tags.rotate);
  const depth = /(\d+)(?:le|be)$/.exec(String(picture.pix_fmt || ""));
  return {
    turn: Number.isFinite(clockwise) ? (((clockwise % 360) + 360) % 360) : 0,
    bits: depth ? Number(depth[1]) : picture.pix_fmt ? 8 : 10
  };
}

/** The arguments that go before the input for an HDR video, so that its picture is decoded by VideoToolbox and stays on the
    hardware until it is made standard: ffmpeg's own turning is off, because hardware frames skip it and it would otherwise pass
    the stored note to turn the picture on to the file, and the note is set to nothing for the same reason, so that no
    rotation is left in the copy and the picture is never turned twice. */
const HDR_INPUT = ["-noautorotate", "-display_rotation", "0", "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld"];

/** The filters that turn a picture upright by hand, for `turn` degrees clockwise (storedOf): a quarter turn is a transpose, a half
    turn is two flips, and any other angle is what ffmpeg's own turning would do with it, a rotate by that angle. */
function turnFilters(turn) {
  if (turn === 0) return [];
  if (turn === 90) return ["transpose=clock"];
  if (turn === 180) return ["hflip", "vflip"];
  if (turn === 270) return ["transpose=cclock"];
  return [`rotate=${turn}*PI/180`];
}

/** The filters that make an HDR picture standard, from the rate and the size it is made at (workCopySize, as it is shown) and
    how it is stored (storedOf), in this order:
    - fps, first, as for every copy, so that each picture has its place on an even grid from 0;
    - scale_vt, on the hardware: it makes the picture the size it is stored at (the size shown, with its sides swapped for a
      quarter turn, since the turn comes after) and converts its colour to BT.709, with BT.709's primaries, transfer and matrix.
      It reads the colour it starts from off the picture's own tags, which is why the same chain makes HLG and PQ standard;
    - hwdownload, and the pixel format the frames are downloaded in: p010le for the 10 bits an iPhone records, nv12 for 8. It
      must be the format the hardware holds them in, and ffmpeg does not convert there;
    - the turn, by hand, in software (turnFilters);
    - format=yuv420p, last: the drop to 8 bits is ffmpeg's own scaler's, which adds an ordered dither whenever it drops from
      more than 8 bits to 8, so a smooth wall or sky does not band, as it did not when zscale dithered by error diffusion. The
      colour is made standard in the 10 bits VideoToolbox gives (its words hold more than 10 bits, which is what the dither
      works from) and nothing is done to it after. That holds because the file is tagged BT.709, as the frames are
      (workCopyArgs): with no tags to say so, ffmpeg's scaler converts the colour between the frames' tags and the file's as well,
      which does not dither, and a gradient comes out in bands (tried: a ramp of 16 steps went from a few hundred changes along a
      row to three). workcopy-real.test.js looks at a gradient.
    There is no comma in any of them but the ones between filters. */
const hdrChain = ({ rate, width, height, stored }) => {
  const quarter = stored.turn === 90 || stored.turn === 270;
  const [w, h] = quarter ? [height, width] : [width, height];
  return [
    `fps=${rate}:start_time=0`,
    `scale_vt=w=${w}:h=${h}:color_matrix=bt709:color_primaries=bt709:color_transfer=bt709`,
    "hwdownload",
    `format=${stored.bits > 8 ? "p010le" : "nv12"}`,
    ...turnFilters(stored.turn),
    "format=yuv420p"
  ];
};

// --- Whether a video can be made into a working copy ---

/** Why a video cannot be made into a working copy by what ffprobe said of it, in plain words, or "": it could not be read or has no
    length (factsOf has nothing), it has no picture (a cover picture is none), or its only sound is in a form this Mac's ffmpeg
    cannot read. A video with no sound at all can be, and is made with none. */
function unusable({ facts, streams }) {
  if (!facts) return "it could not be read as a video";
  const taken = streams || { video: null, audio: null, unreadable: [] };
  if (!facts.height || taken.video === null) return "there is no picture in it";
  if (taken.audio === null && list(taken.unreadable).length) return "its sound is in a form this Mac can't read";
  return "";
}

/** What a Mac's ffmpeg needs to make an HDR picture standard: the filter that sizes it and converts its colour on the hardware,
    and the hardware decoder that holds its frames there. */
const HDR_FILTERS = ["scale_vt"];
const HDR_HWACCEL = "videotoolbox";

/** Does what ffmpeg printed for -filters list each of these filters? Each is known by its whole name, in the column of names that
    follows the column of flags (two letters or dots, as ffmpeg 9.0.2 prints them, and the three of the ffmpeg before it, and a
    few more are allowed for): a name that only begins as another does (scale_vaapi for scale_vt) is not it, and neither is a
    word of a description or a line of the legend. */
export function hasFilters(listing, names) {
  const have = new Set([...String(listing || "").matchAll(/^\s*[A-Za-z.]{2,5}\s+(\S+)\s+\S+->\S+/gm)].map((m) => m[1]));
  return names.every((name) => have.has(name));
}

/** Does what ffmpeg printed for -hwaccels list this method? Each method is a line of its own, below the line that says what the
    list is, and is known by the whole line: a name that only begins as another does is not it, and neither is a word of a
    sentence or the line that says what the list is. */
export function hasHwaccel(listing, name) {
  const methods = String(listing || "").split("\n").map((line) => line.trim()).filter((line) => /^\w+$/.test(line));
  return methods.includes(name);
}

/** Why a video cannot be made into a working copy on this Mac, in plain words (canNotBeUsed makes the sentence), or null when it
    can. In this order, so that the first thing wrong is the one said: what cannot be read, the picture, the sound, the colour
    and then the room.
    - `filters` is what ffmpeg prints for -filters on this Mac, and `hwaccels` what it prints for -hwaccels. Only an HDR video
      needs the filter and the hardware decoder that make it standard (VideoToolbox's), and one on a Mac without them is refused,
      never used as it is: its colours would be wrong in the app and in the export. A video in standard colour is not touched
      by this.
    - `freeBytes` is the room on the disk the copy is made on, and `rawBytes` the raw video's size: less than twice its size is not
      enough. When the room cannot be measured (it is not a number) nothing is said: a full disk is found out when the copy is
      written, and the job leaves nothing behind then either. */
export function workCopyFault({ facts, streams, colour, filters, hwaccels, freeBytes, rawBytes }) {
  const cannot = unusable({ facts, streams });
  if (cannot) return cannot;
  if (isHdr(colour) && !(hasFilters(filters, HDR_FILTERS) && hasHwaccel(hwaccels, HDR_HWACCEL))) return "it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason";
  if (Number.isFinite(rawBytes) && rawBytes > 0 && Number.isFinite(freeBytes) && freeBytes < 2 * rawBytes) {
    return `there is not enough room on this Mac to make it: ${sizeText(2 * rawBytes)} must be free, and ${sizeText(Math.max(0, freeBytes))} is`;
  }
  return null;
}

// --- The arguments ---

/** Have ffmpeg make the working copy of the video at `input` as the file `output`, or null when the video cannot be made into one
    (see unusable). `facts`, `streams` and `colour` are what factsOf, streamsOf and colourOf read from what ffprobe printed, and
    `rate` is rateOf's. `fourK` lets the longer side be 3840. `stored` is storedOf's, how the picture is stored: it is needed for
    an HDR video, which is turned by hand (see below), and a call for one without it throws rather than make a picture that is
    on its side; a video in standard colour has no use for it.
    - The picture and the sound to take are mapped by their numbers, as the rough cut's are: ffmpeg on its own takes the sound
      with the most channels, which on an iPhone's clip is its APAC, and this Mac cannot read that. A video with no sound is made
      with none.
    - The clock is the rough cut's: fps gives every picture a place on an even grid from 0 at a constant rate, and aresample puts
      the sound on the file's clock first, with silence where it has none, so that a time in the cut plan is a time in the working
      copy. Nothing is cut: there is no select, no trim and no start.
    - The picture is made smaller by workCopySize, never larger, as an iPhone's upright clip is shown: ffmpeg turns it upright
      before any filter sees it, and the copy has no note to turn it. That is for a video in standard colour.
    - An HDR picture is made standard with the Mac's hardware instead (hdrChain, HDR_INPUT): VideoToolbox decodes it, sizes it and
      converts its colour, and ffmpeg's own turning of a stored-on-its-side picture, which hardware frames skip, is off. The
      picture is turned by hand in software after it is downloaded, by the note it is stored with (`stored.turn`), and the file
      is left with no note, so that it is never turned twice.
    - The picture is H.264 High at 8 bits and 4:2:0 (encodeArgs' own settings, at WORK_COPY_CRF and WORK_COPY_PRESET), with a
      keyframe every second, so that a place in the video is reached by decoding a second of it at most when it is scrubbed.
    - It is tagged BT.709 in limited range: what a video in standard colour is, and what an HDR one is once VideoToolbox has
      converted it. A video in standard colour is taken to be BT.709, as the iPhone's, the OBSBOT's and Zoom's are, and its pixels
      are not converted. One that is not (BT.601, wide colour with no HDR, full range) would be tagged as what it is not, and its
      colours shifted a little: the plan asks only for HDR to be converted, and none of the cameras here makes such a video.
    - The file is told it is an mp4, so it can be written under another name and given its own when it is whole.
    - A Reel's copy is of a stretch of the video, { start, end } in seconds of it (architecture 4.3, plan PR 5), and is made with
      this very chain, which is the whole point: its colours (an HDR video's made standard by VideoToolbox, with the turn it needs,
      included), its size, its rate and its clock are the working copy's, and no chain of its own is made for a Reel. Two arguments
      are added and nothing else. `-ss` is an input option, so it goes before the input, after the hardware's options an HDR video
      has there (HDR_INPUT), and seeks to the start (the start of the stretch is then the new video's 0, and ffmpeg decodes from
      the picture before it up to it, which is exact when it writes the pictures again); and `-t` after the pictures and the sound
      are made, in the output's own time, stops at the stretch's length: on the even grid fps puts the pictures on, from the 0 the
      seek made. A stretch that is not one throws: its ends are times in seconds, the end after the start, the start 0 or later. */
export function workCopyArgs(input, output, { facts, streams = null, colour = null, rate = FALLBACK_RATE, fourK = false, stored, stretch } = {}) {
  if (stretch != null && !isStretch(stretch)) throw new Error(`A stretch of a video is { start, end } in seconds, the end after the start, and ${JSON.stringify(stretch)} is not one.`);
  if (unusable({ facts, streams })) return null;
  const at = rate || FALLBACK_RATE;
  const { width, height } = workCopySize(facts, fourK);
  const hdr = isHdr(colour);
  if (hdr && !(stored && Number.isFinite(stored.turn) && Number.isFinite(stored.bits))) {
    throw new Error("An HDR picture is turned by hand, so how it is stored (`stored`, from storedOf) must be given to workCopyArgs.");
  }
  const chain = hdr ? hdrChain({ rate: at, width, height, stored }) : [`fps=${at}:start_time=0`, `scale=${width}:${height}`, "format=yuv420p"];
  const sound = streams.audio !== null;
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...(hdr ? HDR_INPUT : []), ...(stretch != null ? ["-ss", secondsText(stretch.start)] : []), "-i", input,
    "-map", `0:${streams.video}`, ...(sound ? ["-map", `0:${streams.audio}`] : []),
    "-vf", chain.join(","), ...(sound ? ["-af", "aresample=async=1:first_pts=0"] : ["-an"]),
    "-sn", "-dn", ...encodeArgs(WORK_COPY_CRF, WORK_COPY_PRESET),
    "-profile:v", "high", "-g", String(Math.max(1, Math.round(framesASecond(at)))),
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    ...(stretch != null ? ["-t", secondsText(stretch.end - stretch.start)] : []),
    "-f", "mp4", output
  ];
}

/** A time in seconds as ffmpeg is given it: to the thousandth of a second, which leaves 0.1 + 0.2 as 0.3 and not as
    0.30000000000000004, and never in the exponent form JavaScript writes a very small number in, which ffmpeg cannot read. */
const secondsText = (seconds) => String(Math.round(Number(seconds) * 1000) / 1000);

/** Whether `stretch` is a stretch of a video: { start, end } in seconds, the start 0 or later and the end after it. */
const isStretch = (stretch) => stretch !== null && typeof stretch === "object" && Number.isFinite(stretch.start) && Number.isFinite(stretch.end) && stretch.start >= 0 && stretch.end > stretch.start;

// --- The key and the places of a copy ---

/** What a key looks like: the raw file's size in bytes, a dash and its time in milliseconds, and "-4k" for a copy of 4K. */
const KEY = /^\d+-\d+(?:-4k)?$/;

/** The key of a working copy, from the raw file's size and the time it was last written, as stat gives them: the same file gives
    the same key, and a file of another size or time another. A time is taken to the millisecond. A copy of 4K has "-4k" after it,
    so that asking for 4K when a copy of 1080 is there makes another, and not "it is made already". It is safe to be a file's name.
    "" when the size or the time cannot be one. A Reel's copy has a key of its own (reelCopyKey). */
export function workCopyKey(file) {
  const { bytes, mtimeMs, fourK } = file || {};
  if (!(Number.isInteger(bytes) && bytes >= 0 && Number.isFinite(mtimeMs) && mtimeMs >= 0)) return "";
  return `${bytes}-${Math.floor(mtimeMs)}${fourK ? "-4k" : ""}`;
}

/** Where a working copy goes, for the episode in `folder` on this Mac: { dir, video, facts }. The finished video is in the
    episode's own folder in BRIMM Video Work, in "working copy", with its facts beside it. Throws for a key that workCopyKey could
    not have made, and for a folder that is not one folder's name (an episode's folder is a name in Episodes, with no slash in it),
    so that no path leaves the folder: the job renames into it and takes copies away from it. */
export function workCopyPaths(home, folder, key) {
  if (typeof key !== "string" || !KEY.test(key)) throw new Error(`A working copy's key is its size and its time, and ${JSON.stringify(key)} is not one.`);
  const dir = copiesFolder(home, folder);
  return { dir, video: join(dir, `${key}.mp4`), facts: join(dir, `${key}.json`) };
}

/** The folder of an episode's working copies, "working copy" in its own folder in BRIMM Video Work. Throws for a folder that is not
    one folder's name, so that no path leaves it. */
function copiesFolder(home, folder) {
  if (typeof folder !== "string" || !folder || folder === "." || folder === ".." || /[/\0]/.test(folder)) throw new Error(`A working copy goes in an episode's own folder, and ${JSON.stringify(folder)} is not the name of one.`);
  return join(episodeWork(home, folder), "working copy");
}

/** What a Reel's key looks like: the raw file's size, its time, and the two ends of the stretch, each in milliseconds. */
const REEL_KEY = /^\d+-\d+-\d+-\d+$/;

/** The key of a Reel's copy (architecture 4.3, plan PR 5), from the raw file's size and the time it was last written, as workCopyKey
    has them, and the two ends of the stretch it is made of, in seconds of the video, each to the millisecond: the same stretch of the
    same file gives the same key, and another file or another stretch another. A Reel's copy is never of 4K. It is safe to be a
    file's name. "" when the file or the stretch cannot be one. */
export function reelCopyKey(file, stretch) {
  const base = workCopyKey({ bytes: file && file.bytes, mtimeMs: file && file.mtimeMs });
  if (!base || !isStretch(stretch)) return "";
  return `${base}-${Math.round(stretch.start * 1000)}-${Math.round(stretch.end * 1000)}`;
}

/** Where Reel `n`'s copy goes, for the episode in `folder` on this Mac: { dir, video, facts, faces }. They are in the folder of the
    working copies, named for the Reel and its key: `reel-<n>-<key>.mp4`, the facts beside it, and the file of faces the face
    finder found in it, if it found any. The working copy's own files are named by their keys alone, so neither is taken for the
    other. Throws for a number that is not a whole number from 1, a key that reelCopyKey could not have made, and a folder that is
    not one folder's name. */
export function reelCopyPaths(home, folder, n, key) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`A Reel's copy is of a Reel, a whole number from 1, and ${JSON.stringify(n)} is not one.`);
  if (typeof key !== "string" || !REEL_KEY.test(key)) throw new Error(`A Reel's copy has a key of its own, the file's size and time and the stretch's two ends, and ${JSON.stringify(key)} is not one.`);
  const dir = copiesFolder(home, folder);
  const stem = join(dir, `reel-${n}-${key}`);
  return { dir, video: `${stem}.mp4`, facts: `${stem}.json`, faces: `${stem}.faces.json` };
}

/** The facts of a finished working copy, read from what ffprobe printed of it, and its size on disk: { seconds, fps, width, height,
    bytes }. The project is made at this size and length. null when it has no length or no picture, or cannot be read. */
export function workCopyFacts(printed, bytes) {
  const facts = factsOf(printed);
  if (!facts || !facts.height) return null;
  return { seconds: facts.duration, fps: Math.round(framesASecond(facts.fps) * 1000) / 1000, width: facts.width, height: facts.height, bytes };
}

/** The limits the watchdog (guard.js) holds ffmpeg to while it makes the copy of a video of `seconds` seconds: {most, limit}. They
    were set from measurements on a box of four cores, with 3 seconds of 4K made into a copy, and they are generous: a limit that
    stops work that is going well stops it every time it is tried, while a runaway is stopped by any limit.
    - Memory. The most ffmpeg held, and the most it was allowed:
        1080 SDR 0.5 GB, 1080 HDR 0.6 GB      allowed 4 GB
        4K SDR 1.2 GB, 4K HDR 1.8 GB          allowed 8 GB (`fourK`)
      The SDR figures are the four cores'. The HDR ones are of the VideoToolbox chain (workCopyArgs), measured on 2026-10-28 on the
      Mac Studio (an M1 Max): 0.6 GB for 4 seconds of a real 1080 clip, and 1.8 GB for 2 seconds of a made-up 4K clip made into a
      copy of 4K. Its frames stay on the hardware until they are standard, so none is held as floating point, as the software
      chain's were. The limits are left as they were: the Mac Studio has many more cores, so many more frames in flight, than the
      box the SDR ones were measured on, so each is several times what was held, and a Reel preview's 2 GB would not do. A runaway
      grows by gigabytes a second, so any of these stops it in a moment.
    - Time. Five minutes, and twenty seconds more for every second of video. The four cores took 1.1 and 2.4 seconds for each
      second of SDR video at 1080 and 4K, so the slowest has many times as long as it needed. The VideoToolbox chain took 0.2 to
      0.3 for HDR at 1080 and 0.5 at 4K, on the Mac Studio. */
export const workCopyLimits = (seconds, fourK = false) => ({ most: (fourK ? 8 : 4) * GB, limit: Math.round((300 + 20 * (Number.isFinite(seconds) && seconds > 0 ? seconds : 0)) * 1000) });

// --- Asking for the copy ---

/** The command a run of the job is: edit.js starts it detached, as `workcopy --now <folder>`, and runs it with runDetached, which
    holds the working copy's own lock (workCopyLockOf) for as long as it works. */
export const WORK_COPY_COMMAND = "workcopy";

/** The working copy's own lock for the episode in `folder` on this Mac, beside the episode's (detached.js lockOf). The run writes
    no record, only files in the episode's folder of copies, so it runs beside the reading `kind` starts at the same moment, and
    beside any other command: one working copy at a time is all this lock keeps. */
export const workCopyLockOf = (home, folder) => join(episodeWork(home, folder), "workcopy.lock");

/** Ask for the working copy of the episode in `folder` to be made: start its detached run (startDetached, which returns at once),
    unless a run of it is at work already, since its lock lets one at a time make it and a second would only find the lock taken.
    { started: true, running: "" } when it was started, and { started: false, running: "workcopy" } when the copy is being made
    already, which is the answer to a second request. The reading and every other command hold the episode's lock, not this one,
    so none of them stops it. A run whose lock was left by one that died counts as none, as it does for every command. A request
    made in the moment before a run has taken the lock starts a second run, which finds the lock taken and does nothing
    (runDetached). `fourK` is the switch for a copy of 4K, which the run is given. `reel` is the number of a Reel, whose stretch of the
    recording the run makes the copy of instead (`--reel <n>`; plan PR 5): a Reel's copy is never of 4K, and it has the same lock, so
    one copy of an episode is made at a time, a Reel's or the video's. `ctx` is what edit.js gives its commands: {
    home, alive, start, settings }. */
export function requestWorkCopy(ctx, { folder, fourK = false, reel = 0 }) {
  const running = runningCommand(ctx.home, folder, ctx.alive, workCopyLockOf(ctx.home, folder));
  if (running) return { started: false, running };
  startDetached(ctx, { command: WORK_COPY_COMMAND, folder, args: reel ? ["--reel", String(reel)] : fourK ? ["--4k"] : [] });
  return { started: true, running: "" };
}

// --- The job ---

/** What a working copy's own files are called in the folder of the copies, so that the copies for another key are known from
    everything else there by the whole of their names, and nothing else is ever taken away. */
const COPY_FILE = /^(\d+-\d+(?:-4k)?)\.(?:mp4|json)$/;

/** A file's facts as stat gives them, or nothing when there is no such file or it cannot be looked at. */
const statOf = (path) => {
  try {
    return statSync(path, { throwIfNoEntry: false });
  } catch (e) {
    return undefined;
  }
};

/** The room left on the disk a path is on, in bytes. */
const freeOn = (path) => {
  const disk = statfsSync(path);
  return Number(disk.bavail) * Number(disk.bsize);
};

/** Look for the faces in the Reel's video that is in place, and keep them beside it, in `paths.faces`, when the finder found one:
    { every, stills }, the stills as the finder printed them. The file is made whole in the run's own folder and renamed into
    place, as the copy is. Nothing here can cost the copy anything: a finder that finds none, says why, fails, throws or prints
    what cannot be read, and a file that cannot be put in place, are said in the log and leave no file. */
async function keepFaces({ faces, paths, work, shown, write, rename, log }) {
  let stills = null;
  try {
    const seen = await faces(paths.video, work);
    if (seen && Array.isArray(seen.stills)) stills = seen.stills;
    if (!(stills && stills.some((still) => still && Array.isArray(still.faces) && still.faces.length > 0))) {
      stills = null;
      log(`${shown}: no face was found in the video${seen && seen.why ? ` (${seen.why})` : ""}, so the faces are not offered.`);
    }
  } catch (e) {
    stills = null;
    log(`${shown}: the faces could not be looked for (${e.code || e.message}), so they are not offered.`);
  }
  if (!stills) return;
  try {
    const made = join(work, basename(paths.faces));
    write(made, `${JSON.stringify({ every: STILL_EVERY, stills }, null, 2)}\n`);
    rename(made, paths.faces);
  } catch (e) {
    log(`${shown}: the faces could not be put in place (${e.code || e.message}), so they are not offered.`);
  }
}

/** Make the working copy of the raw video at `video`, of the episode in `folder`, on this Mac: resolves { ok, made, failed, next,
    words, key, paths }, which is the shape a detached run's work gives runDetached, with `words` the one line to say of it, and
    never throws. `name` is how the video is called in the progress panel and the log, its file's name when it is not given.
    `fourK` is as workCopyArgs takes it.
    What it does, and why in this order:
    - It looks at nothing but the video's size and time first, for the key, and when the copy for that key is there already, whole
      (its video and its facts), it says Done and makes none. The copy is not looked for in any project: whether a project has
      taken it is for the command that asks.
    - It writes in the run's own folder first, "workcopy-<pid>-<time>" in BRIMM Video Work/.runs, as the other commands do, on the
      same disk as the folder of the copies, so that the copy is put in place by a rename and is whole where it first appears. A
      run that is killed leaves nothing in the folder of the copies, and its own folder is taken away by clearRuns.
    - ffmpeg runs under the watchdog (runGuarded) with the limits of workCopyLimits, which stop it for its memory or its time.
    - It puts the copy in place only when ffmpeg ended with 0 and wrote a file, and ffprobe reads from that file a length within a
      second of the raw video's (a sound's last packet makes it a few hundredths longer), a picture, and a sound when the raw video
      has one. The facts are put in place first and the video last, so that a video that is there always has its facts beside it;
      should the video fail to go in place, the facts are taken away again, and a folder this run made with them. A run that is
      killed in the moment between the two renames can leave the facts alone, which is no copy: the next run makes it.
    - Only then are the copies for other keys taken away, each by its whole name and never by a pattern, so that a copy that is
      better than none is kept until its replacement is whole. One that cannot be taken away is said in the log and left.
    - It says nothing to a person that holds a path, a flag or the name of a program: Done, or "It can't be used" and why. What
      ffmpeg said is in the log.
    A Reel's copy (`reel`: { n, start, end }, the Reel's number and its stretch of the video in seconds; architecture 4.3, plan PR 5)
    is made by this very job, with the same chain, checks, limits and places, and differs only in what is of the stretch and not
    of the video:
    - its key and its files are the Reel's (reelCopyKey, reelCopyPaths), so that they are asked for and found by Reel and stretch,
      and the working copy's job never takes them away, nor theirs the working copy's;
    - the end of the stretch is held to the video's length, and a stretch with less than one picture of the video in it, or none,
      is refused: "Reel 2 is not in the video". The key is of the stretch as it was asked for;
    - the length it is made for, the limits it runs under and the length checked afterwards are the stretch's, and so is the room
      it asks for, twice the stretch's share of the raw video's size;
    - the facts hold the stretch that was cut, { start, end }, as the project's writer needs it;
    - once the copy is in place and the copies it replaces are gone, `faces` (a function from the placed video and the run's own
      folder to what the face finder found, unedited.js facesIn: { stills } or { why }) is asked, as a second step. The faces are
      kept beside the copy, in `reel-<n>-<key>.faces.json` as { every, stills }, only when a still holds a face; none found, no
      finder, a finder that fails or throws, or a file that cannot be put in place costs the copy nothing, and is said in the log.
      A copy made already is not looked for faces again.
    The `deps` are all what it touches: `run` (runProgram) for ffprobe and for ffmpeg's lists of filters and of hardware decoders
    (an HDR video's alone), `runGuarded`, `tools` ({ ffmpeg, ffprobe }), `probe` (a function from a file to what ffprobe printed
    of it, or "": read through `run` when none is given), `freeBytes`, `stat`, `mkdir`, `rename`, `rm`, `readDir`, `write`,
    `progress`, `log`, `now`, `pid`, which names the run's own folder, and `faces`. */
export async function makeWorkCopy({ home, folder, video, name, fourK = false, reel = null }, deps = {}) {
  const {
    run = runProgram, runGuarded: guarded = runGuarded, tools = {}, probe: given, freeBytes = freeOn, stat = statOf, mkdir = mkdirSync,
    rename = renameSync, rm = rmSync, readDir = readdirSync, write = writeFileSync, progress = noProgress, log = () => {}, now = Date.now, pid = process.pid,
    faces = null
  } = deps;
  const shown = name || (typeof video === "string" && video ? basename(video) : "a video");
  // What the video is called in what is logged: the Reel's, or HyperFrames'.
  const for_ = reel !== null && reel !== undefined && Number.isInteger(reel.n) ? `Reel ${reel.n}` : "HyperFrames";
  /** The job ends here when it cannot make the copy: `reason` is said to the person, and `why` is what the log says. */
  const refuse = (reason, why = reason) => {
    log(`${shown}: the video for ${for_} could not be made: ${why}.`);
    return { ok: false, made: [], failed: [canNotBeUsed(reason)], next: "", words: canNotBeUsed(reason) };
  };
  let work = "";
  let began = false;
  let finished = false;
  try {
    // A Reel's copy is of a stretch, and of a Reel: anything else is no Reel's.
    if (reel !== null && reel !== undefined && !(typeof reel === "object" && Number.isInteger(reel.n) && reel.n >= 1 && isStretch(reel))) return refuse("it is not a stretch of the video", "it is not a Reel with a stretch of the video");
    if (!tools.ffmpeg || !tools.ffprobe) return refuse("this Mac has no program to make it with: ask Jason", "ffmpeg or ffprobe is not installed");
    const raw = stat(video);
    if (!raw) return refuse("it isn't on this Mac", "the video is not there");
    const key = reel ? reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, reel) : workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs, fourK });
    if (!key) return refuse("it could not be read as a video", "the video's size and time cannot be read");
    const paths = reel ? reelCopyPaths(home, folder, reel.n, key) : workCopyPaths(home, folder, key);
    if (stat(paths.video) && stat(paths.facts)) {
      log(`${shown}: the video for ${for_} is made already.`);
      return { ok: true, made: [], failed: [], next: "", words: WORK_COPY_DONE, key, paths };
    }

    work = join(runsFolder(home), `workcopy-${pid}-${now()}`);
    mkdir(work, { recursive: true });
    progress.begin(shown);
    began = true;
    progress.steps(reel && faces ? REEL_COPY_STEPS : WORK_COPY_STEPS);
    progress.step(WORK_COPY_STEP);
    log(`${shown}: making the video for ${for_}.`);

    // What ffprobe says of a file, in a file of the run's own folder, as the import reads a video's facts.
    let probes = 0;
    const probe = given || (async (file) => {
      const out = join(work, `probe-${(probes += 1)}.json`);
      const asked = await run(tools.ffprobe, probeArgs(file, out));
      if (asked.code !== 0) {
        log(`${shown}: ffprobe stopped (${lastLine(asked.stderr)}).`);
        return "";
      }
      try {
        return readFileSync(out, "utf8");
      } catch (e) {
        return "";
      }
    });
    const printed = await probe(video);
    const facts = factsOf(printed);
    const streams = streamsOf(printed);
    const colour = colourOf(printed);
    const { rate, steady } = rateOf(printed);
    const stored = storedOf(printed);
    const hdr = isHdr(colour);
    // A Reel's copy is of the stretch as far as the video goes: it has at least one picture of the video in it, or it is no Reel of
    // this video. What is made, checked and limited is then the stretch's, and the video's length is not.
    let stretch = null;
    if (reel && facts) {
      const end = Math.min(reel.end, facts.duration);
      if (!(end - reel.start >= 1 / (framesASecond(rate) || framesASecond(FALLBACK_RATE)))) return refuse(`Reel ${reel.n} is not in the video`, `Reel ${reel.n} is from ${reel.start} to ${reel.end} seconds, and the video is ${facts.duration}`);
      stretch = { start: reel.start, end: Math.round(end * 1000) / 1000 };
    }
    const seconds = stretch ? Math.round((stretch.end - stretch.start) * 1000) / 1000 : facts && facts.duration;
    if (facts) progress.length(seconds);
    // Only an HDR video needs the filter and the hardware decoder that make it standard, so ffmpeg is asked which it has for one
    // alone, once each.
    let filters = "";
    let hwaccels = "";
    if (hdr) {
      const listed = await run(tools.ffmpeg, ["-nostdin", "-hide_banner", "-filters"], { out: 1000000 });
      if (listed.code === 0) filters = String(listed.stdout || "");
      else log(`${shown}: ffmpeg could not say which filters it has (${lastLine(listed.stderr)}).`);
      const methods = await run(tools.ffmpeg, ["-nostdin", "-hide_banner", "-hwaccels"], { out: 100000 });
      if (methods.code === 0) hwaccels = String(methods.stdout || "");
      else log(`${shown}: ffmpeg could not say which hardware decoders it has (${lastLine(methods.stderr)}).`);
    }
    let free = Number.NaN;
    try {
      free = freeBytes(work);
    } catch (e) {
      log(`${shown}: the room left on the disk could not be read (${e.code || e.message}).`);
    }
    // The room a copy needs is twice the raw video's size, or twice the stretch's share of it.
    const fault = workCopyFault({ facts, streams, colour, filters, hwaccels, freeBytes: free, rawBytes: stretch ? raw.size * (seconds / facts.duration) : raw.size });
    if (fault) return refuse(fault);

    const writing = join(work, basename(paths.video));
    // How the picture is stored (`stored`) is the Reel's as much as the video's: an HDR picture is turned by hand, from the note the
    // recording is stored with, whichever stretch of it is cut.
    const args = workCopyArgs(video, writing, { facts, streams, colour, rate, fourK: reel ? false : fourK, stored, ...(stretch ? { stretch } : {}) });
    if (!args) return refuse("it could not be read as a video");
    // ffmpeg says how far it has got, for the progress panel. Without a panel it is given nothing more.
    const watch = progress.encoding(seconds);
    let ended;
    try {
      ended = await guarded(tools.ffmpeg, [...watch.args, ...args], workCopyLimits(seconds, reel ? false : fourK));
    } finally {
      watch.stop();
    }
    const copy = stat(writing);
    if (ended.overMemory) return refuse("it needed more of this Mac's memory than it may use", `ffmpeg was stopped: ${ended.stopped}`);
    if (ended.outOfTime) return refuse("it was taking too long, so it was stopped", `ffmpeg was stopped: ${ended.stopped}`);
    if (ended.signal) return refuse("it was stopped before it was done", `ffmpeg was killed by ${ended.signal}`);
    if (ended.code !== 0 || !copy || !(copy.size > 0)) return refuse("it could not be converted", `ffmpeg stopped (${lastLine(ended.stderr)})`);

    // Whole is what was written, with a picture, and a sound if there was one, and as long as the raw video.
    const printedCopy = await probe(writing);
    const shape = workCopyFacts(printedCopy, copy.size);
    if (!shape) return refuse("what was made could not be read back", "ffprobe could not read what ffmpeg wrote");
    if (Math.abs(shape.seconds - seconds) > 1) return refuse("what was made came out the wrong length", `what ffmpeg wrote is ${shape.seconds} seconds long, and the ${stretch ? "stretch" : "video"} is ${seconds}`);
    if (streams.audio !== null && !factsOf(printedCopy).sound) return refuse("what was made has no sound", "what ffmpeg wrote has no sound, and the video has");

    // The facts first and the video last: the video is the copy, and it is never there without its facts. A Reel's facts say which
    // stretch of the recording its video is, as it was cut (its end held to the video's).
    const madeFacts = join(work, basename(paths.facts));
    const placed = [];
    let madeDir = false;
    try {
      write(madeFacts, `${JSON.stringify(stretch ? { ...shape, stretch } : shape, null, 2)}\n`);
      if (!stat(paths.dir)) {
        mkdir(paths.dir, { recursive: true });
        madeDir = true;
      }
      rename(madeFacts, paths.facts);
      placed.push(paths.facts);
      rename(writing, paths.video);
      placed.push(paths.video);
    } catch (e) {
      // Nothing of this run stays in the folder of the copies, nor the folder, when this run made it.
      for (const path of placed) {
        try {
          rm(path, { force: true });
        } catch (stays) {
          log(`${shown}: ${basename(path)} could not be taken away again (${stays.code || stays.message}).`);
        }
      }
      try {
        if (madeDir && !readDir(paths.dir).length) rm(paths.dir, { recursive: true, force: true });
      } catch (stays) {
        log(`${shown}: the folder of the copies could not be taken away again (${stays.code || stays.message}).`);
      }
      return refuse("it could not be put in place", `it could not be put in place (${e.code || e.message})`);
    }

    // The copy is whole and in place: the copies for other keys, which it replaces, can go.
    let before = [];
    try {
      before = readDir(paths.dir);
    } catch (e) {
      log(`${shown}: the copies made before could not be looked at (${e.code || e.message}), so they are left.`);
    }
    // A Reel's copy replaces the same Reel's copies of other keys, and a working copy its own: each kind is known by its whole name.
    const copyFile = reel ? new RegExp(`^reel-${reel.n}-(\\d+-\\d+-\\d+-\\d+)(?:\\.faces)?\\.(?:mp4|json)$`) : COPY_FILE;
    for (const entry of before) {
      const other = copyFile.exec(entry);
      if (!other || other[1] === key) continue;
      try {
        rm(join(paths.dir, entry), { force: true });
      } catch (e) {
        log(`${shown}: ${entry}, made for an earlier video, could not be taken away (${e.code || e.message}).`);
      }
    }

    finished = true;
    // The faces are looked for last, for a Reel's copy: it is whole and in place, and does without them.
    if (reel && faces) {
      progress.step(FACES_STEP);
      await keepFaces({ faces, paths, work, shown, write, rename, log });
    }
    const notes = workCopyNotes({ steady, rate, hdr });
    log(`${shown}: the video for ${for_} is made${notes.length ? `, with ${notes.join(" and ")}` : ""}.`);
    return { ok: true, made: [reel ? `the video for Reel ${reel.n}` : "the video for HyperFrames", ...notes], failed: [], next: "", words: WORK_COPY_DONE, key, paths };
  } catch (e) {
    return refuse("the work stopped part-way", `the work stopped (${e.code || e.message})`);
  } finally {
    if (began) progress.end(finished);
    if (work) {
      try {
        rm(work, { recursive: true, force: true });
      } catch (e) {
        log(`${shown}: the run's own folder could not be taken away (${e.code || e.message}).`);
      }
    }
  }
}
