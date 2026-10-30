// The recording's captions at their times on the main HyperFrames project's timeline (Jason's by-hand check of 30 October, on his
// episode fbb80c). Studio makes the project with the recording at the start of its timeline (project.js), so the recording's own times are
// the project's. The app's agent moves it: asked for a 3 second title card, it put the recording at `data-start="3"`, and `show …
// transcript` went on printing the words 3 seconds early. The page says where the recording is, so this reads that, and puts each caption
// of the recording's `.srt` at the moment of it that is on the timeline.
//
// The page's timing is read as the pinned command line reads it (version 0.8.208, LINKED_TIMING_FIELDS in its dist): `data-start`, when the
// clip starts on the timeline, in seconds (0 when the page gives none); `data-duration`; the media's in-point, which is `data-playback-start`
// or else `data-media-start` (0 when the page gives neither); and `data-playback-rate` (1 when it gives none). The clip shows the recording
// from its in-point on, for `duration × rate` seconds of it. A clip the app splits is cloned with a later in-point, so a recording that was
// split is several placements, and a stretch no placement shows was cut.
//
// A placement is a `<video>` or an `<audio>` whose `src` is the recording, in index.html's own markup, with a start that is a number and a
// duration above 0. Nested compositions are not read: a composition a host names (`data-composition-src`) is a file of its own, on a clock
// of its own, and an inline one (a second `data-composition-id` around the recording) starts at a time that the recording's start is
// relative to; a recording inside either cannot be read as a placement. A page that does not place the recording so is one that cannot be
// read, and so is a page with even one element of the recording that cannot be: where the rest of it is on the timeline is then not known,
// and the elements that can be read would tell only part of it. `show` prints the recording's own transcript for such a page, as it did
// before.
//
// Pure over the page's text and the captions, but for `recordingPlacementsIn`, which reads index.html as the project's other files are read
// (on-screen.js projectReader: a regular file of at most 2 MB, never through a link) and only reads.
import { posix } from "node:path";
import { captionTime } from "./cuts.js";
import { captionsOf, stampedText } from "./lib.js";
import { htmlTree, projectReader } from "./on-screen.js";

/** The recording, as the project names it: the file Studio puts in every project it makes (project.js). */
export const RECORDING = "media/recording.mp4";

/** The number an attribute's text is, or NaN: blank text is no number. */
function numberOf(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  return trimmed === "" ? NaN : Number(trimmed);
}

/** A timing field of a clip as the command line reads it: the first of the attributes `names` whose text is a number, or `fallback`
    when none is. */
function fieldOf(attrs, names, fallback) {
  for (const name of names) {
    const value = numberOf(attrs[name]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

/** Where a clip with the attributes `attrs` is on the timeline, { start, duration, mediaStart, rate }, or null when it is not a place:
    a start that is not a number of 0 or more (a page can start a clip after another by its name, which is not a time), a duration that
    is not a number above 0, an in-point below 0, or a rate that is not above 0. A start the page does not give is 0. */
function placementOf(attrs) {
  const given = (attrs["data-start"] ?? "").trim();
  const start = given === "" ? 0 : numberOf(given);
  const duration = numberOf(attrs["data-duration"]);
  const mediaStart = fieldOf(attrs, ["data-playback-start", "data-media-start"], 0);
  const rate = fieldOf(attrs, ["data-playback-rate"], 1);
  if (!(Number.isFinite(start) && start >= 0 && Number.isFinite(duration) && duration > 0 && mediaStart >= 0 && rate > 0)) return null;
  return { start, duration, mediaStart, rate };
}

/** Whether the `src` of an element is the recording: its path, with a leading ./ or doubled slashes settled. */
const isRecording = (src) => typeof src === "string" && posix.normalize(src.trim()) === RECORDING;

/** Where the page `html` (an index.html) puts the recording on its timeline: a list of { start, duration, mediaStart, rate }, in the
    order the page has them. None for a page that is not text, has more elements than a page is read for, or places the recording
    nowhere that can be read (see the top of this file). None as well when any `<video>` or `<audio>` of the recording cannot be read as
    a placement (a start by another clip's name, a duration that is no time, or an element in a composition of its own): the page then
    shows the recording somewhere that is not known, and the placements that can be read would tell only part of it. */
export function recordingPlacements(html) {
  if (typeof html !== "string") return [];
  const tree = htmlTree(html);
  if (tree === null) return [];
  const found = [];
  let unreadable = false;
  /** `compositions` is how many compositions the element is inside: the main one is one, and the recording is read inside no more. */
  const walk = (node, compositions) => {
    if (node.text !== undefined) return;
    const { tag, attrs } = node;
    if ((tag === "video" || tag === "audio") && isRecording(attrs.src)) {
      const placed = compositions <= 1 ? placementOf(attrs) : null;
      if (placed) found.push(placed);
      else unreadable = true;
    }
    // A host's file has a clock of its own, and so has a composition inside the page: what is in either is not on the timeline's.
    const host = attrs["data-composition-src"] !== undefined;
    const inside = host ? Math.max(compositions + 1, 2) : compositions + (attrs["data-composition-id"] !== undefined ? 1 : 0);
    for (const kid of node.kids) walk(kid, inside);
  };
  walk(tree, 0);
  return unreadable ? [] : found;
}

/** The captions (captionsOf's, each { start, end, text } in seconds of the recording) at their times on the timeline `placements`
    (recordingPlacements') put the recording on: a list of { start, end, text } in timeline order, for a caption that is the same moment
    in the order the captions have. A placement shows the recording from its in-point M for duration × rate seconds of it, so a caption
    [a, b] overlaps it where it and [M, M + duration × rate) do, and is at start + (max(a, M) − M) / rate there: a caption that begins
    before the in-point is at the placement's start. A caption that two placements show is at the earlier of its two times, once, and a
    caption that no placement shows (its stretch was cut) is left out. A caption of no length is at one moment, and is in a placement
    from its in-point to just before its end. Nothing it is given is changed. */
export function captionsOnTimeline(captions, placements) {
  const placed = [];
  (Array.isArray(captions) ? captions : []).forEach((caption, index) => {
    let first = null;
    for (const place of Array.isArray(placements) ? placements : []) {
      const mediaEnd = place.mediaStart + place.duration * place.rate;
      const from = Math.max(caption.start, place.mediaStart);
      const to = Math.min(caption.end, mediaEnd);
      const moment = caption.end <= caption.start;
      if (moment ? !(place.mediaStart <= caption.start && caption.start < mediaEnd) : !(from < to)) continue;
      const start = place.start + (from - place.mediaStart) / place.rate;
      if (first === null || start < first.start) first = { start, end: place.start + (Math.max(from, to) - place.mediaStart) / place.rate, text: caption.text };
    }
    if (first !== null) placed.push({ ...first, index });
  });
  return placed.sort((a, b) => a.start - b.start || a.index - b.index).map(({ index, ...line }) => line);
}

/** The recording's captions `srt` at their times on the timeline `placements` put it on, as the transcript tool stamps a transcript
    (lib.js stampedText: one "[m:ss] words" line to a caption, the text ending in a new line), "" when the file has captions and none is on
    the timeline, and null when it holds no captions at all (empty, or not captions): that says nothing of the timeline. */
export function timelineTranscript(srt, placements) {
  const captions = captionsOf(srt);
  if (!captions.length) return null;
  const lines = captionsOnTimeline(captions, placements);
  return stampedText(lines.map((line, i) => `${i + 1}\n${captionTime(line.start)} --> ${captionTime(line.end)}\n${line.text}\n`).join("\n"));
}

/** Where the project in the folder `dir` puts the recording on its timeline: recordingPlacements of its index.html, or none when the
    folder or the file is not there, is a link, or is more than 2 MB. `io` is on-screen.js projectReader's. It only reads. */
export function recordingPlacementsIn(dir, io) {
  const read = projectReader(dir, io);
  const file = read === null ? null : read("index.html");
  return file === null ? [] : recordingPlacements(file.text);
}
