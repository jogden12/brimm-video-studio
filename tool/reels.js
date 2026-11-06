// The previews of a Reel's candidates, and the upright Final Cut project of a Reel (the candidates themselves are in
// reel-candidates.js). A preview is small and upright, to judge a candidate by: no full-size clip is made at the import, no part
// of a Story and no caption file. Only a Reel she picks gets a Final Cut project.
// Nothing here touches a disk or runs a program. It takes plain data and gives back plain data, text or ffmpeg's arguments.
import { encodeArgs, roughRate, joinNotes, framesASecond } from "./cuts.js";
import { fcpxml, checkFcpxml } from "./fcpxml.js";
import { basename, extname, join } from "node:path";
import { notMadeWords } from "./reel-candidates.js";

/** The size of a preview, in pixels: half a Reel's each way. */
export const PREVIEW = { width: 540, height: 960 };
/** The quality a preview is written at. It is for judging a candidate, not for posting, so it is small. */
export const PREVIEW_QUALITY = 30;

/** A time as it is written for ffmpeg: to the thousandth of a second, and never before 0. A computer's sums leave 0.1 + 0.2 a
    hair over 0.3, and JavaScript writes that as 0.30000000000000004. */
const timeOf = (seconds) => Math.max(0, Math.round(seconds * 1000) / 1000);

/** A length in seconds as a filter is given it: to the millionth, so a length of whole pictures at 29.97 a second keeps them. */
const exact = (seconds) => Math.round(seconds * 1000000) / 1000000;

/** The stretches of a preview as ffmpeg is to read them: each {start, pictures, seconds, crop}, stopped at the end of the
    video, with any that is then gone left out. Each stretch given is {start, end, crop}, in seconds of the raw video, each
    end on a whole picture as stretchesOf gives them, and the crop is cropFor's, in pixels of the picture as it is shown.
    `fps` is the rate the stretches were made at, roughRate's, and `duration` the video's length in seconds, as factsOf gives
    it. A stretch is stopped at the end of the video, and one that starts at or after the end, or holds less than one
    picture before it, is left out: the transcriber can time a recording's last words past the end of its file, and a cut
    plan can end there, and ffmpeg asked to read past the end of a file grew its memory without end (on 2026-10-14 such a
    preview took the Mac Studio to 101 GB before it was killed). The stretches must be in rising order and must not overlap,
    and each must hold at least one picture and have a crop. Anything else is refused, with a reason that says which
    stretch, and so is a rate or a length that cannot be read, and a preview whose every stretch lies past the end. */
function previewStretches({ ranges, fps, duration }) {
  const rate = framesASecond(fps);
  if (!rate) throw new Error(`A preview needs the video's frame rate, and this one cannot be read: ${fps}`);
  if (!(Number(duration) > 0 && Number(duration) < Infinity)) throw new Error(`A preview needs the video's length, and this one cannot be read: ${duration}`);
  if (!ranges.length) throw new Error("A preview needs at least one stretch to show.");
  let at = 0;
  const stretches = ranges.map((range) => {
    const [start, end] = [timeOf(range.start), timeOf(range.end)];
    if (!(end > start && end < Infinity)) throw new Error(`A stretch must end after it starts, at times in seconds: this one runs from ${range.start} to ${range.end}.`);
    if (start < at) throw new Error(`The stretches must be in rising order and must not overlap: the one from ${range.start} to ${range.end} starts before the one before it ends.`);
    if (!range.crop) throw new Error(`Each stretch of a preview needs its crop: the one from ${range.start} to ${range.end} has none.`);
    at = end;
    // Stopped at the end of the video. One that is then gone, or holds less than a picture, is left out.
    const stop = Math.min(end, Number(duration));
    const pictures = stop > start ? Math.round((stop - start) * rate) : 0;
    if (pictures < 1 && stop < end) return null;
    if (pictures < 1) throw new Error(`A stretch must hold at least one picture: the one from ${range.start} to ${range.end} holds none at ${fps} a second.`);
    return { start, pictures, seconds: exact(pictures / rate), crop: range.crop };
  }).filter(Boolean);
  if (!stretches.length) throw new Error(`Every stretch of this preview lies past the end of the video, at ${duration} seconds: there is nothing to show.`);
  return stretches;
}

/** Have ffmpeg make one part of a preview, of a few stretches: each cropped on the speaker, joined, and made 540 by 960, its
    picture as the preview's is to be and its sound kept whole (PCM, in a .mov), for the join to write once.
    - Each stretch is read by seeking to it (-ss and -t before -i), so ffmpeg reads from the picture it can start at before
      the stretch to a little past its end, and nothing else. It is read twice, its picture alone (-an) and its sound alone
      (-vn), so each ends on its own. Read together, a stretch where the recording has no sound (as when its sound ends before
      its picture) waits for the sound to end, which is the end of the file, while its picture is read on into memory: on
      ffmpeg 9.0.2 a stretch at 30 s of a clip whose sound ends at 20 s grew past 400 MB and was stopped. Read apart, 189 MB.
    - Each stretch's picture is put on an even grid of the video's rate that starts at the seek time (fps with start_time=0),
      as the rough cut's pictures are, and holds exactly the stretch's whole pictures (trim, by count). So a stretch never
      keeps the picture the plan cuts after it, and one that starts on a missing picture, where a recording from Zoom or a
      phone drops some, stays in step with its sound. Cut by -t alone, ffmpeg counts from the first picture it keeps: tried
      on ffmpeg 9.0.2, 9 to 13 cut pictures came back in 40 stretches, and after a freeze the picture ran up to 0.4 s ahead.
    - Each stretch's sound is put on the same clock, from the seek time, with silence where there is none, and cut where its
      pictures end. It is never padded by a filter: apad on a stretch with no sound at all never ends.
    - The part's sound, once its stretches are joined, is mixed with silence exactly as long as the part (`seconds`), and is
      that long: the join of the stretches puts silence after every stretch's sound but the last one's, so a part whose
      sound ended a little before its picture would make every later part's sound play early, and a part with no sound at
      all would write no sound, which a preview cannot be joined from. The sound is one channel: mixed with silence of two,
      a recording of one channel came out 3 dB quieter. A preview's sound is for judging the words, and one channel does. */
const partArgs = ({ video, stretches, fps, seconds, out, streams = null }) => {
  // The picture and the sound by their numbers in the file when they are known (cuts.js streamsOf).
  const named = streams && streams.video !== null && streams.audio !== null;
  const picture_ = (i) => `${2 * i}:${named ? streams.video : "v"}`;
  const sound_ = (i) => `${2 * i + 1}:${named ? streams.audio : "a"}`;
  const rate = framesASecond(fps);
  // Two pictures more are read than the stretch holds, so the trim, not the read, is where it ends.
  const inputs = stretches.flatMap((s) => {
    const read = ["-ss", String(s.start), "-t", String(timeOf(s.seconds + 2 / rate))];
    return [...read, "-an", "-i", video, ...read, "-vn", "-i", video];
  });
  const each = stretches.flatMap(({ pictures, seconds, crop }, i) => [
    `[${picture_(i)}]fps=${fps}:start_time=0,trim=end_frame=${pictures},crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${PREVIEW.width}:${PREVIEW.height},setsar=1[v${i}]`,
    `[${sound_(i)}]aresample=async=1:first_pts=0,atrim=end=${seconds}[a${i}]`
  ]);
  const joined = `${stretches.map((s, i) => `[v${i}][a${i}]`).join("")}concat=n=${stretches.length}:v=1:a=1[v][c]`;
  const sound = ["[c]aformat=channel_layouts=mono[m]", `anullsrc=r=48000:cl=mono,atrim=end=${seconds}[s]`, "[s][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]"];
  const picture = encodeArgs(PREVIEW_QUALITY, "veryfast").slice(0, 8);
  return ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", [...each, joined, ...sound].join(";"), "-map", "[v]", "-map", "[a]", ...picture, "-c:a", "pcm_s16le", "-ar", "48000", "-f", "mov", out];
};

/** How many stretches one part of a preview holds: 8 for a picture of 1080 lines or less, and fewer for a larger one, as many
    as hold no more pixels than 8 of 1080 lines. Read at once, every stretch's two inputs are open and decoding together:
    measured on the Mac Studio at 1080 lines, about 310 MB and 28 MB more for every stretch, so 60 stretches passed 2 GB,
    and at 3840x2160 about 17 did. In parts, the memory is that of one part, however many stretches the preview has. */
const perPart = ({ width, height }) => Math.max(1, Math.min(8, Math.floor((8 * 1920 * 1080) / (width * height))));

/** A path as a line of ffmpeg's list of files to join reads it: in single quotes, with each single quote in it written
    '\'' (end the quote, a quote, start again). */
const listed = (path) => `file '${String(path).replace(/'/g, "'\\''")}'`;

/** What ffmpeg is asked to do to make the preview of one candidate, in order: {parts, list, join, cleanup}.
    - `parts`: each part of the preview, {file, seconds, args}, made by its own ffmpeg (partArgs) into `work`, the run's own
      folder on this Mac's disk, from a few stretches at a time (perPart), so its memory does not grow with the number of
      stretches. `seconds` is how long the part is, for the limits it is made under (previewLimits). A part is named after
      the preview, "<preview>.part-1.mov", so two previews made in one folder never share a part.
    - `list`: {file, text}, the list of the parts for ffmpeg to join, "<preview>.parts.txt", to be written in `work` before
      the join. It names each part by its name alone, since ffmpeg reads a name in its list from the list's own folder, and
      the parts are beside it.
    - `cleanup`: the list and the parts, to be deleted once the join is over, whether or not it made the preview.
    - `join`: {seconds, args}, the last pass: the parts joined one after another (ffmpeg's concat), the picture copied as it
      is and the sound written once, as AAC at 48 kHz, so there is no gap at a join; where a part's sound ends before its
      picture, the join puts silence after it. It writes `out`, told it is an mp4, so it can be written under another name
      and given its own when it is whole.
    `video` is the raw video, `ranges` the candidate's stretches, `fps` and `duration` as previewStretches takes them, and
    `size` the picture's {width, height} as it is shown. Anything previewStretches refuses is refused, and so is a size that
    cannot be read. A candidate with no crops yet, which a reading suggested (reels.json version 2), is refused first, in the
    words of every reader that needs crops (notMadeWords), by its number `n` when it is given; one with a crop on some stretches
    and not on others says which stretch has none. */
export function previewSteps({ video, ranges, out, fps, duration, work, size, streams = null, n }) {
  if (Array.isArray(ranges) && ranges.length && ranges.every((range) => !(range && range.crop))) throw new Error(notMadeWords(n));
  if (!(size && Number.isInteger(size.width) && size.width > 0 && Number.isInteger(size.height) && size.height > 0)) throw new Error(`A preview needs the size of the video's picture, and this one cannot be read: ${size && size.width} by ${size && size.height}`);
  const stretches = previewStretches({ ranges, fps, duration });
  const most = perPart(size);
  const stem = basename(out, extname(out));
  const parts = [];
  for (let k = 0; k < stretches.length; k += most) {
    const these = stretches.slice(k, k + most);
    const file = join(work, `${stem}.part-${parts.length + 1}.mov`);
    const seconds = exact(these.reduce((sum, s) => sum + s.seconds, 0));
    parts.push({ file, seconds, args: partArgs({ video, stretches: these, fps, seconds, out: file, streams }) });
  }
  const list = { file: join(work, `${stem}.parts.txt`), text: parts.map((part) => `${listed(basename(part.file))}\n`).join("") };
  const join_ = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list.file, "-map", "0:v", "-map", "0:a", "-c:v", "copy", "-af", "aresample=async=1:first_pts=0", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", "-f", "mp4", out];
  return { parts, list, join: { seconds: exact(stretches.reduce((sum, s) => sum + s.seconds, 0)), args: join_ }, cleanup: [list.file, ...parts.map((part) => part.file)] };
}

/** The limits each ffmpeg of a preview runs under (runGuarded, in guard.js): {most, limit}, for a part of the preview or its
    join that makes `seconds` of video. Its memory may reach 2 GB, and it may run for 60 seconds, and 5 seconds more for
    every second of video it makes. Past either, ffmpeg is stopped, and the preview is not made. Measured on the Mac Studio
    with ffmpeg 9.0.2, in parts (previewSteps): 60 stretches of 1080 lines peaked at 555 MB, 100 at 576 MB, and 40 of
    3840x2160 at 771 MB, the slowest step a few seconds. */
export const previewLimits = (seconds) => ({ most: 2 * 1024 * 1024 * 1024, limit: Math.round((60 + 5 * seconds) * 1000) });

/** The size of a Reel, in pixels. */
export const REEL_FRAME = { width: 1080, height: 1920 };

/** The words of a marker on a stretch whose crop is a guess. */
export const GUESSED = "No face was found in this stretch, so the picture is placed where the face is in the rest of the video, or in the middle. Check it.";

/** The upright Final Cut project of a Reel candidate: {text}, or {why} there is none. Its stretches are clips one after
    another on a timeline of 1080 by 1920, each filled into the frame and moved onto the face by its crop (reelPosition, in
    fcpxml.js, as phase 0 saw Final Cut 12.4 take it). A marker at each join says how much was taken out there and why, in the plan's own words,
    and a marker on each stretch whose crop is a guess says to check it. No captions and no title yet: they come in phase 4.
    Only the cuts that lie wholly inside the Reel have a note, never the cut before its first words or after its last.
    `video` is the raw video's whole path on this Mac, `facts` what ffprobe said of it (as factsOf gives them), and `plan` the
    cut plan. `project` and `event` are the names Final Cut is to give them, and `writer` is what writes the file's text, for
    a test to give another. `more` is what else ffprobe says of the video, for its asset: { audioRate, audioChannels,
    colorSpace }, as the main timeline is given them (an HDR video's own colour space goes on its format). The text is
    checked before it is given back, and one with something wrong in it is not: `why` then says what. */
export function reelProject({ video, facts, candidate, plan, planRanges = plan.ranges, titles = [], stills = [], look = null, project, event, more = {}, writer = fcpxml }) {
  if (!candidate.ranges.length) return { why: "the Reel has no stretch to show" };
  const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound, ...more };
  const joins = joinNotes(planRanges.filter((r) => r.start >= candidate.start && r.end <= candidate.end));
  const guesses = candidate.ranges.filter((r) => (r.crop ? !r.crop.found : r.guessed)).map((r) => ({ at: r.start, text: GUESSED }));
  try {
    const text = writer({ video, facts: said, ranges: candidate.ranges, markers: [...guesses, ...joins], titles, stills, look, frame: REEL_FRAME, project, event });
    const wrong = checkFcpxml(text, said, { frame: REEL_FRAME });
    return wrong.length ? { why: `it did not pass its own check (${wrong.join(" ").replace(/\.$/, "")})` } : { text };
  } catch (e) {
    return { why: `the writer refused it (${String(e.message).replace(/\.$/, "")})` };
  }
}
