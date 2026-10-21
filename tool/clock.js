// Times and words a person gives (spec section 4, "Times a person gives"): read on the timeline she names, as she watched it
// in Final Cut, and mapped back to seconds of the raw video, where the record keeps every time. A time in what is cut now is
// refused, with the kept words nearest it.
// Nothing here touches a disk or runs a program.

/** A time as a person gives it, in seconds: "0:03", "12:30", "1:02:03", or seconds alone, "45" or "3.5". null for anything
    else. */
export function secondsOf(said) {
  const m = /^(?:(\d+):)?(?:(\d{1,2}):)?(\d+(?:\.\d+)?)$/.exec(String(said ?? "").trim());
  if (!m) return null;
  const parts = [m[1], m[2], m[3]].filter((p) => p !== undefined).map(Number);
  if (parts.length > 1 && parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((sum, p) => sum * 60 + p, 0);
}

/** Seconds as a clock shows them, to the second: "0:05", "12:30", "1:02:03". */
export function clockText(seconds) {
  const s = Math.round(seconds);
  const [h, m, r] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const two = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

/** A time of a Final Cut file, "300300/30000s" or "5s", in seconds. */
const timeIn = (text) => {
  const m = /^(-?\d+)(?:\/(\d+))?s$/.exec(String(text ?? "0s"));
  return m ? Number(m[1]) / Number(m[2] || 1) : NaN;
};

/** The clock of a timeline as a Final Cut file keeps it: each clip of its spine, in order, as { at, from, to }, where `at`
    is where it starts on the timeline and `from` and `to` are seconds of the raw video, `position`, the clip's move,
    when it has one, and `notes`, the words of the markers on it. It reads a file as brimm-video
    writes one, not Final Cut's files at large. */
export function clockOf(text) {
  const spine = /<spine>([\s\S]*?)<\/spine>/.exec(String(text));
  if (!spine) return [];
  // Each clip, and the move on it when it has one: an upright project's clip moved onto the face (phase 3).
  return [...spine[1].matchAll(/<asset-clip((?:\s+[\w.:-]+="[^"]*")*)\s*(\/?)>((?:(?!<asset-clip)[\s\S])*?)(?=<asset-clip|$)/g)].map((m) => {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w.:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const from = timeIn(attrs.start || "0s");
    const moved = m[2] ? null : /<adjust-transform\b[^>]*\sposition="([^"]*)"/.exec(m[3]);
    const notes = m[2] ? [] : [...m[3].matchAll(/<marker\b[^>]*\svalue="([^"]*)"/g)].map((n) => n[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
    return { at: timeIn(attrs.offset || "0s"), from, to: from + timeIn(attrs.duration), ...(moved ? { position: moved[1] } : {}), notes };
  });
}

/** The clock of a timeline as kept pieces, { start, end } of the raw video in order, would give it. */
export function clockOfRanges(ranges) {
  let at = 0;
  return ranges.map((r) => {
    const piece = { at, from: r.start, to: r.end };
    at += r.end - r.start;
    return piece;
  });
}

const EDGE = 0.0005;
/** How far a pushed file's clip may start before, or end past, its kept piece: it starts and ends on a frame. */
export const FRAME_SLACK = 0.05;
/** The second of the raw video at a time on a clock, or null when the time is past its end. */
export function rawAt(clock, t) {
  const piece = clock.find((p) => t >= p.at - EDGE && t < p.at + (p.to - p.from) - EDGE) || (clock.length && Math.abs(t - lengthOf(clock)) < EDGE ? clock[clock.length - 1] : null);
  return piece ? piece.from + (t - piece.at) : null;
}
/** The time on a clock of a second of the raw video, or null when it is not on that clock: cut out of it. */
export function timelineAt(clock, raw) {
  const piece = clock.find((p) => raw >= p.from - EDGE && raw <= p.to + EDGE);
  return piece ? piece.at + Math.min(Math.max(raw - piece.from, 0), piece.to - piece.from) : null;
}
/** A time past the end of a clock, said with the clock's length; to the tenth of a second when, to the second, the two would
    read the same ("0:04 is after the end …, which is 0:03.9 long"). */
function pastEnd(t, on, clock) {
  const length = lengthOf(clock);
  const tenths = Math.floor(length * 10) / 10;
  const shown = clockText(length) === clockText(t) ? `${clockText(Math.floor(tenths))}.${Math.round((tenths % 1) * 10)}` : clockText(length);
  return `${clockText(t)} is after the end of ${on}, which is ${shown} long.`;
}
/** How long a clock runs. */
export const lengthOf = (clock) => (clock.length ? clock[clock.length - 1].at + clock[clock.length - 1].to - clock[clock.length - 1].from : 0);

/** The recording's words as they were heard: the transcriber starts a word where the word before it ended (cuts.js wordsOf),
    so a word after a pause starts in the pause. A phrase starts on the pause's end where there is one (cuts.js phrasesOf),
    so each word starts no earlier than the phrase it ends in. Captions, and words a person quotes, start when they are said. */
export const heardWords = (words, phrases) => words.map((w) => {
  const phrase = phrases.find((p) => w.end > p.start && w.end <= p.end + 0.0005);
  return phrase && w.start < phrase.start ? { ...w, start: phrase.start } : w;
});

/** A word as words are compared: in lower case, without its punctuation. */
const plain = (w) => String(w).normalize("NFC").toLowerCase().replace(/[’]/g, "'").replace(/[^\p{L}\p{N}']+/gu, "");

/** The words of the recording that a timeline keeps: those that end in one of its kept pieces, `ranges`. */
export const keptWords = (words, ranges) => words.filter((w) => ranges.some((r) => w.end > r.start && w.end <= r.end));

/** Where quoted words are said among a timeline's kept words: each place, { start, end } in seconds of the raw video, from the
    first word's start (no earlier than its piece's) to the last word's end. Compared without case or punctuation. */
export function wordsAt(words, ranges, said) {
  const wanted = String(said ?? "").split(/\s+/).map(plain).filter(Boolean);
  // Each kept word as the words it reads as: one the episode spells as several is each of them, and a mark the transcriber
  // wrote as a word of its own reads as none.
  const kept = keptWords(words, ranges).flatMap((w) => String(w.w).split(/\s+/).map(plain).filter(Boolean).map((p) => ({ ...w, p })));
  const found = [];
  if (!wanted.length) return found;
  for (let i = 0; i + wanted.length <= kept.length; i++) {
    if (wanted.every((w, k) => kept[i + k].p === w)) {
      const piece = ranges.find((r) => kept[i].end > r.start && kept[i].end <= r.end);
      found.push({ start: Math.max(kept[i].start, piece.start), end: kept[i + wanted.length - 1].end });
    }
  }
  return found;
}

/** The moment a person gives on a timeline, in seconds of the raw video: { at } and, for quoted words, `to`, the second they
    end, and `for`, how long they take on the timeline, never counting what is cut between; or { why } in plain words. `on` names the timeline as she knows it ("main v3"); `clock` is the clock she watched
    (the newest version pushed, or the timeline as it is now when none was); `ranges` are its kept pieces now, and `words`
    the recording's words. Given `time` (as a person says it) or `quoted` words:
    - a time past the clock's end is refused, with its length;
    - a time that falls in what is cut now (it was kept in the version she watched) is refused, with the kept words nearest;
    - words found nowhere, or found more than once, are refused, the second with each place on her clock. */
export function momentOf({ time, quoted, on, clock, ranges, words, end = false }) {
  if (quoted !== undefined) {
    const places = wordsAt(words, ranges, quoted);
    if (!places.length) return { why: `"${quoted}" is not said in what ${on} keeps. Say the words as they are said, or give the time.` };
    if (places.length > 1) {
      const at = places.map((p) => timelineAt(clock, p.start)).map((t) => (t === null ? "in what is cut now" : `at ${clockText(t)}`));
      return { why: `"${quoted}" is said ${places.length} times on ${on}: ${at.join(", ")}. Say the time instead.` };
    }
    const [{ start, end }] = places;
    const shown = ranges.reduce((sum, r) => sum + Math.max(0, Math.min(end, r.end) - Math.max(start, r.start)), 0);
    return { at: start, to: end, for: Math.round(shown * 1000) / 1000 };
  }
  let t = secondsOf(time);
  if (t === null) return { why: `"${time}" is not a time. Say it as minutes and seconds, like 0:03 or 12:30.` };
  // The end of a stretch may be the timeline's own end, read off its clock to the second: up to a second past it is the end.
  if (end && t > lengthOf(clock) && t <= lengthOf(clock) + 1) t = lengthOf(clock);
  const raw = rawAt(clock, t);
  if (raw === null) return { why: pastEnd(t, on, clock) };
  // A stretch's end may be a kept piece's own end; a pushed file's clips end on a frame, a little past it, and start on one, a
  // little before it: a time on a clip's first frame is its piece's start.
  const inside = (r) => (end ? raw > r.start + EDGE && raw <= r.end + FRAME_SLACK : raw >= r.start - FRAME_SLACK && raw < r.end - EDGE);
  const piece = ranges.find(inside);
  if (!piece) return { why: `${clockText(t)} on ${on} is in what is cut now. ${nearest(words, ranges, raw, clock)}` };
  return { at: Math.round((end ? raw : Math.max(raw, piece.start)) * 1000) / 1000 };
}

/** The places on a clock where the raw video was cut: between two clips whose seconds of the raw video do not meet and, given
    the timeline's `edges` ({ from, to }: the whole recording for the main video, its stretch for a Reel), before its first
    clip and after its last. Each is { at, from, to }: where it is on the timeline, and the seconds of the raw video cut out
    there. */
export function cutsOn(clock, edges) {
  const GAP = 0.1;
  const cuts = [];
  if (!clock.length) return cuts;
  if (edges && clock[0].from - edges.from > GAP) cuts.push({ at: 0, from: edges.from, to: clock[0].from });
  for (let i = 1; i < clock.length; i++) if (clock[i].from - clock[i - 1].to > GAP) cuts.push({ at: clock[i].at, from: clock[i - 1].to, to: clock[i].from });
  const last = clock[clock.length - 1];
  if (edges && edges.to - last.to > GAP) cuts.push({ at: lengthOf(clock), from: last.to, to: edges.to });
  return cuts;
}

/** How far from a cut, in seconds of the timeline, a time a person gives may be and still mean it. */
export const NEAR = 5;

/** A sentence's end: a full stop, unless it ends in one already, or in a quote that does. */
const ended = (text) => (/[.!?…]"?$/.test(text) ? text : `${text}.`);
/** The first words of what was said, for a person to know it by. */
const opening = (text) => {
  const words = String(text).split(/\s+/);
  return words.length > 5 ? `${words.slice(0, 5).join(" ")}…` : text;
};

/** The cut nearest a time a person gives on a timeline, "keep the Hormozi story at 12:30": { cut } (cutsOn, with the words
    cut there), or { why } in plain words. `said(cut)` gives what is said in a cut, { cut, kept }: the words cut there now,
    and those kept there again since. Only a cut with words counts, never a pause alone, and only within NEAR seconds of the
    time. It is the one when it is the only one so near, or when it is within a second and the next more than 2 seconds off;
    otherwise each is named, and nothing is guessed (spec section 4: a command refuses rather than guess). One whose words are
    all kept again is said to be kept already. */
export function cutNear({ time, on, clock, edges, said }) {
  const t = secondsOf(time);
  if (t === null) return { why: `"${time}" is not a time. Say it as minutes and seconds, like 0:03 or 12:30.` };
  if (t > lengthOf(clock) + 1) return { why: pastEnd(t, on, clock) };
  const off = (c) => Math.abs(c.at - t);
  const worded = cutsOn(clock, edges).map((c) => ({ ...c, ...said(c) })).filter((c) => c.cut || c.kept).sort((a, b) => off(a) - off(b));
  const near = worded.filter((c) => off(c) <= NEAR);
  if (near.length === 1 || (near.length > 1 && off(near[0]) <= 1 && off(near[1]) > 2)) return near[0].cut ? { cut: near[0] } : { why: `"${near[0].kept}" is kept on ${on} already.` };
  if (near.length > 1) {
    const each = [...near].sort((a, b) => a.at - b.at).map((c) => `at ${clockText(c.at)}, "${opening(c.cut || c.kept)}"${c.cut ? "" : " (kept already)"}`);
    return { why: `There are ${near.length} places near ${clockText(t)} on ${on} where words were cut: ${ended(each.length === 2 ? each.join(", and ") : `${each.slice(0, -1).join("; ")}; and ${each[each.length - 1]}`)} Say the words that were cut (--words), or a time nearer one of them.` };
  }
  const cut = worded.find((c) => c.cut);
  if (!cut) return { why: `Nothing with words is cut from ${on}, so there is nothing there to keep.` };
  return { why: `There is no cut with words near ${clockText(t)} on ${on}: ${ended(`the nearest is at ${clockText(cut.at)}, "${opening(cut.cut)}"`)} Say that time, or the words that were cut (--words).` };
}

/** The kept words nearest a second of the raw video, before it and after it, each with its time on the clock when it is on
    it: a sentence for a person. */
function nearest(words, ranges, raw, clock) {
  const kept = keptWords(words, ranges);
  const before = kept.filter((w) => w.end <= raw).slice(-4);
  const after = kept.filter((w) => w.end > raw).slice(0, 4);
  const told = (list) => {
    if (!list.length) return null;
    const piece = ranges.find((r) => list[0].end > r.start && list[0].end <= r.end);
    const t = timelineAt(clock, Math.max(list[0].start, piece.start));
    return `"${list.map((w) => w.w).join(" ")}"${t === null ? "" : ` at ${clockText(t)}`}`;
  };
  const parts = [told(before) && `before it, ${told(before)}`, told(after) && `after it, ${told(after)}`].filter(Boolean);
  return parts.length ? `The nearest kept words are ${parts.join(", and ")}.` : "Nothing is kept near it.";
}
