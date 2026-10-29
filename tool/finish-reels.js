// finish "<episode>" reels (architecture 2026-10-27, 4.3 and 8.7; plan PR 9): the Reels a person made in HyperFrames from a video her
// editor finished, handed off as the next revision of the hand-off the video has already. The video's first hand-off is written by the
// spellings card, from the import's captions (finish.js finishFinished); this adds to it, and never writes it. The next revision keeps
// the same id, `main`, the suggestions and the Reels it holds as they were, and adds the Reels taken now.
//
// This module is the pure part: the word that asks for it, the sentences she is told, what the next revision is made of, and which
// parts of the last finish a hand-off still holds. It reads and writes nothing. The hand-off on file is read by finish.js (reelsBase),
// the exports are found by exports.js, and edit.js and finish.js do the rest.

/** The word after the episode's that asks for the Reels of a finished video: `finish "<episode>" reels`. */
export const REELS_WORD = "reels";

/** The key of a Reel's part in a record's `finished.parts`, and of its project in `app.projects`: "reel 2". */
export const REEL_KEY = /^reel [1-9]\d*$/;

/** What she asked of `finish`, from its words (flags taken out): `reels` as the last word, with another before it, is { episode }, the
    words that name the episode; anything else is none, and she asked for the episode as before. The word counts only when another word
    comes before it, so that `finish reels` alone names an episode called "reels", as `app versions` does. */
export function reelsAsked(words) {
  if (!Array.isArray(words) || words.length < 2) return null;
  return new RegExp(`^${REELS_WORD}$`, "i").test(words[words.length - 1]) ? { episode: words.slice(0, -1) } : null;
}

// --- What she is told. None of it holds a path, a flag or the name of a command. ---

/** A raw video's Reels go with its main video, which is finished the way the app's exports are. */
export const rawWords = (name) => `${name} is a raw video: its Reels are handed off with its main video. Say "hand it off".`;
/** The hand-off the Reels are added to is not written yet: the spellings card writes it. */
export const noHandoffWords = (name) => `${name}'s hand-off is written once its spellings are answered, and its Reels go into it after that. Say "show me the spellings".`;
/** The video has been answered as another kind since its hand-off was made. */
export const otherKindWords = (name) => `${name}'s hand-off was made as another kind than it is now: it waits for its new reading.`;
/** The hand-off on file is not one that Reels can be added to. */
export const unusableWords = (name) => `${name}'s hand-off cannot be used as it stands, so its Reels cannot be added to it. Ask Jason.`;
/** The hand-off the record points at is not in the folder at all, so there is nothing for Dropbox to bring over. */
export const missingWords = (name) => `${name}'s hand-off is not there, so its Reels cannot be added to it. Ask Jason.`;
/** A hand-off that holds Reels is gone or cannot be read, and the spellings would make it again without them. */
export const lostReelsWords = (name) => `${name}'s hand-off is not there or cannot be read, so a new one would leave out the Reels it holds. Nothing was written. Ask Jason.`;
/** No Reel project is in the record. */
export const noReelWords = (name) => `${name} has no Reel made in HyperFrames yet. Say "show me the Reels" to see Claude's suggestions.`;
/** No Reel is taken from an export: every one is kept as the hand-off has it, or there is none. */
export const nothingNewWords = (name, revision) => `${name} has no Reel exported since its hand-off was made, as revision ${revision}, so there is nothing new to hand off. Export one from HyperFrames on This Mac, then say "hand off the Reels".`;
/** What she is asked to say when everything is found and nothing is left to ask. */
export const START = 'Say "yes, hand off the Reels" to start.';
/** What she is told to say again when the detached part could not go on. */
export const SAY_AGAIN = 'Say "hand off the Reels" again.';
/** The hand-off is not whole on this Mac yet; Dropbox is bringing it over. */
export const BRINGING = "Dropbox is still bringing the hand-off over: say it again in a minute.";

// --- The next revision ---

/** What the next revision of a finished video's hand-off is made of, from the hand-off on file (`onFile`) and the Reels taken now
    (`reels`, each as the hand-off holds a Reel): { main, suggestions?, reels }, to be given to buildHandoffV2 with the id, the revision
    and the rest.
    - `main` is the hand-off on file's, as it was (file, length and captions), and so are its `suggestions`, a suggestion that was made
      into a Reel included: the contract's finished fixture lists such a suggestion beside its Reel. They are left out when it has none.
    - `reels` are the Reels it holds, as they were, with those taken now: a Reel taken now takes the place of the Reel of its number, if
      the hand-off has one, so that no number is there twice. They are in the order of their numbers.
    Nothing it is given is changed. */
export function nextHandoff({ onFile, reels }) {
  const earlier = Array.isArray(onFile.reels) ? onFile.reels : [];
  const again = new Set(reels.map((reel) => reel.n));
  return {
    main: onFile.main,
    ...(Array.isArray(onFile.suggestions) && onFile.suggestions.length ? { suggestions: onFile.suggestions } : {}),
    reels: [...earlier.filter((reel) => !again.has(reel.n)), ...reels].sort((a, b) => a.n - b.n)
  };
}

/** The parts of a finish (a record's `finished.parts`) that belong to the Reels a hand-off holds (`reels`, as the hand-off lists them),
    in the order of their numbers: { "reel 2": part, … }. `main` is never among them, and a Reel the finish has no part for is left out.
    A hand-off made again from the import's captions (finishFinished) keeps these, so that the record still says what it took. */
export function heldReelParts(parts, reels) {
  if (parts === null || typeof parts !== "object" || !Array.isArray(reels)) return {};
  const held = {};
  for (const n of reels.map((reel) => reel && reel.n).filter(Number.isInteger).sort((a, b) => a - b)) {
    const key = `reel ${n}`;
    if (REEL_KEY.test(key) && parts[key] !== undefined) held[key] = parts[key];
  }
  return held;
}
