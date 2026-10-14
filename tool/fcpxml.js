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
const fileUrl = (path) => "file://" + String(path).split("/").map(encodeURIComponent).join("/");

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

/** How a caption looks, as Final Cut writes it for a caption of its own: white letters on black. */
const STYLE = { font: ".AppleSystemUIFont", fontSize: 13, fontFace: "Regular", fontColor: "1 1 1 1", backgroundColor: "0 0 0 1" };

/** A tag as lines of the file. The tags it holds are set in by four spaces. Words it holds are given whole and are written as
    they are, since a space there would be read as part of them. An attribute with no value is left off. */
function tag(name, attributes, inside) {
  const head = `<${name}` + Object.entries(attributes).filter(([, value]) => value != null)
    .map(([key, value]) => ` ${key}="${escaped(oneLine(value)).replace(/"/g, "&quot;")}"`).join("");
  if (inside === undefined) return [head + "/>"];
  if (typeof inside === "string") return [`${head}>${escaped(inside)}</${name}>`];
  return [head + ">", ...inside.flat().map((line) => "    " + line), `</${name}>`];
}

/** Where the library is, as the file names it: its whole path as a file:// address, with no slash at the end. That is how the
    two files that were opened in Final Cut Pro 12.4 named their library, one written by hand and one written here, and Final
    Cut Pro made the library and asked nothing. Nobody has tried the address with a slash at its end.
    Anything but the whole path of a library, which is a name ending .fcpbundle, is refused: Final Cut would be sent to a place
    nobody meant. */
function libraryUrl(library) {
  const path = String(library).replace(/\/+$/, "");
  if (!/^\/(?:.*\/)?[^/]+\.fcpbundle$/.test(path)) throw new Error(`The library must be given by its whole path, with a name ending .fcpbundle: ${library}`);
  return fileUrl(path);
}

/** The furthest a wide picture filled into an upright frame can be moved either way and still fill it, in the unit of
    reelPosition. */
export const fillMost = (facts, frame) => (100 * (facts.width - (facts.height * frame.width) / frame.height)) / 2 / facts.height;

/** Where a wide picture is moved in an upright frame so that its crop is what shows: Final Cut's position, "x y". The unit
    is hundredths of the frame's height, and a positive x moves the picture right (a positive y, up). That was seen in Final
    Cut 12.4 in phase 0 (step B2b, 2026-10-14): with each clip naming its own format, a 1920x1080 picture filled the
    1080x1920 frame, and "20 0" moved it right by 384 pixels, 20 hundredths of the frame's height of 1920.
    A picture filled into an upright frame is as tall as the frame, so unmoved its middle shows. Filled, the picture is
    scaled by the frame's height over its own, so moving it by how far the crop's middle is from the picture's comes to that
    distance in hundredths of the picture's own height. A face right of the middle moves the picture left, by a negative x.
    It is never moved so far that the frame is not filled: a crop is rounded down to an even width, so one pressed to the
    edge would leave a sliver of black. */
export function reelPosition(facts, crop, frame) {
  const most = fillMost(facts, frame);
  const x = (100 * (facts.width / 2 - (crop.x + crop.w / 2))) / facts.height;
  const held = Math.max(-most, Math.min(most, x));
  return `${Math.round(held * 10000) / 10000 || 0} 0`;
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
    `frame` is {width, height} of the project, for an upright project of a wide video: then each piece is filled into the
    frame and moved onto the face by its `crop`, {x, y, w, h} in pixels of the picture as it is shown, and the project has a
    format of its own. Given none, the project is the video's own shape. It throws when the frame is not whole pixels, and
    when a piece of an upright project has no crop. */
export function fcpxml({ video, facts, ranges = [], captions = [], markers = [], project, event, library, frame }) {
  if (frame && !(Number.isInteger(frame.width) && frame.width > 0 && Number.isInteger(frame.height) && frame.height > 0)) throw new Error(`The frame of the project must be given in whole pixels: ${frame.width} by ${frame.height}.`);
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
    if (frame && !range.crop) throw new Error(`Piece ${i + 1} of an upright project has no crop to move it onto the face by.`);
    if (to <= from) continue;
    if (pieces.length && from < pieces[pieces.length - 1].to) throw new Error(`The pieces to keep must follow one another in the video: piece ${i + 1} starts before the one before it ends.`);
    pieces.push({ from, to, name: range.name || name, crop: range.crop, captions: [], notes: new Map() });
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
    // In an upright project each clip is first filled into the frame and moved onto the face. Final Cut's definition of the
    // format has these before what sits on the clip.
    const moved = frame ? [tag("adjust-conform", { type: "fill" }), tag("adjust-transform", { position: reelPosition(facts, piece.crop, frame) })] : [];
    const inside = [...moved, ...shown, ...noted];
    // In an upright project each clip names the video's own format. Phase 0, Final Cut 12.4: a clip that does not takes the
    // timeline's, Final Cut takes the wide video for an upright one, warns of "an unexpected value", and does not fill.
    return tag("asset-clip", { ref: "r2", format: frame ? "r1" : undefined, offset: time(offset), name: piece.name, start: time(piece.from), duration: time(piece.to - piece.from) }, inside.length ? inside : undefined);
  });

  // Nothing here needs a later version of the format than 1.10, and older copies of Final Cut Pro open that one too. Final
  // Cut's definition of the format has the library first, before the video.
  const file = tag("fcpxml", { version: "1.10" }, [
    ...(library ? [tag("import-options", {}, [tag("option", { key: "library location", value: libraryUrl(library) })])] : []),
    tag("resources", {}, [
      tag("format", { id: "r1", name: size && speed ? `FFVideoFormat${size}${speed}` : undefined, frameDuration: time(1), width: facts.width, height: facts.height }),
      tag("asset", { id: "r2", name, start: "0s", duration: time(total), hasVideo: 1, format: "r1", videoSources: 1, ...sound }, [
        tag("media-rep", { kind: "original-media", src: fileUrl(video) })
      ]),
      // An upright project's timeline has a format of its own, written as Final Cut 12.4 writes the 1080x1920 format of a
      // project made by hand (phase 0): no name, and its colour space.
      ...(frame ? [tag("format", { id: "r3", frameDuration: time(1), width: frame.width, height: frame.height, colorSpace: "1-1-1 (Rec. 709)" })] : [])
    ]),
    tag("event", { name: event || "Rough cuts" }, [
      tag("project", { name: project || `${name} rough cut` }, [
        tag("sequence", { format: frame ? "r3" : "r1", duration: time(length), tcStart: "0s", tcFormat: "NDF", ...(facts.hasAudio ? { audioLayout: "stereo", audioRate: "48k" } : {}) }, [
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
    one that is there. Each format's frames are the video's, the video's own format is the video's size, and each timeline is
    the size it is meant to be: `frame`, {width, height}, for an upright project, and the video's own size when none is given.
    In a timeline of another shape than the video, each clip names the video's own format, and is filled into the frame and
    moved no further than fills it.
    Every project in the file is checked on its own, and with more than one, each problem says which project it is in.
    `facts` is what ffprobe says of the video. Gives back the problems in plain words. None means it passed. It throws when the
    video's frame rate or its length cannot be read. */
export function checkFcpxml(text, facts, { frame } = {}) {
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

  // Each format's frames are the video's, and the video's own format is the video's size.
  const one = timeOf(1, rate);
  const formats = new Map(all.filter((el) => el.name === "format").map((el) => [el.attrs.id, el]));
  for (const format of formats.values()) {
    if (format.attrs.frameDuration !== one) problems.push(`The format ${format.attrs.id} has frames of ${format.attrs.frameDuration}, and the video's are ${one}.`);
  }
  // The video's size is the one `facts` gives, and when they give none, the one its own format says.
  const asset = all.find((el) => el.name === "asset");
  const own = asset && formats.get(asset.attrs.format);
  const sized = Number.isFinite(facts.width) && Number.isFinite(facts.height);
  if (own && sized && (Number(own.attrs.width) !== facts.width || Number(own.attrs.height) !== facts.height)) problems.push(`The video's format is ${own.attrs.width} by ${own.attrs.height}, and the video is ${facts.width} by ${facts.height}.`);
  const picture = sized ? { width: facts.width, height: facts.height } : own ? { width: Number(own.attrs.width), height: Number(own.attrs.height) } : null;
  const meant = frame || picture;

  // Each project on its own. With more than one, each problem says which project it is in.
  const projects = all.filter((el) => el.name === "project");
  if (!projects.length) return [...problems, "The file has no timeline."];
  for (const project of projects) {
    const said = projects.length > 1 ? (problem) => `In the project "${project.attrs.name}": ${problem[0].toLowerCase()}${problem.slice(1)}` : (problem) => problem;
    const sequence = all.find((el) => el.name === "sequence" && el.parent === project);
    const spine = sequence && all.find((el) => el.name === "spine" && el.parent === sequence);
    if (!spine) {
      problems.push(said("The file has no timeline."));
      continue;
    }
    const shape = formats.get(sequence.attrs.format);
    const size = shape ? { width: Number(shape.attrs.width), height: Number(shape.attrs.height) } : meant;
    if (size && meant && (size.width !== meant.width || size.height !== meant.height)) problems.push(said(`The timeline is ${size.width} by ${size.height}, and it is meant to be ${meant.width} by ${meant.height}.`));
    // A timeline of another shape than the video holds each clip filled into it, and moved no further than fills it.
    const upright = Boolean(size && picture) && (size.width !== picture.width || size.height !== picture.height);
    const most = upright ? fillMost(picture, size) : 0;
    let end = read(sequence, "tcStart");
    let sum = 0;
    all.filter((el) => el.parent === spine).forEach((clip, i) => {
      const n = i + 1;
      if (upright) {
        if (!asset || clip.attrs.format !== asset.attrs.format) problems.push(said(`Clip ${n} does not name the video's own format, so Final Cut takes the wide video for an upright one.`));
        const conform = all.find((e) => e.parent === clip && e.name === "adjust-conform");
        const moved = all.find((e) => e.parent === clip && e.name === "adjust-transform");
        if (!conform || conform.attrs.type !== "fill") problems.push(said(`Clip ${n} is not filled into the frame.`));
        const x = moved ? Number(String(moved.attrs.position || "0 0").split(" ")[0]) : 0;
        if (!(Math.abs(x) <= most + 0.0001)) problems.push(said(`Clip ${n} is moved so far that the frame is not filled.`));
      }
      const [offset, start, length] = ["offset", "start", "duration"].map((key) => read(clip, key));
      // A time that is not on a frame is in the list already, and nothing can be added up from it.
      if (offset === null || start === null || length === null) {
        end = sum = null;
        return;
      }
      if (end !== null && offset > end) problems.push(said(`There is a gap of ${count(offset - end)} before clip ${n}.`));
      if (end !== null && offset < end) problems.push(said(`Clip ${n} overlaps what comes before it by ${count(end - offset)}.`));
      if (start < 0 || start + length > total) problems.push(said(`Clip ${n} runs outside the video.`));
      for (const el of all.filter((e) => e.parent === clip && (e.name === "caption" || e.name === "marker"))) {
        const at = read(el, el.name === "caption" ? "offset" : "start");
        const long = el.name === "caption" ? read(el, "duration") : 1;
        if (at !== null && long !== null && (at < start || at + long > start + length)) problems.push(said(`A ${el.name} on clip ${n} lies outside the clip.`));
      }
      end = offset + length;
      if (sum !== null) sum += length;
    });
    const told = read(sequence, "duration");
    if (told !== null && sum !== null && told !== sum) problems.push(said(`The timeline is said to be ${count(told)} long, and its clips come to ${count(sum)}.`));
  }
  return problems;
}
