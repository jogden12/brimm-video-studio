// A small fingerprint of a recording's words, and the match of a new file with the episode it is a new version of (spec
// 2026-10-22, section 1, "Matching a new version"). The light import asks for it at every drop, so it is cheap: the lengths
// first, from the records; then the fingerprints, from the records; and only then the words of one episode, counted in order.
// Nothing here touches a disk or runs a program: the words of an episode come from a function the caller gives.
import { normalWords } from "./handoff.js";

/** The words in one run, and the most hashes a fingerprint keeps. */
const RUN = 5;
const KEEP = 4000;
/** How much of the new file's hashes the episode's must have, and how many of the new file's words, in 100, must be found in the
    episode's in order. */
const HASH_SHARE = 0.5;
const WORD_SHARE_IN_100 = 70;

/** FNV-1a, 32 bits, of text that is only letters and figures (normalWords leaves nothing else) and the spaces between them. */
function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

/** The fingerprint of a recording's words: the hash of each run of five words as `normalWords` says them (so case,
    punctuation and numbers said as words make no difference), each once, as eight hex digits, sorted and joined by a space. A
    talk of more than KEEP runs keeps one hash value in k, k being the least power of two that leaves KEEP or fewer. It is the
    hash's value that decides, not its place in the order: a place moves for every run a file has more than another, so the
    "every k-th" of a long talk would not be the same hashes in a corrected export of it, and half of them would never be found.
    For fewer than five words there is no run, and the text is empty. */
export function fingerprintOf(words) {
  const said = normalWords(Array.isArray(words) ? words : []).map((word) => word.w);
  const runs = new Set();
  for (let i = 0; i + RUN <= said.length; i++) runs.add(fnv1a(said.slice(i, i + RUN).join(" ")));
  let kept = [...runs];
  for (let k = 2; kept.length > KEEP; k *= 2) kept = [...runs].filter((hash) => hash % k === 0);
  return kept.sort((a, b) => a - b).map((hash) => hash.toString(16).padStart(8, "0")).join(" ");
}

/** The hashes a fingerprint holds, as numbers. */
const hashesOf = (fingerprint) => (typeof fingerprint === "string" ? fingerprint.split(" ").filter((x) => /^[0-9a-f]{8}$/.test(x)).map((x) => parseInt(x, 16)) : []);

/** The k a fingerprint was thinned by: the lowest bit that any of its hashes has. A fingerprint thinned by k holds only
    multiples of k, and of its thousands some are not multiples of 2k. One of a few hashes was not thinned, but may seem to be by
    chance; shareOf then leaves a few of the other's hashes uncounted, which does no harm. */
function thinnedBy(hashes) {
  let seen = 0;
  for (const hash of hashes) seen = (seen | hash) >>> 0;
  return seen === 0 ? 1 : (seen & -seen) >>> 0;
}

/** The share of `a`'s hashes that `b` has, from 0 to 1, for two fingerprints. A fingerprint thinned more than the other holds
    only the hash values that are multiples of its k, so `a`'s hashes are counted only where `b` could have them: those that
    are multiples of `b`'s k. Nothing is counted when either has no hashes. */
export function shareOf(a, b) {
  const [mine, theirs] = [hashesOf(a), hashesOf(b)];
  if (!mine.length || !theirs.length) return 0;
  const k = thinnedBy(theirs);
  const counted = mine.filter((hash) => hash % k === 0);
  if (!counted.length) return 0;
  const there = new Set(theirs);
  return counted.filter((hash) => there.has(hash)).length / counted.length;
}

/** How many of `a`'s words are found in `b` in the same order, other words between them allowed: the longest run the two
    have in common, which is the count `tightest` in handoff.js makes. `inMain` is not used for it: it asks for 90 in 100,
    looks for a place in a main video, and for two talks of an hour takes over a second and 400 MB. A table of every pair of
    places is still 160 MB and 80 million steps. This takes 32 places of `b` to a step (the count of Crochemore and others,
    in the form Hyyrö gives it), so 3 million steps and a few megabytes. `b` is a row of bits, one for each of its words, each
    a 1 until a word of `a` has found it a place; each word of `a`, taken in order, moves the row along. Words are text. */
export function inOrderCount(a, b) {
  const size = (b.length + 31) >>> 5;
  if (!a.length || !size) return 0;
  // Where each word of `b` is, as bits, for the words `a` has: no other word can be found.
  const wanted = new Set(a);
  const where = new Map();
  b.forEach((word, place) => {
    if (!wanted.has(word)) return;
    let bits = where.get(word);
    if (!bits) where.set(word, (bits = new Uint32Array(size)));
    bits[place >>> 5] |= 1 << (place & 31);
  });
  const row = new Uint32Array(size).fill(0xffffffff);
  for (const word of a) {
    const bits = where.get(word);
    if (!bits) continue;
    let carry = 0;
    for (let k = 0; k < size; k++) {
      const [was, here] = [row[k], bits[k]];
      const sum = was + ((was & here) >>> 0) + carry;
      carry = sum > 0xffffffff ? 1 : 0;
      row[k] = (sum | (was & ~here)) >>> 0;
    }
  }
  // The bits that are still 1 are the places no word found; the spare bits after the last place are always 1.
  let unfound = 0;
  for (const bits of row) {
    let x = bits - ((bits >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    unfound += Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
  }
  return size * 32 - unfound;
}

/** Whether a record is one a new file may be a version of: answered (its kind is not null), not a session (neither its kind
    nor a mark that has not been cleared), and not archived. */
const askable = (c) => c.kind != null && c.kind !== "session" && !(c.session && !c.session.cleared) && !c.archived;

/** Whether two lengths differ by no more than a fifth of the longer. A length that is not a number of seconds is no length. */
const alike = (a, b) => Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && 5 * Math.abs(a - b) <= Math.max(a, b);

/** The episode a new file is a new version of, as {id, folder}, or null. The new file is given by its length in `seconds`,
    its `fingerprint` and its `words`. `candidates` are the records of the episodes on this Mac, each {id, folder, kind,
    archived, session, seconds, fingerprint}; `readWords(folder)` gives an episode's words, or null when its file is not
    whole on this Mac, which brings nothing down from Dropbox and leaves that episode out.
    In order, so that the dearest step is done once and for one episode only:
    - the episode is answered, not a session and not archived (see `askable`);
    - its length is within a fifth of the new file's (see `alike`), read from the record;
    - at least half of the new file's hashes are in its fingerprint (see shareOf);
    - of those left, the one with the most, then the one nearest in length, then the first listed, whose words can be read:
      at least 70 in 100 of the new file's words are found in its words in order. If not, there is no match: the next best is
      not tried. */
export function matchVersion({ seconds, fingerprint, words }, candidates, readWords) {
  const ours = normalWords(Array.isArray(words) ? words : []).map((word) => word.w);
  if (!fingerprint || !ours.length) return null;
  const near = [];
  (Array.isArray(candidates) ? candidates : []).forEach((c, order) => {
    if (!c || !askable(c) || !alike(c.seconds, seconds)) return;
    const share = shareOf(fingerprint, c.fingerprint);
    if (share >= HASH_SHARE) near.push({ c, share, apart: Math.abs(c.seconds - seconds), order });
  });
  near.sort((x, y) => y.share - x.share || x.apart - y.apart || x.order - y.order);
  for (const { c } of near) {
    const theirs = readWords(c.folder);
    if (!Array.isArray(theirs)) continue;
    const found = inOrderCount(ours, normalWords(theirs).map((word) => word.w));
    return found * 100 >= ours.length * WORD_SHARE_IN_100 ? { id: c.id, folder: c.folder } : null;
  }
  return null;
}
