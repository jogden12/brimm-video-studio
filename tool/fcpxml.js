// Writes a Final Cut Pro project file (FCPXML) from a video and the list of the pieces of it to keep. Final Cut Pro opens the file
// as a project with those cuts already made on its timeline, the captions in place, and a marker wherever there is a note.
// What the file holds: the cuts, the captions, the notes for the editor and, when it is told one, the library the project goes
// into. What it cannot do: it cannot make Final Cut export a video, and a title or a graphic in such a file is only the name of
// a template on that Mac, so none is written here.
// Nothing here touches a disk or runs a program. It takes plain data and gives back text.
import { basename, extname } from "node:path";

/** Final Cut's own names for the formats it knows, by the size of the picture and by the frames a second. These are the ones found
    inside Final Cut Pro 12.4. A format that is not among them goes without a name, and Final Cut goes by its numbers. */
const SIZES = { "1920x1080": "1080p", "1280x720": "720p", "3840x2160": "3840x2160p" };
const RATES = { "24000/1001": "2398", "24/1": "24", "25/1": "25", "30000/1001": "2997", "30/1": "30", "50/1": "50", "60000/1001": "5994", "60/1": "60" };

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** The frame rate as ffprobe gives it, "30000/1001" or "30/1", as two whole numbers with nothing left to divide out. */
function rateOf(frameRate) {
  const m = /^(\d+)(?:\/(\d+))?$/.exec(String(frameRate).trim());
  const frames = m ? Number(m[1]) : 0;
  const seconds = m ? Number(m[2] || 1) : 0;
  if (!frames || !seconds) throw new Error(`The video's frame rate cannot be read: ${frameRate}`);
  const g = gcd(frames, seconds);
  return { frames: frames / g, seconds: seconds / g };
}

/** A moment in seconds as a count of frames, to the nearest one. Every sum after this is done in frames, so that nothing drifts. */
const framesAt = (seconds, rate) => Math.round((Number(seconds) * rate.frames) / rate.seconds);

/** How many whole frames the video holds. Part of a frame at the end is not counted, so that no piece runs past the end. ffprobe
    gives the length to a millionth of a second, so a length a hair short of a whole frame is that frame. */
function framesIn(facts, rate) {
  const count = Math.floor((Number(facts.duration) * rate.frames) / rate.seconds + 0.001);
  if (!(count > 0)) throw new Error(`The video's length cannot be read: ${facts.duration}`);
  return count;
}

/** A count of frames as the file writes a time: a fraction of a second, "300300/30000s", or whole seconds, "5s". */
function timeOf(count, rate) {
  const top = count * rate.seconds;
  return top % rate.frames === 0 ? `${top / rate.frames}s` : `${top}/${rate.frames}s`;
}

/** Where a file is, as Final Cut writes it: file:// and the path, with every character an address cannot hold as %xx. */
export const fileUrl = (path) => "file://" + String(path).split("/").map(encodeURIComponent).join("/");

/** Where a file is from the folder of the Final Cut file that names it, as an address: each folder's name and the file's with
    every character an address cannot hold as %xx, joined by slashes, and ".." left as it is. "../Pricing talk.mp4" is
    "../Pricing%20talk.mp4". A file kept in Dropbox names its video this way, so it reads the same from either Mac. */
export const relativeUrl = (path) => String(path).split("/").map(encodeURIComponent).join("/");

/** Text from outside, without the characters XML does not allow: the control characters other than a tab and a line break, and
    one half alone of a character that is written as two. */
const clean = (text) => String(text ?? "").replace(/[^\t\n\r\x20-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu, "");

/** Text on one line, for a name. */
const oneLine = (text) => clean(text).replace(/\s+/g, " ").trim();

/** A caption's words. A line break stays a line break, which is how the file writes a caption of two lines, and the space around
    each line is taken off. */
const wordsOf = (text) => clean(text).split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean).join("\n");

/** Text with the three characters that would be read as part of a tag written out. */
const escaped = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Text as the value of an attribute: on one line, and with the characters that would end it or start a tag written out. Every
    attribute in the file is written this way, and code that changes a name in a file this module wrote uses it too. */
export const attribute = (text) => escaped(oneLine(text)).replace(/"/g, "&quot;");

/** How a caption looks, as Final Cut writes it for a caption of its own: white letters on black. */
const STYLE = { font: ".AppleSystemUIFont", fontSize: 13, fontFace: "Regular", fontColor: "1 1 1 1", backgroundColor: "0 0 0 1" };

/** A tag as lines of the file. The tags it holds are set in by four spaces. Words it holds are given whole and are written as
    they are, since a space there would be read as part of them. An attribute with no value is left off. */
function tag(name, attributes, inside) {
  const head = `<${name}` + Object.entries(attributes).filter(([, value]) => value != null)
    .map(([key, value]) => ` ${key}="${attribute(value)}"`).join("");
  if (inside === undefined) return [head + "/>"];
  if (typeof inside === "string") return [`${head}>${escaped(inside)}</${name}>`];
  return [head + ">", ...inside.flat().map((line) => "    " + line), `</${name}>`];
}

/** Where the library is, as the file names it: its whole path as a file:// address, with no slash at the end. That is how the
    two files that were opened in Final Cut Pro 12.4 named their library, one written by hand and one written here, and Final
    Cut Pro made the library and asked nothing. Nobody has tried the address with a slash at its end.
    Anything but the whole path of a library, which is a name ending .fcpbundle, is refused: Final Cut would be sent to a place
    nobody meant. */
export function libraryUrl(library) {
  const path = String(library).replace(/\/+$/, "");
  if (!/^\/(?:.*\/)?[^/]+\.fcpbundle$/.test(path)) throw new Error(`The library must be given by its whole path, with a name ending .fcpbundle: ${library}`);
  return fileUrl(path);
}

/** The whole project file, as text.
    `video` is the path of the video file, and `facts` is what ffprobe says of it: { duration, frameRate, width, height, hasAudio,
    audioRate, audioChannels }. `ranges` are the pieces to keep, in order, as [{ start, end, name }] in seconds of the video.
    `captions` are [{ start, end, text }] and `markers`, the notes for the editor, are [{ at, text }]. Both are in seconds of the
    video too, and not of the cut. It throws when the video's frame rate or its length cannot be read, when a time of a piece, a
    caption or a note cannot be read, and when a piece starts before the one before it ends.
    `library` is the whole path of the library the project is to go into, a name ending .fcpbundle. Final Cut Pro makes the
    library when it is not there, and imports the file with no question asked. Given none, Final Cut asks where the project
    goes. Final Cut Pro cannot keep a library in a folder that syncs to a cloud drive, so name one that does not. It throws
    when the library is not such a path.
    `src`, when it is given, is where the file says the video is, written as it is given: an address from the file's own
    folder, such as "../Pricing%20talk.mp4" (relativeUrl makes one), for a file that is kept beside its video in Dropbox and
    is read on either Mac. Given none, the file names the video by its whole path, as before. */
export function fcpxml({ video, facts, ranges = [], captions = [], markers = [], project, event, library, src }) {
  const rate = rateOf(facts.frameRate);
  const time = (count) => timeOf(count, rate);
  /** A time from outside as a count of frames. One that is not a number, or is not there, is refused. Let through, it would take
      a piece of the video or a caption out of the file without a word, or put a note on a frame nobody meant. */
  const frames = (seconds, what) => {
    const count = seconds === null || String(seconds).trim() === "" ? NaN : framesAt(seconds, rate);
    if (Number.isNaN(count)) throw new Error(`The ${what} cannot be read: ${seconds}`);
    return count;
  };
  const total = framesIn(facts, rate);
  const name = basename(video, extname(video));
  const size = SIZES[`${facts.width}x${facts.height}`];
  const speed = RATES[`${rate.frames}/${rate.seconds}`];
  const sound = facts.hasAudio ? { hasAudio: 1, audioSources: 1, audioChannels: facts.audioChannels, audioRate: facts.audioRate } : {};

  // The pieces kept, each end on a frame of the video. One that comes to no frames is left out. They come in the order of the
  // video, and where a caption or a note lands goes by that. So a piece that starts before the last one kept ends is refused: it
  // would play part of the video twice, or put a caption on the wrong piece.
  const pieces = [];
  for (const [i, range] of ranges.entries()) {
    const from = Math.max(0, frames(range.start, `start of piece ${i + 1}`));
    const to = Math.min(total, frames(range.end, `end of piece ${i + 1}`));
    if (to <= from) continue;
    if (pieces.length && from < pieces[pieces.length - 1].to) throw new Error(`The pieces to keep must follow one another in the video: piece ${i + 1} starts before the one before it ends.`);
    pieces.push({ from, to, name: range.name || name, captions: [], notes: new Map() });
  }

  // A caption goes on the first kept piece it shows over, and shows no longer than that piece runs. So one that starts in a piece
  // that was cut out begins with the next piece, and one that lies wholly in what was cut out goes nowhere.
  for (const [i, caption] of captions.entries()) {
    const from = frames(caption.start, `start of caption ${i + 1}`);
    const to = frames(caption.end, `end of caption ${i + 1}`);
    const words = wordsOf(caption.text);
    const piece = words && to > from && pieces.find((p) => p.to > from && p.from < to);
    if (piece) piece.captions.push({ from: Math.max(from, piece.from), to: Math.min(to, piece.to), words });
  }

  // A note goes on the kept piece that holds its moment. When the moment was cut out it goes on the first frame of the next kept
  // piece, which is the join, and when nothing was kept after it, on the last frame that was. Two markers on one frame would lie
  // one over the other, so the notes that land on one frame are written as one marker.
  for (const [i, marker] of markers.entries()) {
    const at = frames(marker.at, `moment of note ${i + 1}`);
    const piece = pieces.find((p) => p.from <= at && at < p.to) || pieces.find((p) => p.from > at) || pieces[pieces.length - 1];
    if (!piece) continue;
    const frame = Math.min(Math.max(at, piece.from), piece.to - 1);
    piece.notes.set(frame, [...(piece.notes.get(frame) || []), oneLine(marker.text)]);
  }

  // On the timeline each piece begins where the one before it ends. What sits on a piece is placed by the video's own time, since
  // a clip keeps the clock of the video it shows. Final Cut's definition of the format has the captions before the markers.
  let length = 0;
  let styles = 0;
  const clips = pieces.map((piece) => {
    const offset = length;
    length += piece.to - piece.from;
    const shown = piece.captions.map((caption) => {
      const style = `ts${++styles}`;
      return tag("caption", { lane: 1, offset: time(caption.from), name: caption.words, duration: time(caption.to - caption.from), role: "iTT?captionFormat=ITT.en" }, [
        tag("text", { placement: "bottom" }, [tag("text-style", { ref: style }, caption.words)]),
        tag("text-style-def", { id: style }, [tag("text-style", STYLE)])
      ]);
    });
    const noted = [...piece.notes].sort(([a], [b]) => a - b).map(([frame, texts]) => tag("marker", { start: time(frame), duration: time(1), value: texts.filter(Boolean).join(" / ") }));
    const inside = [...shown, ...noted];
    return tag("asset-clip", { ref: "r2", offset: time(offset), name: piece.name, start: time(piece.from), duration: time(piece.to - piece.from) }, inside.length ? inside : undefined);
  });

  // Nothing here needs a later version of the format than 1.10, and older copies of Final Cut Pro open that one too. Final
  // Cut's definition of the format has the library first, before the video.
  const file = tag("fcpxml", { version: "1.10" }, [
    ...(library ? [tag("import-options", {}, [tag("option", { key: "library location", value: libraryUrl(library) })])] : []),
    tag("resources", {}, [
      tag("format", { id: "r1", name: size && speed ? `FFVideoFormat${size}${speed}` : undefined, frameDuration: time(1), width: facts.width, height: facts.height }),
      tag("asset", { id: "r2", name, start: "0s", duration: time(total), hasVideo: 1, format: "r1", videoSources: 1, ...sound }, [
        tag("media-rep", { kind: "original-media", src: src || fileUrl(video) })
      ])
    ]),
    tag("event", { name: event || "Rough cuts" }, [
      tag("project", { name: project || `${name} rough cut` }, [
        tag("sequence", { format: "r1", duration: time(length), tcStart: "0s", tcFormat: "NDF", ...(facts.hasAudio ? { audioLayout: "stereo", audioRate: "48k" } : {}) }, [
          tag("spine", {}, clips)
        ])
      ])
    ])
  ]);
  return ['<?xml version="1.0" encoding="UTF-8"?>', "<!DOCTYPE fcpxml>", "", ...file].join("\n") + "\n";
}

/** Every tag in a project file, in order, with its attributes and the tag it sits in. It reads a file as this module writes
    one, and is not a reader of XML at large. */
function tagsIn(text) {
  const all = [];
  const open = [];
  for (const m of String(text).matchAll(/<(\/?)([A-Za-z][\w.-]*)((?:\s+[\w.:-]+="[^"]*")*)\s*(\/?)>/g)) {
    if (m[1]) {
      open.pop();
      continue;
    }
    const el = { name: m[2], attrs: Object.fromEntries([...m[3].matchAll(/([\w.:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])), parent: open[open.length - 1] };
    all.push(el);
    if (!m[4]) open.push(el);
  }
  return all;
}

/** A time from a project file as a count of frames, or null when it is not a whole number of them. */
function framesOf(time, rate) {
  const m = /^(-?\d+)(?:\/(\d+))?s$/.exec(time);
  if (!m) return null;
  const top = Number(m[1]) * rate.frames;
  const bottom = Number(m[2] || 1) * rate.seconds;
  return bottom && top % bottom === 0 ? top / bottom : null;
}

/** The kind of thing a tag's ref has to name. A ref on any other tag has only to name something that is in the file. */
const POINTS_AT = { "asset-clip": "asset", "text-style": "text-style-def" };

/** Our own checks of a project file, for what Final Cut's definition of the format cannot see: that every time is a whole number
    of frames, that the clips follow one another with no gap and no overlap, that no clip runs outside the video, that a caption
    or a note lies in its clip, that the timeline is as long as its clips, and that whatever points at a part of the file points at
    one that is there. `facts` is what ffprobe says of the video. Gives back the problems in plain words. None means it passed.
    It throws when the video's frame rate or its length cannot be read. */
export function checkFcpxml(text, facts) {
  const rate = rateOf(facts.frameRate);
  const total = framesIn(facts, rate);
  const all = tagsIn(text);
  const problems = [];
  const count = (frames) => `${frames} frame${frames === 1 ? "" : "s"}`;
  /** A time on a tag, in frames: null when it is not on a frame, and 0 when it is not given, which is how Final Cut reads an
      offset or a start that is left off. A clip with no duration is another matter: Final Cut takes it to be as long as its
      video. This module writes none, so none is looked for. */
  const read = (el, key) => (key in el.attrs ? framesOf(el.attrs[key], rate) : 0);

  for (const el of all) {
    for (const key of ["offset", "start", "duration"]) {
      if (read(el, key) === null) problems.push(`One ${el.name} has the ${key} ${el.attrs[key]}, which is not a whole number of frames.`);
    }
  }

  const kinds = new Map(all.filter((el) => "id" in el.attrs).map((el) => [el.attrs.id, el.name]));
  for (const el of all) {
    for (const [key, kind] of [["format", "format"], ["ref", POINTS_AT[el.name]]]) {
      const id = el.attrs[key];
      if (id === undefined) continue;
      if (kind ? kinds.get(id) !== kind : !kinds.has(id)) problems.push(`The ${el.name} points at "${id}", and the file holds ${kind ? `no ${kind}` : "nothing"} of that name.`);
    }
  }

  const sequence = all.find((el) => el.name === "sequence");
  const spine = sequence && all.find((el) => el.name === "spine");
  if (!spine) return [...problems, "The file has no timeline."];
  let end = read(sequence, "tcStart");
  let sum = 0;
  all.filter((el) => el.parent === spine).forEach((clip, i) => {
    const n = i + 1;
    const [offset, start, length] = ["offset", "start", "duration"].map((key) => read(clip, key));
    // A time that is not on a frame is in the list already, and nothing can be added up from it.
    if (offset === null || start === null || length === null) {
      end = sum = null;
      return;
    }
    if (end !== null && offset > end) problems.push(`There is a gap of ${count(offset - end)} before clip ${n}.`);
    if (end !== null && offset < end) problems.push(`Clip ${n} overlaps what comes before it by ${count(end - offset)}.`);
    if (start < 0 || start + length > total) problems.push(`Clip ${n} runs outside the video.`);
    for (const el of all.filter((e) => e.parent === clip && (e.name === "caption" || e.name === "marker"))) {
      const at = read(el, el.name === "caption" ? "offset" : "start");
      const long = el.name === "caption" ? read(el, "duration") : 1;
      if (at !== null && long !== null && (at < start || at + long > start + length)) problems.push(`A ${el.name} on clip ${n} lies outside the clip.`);
    }
    end = offset + length;
    if (sum !== null) sum += length;
  });
  const said = read(sequence, "duration");
  if (said !== null && sum !== null && said !== sum) problems.push(`The timeline is said to be ${count(said)} long, and its clips come to ${count(sum)}.`);
  return problems;
}
