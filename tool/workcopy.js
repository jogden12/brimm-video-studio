// The working copy of a raw video: the video HyperFrames is given to edit (spec 2026-10-27, "the architecture", section 5.7). The
// recording as it was filed may be 4K, HDR, of a frame rate that wanders, or stored on its side. The app wants an ordinary video it
// can seek in at once, so the tool makes one: the longer side at most 1920, H.264 High at 8 bits, tagged BT.709, a constant frame
// rate, and AAC at 48 kHz. It has the raw video's own length and clock and is cut nowhere, so every time the tool and Claude have
// given for the recording is a time in the working copy.
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
import { lastLine, runProgram } from "./run.js";
import { episodeWork, runsFolder } from "./settings.js";

const list = (v) => (Array.isArray(v) ? v : []);
const GB = 1024 ** 3;

// --- What is said: the one step of the work, and the two ways it ends ---

/** The step of the work, as the progress panel says it. The job has this one only: the run is the copy being made. */
export const WORK_COPY_STEP = "Making the video for HyperFrames";
export const WORK_COPY_STEPS = [WORK_COPY_STEP];
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

/** The curves the tonemap filter has that a picture can be made with: not "none", which changes nothing. */
const CURVES = ["clip", "gamma", "hable", "linear", "mobius", "reinhard"];
/** The curve an HDR picture is tone-mapped with: Hable's, which rolls the highlights off and does not cut them, and is the one most
    guides to tone-mapping in software give. How it looks on a real iPhone clip is looked at by eye (plan, PR 3, step 5), and this
    is the one word to change if another is better: workCopyArgs takes the curve as `toneMap`. */
export const TONE_MAP = "hable";

/** The filters that make an HDR picture standard, as the rough cut's chain for size goes before them (so that they work on the
    smaller picture, which is four times quicker at 4K): to linear light as a float, from the colour ffprobe said it has, with
    the input given in full so that the work never depends on what the frames themselves say; to BT.709 primaries; tone-mapped;
    and to BT.709's own transfer, matrix and limited range, dithered, since the picture is written at 8 bits and a smooth
    wall or sky would band. The caller ends the chain with format=yuv420p. */
const toneMapChain = (transfer, curve) => [
  `zscale=pin=bt2020:tin=${transfer}:min=bt2020nc:rin=tv:t=linear:npl=100`,
  "format=gbrpf32le",
  "zscale=p=bt709",
  `tonemap=tonemap=${curve}:desat=0`,
  "zscale=t=bt709:m=bt709:r=tv:dither=error_diffusion"
];

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

/** The filters of a Mac's ffmpeg that tone-map an HDR picture. */
const HDR_FILTERS = ["zscale", "tonemap"];

/** Does what ffmpeg printed for -filters list each of these filters? Each is known by its whole name, in the column of names that
    follows the column of flags (three letters or dots today, and a few more are allowed for): a name that only begins as another
    does (tonemap_opencl for tonemap) is not it, and neither is a word of a description or a line of the legend. */
export function hasFilters(listing, names) {
  const have = new Set([...String(listing || "").matchAll(/^\s*[A-Za-z.]{3,5}\s+(\S+)\s+\S+->\S+/gm)].map((m) => m[1]));
  return names.every((name) => have.has(name));
}

/** Why a video cannot be made into a working copy on this Mac, in plain words (canNotBeUsed makes the sentence), or null when it
    can. In this order, so that the first thing wrong is the one said: what cannot be read, the picture, the sound, the colour
    and then the room.
    - `filters` is what ffmpeg prints for -filters on this Mac. Only an HDR video needs the filters that tone-map it, and one on
      a Mac without them is refused, never used as it is: its colours would be wrong in the app and in the export. A video in
      standard colour is not touched by this.
    - `freeBytes` is the room on the disk the copy is made on, and `rawBytes` the raw video's size: less than twice its size is not
      enough. When the room cannot be measured (it is not a number) nothing is said: a full disk is found out when the copy is
      written, and the job leaves nothing behind then either. */
export function workCopyFault({ facts, streams, colour, filters, freeBytes, rawBytes }) {
  const cannot = unusable({ facts, streams });
  if (cannot) return cannot;
  if (isHdr(colour) && !hasFilters(filters, HDR_FILTERS)) return "it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason";
  if (Number.isFinite(rawBytes) && rawBytes > 0 && Number.isFinite(freeBytes) && freeBytes < 2 * rawBytes) {
    return `there is not enough room on this Mac to make it: ${sizeText(2 * rawBytes)} must be free, and ${sizeText(Math.max(0, freeBytes))} is`;
  }
  return null;
}

// --- The arguments ---

/** Have ffmpeg make the working copy of the video at `input` as the file `output`, or null when the video cannot be made into one
    (see unusable). `facts`, `streams` and `colour` are what factsOf, streamsOf and colourOf read from what ffprobe printed, and
    `rate` is rateOf's. `fourK` lets the longer side be 3840, and `toneMap` is the curve an HDR picture is mapped with.
    - The picture and the sound to take are mapped by their numbers, as the rough cut's are: ffmpeg on its own takes the sound
      with the most channels, which on an iPhone's clip is its APAC, and this Mac cannot read that. A video with no sound is made
      with none.
    - The clock is the rough cut's: fps gives every picture a place on an even grid from 0 at a constant rate, and aresample puts
      the sound on the file's clock first, with silence where it has none, so that a time in the cut plan is a time in the working
      copy. Nothing is cut: there is no select, no trim and no start.
    - The picture is made smaller by workCopySize, never larger, as an iPhone's upright clip is shown: ffmpeg turns it upright
      before any filter sees it, and the copy has no note to turn it.
    - The picture is H.264 High at 8 bits and 4:2:0 (encodeArgs' own settings, at WORK_COPY_CRF and WORK_COPY_PRESET), with a
      keyframe every second, so that a place in the video is reached by decoding a second of it at most when it is scrubbed.
    - It is tagged BT.709 in limited range: what a video in standard colour is, and what an HDR one is once its filters have run.
      A video in standard colour is taken to be BT.709, as the iPhone's, the OBSBOT's and Zoom's are, and its pixels are not
      converted. One that is not (BT.601, wide colour with no HDR, full range) would be tagged as what it is not, and its colours
      shifted a little: the plan asks only for HDR to be converted, and none of the cameras here makes such a video.
    - The file is told it is an mp4, so it can be written under another name and given its own when it is whole. */
export function workCopyArgs(input, output, { facts, streams = null, colour = null, rate = FALLBACK_RATE, fourK = false, toneMap = TONE_MAP } = {}) {
  if (unusable({ facts, streams })) return null;
  if (!CURVES.includes(toneMap)) throw new Error(`The tonemap filter has no curve called "${toneMap}".`);
  const at = rate || FALLBACK_RATE;
  const { width, height } = workCopySize(facts, fourK);
  const chain = [`fps=${at}:start_time=0`, `scale=${width}:${height}`, ...(isHdr(colour) ? toneMapChain(colour.transfer, toneMap) : []), "format=yuv420p"];
  const sound = streams.audio !== null;
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-map", `0:${streams.video}`, ...(sound ? ["-map", `0:${streams.audio}`] : []),
    "-vf", chain.join(","), ...(sound ? ["-af", "aresample=async=1:first_pts=0"] : ["-an"]),
    "-sn", "-dn", ...encodeArgs(WORK_COPY_CRF, WORK_COPY_PRESET),
    "-profile:v", "high", "-g", String(Math.max(1, Math.round(framesASecond(at)))),
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-f", "mp4", output
  ];
}

// --- The key and the places of a copy ---

/** What a key looks like: the raw file's size in bytes, a dash and its time in milliseconds, and "-4k" for a copy of 4K. */
const KEY = /^\d+-\d+(?:-4k)?$/;

/** The key of a working copy, from the raw file's size and the time it was last written, as stat gives them: the same file gives
    the same key, and a file of another size or time another. A time is taken to the millisecond. A copy of 4K has "-4k" after it,
    so that asking for 4K when a copy of 1080 is there makes another, and not "it is made already". It is safe to be a file's name.
    "" when the size or the time cannot be one. */
export function workCopyKey(file) {
  const { bytes, mtimeMs, fourK } = file || {};
  if (!(Number.isInteger(bytes) && bytes >= 0 && Number.isFinite(mtimeMs) && mtimeMs >= 0)) return "";
  return `${bytes}-${Math.floor(mtimeMs)}${fourK ? "-4k" : ""}`;
}

/** The folder of the working copies of the episode in `folder` on this Mac: "working copy" in the episode's own folder in BRIMM
    Video Work. Throws for a folder that is not one folder's name (an episode's folder is a name in Episodes, with no slash in it),
    so that no path leaves the folder: the job renames into it and takes copies away from it, and `free` takes the folder away
    (free.js), all by this one name. */
export function workCopyDir(home, folder) {
  if (typeof folder !== "string" || !folder || folder === "." || folder === ".." || /[/\0]/.test(folder)) throw new Error(`A working copy goes in an episode's own folder, and ${JSON.stringify(folder)} is not the name of one.`);
  return join(episodeWork(home, folder), "working copy");
}

/** Where a working copy goes, for the episode in `folder` on this Mac: { dir, video, facts }. The finished video is in the
    folder of the copies (workCopyDir), with its facts beside it. Throws for a key that workCopyKey could not have made, and for a
    folder that workCopyDir refuses. */
export function workCopyPaths(home, folder, key) {
  if (typeof key !== "string" || !KEY.test(key)) throw new Error(`A working copy's key is its size and its time, and ${JSON.stringify(key)} is not one.`);
  const dir = workCopyDir(home, folder);
  return { dir, video: join(dir, `${key}.mp4`), facts: join(dir, `${key}.json`) };
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
        1080 SDR 0.5 GB, 1080 HDR 0.8 GB      allowed 4 GB
        4K SDR 1.2 GB, 4K HDR 1.8 GB          allowed 8 GB (`fourK`)
      A picture tone-mapped as floating point holds frames of a hundred megabytes at 4K, and the Mac Studio has many more cores,
      so many more frames in flight, than the box this was measured on. So each is about five times what four cores held, and
      a Reel preview's 2 GB would not do. A runaway grows by gigabytes a second, so any of these stops it in a moment.
    - Time. Five minutes, and twenty seconds more for every second of video. The same four cores took 1.1, 2.4, 1.7 and 6.8
      seconds for each second of video, in the order above, so the slowest has three times as long as it needed, and the Mac
      Studio is far quicker. */
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
    (runDetached). `fourK` is the switch for a copy of 4K, which the run is given. `ctx` is what edit.js gives its commands: {
    home, alive, start, settings }. */
export function requestWorkCopy(ctx, { folder, fourK = false }) {
  const running = runningCommand(ctx.home, folder, ctx.alive, workCopyLockOf(ctx.home, folder));
  if (running) return { started: false, running };
  startDetached(ctx, { command: WORK_COPY_COMMAND, folder, args: fourK ? ["--4k"] : [] });
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

/** Make the working copy of the raw video at `video`, of the episode in `folder`, on this Mac: resolves { ok, made, failed, next,
    words, key, paths }, which is the shape a detached run's work gives runDetached, with `words` the one line to say of it, and
    never throws. `name` is how the video is called in the progress panel and the log, its file's name when it is not given.
    `fourK` and `toneMap` are as workCopyArgs takes them.
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
    The `deps` are all what it touches: `run` (runProgram) for ffprobe and for ffmpeg's list of filters, `runGuarded`, `tools` ({
    ffmpeg, ffprobe }), `probe` (a function from a file to what ffprobe printed of it, or "": read through `run` when none is
    given), `freeBytes`, `stat`, `mkdir`, `rename`, `rm`, `readDir`, `write`, `progress`, `log`, `now`, and `pid`, which names the
    run's own folder. */
export async function makeWorkCopy({ home, folder, video, name, fourK = false, toneMap = TONE_MAP }, deps = {}) {
  const {
    run = runProgram, runGuarded: guarded = runGuarded, tools = {}, probe: given, freeBytes = freeOn, stat = statOf, mkdir = mkdirSync,
    rename = renameSync, rm = rmSync, readDir = readdirSync, write = writeFileSync, progress = noProgress, log = () => {}, now = Date.now, pid = process.pid
  } = deps;
  const shown = name || (typeof video === "string" && video ? basename(video) : "a video");
  /** The job ends here when it cannot make the copy: `reason` is said to the person, and `why` is what the log says. */
  const refuse = (reason, why = reason) => {
    log(`${shown}: the video for HyperFrames could not be made: ${why}.`);
    return { ok: false, made: [], failed: [canNotBeUsed(reason)], next: "", words: canNotBeUsed(reason) };
  };
  let work = "";
  let began = false;
  let finished = false;
  try {
    if (!tools.ffmpeg || !tools.ffprobe) return refuse("this Mac has no program to make it with: ask Jason", "ffmpeg or ffprobe is not installed");
    const raw = stat(video);
    if (!raw) return refuse("it isn't on this Mac", "the video is not there");
    const key = workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs, fourK });
    if (!key) return refuse("it could not be read as a video", "the video's size and time cannot be read");
    const paths = workCopyPaths(home, folder, key);
    if (stat(paths.video) && stat(paths.facts)) {
      log(`${shown}: the video for HyperFrames is made already.`);
      return { ok: true, made: [], failed: [], next: "", words: WORK_COPY_DONE, key, paths };
    }

    work = join(runsFolder(home), `workcopy-${pid}-${now()}`);
    mkdir(work, { recursive: true });
    progress.begin(shown);
    began = true;
    progress.steps(WORK_COPY_STEPS);
    progress.step(WORK_COPY_STEP);
    log(`${shown}: making the video for HyperFrames.`);

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
    if (facts) progress.length(facts.duration);
    const streams = streamsOf(printed);
    const colour = colourOf(printed);
    const { rate, steady } = rateOf(printed);
    const hdr = isHdr(colour);
    // Only an HDR video needs the filters that tone-map it, so ffmpeg is asked which it has for one alone, once.
    let filters = "";
    if (hdr) {
      const listed = await run(tools.ffmpeg, ["-nostdin", "-hide_banner", "-filters"], { out: 1000000 });
      if (listed.code === 0) filters = String(listed.stdout || "");
      else log(`${shown}: ffmpeg could not say which filters it has (${lastLine(listed.stderr)}).`);
    }
    let free = Number.NaN;
    try {
      free = freeBytes(work);
    } catch (e) {
      log(`${shown}: the room left on the disk could not be read (${e.code || e.message}).`);
    }
    const fault = workCopyFault({ facts, streams, colour, filters, freeBytes: free, rawBytes: raw.size });
    if (fault) return refuse(fault);

    const writing = join(work, `${key}.mp4`);
    const args = workCopyArgs(video, writing, { facts, streams, colour, rate, fourK, toneMap });
    if (!args) return refuse("it could not be read as a video");
    // ffmpeg says how far it has got, for the progress panel. Without a panel it is given nothing more.
    const watch = progress.encoding(facts.duration);
    let ended;
    try {
      ended = await guarded(tools.ffmpeg, [...watch.args, ...args], workCopyLimits(facts.duration, fourK));
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
    if (Math.abs(shape.seconds - facts.duration) > 1) return refuse("what was made came out the wrong length", `what ffmpeg wrote is ${shape.seconds} seconds long, and the video is ${facts.duration}`);
    if (streams.audio !== null && !factsOf(printedCopy).sound) return refuse("what was made has no sound", "what ffmpeg wrote has no sound, and the video has");

    // The facts first and the video last: the video is the copy, and it is never there without its facts.
    const madeFacts = join(work, `${key}.json`);
    const placed = [];
    let madeDir = false;
    try {
      write(madeFacts, `${JSON.stringify(shape, null, 2)}\n`);
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
    for (const entry of before) {
      const other = COPY_FILE.exec(entry);
      if (!other || other[1] === key) continue;
      try {
        rm(join(paths.dir, entry), { force: true });
      } catch (e) {
        log(`${shown}: ${entry}, made for an earlier video, could not be taken away (${e.code || e.message}).`);
      }
    }

    finished = true;
    const notes = workCopyNotes({ steady, rate, hdr });
    log(`${shown}: the video for HyperFrames is made${notes.length ? `, with ${notes.join(" and ")}` : ""}.`);
    return { ok: true, made: ["the video for HyperFrames", ...notes], failed: [], next: "", words: WORK_COPY_DONE, key, paths };
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
