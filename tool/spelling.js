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
