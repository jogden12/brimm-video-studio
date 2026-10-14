// The rules of the unedited-video workflow: what it asks ffprobe, the transcriber and ffmpeg to do, how it reads what they say,
// and how it decides what to suggest cutting from a raw recording.
// Nothing here touches a disk or runs a program, so all of it is tested without a video.
import { basename, dirname, extname, join } from "node:path";
import { tokens, stamp } from "./shared/text.js";
import { isMedia, outputsFor, whisperArgs, silences, dropSilent, spellNames } from "./lib.js";

const list = (v) => (Array.isArray(v) ? v : []);
/** A time in seconds, to the millisecond. */
const ms = (t) => Math.round(t * 1000) / 1000;
const two = (n) => String(n).padStart(2, "0");
/** A time in seconds as a caption file writes it: 00:01:07,250. */
const captionTime = (t) => {
  const n = Math.max(0, Math.round(t * 1000));
  return `${two(Math.floor(n / 3600000))}:${two(Math.floor(n / 60000) % 60)}:${two(Math.floor(n / 1000) % 60)},${String(n % 1000).padStart(3, "0")}`;
};

/** Have ffprobe write what it knows about a file, as JSON, into a file of its own. */
export const probeArgs = (file, out) => ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "-o", out, file];

/** A frame rate such as "30000/1001" as a number of frames a second. 0 for anything that is not a rate. */
export function framesASecond(fps) {
  const m = /^(\d+)(?:\/(\d+))?$/.exec(String(fps || ""));
  return m && Number(m[2] || 1) ? Number(m[1]) / Number(m[2] || 1) : 0;
}

/** The facts the cut plan needs, from what ffprobe wrote: the file's length in seconds, the size of the picture as it is shown,
    its frame rate as a fraction, whether there is sound, and how many seconds after the first picture the sound starts.
    A file with no picture has no size and no frame rate. Null when ffprobe wrote nothing that can be read, or no length. */
export function factsOf(printed) {
  let told;
  try {
    told = JSON.parse(printed);
  } catch (e) {
    return null;
  }
  const streams = list(told && told.streams);
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  // The cover of a sound file is stored as a video of one picture. It is not a picture to cut.
  const picture = streams.find((s) => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic));
  const sound = streams.find((s) => s.codec_type === "audio");
  const duration = num(told.format && told.format.duration) || num(picture && picture.duration) || num(sound && sound.duration);
  if (!duration) return null;
  // A phone stores an upright video on its side, with a note to turn it.
  const turn = picture ? num(list(picture.side_data_list).map((d) => d.rotation).find((r) => r != null) ?? (picture.tags && picture.tags.rotate)) : 0;
  const size = picture ? [num(picture.width), num(picture.height)] : [0, 0];
  const [width, height] = Math.abs(turn) % 180 === 90 ? [size[1], size[0]] : size;
  // The file's own rate is the finest its times can be told apart at, which for some recordings is thousands a second.
  const shown = (fps) => framesASecond(fps) >= 1 && framesASecond(fps) <= 120;
  const fps = picture ? [picture.r_frame_rate, picture.avg_frame_rate].find(shown) || "" : "";
  return { duration: ms(duration), width, height, fps, sound: Boolean(sound), soundStart: picture && sound ? ms(num(sound.start_time) - num(picture.start_time)) : 0 };
}

/** Have the transcriber write the captions as the transcript tool does and, in the same pass, everything it knows as JSON, with
    a time for every token. Without -nfa it silently drops -dtw, which is what gives those times. */
export const wordArgs = (given) => [...whisperArgs(given), "-ojf", "-nfa", "-dtw", "large.v3.turbo"];

/** Have ffmpeg say where the pauses are: quieter than -35 dB for 0.3 seconds or more. It writes no file. `length` is how long
    the recording goes on from the start of its sound, in seconds. A sound that ends before its picture has silence put after
    it first, up to that length: there is nothing to hear there, and ffmpeg then says so as it does of any other pause. */
export const pauseArgs = (wav, length = 0) => ["-nostdin", "-hide_banner", "-nostats", "-i", wav, "-af", `${length > 0 ? `apad=whole_dur=${length.toFixed(3)},` : ""}silencedetect=noise=-35dB:d=0.3`, "-f", "null", "-"];

/** The transcriber's own marks, such as [_BEG_] and [_TT_123], and its tags for a sound that is not speech. */
const MARK = /^\[[^\]]*\]$/;
const SPOKEN = /[\p{L}\p{N}]/u;
/** Does a caption from `from` to `to` lie in a long silence? The transcript tool's own rule for it, asked of one caption. */
const invented = (from, to, silent) => silent.length > 0 && dropSilent(`1\n${captionTime(from)} --> ${captionTime(to)}\nwords\n`, silent).dropped === 1;

/** The words of a recording, each {w, start, end} in seconds, rebuilt from what the transcriber wrote with -ojf. A token that
    begins with a space starts a new word. A word ends where its last spoken token ends: the time the transcriber gives a full
    stop or a comma drifts into the pause after it. A word starts where the word before it ended, or at the start of its own
    segment for the first word after a gap. The times are close and not exact: expect a tenth to a third of a second.
    `silent` is the long silences, and the words of a segment that lies in one are left out, as its caption is. `shift` is added
    to every time, for a file whose sound starts later than its picture. */
export function wordsOf(told, { silent = [], shift = 0 } = {}) {
  const words = [];
  const seconds = (v, per) => (Number.isFinite(Number(v)) ? Number(v) / per : 0);
  let last = null;
  for (const segment of list(told && told.transcription)) {
    const from = seconds(segment.offsets && segment.offsets.from, 1000);
    if (invented(from, seconds(segment.offsets && segment.offsets.to, 1000), silent)) continue;
    let open = null;
    const built = [];
    for (const token of list(segment.tokens)) {
      const text = String(token.text == null ? "" : token.text);
      if (MARK.test(text.trim())) continue;
      if (!open || text.startsWith(" ")) built.push(open = { w: "", spoken: null, end: 0 });
      // The moment the token ends: the fine time in hundredths of a second, or the token's own coarser one in milliseconds.
      const end = token.t_dtw >= 0 ? seconds(token.t_dtw, 100) : seconds(token.offsets && token.offsets.to, 1000);
      open.w += text;
      open.end = end;
      if (SPOKEN.test(text)) open.spoken = end;
    }
    let first = true;
    for (const word of built) {
      const w = spellNames(word.w.trim());
      if (!w || MARK.test(w)) continue;
      const start = last == null || (first && from > last) ? from : last;
      last = Math.max(start, word.spoken == null ? word.end : word.spoken);
      first = false;
      words.push({ w, start: ms(start + shift), end: ms(last + shift) });
    }
  }
  return words;
}

/** The pauses in what ffmpeg printed, each as [start, end] in seconds, to the millisecond. `shift` is added to every time, as it
    is to the words. One that never ends lasts to the end of the recording, as a long silence does. The time before a sound
    that starts later than its picture is a pause too: there is nothing to hear in it. */
export function pausesOf(printed, shift = 0) {
  const heard = silences(printed).map(([a, b]) => [ms(a + shift), ms(b + shift)]);
  if (!(shift > 0)) return heard;
  return heard.length && heard[0][0] <= ms(shift) ? [[0, heard[0][1]], ...heard.slice(1)] : [[0, ms(shift)], ...heard];
}

/** Does this word end a sentence? Words that trail off ("So the...") do not. */
const endsSentence = (w) => /[.?!]["'”’)\]]*$/.test(w) && !/(?:\.\.\.|…)["'”’)\]]*$/.test(w);

/** The words grouped into phrases, each {id, start, end, text, words}. A phrase ends at a pause, or at a word that ends a
    sentence. Where there is a pause the phrase starts or ends on its edge, which is exact to the sound. Where there is none it
    takes the word's time, and the two phrases touch: the one starts at the moment the other ends. So a place where two phrases
    do not touch is a pause, and the only kind of place where a cut can be made.
    A pause belongs between the two words whose times it falls between: the last word to end before its middle, and the next.
    Two pauses between the same two words, with a cough between them, are one gap: the phrase before it ends where the first
    pause starts and the phrase after it starts where the last one ends. The cough is part of neither. */
export function phrasesOf(words, pauses) {
  const gaps = new Array(words.length + 1).fill(null);
  let k = 0;
  for (const [a, b] of pauses) {
    while (k < words.length && words[k].end <= (a + b) / 2) k += 1;
    gaps[k] = [gaps[k] ? gaps[k][0] : a, b];
  }
  const phrases = [];
  let from = 0;
  for (let to = 1; to <= words.length; to++) {
    if (to < words.length && !gaps[to] && !endsSentence(words[to - 1].w)) continue;
    const mine = words.slice(from, to);
    const before = phrases.length ? phrases[phrases.length - 1].end : 0;
    const start = Math.max(before, gaps[from] ? gaps[from][1] : phrases.length ? before : mine[0].start);
    const end = Math.max(start, gaps[to] ? gaps[to][0] : mine[mine.length - 1].end);
    phrases.push({ id: "p" + (phrases.length + 1), start: ms(start), end: ms(end), text: mine.map((w) => w.w).join(" "), words: mine });
    from = to;
  }
  return phrases;
}

/** What somebody says to start over. A phrase that is one of these and nothing more is a cue. They are compared as the phrases
    are, without case or punctuation. */
const CUES = ["let me do that again", "let me do that one more time", "let me try that again", "let me say that again", "let me start over", "let me start again", "lets do that again", "lets try that again", "lets start over", "ill do that again", "ill start over", "im going to start over", "do that again", "start over", "starting over", "take two", "take three", "one more time", "sorry again", "from the top"];
/** Words that come before or after a cue without making it more than one: "Okay, let me do that again, sorry." */
const SOFT = ["sorry", "okay", "ok", "um", "uh", "so", "wait", "actually", "alright"];

/** A retake is said again within this many seconds. */
const SOON = 90;
/** Two tellings are the same when they open with this many of the same words, or share this many and this much of the earlier
    one, in order. */
const SAME_WORDS = 4;
const SAME_SHARE = 0.7;
/** How far into the later telling the words of the earlier one are looked for: half as far again as the earlier one is long.
    Looked for any further, a few common words are found in order in any long sentence. */
const ROOM = 1.5;
/** How many words at the start of two tellings are looked at to see that they start at the same place. */
const START_WORDS = 2;
/** How many words there may be between a retake and the telling that is kept: "Sorry. Where was I?" */
const ASIDE_WORDS = 6;
const FALSE_START_WORDS = 6;
/** Nobody says a word in less time than this, taken over a whole phrase. */
const WORD_SECONDS = 0.1;
/** A pause this long between kept phrases is shortened, and this much silence is kept on each side of every cut. */
const LONG_PAUSE = 1.5;
export const KEPT_SIDE = 0.2;

function isCue(said) {
  let a = 0;
  let b = said.length;
  while (a < b && SOFT.includes(said[a])) a += 1;
  while (b > a && SOFT.includes(said[b - 1])) b -= 1;
  return CUES.includes(said.join(" ")) || CUES.includes(said.slice(a, b).join(" "));
}

/** How many words two tellings open with that are the same. */
function opening(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

/** How many of the words of `a` are in `b` too, in the same order. */
function shared(a, b) {
  let row = new Array(b.length + 1).fill(0);
  for (const word of a) {
    const next = [0];
    for (let j = 1; j <= b.length; j++) next.push(word === b[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]));
    row = next;
  }
  return row[b.length];
}

export const KEPT = { keep: true, kind: "keep", why: "" };
const pause = (why) => ({ keep: false, kind: "pause", why });

/** The parts of the time from `a` to `b` that lie in no pause. Something is heard there. */
function soundsIn(a, b, pauses) {
  const sounds = [];
  let from = a;
  for (const [start, end] of pauses) {
    if (end <= from || start >= b) continue;
    if (start > from) sounds.push([from, start]);
    from = end;
  }
  if (from < b) sounds.push([from, b]);
  return sounds;
}

/** The ranges of a plan: the whole recording in order, from the phrases and what was decided for each. A cut is never placed on
    a word's time. It falls in the pause beside the words that are kept, KEPT_SIDE from them, so the first sound of a word is
    not clipped and two kept phrases never meet with no breath between them. Kept ranges that touch are one range, and so are
    cut ranges that touch and have the same reason.
    Between the phrases, and before the first and after the last, only what ffmpeg heard as silent is cut as a pause. A sound
    there that no word was written for is kept as a kept phrase is: it may be a word the transcriber missed, or timed seconds
    off. So where no pause was heard before the first words or after the last, the recording is kept from its start or to its
    end. Beside a phrase that is cut it is otherwise: the silence there is part of that phrase's range, and so is such a sound. */
export function rangesOf(phrases, duration, pauses) {
  const ranges = [];
  const add = (start, end, { keep, kind, why }, phrase) => {
    const [a, b] = [ms(Math.min(start, duration)), ms(Math.min(end, duration))];
    if (!phrase && b <= a) return;
    const last = ranges[ranges.length - 1];
    if (!last || last.keep !== keep || last.kind !== kind || last.why !== why) ranges.push({ start: a, end: b, keep, kind, why, phrases: [], text: "" });
    const range = ranges[ranges.length - 1];
    range.end = b;
    if (phrase) {
      range.phrases.push(phrase.id);
      range.text = [range.text, phrase.text].filter(Boolean).join(" ");
    }
  };
  // What is heard, in order: the phrases, and beside kept ones the sounds that no word was written for.
  const heard = [];
  let before = null;
  for (const next of [...phrases, null]) {
    const cut = (before && !before.keep) || (next && !next.keep);
    const kept = (before && before.keep) || (next && next.keep);
    if (kept && !cut) heard.push(...soundsIn(before ? before.end : 0, next ? next.start : duration, pauses).map(([start, end]) => ({ start, end, ...KEPT })));
    if (next) heard.push(next);
    before = next;
  }
  before = null;
  for (const next of [...heard, null]) {
    // The silence between two of them, or before the first, or after the last.
    const a = before ? before.end : 0;
    const b = next ? next.start : duration;
    if (before && before.keep && next && next.keep) {
      if (b - a >= LONG_PAUSE) {
        add(a, a + KEPT_SIDE, KEPT);
        add(a + KEPT_SIDE, b - KEPT_SIDE, pause(`${(b - a).toFixed(1)} seconds of silence, shortened to ${(2 * KEPT_SIDE).toFixed(1)}`));
        add(b - KEPT_SIDE, b, KEPT);
      } else add(a, b, KEPT);
    } else if (before && before.keep) {
      add(a, Math.min(a + KEPT_SIDE, b), KEPT);
      add(Math.min(a + KEPT_SIDE, b), b, next || pause("silence after the last words"));
    } else if (next && next.keep) {
      add(a, Math.max(b - KEPT_SIDE, a), before || pause("silence before the first words"));
      add(Math.max(b - KEPT_SIDE, a), b, KEPT);
    } else add(a, b, before || next || pause("silence, with no words in it"));
    if (next) add(next.start, next.end, next, next.id ? next : null);
    before = next;
  }
  return ranges;
}

/** The cut plan for a recording, from its phrases: {phrases, ranges, kept, cut}. Each phrase comes back with `keep`, a `kind`
    ("keep", "retake", "false start" or "cue") and `why`, a reason in plain words. The ranges cover the recording from 0 to
    `duration`, each {start, end, keep, kind, why, phrases, text}, and `kept` and `cut` are the seconds of each. `pauses` is
    where ffmpeg heard silence, the same pauses the phrases were made from.
    The rules are cautious, and what they suggest is for a person to check:
    - A cue is a phrase that only says to start over. It is cut.
    - A false start is a phrase of two to six words that does not end a sentence, and whose words begin the phrase after it.
      One word is never one: "Never," and then "never give up" is said so on purpose. Neither are words the transcriber wrote
      with a full stop, which are taken for a sentence. A false start that is missed costs less than a sentence that is cut.
    - A retake is a phrase, or a run of phrases, that is said again straight after it, within 90 seconds. What is said next
      opens with its first four words or more, or shares four words or more and at least 70% of its words, in order. The
      earlier telling is cut and the last one kept. A run of more than one phrase is held to the 70%, so that an opening
      somebody often uses does not take with it the different things said after it. Between the two tellings there may be a
      cue and a few words ("Sorry. Where was I?") and no more: the same words after other things have been said are a point
      made a second time, and both are kept.
    - The phrase before a cue is cut when a phrase within 90 seconds of it begins with all of its words, however few.
    - Nothing is cut for being said again by a cue, or by words that had no time to be said in.
    - A phrase is only ever cut whole, and only at a pause: phrases with no pause between them are cut together or not at all.
    - A pause of 1.5 seconds or more between kept phrases is shortened to 0.4, and the silence before the first kept words and
      after the last is cut. Only what was heard as silent is cut so: a sound there with no words to it is kept. */
export function cutPlan(phrases, { duration, pauses = [] }) {
  const said = phrases.map((p) => tokens(p.text));
  const cue = said.map(isCue);
  // Everything that is said and is not a cue, as one run of words, and where each phrase starts in it. A cue is left out so
  // that its own words are never what something is said again by.
  const all = [];
  const at = said.map((words, i) => {
    const from = all.length;
    if (!cue[i]) all.push(...words);
    return from;
  });
  const soon = (i, j) => phrases[j].start - phrases[i].end <= SOON;
  /** Can phrase `j` be the later telling of something? A cue cannot, and neither can words that had no time to be said in.
      After a pause the transcriber sometimes writes the sentence before it a second time, with no time of its own. To cut the
      sentence for that would take out the only time it was said. */
  const telling = (j) => !cue[j] && phrases[j].end - phrases[j].start >= said[j].length * WORD_SECONDS;
  /** Do these words begin what is said from phrase `j` on? */
  const begins = (words, j) => words.length > 0 && opening(words, all.slice(at[j], at[j] + words.length)) === words.length;
  const verdict = phrases.map((p, i) => (cue[i] ? { kind: "cue" } : null));

  // A phrase before a cue is not a false start: what begins again is across the cue from it, and it is seen to further down.
  for (let i = 0; i + 1 < phrases.length; i++) {
    if (verdict[i] || !telling(i + 1)) continue;
    if (said[i].length > 1 && said[i].length <= FALSE_START_WORDS && !endsSentence(phrases[i].text) && begins(said[i], i + 1)) verdict[i] = { kind: "false start", again: i + 1 };
  }

  for (let i = 0; i < phrases.length; i++) {
    if (verdict[i]) continue;
    const start = all.slice(at[i], at[i] + START_WORDS);
    for (let j = i + 1; j < phrases.length && soon(i, j); j++) {
      // A later telling starts where the earlier one did, give or take a word: the first word of either is one of the first
      // two of the other. Without this, the words of the earlier telling are found a little way into something else.
      const restart = all.slice(at[j], at[j] + START_WORDS);
      if (!telling(j) || !(start.includes(restart[0]) || restart.includes(start[0]))) continue;
      const told = (run) => shared(run, all.slice(at[j], at[j] + Math.ceil(run.length * ROOM)));
      const again = (run) => told(run) >= run.length * SAME_SHARE;
      const sameOpening = opening(said[i], all.slice(at[j], at[j] + said[i].length)) >= SAME_WORDS;
      if (!sameOpening && !again(said[i])) continue;
      // The run goes on through the phrases after this one for as long as all of it is still said again. A cue in it adds no
      // words to it, and a phrase in it that already has its own reason keeps that reason.
      let k = i;
      let run = said[i];
      if (again(run)) {
        for (; k + 1 < j; k++) {
          const more = cue[k + 1] ? run : [...run, ...said[k + 1]];
          if (!again(more)) break;
          run = more;
        }
      }
      if (!sameOpening && told(run) < SAME_WORDS) continue;
      // The later telling comes straight after the earlier one, with no more than a few words between them. The same words
      // after other things have been said are a point made a second time, and both tellings are kept.
      if (at[j] - at[k + 1] > ASIDE_WORDS) continue;
      for (let q = i; q <= k; q++) verdict[q] = verdict[q] || { kind: "retake", again: j };
      break;
    }
  }

  for (let i = 0; i + 1 < phrases.length; i++) {
    if (verdict[i] || !cue[i + 1]) continue;
    for (let j = i + 2; j < phrases.length && soon(i, j); j++) {
      if (!telling(j) || !begins(said[i], j)) continue;
      verdict[i] = { kind: "retake", again: j, cued: true };
      break;
    }
  }

  // A cut is only made at a pause. Phrases that touch have none between them, so they are cut together or not at all.
  for (let a = 0; a < phrases.length;) {
    let b = a + 1;
    while (b < phrases.length && phrases[b].start <= phrases[b - 1].end) b += 1;
    if (verdict.slice(a, b).some((v) => !v)) verdict.fill(null, a, b);
    a = b;
  }

  /** When the telling that is kept starts: the last of the tellings, when there are more than two. */
  const keptAt = (i) => {
    let j = verdict[i].again;
    while (verdict[j] && verdict[j].again != null) j = verdict[j].again;
    return stamp(phrases[j].start);
  };
  const why = (v, i) => {
    if (v.kind === "cue") return "a spoken cue to start over";
    if (v.kind === "false start") return `begun again at ${keptAt(i)}`;
    return `said again at ${keptAt(i)}${v.cued ? " after a cue to start over" : ""}, the later one is kept`;
  };
  const decided = phrases.map((p, i) => (verdict[i] ? { ...p, keep: false, kind: verdict[i].kind, why: why(verdict[i], i) } : { ...p, ...KEPT }));
  const ranges = rangesOf(decided, duration, pauses);
  const kept = ms(ranges.reduce((sum, r) => sum + (r.keep ? r.end - r.start : 0), 0));
  return { phrases: decided, ranges, kept, cut: ms(duration - kept) };
}

/** A kept stretch of more words than this is shown in the plan as its first words and its last. */
const SHOWN_WHOLE = 24;
const SHOWN_FIRST = 12;
const SHOWN_LAST = 8;

/** What a cut is, and why it was made, as the plan says it to a person: "retake: said again at 0:06, the later one is kept".
    A cut of Claude's has the kind "claude", and its reason starts with whose it is, "Claude: " (applyDecisions, in notes.js).
    A reason that opens with its own kind stands alone, so that such a cut is not named twice. */
export const cutReason = ({ kind, why }) => (why.toLowerCase().startsWith(`${kind}: `) ? why : `${kind}: ${why}`);

/** The plan for a person to read: a first line with the totals, then one line for each range. `note` goes above them when
    something could not be made. What is cut is shown whole, and of a long kept stretch only how it begins and ends. The exact
    times are in the plan's JSON. */
export function planText({ ranges, kept, cut }, note = "") {
  const all = Math.round(kept + cut);
  const lines = [`Kept ${stamp(Math.round(kept))} of ${stamp(all)}. Cut ${stamp(all - Math.round(kept))}.`];
  for (const r of ranges) {
    const words = r.text.split(" ");
    const text = r.keep && words.length > SHOWN_WHOLE ? [...words.slice(0, SHOWN_FIRST), "...", ...words.slice(-SHOWN_LAST)].join(" ") : r.text;
    lines.push(`${stamp(r.start)} to ${stamp(r.end)}  ${r.keep ? "KEEP" : `CUT  ${cutReason(r)}`}${text ? "  |  " + text : ""}`);
  }
  return (note ? note + "\n" : "") + lines.join("\n") + "\n";
}

/** The kept ranges as the rough cut takes them, each {start, end, at}, where `at` is the moment the range starts in the rough
    cut. Each edge is moved to the nearest whole picture, so the picture and the sound of every range are the same length and
    the two do not drift apart over many cuts. With no frame rate the ranges are taken as they are. */
export function keptSpans(ranges, fps) {
  const rate = framesASecond(fps);
  const whole = (t) => (rate ? Math.round(t * rate) / rate : t);
  const spans = [];
  let at = 0;
  for (const r of ranges) {
    const [start, end] = [whole(r.start), whole(r.end)];
    if (!r.keep || end <= start) continue;
    spans.push({ start, end, at });
    at += end - start;
  }
  return spans;
}

/** The rate a rough cut is made at when its picture gives none that can be used. */
const PLAIN_RATE = "30";

/** The rate the rough cut of a file is made at: the file's own, or 30 pictures a second for a picture that gives none. A file
    with no picture has no rate. The rough cut and its captions are placed by the same one, or they drift apart. */
export const roughRate = ({ fps, height }) => fps || (height ? PLAIN_RATE : "");

/** Many things added together, as ffmpeg can read them: halved and halved again, with brackets round each half. Written as
    one row, ffmpeg 9 reads 99 of them and refuses 100, and an hour of talk with its pauses shortened is about 250. */
function sum(terms) {
  if (terms.length < 3) return terms.join("+");
  const half = Math.ceil(terms.length / 2);
  return [terms.slice(0, half), terms.slice(half)].map((part) => (part.length > 1 ? `(${sum(part)})` : part[0])).join("+");
}

/** The quality a video is written at when its picture is not enlarged: x264's own default. Lower is better and larger. */
export const QUALITY = 23;

/** How every video the tool makes is written: H.264 by x264 at the quality `crf`, never at a fixed bitrate, so a file is only as
    large as its picture needs. At a fixed 8 Mbit with the Mac's own encoder, the rough cut of a 32-minute Zoom recording of
    182 MB came out at 1.32 GB. Tried on ffmpeg 9 with a made-up recording like it, which came out at 1.33 GB that way: 45 MB.
    x264 is slower than the Mac's own encoder. At 1080 lines it writes about 5 seconds of video a second, against 13.
    The picture is 8-bit 4:2:0, which every player and Instagram take. The sound is AAC at 48 kHz, whatever the recording's
    own rate. The file's index is moved to its front once it is whole ("faststart"), so it can be played before all of it is
    read. */
export const encodeArgs = (crf) => ["-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart"];

/** Have ffmpeg make the rough cut in one pass: the kept ranges joined, written as encodeArgs says at the quality QUALITY.
    - fps gives every picture a place on an even grid from 0, at the file's own rate, or at 30 a second when it has none.
    - select and aselect let through the pictures and the sound that lie in a kept range, and setpts and asetpts make their
      times run on from one range to the next. A picture is asked for from half a picture early, so that a time written to six
      decimals never loses or gains one.
    - aresample puts the sound on the file's clock first, with silence where there is none. A kept range can start before a
      sound that starts later than its picture, and its sound would come out shorter than its picture: every sound after it
      would then be early by as much. It also makes the sound 48 kHz, as encodeArgs asks, so what follows works at 48 kHz.
      Tried on ffmpeg 9 with a recording whose sound is 32 kHz and 12 cuts: the sound of every kept second came within 3 ms
      of where it came when the sound stayed at 32 kHz, and the pictures were the same.
    - asetnsamples cuts the sound into pieces of 128 samples. aselect takes whole pieces, and the pieces the sound comes in
      are about a fiftieth of a second long: over many cuts that would put the sound out of step with the picture.
    - scale makes a picture of more than 1080 lines 1080, and never makes one bigger. The size is made even, as H.264 needs.
    The file is told it is an mp4, so it can be written under another name and given its own when it is whole. */
export function roughCutArgs(input, output, { ranges, fps }) {
  const rate = fps || PLAIN_RATE;
  const pick = (early) => sum(keptSpans(ranges, rate).map((s) => `gte(t,${(s.start - early).toFixed(6)})*lt(t,${(s.end - early).toFixed(6)})`));
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-vf", `fps=${rate}:start_time=0,select='${pick(0.5 / framesASecond(rate))}',setpts=N/FRAME_RATE/TB,scale=-2:'2*trunc(min(1080,ih)/2)',format=yuv420p`,
    "-af", `aresample=async=1:first_pts=0,asetnsamples=n=128:p=0,aselect='${pick(0)}',asetpts=N/SR/TB`,
    "-sn", "-dn", ...encodeArgs(QUALITY), "-f", "mp4", output
  ];
}

/** The longest line of a caption, as the transcript tool asks the transcriber for. */
const LINE = 60;

/** The captions of the rough cut, as an .srt: the kept phrases, each at the time it has once the cuts are made. `spans` is
    the kept ranges as the rough cut takes them. A phrase too long for one line is more than one caption. It starts and ends on
    the phrase's own edges, and changes line at the time of the word the line ends with. */
export function roughCaptions(phrases, spans) {
  const last = spans[spans.length - 1];
  const moved = (t) => {
    for (const s of spans) if (t < s.end) return s.at + Math.max(0, t - s.start);
    return last ? last.at + last.end - last.start : 0;
  };
  const captions = [];
  for (const p of phrases.filter((kept) => kept.keep)) {
    const lines = [];
    for (const word of p.words) {
      const line = lines[lines.length - 1];
      if (line && line.text.length + 1 + word.w.length <= LINE) lines[lines.length - 1] = { ...line, text: line.text + " " + word.w, end: word.end };
      else lines.push({ text: word.w, start: word.start, end: word.end });
    }
    const within = (t) => Math.min(Math.max(t, p.start), p.end);
    lines.forEach((line, i) => {
      const start = i === 0 ? p.start : within(line.start);
      const end = i === lines.length - 1 ? p.end : Math.max(start, within(line.end));
      captions.push(`${captionTime(moved(start))} --> ${captionTime(moved(end))}\n${line.text}`);
    });
  }
  return captions.map((caption, i) => `${i + 1}\n${caption}\n`).join("\n");
}

/** The files written for an unedited video: the transcript tool's own three, and the words with their times, the cut plan as
    JSON and as text to read, the rough cut, and the rough cut's captions and plain-text transcript. Then the upright version of
    the rough cut, for a video that is wider than it is tall, the Final Cut Pro project file, and the notes Claude wrote for
    the person who edits the video. The short clips Claude picked have names of their own: see clipOutputs. */
export function cutOutputs(file, outDir = dirname(file)) {
  const named = outputsFor(file, outDir);
  const at = (ending) => join(outDir, named.base + ending);
  return { ...named, words: at(".words.json"), plan: at(".cut-plan.json"), planTxt: at(".cut-plan.txt"), rough: at(".rough-cut.mp4"), roughSrt: at(".rough-cut.srt"), roughTxt: at(".rough-cut.transcript.txt"), vertical: at(".rough-cut.vertical.mp4"), fcpxml: at(".fcpxml"), notes: at(".edit-notes.txt") };
}

/** What a short clip is called, after the video's own name: ".reel-2" for the second clip Claude picked, and ".reel-2.story-1"
    for the first part of its Story. Then comes the ending that says what kind of file it is. */
const REEL = /\.reel-\d+(\.story-\d+)?$/i;
const reel = (n, part = 0) => `.reel-${n}${part ? `.story-${part}` : ""}`;
/** The kinds of file a clip is written as: the clip itself, and its captions. */
const REEL_ENDINGS = [".mp4", ".srt"];

/** The files written for one short clip of a video: {video, srt, story}. `n` is the clip's number, which is its place in
    Claude's reply. `video` is the whole clip and `srt` its captions. `story` names a file for each part of its Story when the
    Story has more than one part, `parts` of them. A clip of a minute or less is its own Story, and has none. */
export function clipOutputs(file, n, parts = 1, outDir = dirname(file)) {
  const { base } = outputsFor(file, outDir);
  const at = (part, ending) => join(outDir, base + reel(n, part) + ending);
  return { video: at(0, ".mp4"), srt: at(0, ".srt"), story: parts > 1 ? Array.from({ length: parts }, (_, k) => at(k + 1, ".mp4")) : [] };
}

/** Of the names in a folder, the files of the short clips of one video: the names clipOutputs gives for it, whatever the
    numbers in them. `base` is the video's name without its ending. A run that does the video again takes these away first.
    Before 2026-10-14 a clip was written beside the video under its name with .writing after it, and a run that was killed
    part-way left that name behind. So those are among them too: the next run may cut no clip of that number, and would
    never write over it. */
export function clipFiles(names, base) {
  return names.filter((n) => {
    const whole = n.replace(/\.writing$/, "");
    const stem = basename(whole, extname(whole));
    return REEL_ENDINGS.includes(extname(whole).toLowerCase()) && REEL.test(stem) && stem.replace(REEL, "") === base;
  });
}

/** The videos in a folder that still wait for a cut plan: no plan beside them yet, as JSON or as the text that says why none
    could be made, and no note saying the transcript failed. A rough cut is a video too, and so are its upright version, a
    short clip and a part of a clip's Story. The tool made those itself, and none of them is ever one that waits. */
export function waitingToCut(names) {
  const have = new Set(names);
  return names.filter(isMedia).filter((n) => {
    const base = basename(n, extname(n));
    return !/\.rough-cut(\.vertical)?$/i.test(base) && !REEL.test(base) && !have.has(base + ".cut-plan.json") && !have.has(base + ".cut-plan.txt") && !have.has(base + ".failed.txt");
  }).sort((a, b) => a.localeCompare(b));
}
