// Cuts a person asks for (spec section 4, `cut keep|remove`): a stretch kept that the plan cut, or one taken out that it
// kept, always whole phrases and only at a pause, as the import's own rules cut (cuts.js). The ranges are made again by the
// import's own rangesOf, so a cut asked for looks like one the rules made: a breath kept each side, a long pause shortened.
// Nothing here touches a disk or runs a program.
import { rangesOf, KEPT_SIDE } from "./cuts.js";

/** The pauses of a recording, as its phrases show them: a phrase starts or ends on a pause's edge where there is one, and two
    phrases with no pause between them touch (cuts.js phrasesOf). So each gap between two phrases is a pause, and so is the
    time before the first and after the last. They are taken from the phrases, and not from the pauses ffmpeg heard, which a
    plan keeps in its `pauses` only since 2026-10-22 (notes.js pausesOfPlan): a plan made before has none. A gap that held a
    sound with no words to it (a cough between two pauses) is taken as one pause here. */
export function pausesOf(phrases, duration) {
  const pauses = [];
  let at = 0;
  for (const p of phrases) {
    if (p.start > at) pauses.push([at, p.start]);
    at = Math.max(at, p.end);
  }
  if (duration > at) pauses.push([at, duration]);
  return pauses;
}

/** The phrases that go together: touching ones, with no pause between them, are cut together or not at all. Each group as the
    indexes of its phrases. */
const groupsOf = (phrases) => {
  const groups = [];
  for (const [i, p] of phrases.entries()) {
    if (!groups.length || phrases[i - 1].end < p.start) groups.push([]);
    groups[groups.length - 1].push(i);
  }
  return groups;
};

/** A cut asked for, made whole: the phrases from `from` to `to` (seconds of the raw video), with every phrase they touch
    without a pause, as { from, to, phrases }, from the first one's start to the last one's end; or { why } when no phrase
    is there. */
export function cutSpan(phrases, from, to) {
  const groups = groupsOf(phrases).filter((g) => g.some((i) => phrases[i].end > from && phrases[i].start < to));
  if (!groups.length) return { why: "No words are said there, so there is nothing to cut or keep." };
  const ids = groups.flat();
  return { from: phrases[ids[0]].start, to: phrases[ids[ids.length - 1]].end, phrases: ids.map((i) => phrases[i].id) };
}

/** The phrases as the cuts asked for leave them: each cut, { keep, from, to }, in the order asked, keeps or takes out every
    phrase in it, whole. What a cut took out it says, in the plan's way. */
export function cutPhrases(phrases, cuts = []) {
  const now = phrases.map((p) => ({ ...p }));
  for (const cut of cuts) {
    for (const p of now) {
      if (!(p.end > cut.from && p.start < cut.to)) continue;
      Object.assign(p, cut.keep ? { keep: true, kind: "keep", why: "" } : { keep: false, kind: "cut", why: "taken out by a person" });
    }
  }
  return now;
}

/** The ranges of the whole recording, as the cuts asked for leave them, kept and cut alike, each with its reason, as a plan's
    are (the joins' notes are made from them). With no cut asked for, they are the plan's own, untouched: the plan made them
    from the pauses ffmpeg heard, so a sound with no words to it (a lead-in, a cough, a tail) is kept where it was. With cuts,
    only the stretch around each phrase a cut changed is made again, by the import's own rangesOf on the pauses the phrases
    show (not on the plan's `pauses`, which a plan made before they were kept in it lacks): from the start of the phrase
    before it to the end of the phrase after it. Everything else is the plan's own. */
export function rangesWith({ plan, cuts = [] }) {
  if (!cuts.length) return plan.ranges;
  const duration = plan.facts.duration;
  const phrases = cutPhrases(plan.phrases, cuts);
  const remade = rangesOf(phrases, duration, pausesOf(plan.phrases, duration));
  // The stretches made again: around each phrase whose keeping changed, with its neighbours, joined where they meet.
  const windows = [];
  phrases.forEach((p, i) => {
    if (p.keep === plan.phrases[i].keep) return;
    const from = i > 0 ? phrases[i - 1].start : 0;
    const to = i + 1 < phrases.length ? phrases[i + 1].end : duration;
    const last = windows[windows.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else windows.push([from, to]);
  });
  const clip = (ranges, a, b) => ranges.filter((r) => r.end > a && r.start < b).map((r) => ({ ...r, start: Math.max(r.start, a), end: Math.min(r.end, b) }));
  const spliced = [];
  let at = 0;
  for (const [a, b] of windows) {
    spliced.push(...clip(plan.ranges, at, a), ...clip(remade, a, b));
    at = b;
  }
  spliced.push(...clip(plan.ranges, at, duration));
  // Ranges that now touch and are of one kind are one range, as rangesOf leaves them.
  const joined = [];
  for (const r of spliced.filter((x) => x.end > x.start)) {
    const last = joined[joined.length - 1];
    if (last && last.keep === r.keep && last.kind === r.kind && last.why === r.why) last.end = r.end;
    else joined.push({ ...r });
  }
  // Each range names the phrases that lie in it now, and their words: one of the plan's, cut short at a stretch made again,
  // no longer holds the phrases beyond it.
  return joined.map((r) => {
    const inside = phrases.filter((p) => (p.start + p.end) / 2 >= r.start && (p.start + p.end) / 2 < r.end);
    return { ...r, phrases: inside.map((p) => p.id), text: inside.map((p) => p.text).join(" ") };
  });
}

/** The kept pieces of a timeline, each { start, end }, from ranges as rangesWith gives them. `span`, for a Reel, is its
    stretch, { from, to }: only what lies in it is kept, and it is cut at the stretch's edges. */
export function keptOf(ranges, span) {
  const pieces = ranges.filter((r) => r.keep).map((r) => ({ start: r.start, end: r.end }));
  if (!span) return pieces;
  return pieces.map((r) => ({ start: Math.max(r.start, span.from), end: Math.min(r.end, span.to) })).filter((r) => r.end - r.start > KEPT_SIDE / 2);
}

/** The kept pieces, as the cuts asked for leave them (rangesWith, then keptOf). */
export const keptRanges = ({ plan, cuts = [], span }) => keptOf(rangesWith({ plan, cuts }), span);

/** Each piece of a Reel with the crop, or the move, of the Reel's own stretch it lies most in, or the nearest: a cut made in a
    Reel keeps the picture where the face was, and the note that no face was found there (reels.js GUESSED) goes with it. A
    piece that runs over two or more of the stretches, as when a cut keeps again what lay between them, is split at the middle
    of what lay between each two, so that each part keeps its own stretch's. */
export function croppedLike(pieces, stretches) {
  const ordered = [...stretches].sort((a, b) => a.start - b.start);
  const overlap = (piece, s) => Math.min(piece.end, s.end) - Math.max(piece.start, s.start);
  const parts = (piece) => {
    const over = ordered.filter((s) => overlap(piece, s) > 0);
    const splits = over.slice(1).map((s, i) => Math.round(((over[i].end + s.start) / 2) * 1000) / 1000).filter((at) => at > piece.start && at < piece.end);
    const edges = [piece.start, ...splits, piece.end];
    return edges.slice(1).map((end, i) => ({ ...piece, start: edges[i], end }));
  };
  return pieces.flatMap(parts).map((piece) => {
    const gap = (s) => Math.max(s.start - piece.end, piece.start - s.end, 0);
    const best = stretches.reduce((a, b) => (overlap(piece, b) > overlap(piece, a) || (overlap(piece, b) === overlap(piece, a) && gap(b) < gap(a)) ? b : a));
    return { ...piece, ...(best.crop ? { crop: best.crop } : {}), ...(best.position ? { position: best.position } : {}), ...(best.guessed ? { guessed: true } : {}) };
  });
}
