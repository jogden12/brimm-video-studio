// The episode's own spellings (spec section 4, `spell`): a word the transcriber writes one way, written as the person says it
// is spelled, "Sally" as "Sallie". They apply to every timeline's words and to the final transcripts, by the same rule the
// final transcript is spelled by (final-transcript.js `spelled`: the show's own names first, then the episode's, each a
// whole word matched as it is written).
// Nothing here touches a disk or runs a program.
import { spelled, spelledPairs, spelledCaptions } from "./final-transcript.js";
import { stampedText } from "./lib.js";
import { buildHandoff } from "./handoff.js";
import { buildHandoffV2, onPictureOf, fromSuggestionOf, VERSION_2 } from "./handoff-v2.js";

/** Why a spelling cannot be kept, in plain words: "" when it can. The word as heard is one word, of letters and figures with
    a straight apostrophe or a hyphen inside it, as the transcriber writes it and as `spelled` takes it, and not one the
    show's own names spell already; the spelling is one to four words on one line, and not the same. */
export function spellingFault(heard, meant) {
  const one = String(heard ?? "").trim();
  const written = String(meant ?? "").trim();
  if (one.includes("’")) return `"${one}" has a curly apostrophe, and the transcriber writes a straight one ('): give it that way.`;
  if (!/^[\p{L}\p{N}](?:[\p{L}\p{N}'-]*[\p{L}\p{N}])?$/u.test(one)) return `"${one}" is not one word. Say the one word as the transcriber writes it.`;
  if (!written || /[\r\n]/.test(written) || written.split(/\s+/).length > 4) return `Say how "${one}" is spelled, in one to four words.`;
  if (written === one) return `"${one}" is spelled that way already.`;
  // The show's own names are spelled first (final-transcript.js spelled), so a pair for one of them would never be applied.
  const shows = spelled(one);
  if (shows !== one) return shows === written ? `"${one}" is spelled "${written}" already: it is one of the show's own names.` : `"${one}" is always written "${shows}", the show's own spelling. To spell it another way, give "${shows}" as the word heard.`;
  return "";
}

/** The spellings with one more, as the record keeps them: one for each word as heard, the newest kept, in the order given. */
export const withSpelling = (spellings, heard, meant) => [...spellings.filter(([h]) => h !== heard), [heard, meant]];

/** The words of a words file, each {w, start, end}, with the spellings applied to each. */
export const spellWords = (words, spellings = []) => words.map((word) => ({ ...word, w: spelled(word.w, spellings) }));

/** The final transcripts of one finished part with spellings added: its captions (.srt), its transcript (.transcript.txt,
    made again from the captions as finish makes it) and its words (.words.json, when it has one), each given and given back
    as text. Only the pairs given are applied: the show's own names and the episode's earlier spellings are in them already,
    from when they were made. */
export function respelledPart({ srt, words }, spellings) {
  const captions = spelledCaptions(srt, spellings, spelledPairs);
  const timed = words ? JSON.parse(words) : null;
  return { srt: captions, txt: stampedText(captions), words: timed ? JSON.stringify({ ...timed, words: timed.words.map((w) => ({ ...w, w: spelledPairs(w.w, spellings) })) }, null, 2) + "\n" : null };
}

/** Whether `text` holds `word` as a whole word, or run of words, as spelledPairs matches one. */
const holdsWord = (text, word) => new RegExp(`(?<![\\p{L}\\p{N}])${String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(text);

/** A Reel of a finished video that its hand-off holds, spelled again with the episode's spellings as they are now (plan PR 9, the review's
    I1), from what is kept of it: its captions (`srt`) and its word times (`words`), each given as text. The Reel holds the pairs that changed
    it (`held`); only the pairs of `now` it does not hold are applied, so none is applied twice, and a pair is held from now on only once it
    has changed the Reel. Gives { srt, txt, words, held, keeps, changed }: the captions, their transcript and the words spelled; `held`, the
    pairs the Reel holds now; `changed`, whether the captions ({ srt }) and the word times ({ words }) are another text than they were; and
    `keeps`, true when a pair the Reel holds was taken back or changed since and its captions still hold the spelling it gave, which cannot
    be taken out of words that hold it. Throws for word times that are not a words file. Nothing is read or written. */
export function respelledHeldReel({ srt, words }, { held, now }) {
  const meant = (list, heard) => (list.find(([h]) => h === heard) || [])[1];
  const timed = JSON.parse(words);
  const sameWords = (made) => JSON.stringify(JSON.parse(made.words).words) === JSON.stringify(timed.words);
  const changing = now.filter(([heard]) => meant(held, heard) === undefined).filter((pair) => {
    const made = respelledPart({ srt, words }, [pair]);
    return made.srt !== srt || !sameWords(made);
  });
  const made = respelledPart({ srt, words }, changing);
  return { ...made, held: [...held, ...changing], keeps: held.some(([heard, spelt]) => meant(now, heard) !== spelt && holdsWord(srt, spelt)), changed: { srt: made.srt !== srt, words: !sameWords(made) } };
}

/** A version 1 hand-off made again, as version 1, with each part's captions as they are spelled now, as the next revision, made
    now on this Mac by this brimm-video (`commit`), as a finish makes one (handoff.js buildHandoff): the episode's name and
    approved title as the `record` has them now, and each part's file and length as the hand-off has them. Only a version 1
    hand-off is made again so: a version 2 one is never written over by version 1 (respelledHandoffV2). */
export const respelledHandoff = (handoff, { record, srts, revision, made, madeOn, commit }) => buildHandoff({
  record,
  revision,
  made,
  madeOn,
  commit,
  main: { ...handoff.main, srt: srts.main },
  reels: handoff.reels.map((r) => ({ ...r, srt: srts[`reel ${r.n}`] }))
});

/** The hand-off made again as version 2 (handoff-v2.js), with each part's captions as they are spelled now, as the next
    revision, made now on this Mac by this brimm-video, as a finish writes version 2: under `id`, the video's first version's
    (finish.js handoffIdOf), with the video's name and kind as the `record` has them now, and no title.
    - From a version 2 hand-off, all else it held is kept: each part's file and length, the words on the main video's picture,
      each Reel's title, place in the main video and suggestion, and a session's items. Its suggestions' first and last words
      are the main video's own, so they are spelled with `spellings`, the pairs its captions were spelled with now.
    - From a version 1 hand-off, made before this Mac's settings said version 2, each part's file, length and place are kept,
      and what version 1 never held is taken from the record, as a finish takes it: the words on the main video's picture
      (onPictureOf) and each Reel's suggestion (fromSuggestionOf). It held no suggestions, so none are written. */
export function respelledHandoffV2(handoff, { record, id, srts, spellings = [], revision, made, madeOn, commit }) {
  const was2 = handoff.version === VERSION_2;
  const reelOf = (n) => (record.reels || []).find((r) => r.n === n) || { n };
  // Only words are spelled: anything else is kept as it is, for the check to refuse.
  const spell = (said) => (typeof said === "string" ? spelledPairs(said, spellings) : said);
  return buildHandoffV2({
    record,
    id,
    revision,
    made,
    madeOn,
    commit,
    main: handoff.main ? { ...handoff.main, srt: srts.main } : undefined,
    onPicture: was2 ? handoff.main && handoff.main.onPicture : onPictureOf(record),
    suggestions: was2 && Array.isArray(handoff.suggestions) ? handoff.suggestions.map((s) => ({ ...s, first: spell(s.first), last: spell(s.last) })) : undefined,
    reels: (handoff.reels || []).map((r) => ({ ...r, srt: srts[`reel ${r.n}`], ...(was2 ? {} : { fromSuggestion: fromSuggestionOf(reelOf(r.n)) }) })),
    session: was2 ? handoff.session : undefined
  });
}
