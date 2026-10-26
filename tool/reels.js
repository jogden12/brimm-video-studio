// The Reels of an episode, made light at the import, as Jason asked: "some of those may not be utilized, so the initial reels
// creation should be lightweight". Claude picks up to five candidates. Each has its kept stretches on the raw video's clock,
// the crop that puts the speaker in an upright frame, a recommended title, why Claude picked it, and a small upright preview
// to judge it by. No full-size clip is made at the import, no part of a Story and no caption file. Only a Reel she picks gets
// a Final Cut project.
// Nothing here touches a disk or runs a program. It takes plain data and gives back plain data, text or ffmpeg's arguments.
import { encodeArgs, keptSpans, roughRate, joinNotes, framesASecond, KEPT_SIDE } from "./cuts.js";
import { fcpxml, checkFcpxml } from "./fcpxml.js";
import { stamp } from "./shared/text.js";
import { basename, extname, join } from "node:path";
import { cropsFor, stretchesOf, fitReel } from "./reframe.js";
import { isAnswered, shownName } from "./episode.js";
import { gated } from "./gate.js";
import { suggestionsOnClock, KEPT_IN_100 } from "./handoff-v2.js";
import { spelled } from "./final-transcript.js";
import { timelineAt } from "./clock.js";

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

/** A sum to the thousandth of a second: a computer's sums leave 3.136 + 2.068 a hair off 5.204. */
const ms = (t) => Math.round(t * 1000) / 1000;

/** The Reel candidates made of the clips Claude picked, as clipRanges gives them. Each is {n, start, end, ranges, seconds,
    fits, title, reason, words, check, preview}:
    - `ranges` are the clip's kept stretches as the preview and the Reel's project take them, each end on a whole picture and
      written to the thousandth below it, each with its crop: one fixed crop for each stretch, placed on the speaker's face by
      the stills the face finder looked in for the upright version. A crop no face was found for is a guess, and its `found`
      is false. All in seconds of the raw video.
    - `seconds` is how long the Reel is, and `fits` whether that fits a Reel and, when not, why.
    - `title` is Claude's recommended words for the screen, and `reason` why it picked the clip.
    - `words` are the kept words of the clip, as the plan has them, and `phrases` the ids of the plan's phrases they are, so
      two candidates can be told to share words, and not only the pause between them.
    - `check` is there when the clip starts or ends with no pause: its first or last word is to be checked.
    - `preview` is null until a preview is made.
    A clip that comes to less than one picture has no stretches and no preview, and `failed` says why. With no stills, as
    when the faces could not be looked for, every crop is the middle of the picture, and a guess. */
export function reelCandidates({ clips, plan, facts, stills }) {
  return clips.map((clip) => {
    const stretches = stretchesOf(keptSpans(clip.ranges.map((range) => ({ ...range, keep: true })), roughRate(facts)));
    const crops = cropsFor(facts, stretches, stills || []);
    const seconds = ms(stretches.reduce((sum, s) => sum + s.end - s.start, 0));
    const kept = plan.phrases.filter((p) => p.keep && p.start < clip.end && p.end > clip.start);
    const words = kept.map((p) => p.text.trim()).filter(Boolean).join(" ");
    const about = { title: clip.hook, reason: clip.why, words, phrases: kept.map((p) => p.id), ...(clip.check ? { check: clip.check } : {}), preview: null };
    if (!stretches.length) return { n: clip.n, start: clip.start, end: clip.end, ranges: [], seconds: 0, fits: fitReel({ start: 0, end: 0 }), ...about, failed: "it is shorter than one picture" };
    return {
      n: clip.n, start: stretches[0].start, end: stretches[stretches.length - 1].end,
      ranges: stretches.map((s, i) => ({ start: s.start, end: s.end, crop: crops[i] })),
      seconds, fits: fitReel({ start: 0, end: seconds }), ...about
    };
  });
}

/** What the candidates' file is called in the episode folder, and where each preview is, relative to that folder. */
export const REELS_FILE = "reels.json";
export const previewPath = (n) => `previews/reel-${n}.mp4`;

/** The layout of reels.json. It is raised only when its shape changes, and a reader refuses a higher one. Version 2 (spec
    2026-10-22, section 3, "reels.json version 2") adds the candidate a reading suggests: its stretches have no crops yet,
    since no face is looked for until she asks to make it, it has no preview, and its `title` is "". A list that holds such a
    candidate is written at version 2, so that a Mac that knows version 1 alone says a newer brimm-video wrote it, rather than
    that a candidate cannot be read; any other list is written at version 1, as it always was. */
export const REELS_VERSION = 2;

/** Whether a candidate is one a reading suggested and nobody has made yet: a stretch of it has no crop. A candidate with no
    stretch at all is not one: it has nothing to show, and says so in its own words. */
export const uncropped = (candidate) => Array.isArray(candidate.ranges) && candidate.ranges.some((range) => !(range && range.crop));

/** What a command that needs a Reel's crops says of a candidate that is not made yet, by its number `n`, by several numbers, or
    with none. Nothing makes one yet (phase V), so she is never sent to make it first: for now she cuts it in OpusClip, and BRIMM
    Ops writes its post text (Sallie's walkthrough, 25 Oct, "A Reel cut in OpusClip"). A session never hears it: the gate refuses
    every command that would say it, and a session never goes to OpusClip. */
export const notMadeWords = (n) => {
  const ns = n === undefined ? [] : [].concat(n);
  const them = ns.length === 0 ? "them" : ns.length === 1 ? `Reel ${ns[0]}` : `Reels ${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
  return `brimm-video cannot make Reels from this video yet: for now, cut ${them} in OpusClip. BRIMM Ops writes ${ns.length === 1 ? "its" : "their"} post text: on the episode's "Reels" card, press "New short video from a clip".`;
};

/** reels.json, as it is written: the candidates of `video`, made by the import, by `ask` or by a reading (`by`) at the moment
    `made`, at version 2 when a candidate has no crops (uncropped), and at version 1 otherwise.
    `none` says why there are no candidates, and is left out when there are some. `highest` is the highest number ever given
    to a Reel of this episode, kept so that asking Claude again never gives a number twice: a candidate that is let go takes
    its number out of every list. It is at least the highest number among the candidates. `cannotAsk` says why asking Claude
    again would not work: the importing Mac set to go by the rules alone, with `rulesOnly`, the field `ask` goes by. Both are
    left out when there are candidates. Whether Claude can be asked again otherwise is for the Mac that shows the list to
    say (edit.js reels). */
export const reelsFile = ({ video, by, made, candidates, none = "", cannotAsk = "", rulesOnly = false, highest = 0 }) => ({
  format: "brimm-video reels", version: candidates.some(uncropped) ? REELS_VERSION : 1, video, by, made,
  highest: Math.max(highest, 0, ...candidates.map((c) => c.n)),
  ...(none && !candidates.length ? { none } : {}), ...(cannotAsk && !candidates.length ? { cannotAsk } : {}),
  ...(rulesOnly && !candidates.length ? { rulesOnly: true } : {}), candidates
});

/** reels.json as it was read: {reels}, or {why} it cannot be used. Only what the previews, the listing and a Reel's project
    are made from is looked at: each candidate's number, its stretches and their crops, and its preview's place. A stretch at
    version 2 may have no crop (a candidate a reading suggested, not made yet); at version 1 each has its own. `known` is the
    newest version this brimm-video reads: a test gives an older one, to stand in for a Mac on older code. */
export function readReels(text, { known = REELS_VERSION } = {}) {
  let reels;
  try {
    reels = JSON.parse(text);
  } catch (e) {
    return { why: "it is not JSON" };
  }
  const not = { why: "it is not a list of Reel candidates this tool wrote" };
  if (!reels || reels.format !== "brimm-video reels" || !Number.isInteger(reels.version)) return not;
  if (reels.version > known) return { why: "it was written by a newer brimm-video. Ask Jason to update this Mac." };
  if (typeof reels.video !== "string" || !Array.isArray(reels.candidates)) return not;
  if (reels.highest !== undefined && !(Number.isInteger(reels.highest) && reels.highest >= 0)) return not;
  const isCrop = (c) => Boolean(c) && [c.x, c.y, c.w, c.h].every(Number.isFinite);
  const isRange = (r) => Boolean(r) && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start && (isCrop(r.crop) || (reels.version >= 2 && r.crop === undefined));
  // A preview is opened in QuickTime Player and brought over by Dropbox, so it may be in one place only: its own in previews/.
  const isPreview = (c) => c.preview === undefined || c.preview === null || c.preview === previewPath(c.n);
  const bad = reels.candidates.findIndex((c) => !c || !Number.isInteger(c.n) || c.n < 1 || !Array.isArray(c.ranges) || !c.ranges.every(isRange) || !isPreview(c));
  return bad === -1 ? { reels } : { why: `candidate ${bad + 1} in it cannot be read` };
}

/** The record's Reels, one for each candidate, in the record's own words (the design's section 1, and the architect's
    contract): each a candidate still, with its times, its title and why, and its preview as its one file. reels.json keeps
    the rest. */
export const reelEntries = (candidates) => candidates.map((c) => ({ n: c.n, status: "candidate", from: c.start, to: c.end, title: c.title, why: c.reason, files: c.preview ? [c.preview] : [], pushed: [] }));

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

/** What a Reel is now, in the record's words, as the list says it. */
const NOW = { candidate: "A candidate", picked: "Picked", dropped: "Dropped", finished: "Finished" };

/** The lines after the list of candidates: the record's Reels that reels.json does not hold, which are the clips the import cut,
    of an episode imported before phase 3, and any other the record lists before Dropbox has brought the list that holds it.
    Each kind is a line and a blank one after it; none when there are none. */
function reelsNotListed(reels, record) {
  const listed = new Set(reels.candidates.map((c) => c.n));
  const others = (record.reels || []).filter((r) => !listed.has(r.n));
  const cut = (r) => (Array.isArray(r.files) ? r.files : []).some((f) => /\.reel-\d+\.mp4$/i.test(f));
  const said = (list) => list.map((r) => `Reel ${r.n}, ${r.status === "candidate" ? "a candidate" : r.status}`).join("; ");
  return [
    ...(others.some(cut) ? [`Reels the import cut as clips: ${said(others.filter(cut))}.`, ""] : []),
    ...(others.some((r) => !cut(r)) ? [`Reels the record lists that reels.json does not hold yet: ${said(others.filter((r) => !cut(r)))}.`, ""] : [])
  ];
}

/** A suggestion's stretches, in seconds of the video: its own, or all of it from its start to its end when it holds none. */
const stretchesOfSuggestion = (c) => (c.ranges.length ? c.ranges : [{ start: c.start, end: c.end }]);

/** The parts of a suggestion's stretches that lie in the clock's pieces, each { start, end } in seconds of the video: what the
    clock keeps of them. Whatever lies between two stretches is none of them, even where the clock keeps it too. */
const keptOfStretches = (c, clock) => stretchesOfSuggestion(c).flatMap((s) => clock.map((p) => ({ start: Math.max(s.start, p.from), end: Math.min(s.end, p.to) })).filter((i) => i.end > i.start));

/** How many seconds a list of { start, end } holds. */
const secondsIn = (list) => list.reduce((sum, i) => sum + i.end - i.start, 0);

/** Where a suggestion lies on the clock she is reading, by its time alone, for a video with no words file: { start, end,
    seconds } with its times on the clock and the seconds of its stretches the clock keeps; or null when fewer than 70 in 100 of
    the seconds of its stretches lie in the clock's pieces (as for a suggestion placed by its words, handoff-v2.js
    suggestionsOnClock), or none does. Its start and end are where the clock puts the first and the last moment of it that it
    keeps. */
function placedByTime(c, clock) {
  const inside = keptOfStretches(c, clock);
  if (!inside.length || secondsIn(inside) * 100 < secondsIn(stretchesOfSuggestion(c)) * KEPT_IN_100) return null;
  return { start: timelineAt(clock, Math.min(...inside.map((i) => i.start))), end: timelineAt(clock, Math.max(...inside.map((i) => i.end))), seconds: secondsIn(inside) };
}

/** Where a suggestion lies on the clock she is reading (`now`, clockFor's read, with a clock): placed by its words when the
    read has the recording's words, as the hand-off places a suggestion (handoff-v2.js suggestionsOnClock, which says what it
    keeps), and by its time otherwise. { start, end, seconds, first?, last? } on that clock: `first` and `last` the words it opens
    and closes with there, when it is placed by its words, and `seconds` those of its own stretches the clock keeps (not the
    gap between two of them that the clock keeps too, which a run of its words bridges); or null when what it says is cut now. */
function placedOn(c, now) {
  if (!(Array.isArray(now.words) && now.words.length)) return placedByTime(c, now.clock);
  const [one] = suggestionsOnClock({ suggestions: [{ n: c.n, start: c.start, end: c.end, stretches: c.ranges, first: c.first, last: c.last, why: c.reason, point: c.point }], words: now.words, clock: now.clock });
  return one ? { start: one.start, end: one.end, seconds: secondsIn(keptOfStretches(c, now.clock)), first: one.first, last: one.last } : null;
}

/** The list of the Reel suggestions of a video of the switch (a video she has answered the card of): a reading's suggestions,
    each as it is on the clock she is reading (`now`, clockFor's read), the video named as everything edit.js prints names it
    (episode.js shownName), never by `reels.video`, the file's name. A short video gets no Reels. With none, why there are none,
    with no offer to ask Claude again. Otherwise the head line says which clock the times are on, and each suggestion has its
    times there, its length, what it is now, the words it opens and closes with there, why Claude picked it, whether it fits a
    Reel, its preview when it has one, and the word to check. A suggestion whose words are cut now says so ("Cut now"), with the
    words it had. With no clock (`now` null, or a read that could not be made) the times are the recording's own. The words a
    suggestion had, which the clock does not give, are spelled as the episode spells its words (spelling.js). */
function suggestionsText(reels, record, now) {
  const name = shownName(record);
  if (record.kind === "short video") return `${name} is a short video, and a short video gets no Reels.\n`;
  if (!reels.candidates.length) return `There are no Reel suggestions of ${name}${reels.none ? `: ${reels.none}` : ""}.\n`;
  const status = new Map((record.reels || []).map((r) => [r.n, r.status]));
  const on = now && Array.isArray(now.clock) ? now : null;
  const spell = (said) => (said ? spelled(said, record.spellings || []) : said);
  const blocks = reels.candidates.map((c) => {
    const state = NOW[status.get(c.n)] || NOW.candidate;
    const where = on ? placedOn(c, on) : { start: c.start, end: c.end, seconds: c.seconds };
    // Where it is cut now, or where only its time places it, the words it had are the ones it was suggested with.
    const { first = spell(c.first), last = spell(c.last) } = where || {};
    const about = [first && `   Opens with: ${first}`, last && `   Closes with: ${last}`, c.reason && `   Why: ${c.reason}`];
    if (!where) return [`${c.n}. Cut now: its words were cut from ${on.on}. ${state}.`, ...about].filter(Boolean).join("\n");
    const seconds = Math.round(where.seconds);
    return [
      `${c.n}. ${stamp(where.start)} to ${stamp(where.end)}, ${seconds} second${seconds === 1 ? "" : "s"}. ${state}.`,
      ...about,
      !c.fits.fits && `   It does not fit a Reel. ${c.fits.why}`,
      c.preview && `   Preview: ${c.preview}`,
      c.check && `   ${c.check}`
    ].filter(Boolean).join("\n");
  });
  return [`Reel suggestions of ${name}: ${reels.candidates.length}, with times on ${on ? on.on : "the recording's own clock"}.`, "", ...blocks.flatMap((block) => [block, ""]), ...reelsNotListed(reels, record)].join("\n");
}

/** The list of the Reel candidates, to show a person: for each its number, where it is in the raw video, its length, what it
    is now, its words for the screen and why Claude picked it, whether it fits a Reel, its preview or why it has none, and the
    word to check when it starts or ends with no pause. With none, why there are none, and how to ask again only when asking
    again can work: a short video gets no Reels, and `whyNot`, why Claude cannot be asked now on the Mac that shows the list
    (as `ask` would say), is said instead of the offer. After the candidates, the Reels of the record that are none of them,
    which are the clips the import cut of an episode imported before phase 3. `record` is the episode's record, for its kind
    and for what each Reel is now: one it does not know of is a candidate.
    For a video she has answered the card of (episode.js isAnswered) it is the list of suggestions on the clock she is reading,
    `now` being clockFor's read of the main video, or null (suggestionsText); `whyNot` is then not said, since asking Claude again
    is not offered. So it is for a record the gate holds (gate.js gated: a video not yet answered, or a session not cleared),
    whatever its answer says, so that no line of this can name `reels.video` for one: it is named by its label. For any other
    record it is this list, as it always was, whatever `now` is: layoutOf is not asked, since it turns 3 for an old video that only
    holds a version with a `how`. A bare shape with no `kind` at all is no record a session reads (episode.js refuses one), and is
    not held by the gate here. */
export function reelsText(reels, record, whyNot = "", now = null) {
  if (isAnswered(record) || (record.kind !== undefined && gated(record))) return suggestionsText(reels, record, now);
  const name = reels.video;
  if (record.kind === "short video") return `${name} is a short video, and a short video gets no Reels.\n`;
  if (!reels.candidates.length) {
    const why = `There are no Reel candidates of ${name}${reels.none ? `: ${reels.none}` : ""}.`;
    return `${why}\n${whyNot || 'Say "ask Claude again for Reels" to ask again.'}\n`;
  }
  const status = new Map((record.reels || []).map((r) => [r.n, r.status]));
  const blocks = reels.candidates.map((c) => {
    const seconds = Math.round(c.seconds);
    return [
      `${c.n}. ${stamp(c.start)} to ${stamp(c.end)}, ${seconds} second${seconds === 1 ? "" : "s"}. ${NOW[status.get(c.n)] || NOW.candidate}.`,
      c.title && `   On screen: ${c.title}`,
      c.reason && `   Why: ${c.reason}`,
      !c.fits.fits && `   It does not fit a Reel. ${c.fits.why}`,
      c.preview ? `   Preview: ${c.preview}` : `   No preview: ${c.failed || "none was made"}.`,
      c.check && `   ${c.check}`
    ].filter(Boolean).join("\n");
  });
  return [`Reel candidates of ${name}: ${reels.candidates.length}.`, "", ...blocks.flatMap((block) => [block, ""]), ...reelsNotListed(reels, record)].join("\n");
}

/** The candidates and the record's Reels after Claude is asked again (`ask`): {candidates, entries, added, highest, ignored}.
    reels.json only ever grows: every candidate already there stays as it is, with its number, its stretches, its crops and
    its preview, and so does every Reel in the record, whatever it is now (picked, dropped, finished or a candidate). A
    candidate a project, a push, a person's notes or the other Mac may name is never taken out from under it. The fresh
    candidates are added, numbered on from the highest number ever given (reels.json's `highest`, and any number in either
    list), in Claude's order, so no number ever names two different stretches.
    A fresh candidate that has words of a candidate or a Reel already there is left out, and `ignored` says so: the same words
    would be offered twice, or as two Reels. Two candidates share words when they share a phrase of the plan. Each clip also
    takes up to a fifth of a second of the pause beside its words, so two neighbouring sentences can overlap by a little
    silence: that is no overlap. A Reel known only by its record entry (as the clips of an episode imported before reels.json
    was made) is known by its times alone, and then the pause it may hold at each end is left out of the comparison.
    `added` is the fresh candidates kept, with their numbers: the ones whose previews are to be made. `highest` is what
    reels.json is to keep. `old` is the reels.json read before, or null. */
export function mergeCandidates({ old, fresh, record }) {
  const entries = record.reels || [];
  const there = old ? old.candidates : [];
  let next = Math.max(0, (old && old.highest) || 0, ...entries.map((e) => e.n), ...there.map((c) => c.n));
  // Each candidate and Reel already there, as what is compared: its phrases when its candidate has them, and otherwise its
  // times without their edges.
  const numbers = [...new Set([...there.map((c) => c.n), ...entries.map((e) => e.n)])];
  const known = numbers.map((n) => {
    const c = there.find((k) => k.n === n);
    const e = entries.find((x) => x.n === n);
    return { n, status: e ? e.status : "candidate", phrases: c && c.phrases, start: c ? c.start : e && e.from, end: c ? c.end : e && e.to };
  }).filter((k) => k.phrases || (Number.isFinite(k.start) && Number.isFinite(k.end)));
  const inner = (x) => [x.start + KEPT_SIDE, x.end - KEPT_SIDE];
  const shares = (c, k) => {
    if (c.phrases && k.phrases) return c.phrases.some((id) => k.phrases.includes(id));
    const [[a, b], [p, q]] = [inner(c), inner(k)];
    return a < q && p < b;
  };
  const ignored = [];
  const added = fresh.filter((c) => {
    const k = known.find((one) => shares(c, one));
    if (k) ignored.push(`A new clip from ${stamp(c.start)} to ${stamp(c.end)} was left out: it has words of Reel ${k.n}, which is ${k.status === "candidate" ? "a candidate" : k.status}.`);
    return !k;
  }).map((c) => ({ ...c, n: (next += 1) }));
  return { candidates: [...there, ...added], entries: [...entries, ...reelEntries(added)], added, highest: next, ignored };
}
