// The running captions drawn on a timeline (phase 4): its kept words, grouped two to four at a time as a caption style says,
// each caption fitted to the style's line and kept on screen long enough to read. The research's rules 1 and 4
// (docs/research/2026-10-13-video-presets/presets.md, 2.4) are applied here, and what they did is told.
// Nothing here touches a disk or runs a program.

/** A caption shows for at least this long, in seconds, and needs reading no faster than this many characters a second. */
export const SHORTEST = 0.83;
export const FASTEST = 20;
/** A gap this long between two words is taken as a pause, where a caption may end. The words file holds no pauses, and its
    times are off by a tenth to a third of a second, so this is a guess. */
const PAUSE = 0.25;

/** Does this word end a sentence? Words that trail off ("So the...") do not. */
const endsSentence = (w) => /[.?!]["'”’)\]]*$/.test(w) && !/(?:\.\.\.|…)["'”’)\]]*$/.test(w);
const round = (n) => Math.round(n * 1000) / 1000;

/** The words of `list` on as many lines as the look allows, each no longer than its `chars`: the lines, or null when they do
    not fit. Two lines are split where the longer of them is shortest. */
function linesOf(list, look) {
  const text = list.join(" ");
  if (text.length <= look.chars) return [text];
  if (look.lines < 2 || list.length < 2) return null;
  let best = null;
  for (let i = 1; i < list.length; i++) {
    const pair = [list.slice(0, i).join(" "), list.slice(i).join(" ")];
    if (pair.every((line) => line.length <= look.chars) && (!best || Math.max(...pair.map((l) => l.length)) < Math.max(...best.map((l) => l.length)))) best = pair;
  }
  return best;
}

/** The captions of a timeline: `words` are the recording's words, each {w, start, end} in seconds of the raw video, spelled
    as the episode's spellings say; `ranges` are the kept pieces, in order, each {start, end}; `look` is captionLook's. Gives
    { captions: [{ start, end, lines, scale }], told }, each caption in seconds of the raw video. A word belongs to the piece
    it ends in: its end is when it was said, and its start is only where the word before it ended (cuts.js wordsOf), so a
    piece's first word may start in what was cut before it. A caption never runs over a join: it shows only what is seen together. A caption ends at a
    sentence's end or a pause, and holds `look.most` words at most.
    Rule 1: a caption wider than the style's line is split at a word, or put on two lines when the style allows two; a single
    word still too wide is drawn smaller (`scale` under 1). Rule 4: a caption shown for under SHORTEST seconds, or read faster
    than FASTEST characters a second, is held into the pause after it, up to the next word; inside a sentence there is none,
    and it stays. (The research's rule also joins it to the next when the two fit: grouped in the fewest captions that fit,
    two that would fit together are one already.) */
export function captionsFor({ words, ranges, look }) {
  const captions = [];
  let split = 0;
  const smaller = [];
  for (const range of ranges) {
    const mine = words
      .filter((w) => w.end > range.start && w.end <= range.end)
      .map((w) => ({ w: look.caps ? w.w.toLocaleUpperCase("en") : w.w, start: Math.max(w.start, range.start), end: Math.min(w.end, range.end) }));
    // The runs: where a sentence ends or there is a pause, a caption may end.
    const runs = [];
    for (const [i, word] of mine.entries()) {
      if (!runs.length || endsSentence(mine[i - 1].w) || word.start - mine[i - 1].end >= PAUSE) runs.push([]);
      runs[runs.length - 1].push(word);
    }
    for (const run of runs) {
      // The fewest captions the run can be shown in, each of `most` words at most and fitting the line, and of those the
      // most even: so a sentence of four words too wide for one line is two and two, not three and one. A single word too
      // wide for the line is a caption of its own, drawn smaller.
      const best = [{ count: 0, longest: 0, cut: -1 }];
      for (let i = 1; i <= run.length; i++) {
        for (let j = Math.max(0, i - look.most); j < i; j++) {
          const list = run.slice(j, i);
          const lines = linesOf(list.map((x) => x.w), look);
          if (!lines && list.length > 1) continue;
          const length = list.map((x) => x.w).join(" ").length;
          const tried = { count: best[j].count + 1, longest: Math.max(best[j].longest, lines ? length : 0), cut: j };
          if (!best[i] || tried.count < best[i].count || (tried.count === best[i].count && tried.longest < best[i].longest)) best[i] = tried;
        }
      }
      const made = [];
      for (let i = run.length; i > 0; i = best[i].cut) made.unshift(run.slice(best[i].cut, i));
      split += made.length - Math.ceil(run.length / look.most);
      // Rule 4: a caption too short, or too quick to read, is held into the pause after it. It cannot be joined to the next:
      // the run is already in the fewest captions that fit, so two that fit together are one already.
      const read = (list) => ({ start: list[0].start, end: list[list.length - 1].end, chars: list.map((x) => x.w).join(" ").length });
      const after = (list) => {
        const at = mine.indexOf(list[list.length - 1]);
        return at + 1 < mine.length ? mine[at + 1].start : range.end;
      };
      for (const list of made) {
        const { start, end, chars } = read(list);
        const wanted = start + Math.max(SHORTEST, chars / FASTEST);
        const held = end < wanted ? Math.min(wanted, after(list)) : end;
        const lines = linesOf(list.map((x) => x.w), look);
        const scale = lines ? 1 : Math.round((look.chars / list[0].w.length) * 100) / 100;
        if (!lines) smaller.push(scale);
        captions.push({ start: round(start), end: round(held), lines: lines || [list[0].w], scale });
      }
    }
  }
  const told = [];
  if (split || smaller.length) {
    const parts = [];
    if (split) parts.push(`${split} caption${split === 1 ? " was" : "s were"} split to fit the line.`);
    if (smaller.length) parts.push(`${smaller.length} single word${smaller.length === 1 ? " was" : "s were"} drawn smaller, the smallest at ${Math.round(Math.min(...smaller) * 100)}% of the style's size.`);
    told.push(parts.join(" "));
  }
  const short = captions.filter((c) => c.end - c.start < SHORTEST - 0.0005).length;
  const fast = captions.filter((c) => c.lines.join(" ").length / (c.end - c.start) > FASTEST).length;
  if (short || fast) told.push(`${short} caption${short === 1 ? "" : "s"} still show${short === 1 ? "s" : ""} for under ${SHORTEST} s, and ${fast} still run${fast === 1 ? "s" : ""} faster than ${FASTEST} characters a second.`);
  return { captions, told };
}
