// The fingerprint of a recording's words, and the match of a new file with the episode it is a new version of. None of it
// needs a disk or a program: the words come in, and the words of a candidate come from a function the test gives.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fingerprintOf, shareOf, inOrderCount, matchVersion } from "../versions.js";
import { inMain } from "../handoff.js";

const AT = "2026-10-20T15:02:11-05:00";
/** Words said one a second, from the text. */
const words = (text) => text.split(" ").map((w, i) => ({ w, start: i, end: i + 0.5 }));
const TALK = Array.from({ length: 400 }, (_, i) => `word${i % 97} thing${i % 13}`).join(" ");

/** The same numbers every run: a talk made of words nobody repeats on purpose, like a real one. */
function maker(seed = 1) {
  let s = seed;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const word = () => "w" + Math.floor(next() ** 2 * 6000);
  return {
    next,
    /** `n` words as an array of text. */
    talk: (n) => Array.from({ length: n }, word),
    /** The talk with about `share` of its words said another way. */
    edited: (said, share) => said.map((w) => (next() < share ? word() : w)),
    /** The words as the transcriber gives them, four to the second and a bit. */
    timed: (said) => said.map((w, i) => ({ w, start: i * 0.4, end: i * 0.4 + 0.3 }))
  };
}

/** What a record gives the match about an episode. */
const episode = (said, over = {}) => ({ id: "e-20261020-aaaaaa", folder: "A", kind: "finished", archived: null, session: null, seconds: said.length * 0.4, fingerprint: fingerprintOf(maker().timed(said)), ...over });
/** A new file's side of the match. */
const arrival = (said, over = {}) => {
  const timed = maker().timed(said);
  return { seconds: said.length * 0.4, fingerprint: fingerprintOf(timed), words: timed, ...over };
};

/** The hash of text the way FNV-1a 32-bit gives it, written out again with big numbers so that it does not share code. */
function fnv(text) {
  let h = 0x811c9dc5n;
  for (const byte of Buffer.from(text, "utf8")) h = ((h ^ BigInt(byte)) * 0x01000193n) & 0xffffffffn;
  return Number(h);
}
const hashesIn = (fingerprint) => (fingerprint === "" ? [] : fingerprint.split(" ").map((x) => parseInt(x, 16)));

describe("fingerprintOf", () => {
  it("is the FNV-1a hashes of each run of five normalised words, once each, in order, in eight hex digits", () => {
    assert.equal(fnv("a"), 0xe40c292c, "the written-out hash is FNV-1a");
    assert.equal(fnv("foobar"), 0xbf9cf968);
    const said = words("Know your costs, then say three. Twenty-five percent of Sallie's clients");
    const runs = ["know your costs then say", "your costs then say 3", "costs then say 3 25", "then say 3 25 percent", "say 3 25 percent of", "3 25 percent of sallies", "25 percent of sallies clients"];
    assert.equal(fingerprintOf(said), [...new Set(runs.map(fnv))].sort((x, y) => x - y).map((h) => h.toString(16).padStart(8, "0")).join(" "));
  });
  it("is the same for the same words whatever their case, punctuation or timing, and different for other words", () => {
    const a = fingerprintOf(words("Know your costs, then say three. Thank you so much"));
    assert.equal(fingerprintOf(words("know your costs then say 3 thank you so much").map((w) => ({ ...w, start: w.start * 2, end: w.end * 2 }))), a);
    assert.notEqual(fingerprintOf(words("know your costs then say four thank you so much")), a);
  });
  it("counts a run said twice once", () => {
    assert.equal(hashesIn(fingerprintOf(words("a b c d e a b c d e"))).length, 5, "six runs, one of them said twice");
    assert.equal(hashesIn(fingerprintOf(words("a b c d e"))).length, 1);
  });
  it("is empty for fewer than five words, or no words", () => {
    assert.equal(fingerprintOf(words("one two three four")), "");
    assert.equal(fingerprintOf([]), "");
    assert.equal(fingerprintOf(undefined), "");
    assert.equal(fingerprintOf(words("one two three four ... --")), "");
  });
  it("keeps every hash of a talk of 4,000 runs or fewer, sorted", () => {
    const hashes = hashesIn(fingerprintOf(maker().timed(maker(2).talk(3000))));
    assert.ok(hashes.length > 2900 && hashes.length <= 3000);
    assert.deepEqual(hashes, [...hashes].sort((x, y) => x - y));
    assert.match(fingerprintOf(maker().timed(maker(2).talk(3000))), /^[0-9a-f]{8}( [0-9a-f]{8})*$/);
  });
  it("keeps at most 4,000 hashes of a longer talk, each one in k of the hash values, so that another file keeps the same ones", () => {
    const long = maker().timed(maker(3).talk(30000));
    const hashes = hashesIn(fingerprintOf(long));
    assert.ok(hashes.length <= 4000 && hashes.length > 1500, `${hashes.length} kept`);
    const k = Math.min(...hashes.filter((h) => h > 0).map((h) => (h & -h) >>> 0));
    assert.ok(k >= 4, `thinned by ${k}`);
    assert.ok(hashes.every((h) => h % k === 0));
    // Whatever the other file says, a run both say is kept by both or by neither.
    const cut = hashesIn(fingerprintOf(long.slice(0, 29000)));
    const both = cut.filter((h) => hashes.includes(h)).length;
    assert.ok(both > cut.length * 0.9, `${both} of ${cut.length}`);
  });
});

describe("shareOf", () => {
  it("is the share of the first one's hashes that the second one has", () => {
    const small = fingerprintOf(words("a b c d e f g h"));
    const big = fingerprintOf(words("a b c d e f g h i j k l m n"));
    assert.equal(shareOf(small, small), 1);
    assert.equal(shareOf(small, big), 1);
    assert.equal(shareOf(big, small), 4 / 10, "four of the ten runs of the big one");
    assert.equal(shareOf(small, fingerprintOf(words("p q r s t u v w x y"))), 0);
  });
  it("is nothing when either has no hashes", () => {
    const some = fingerprintOf(words("a b c d e f g h"));
    assert.equal(shareOf("", some), 0);
    assert.equal(shareOf(some, ""), 0);
    assert.equal(shareOf(some, undefined), 0);
    assert.equal(shareOf(undefined, some), 0);
  });
  it("still sees a long talk in the same talk with a few words said another way and its end cut", () => {
    const m = maker(4);
    const said = m.talk(9000);
    const [old, corrected] = [fingerprintOf(m.timed(said)), fingerprintOf(m.timed(m.edited(said.slice(0, 8400), 0.01)))];
    assert.ok(shareOf(corrected, old) > 0.8, `${shareOf(corrected, old)}`);
    assert.ok(shareOf(old, corrected) > 0.8, `${shareOf(old, corrected)}`);
    assert.ok(shareOf(old, fingerprintOf(m.timed(m.talk(9000)))) < 0.01, "another talk");
  });
  it("compares two thinned fingerprints of different k at the thinner one, in both directions", () => {
    const m = maker(5);
    const said = m.talk(8400);
    // About 8,400 distinct runs: thinned to one in four. A shorter cut of it, about 7,800: thinned to one in two.
    const [fine, coarse] = [fingerprintOf(m.timed(said.slice(0, 7800))), fingerprintOf(m.timed(said))];
    const [finer, coarser] = [hashesIn(fine), hashesIn(coarse)];
    assert.ok(finer.length > coarser.length * 1.4 && coarser.length > 1500, `${finer.length} and ${coarser.length} kept`);
    assert.ok(shareOf(fine, coarse) > 0.9, `${shareOf(fine, coarse)}`);
    assert.ok(shareOf(coarse, fine) > 0.9, `${shareOf(coarse, fine)}`);
  });
});

describe("inOrderCount", () => {
  /** The longest common run in order, by the table of every pair. */
  function table(a, b) {
    const row = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) row[i][j] = a[i - 1] === b[j - 1] ? row[i - 1][j - 1] + 1 : Math.max(row[i - 1][j], row[i][j - 1]);
    return row[a.length][b.length];
  }
  it("is the most words of the first found in the second in the same order, other words between them allowed", () => {
    assert.equal(inOrderCount("a b c d".split(" "), "a x b y c z d".split(" ")), 4);
    assert.equal(inOrderCount("a b c d".split(" "), "d c b a".split(" ")), 1);
    assert.equal(inOrderCount("a b a b".split(" "), "b a b".split(" ")), 3);
    assert.equal(inOrderCount([], ["a"]), 0);
    assert.equal(inOrderCount(["a"], []), 0);
    assert.equal(inOrderCount(["a"], ["b"]), 0);
  });
  it("is the table's count, for sizes either side of 32 and 64 words and for words said again and again", () => {
    const m = maker(6);
    for (const [r, w, vocab] of [[31, 31, 8], [32, 32, 8], [33, 33, 8], [64, 65, 12], [65, 64, 12], [100, 37, 5], [37, 100, 5], [150, 140, 40], [200, 200, 3], [90, 90, 1000]]) {
      const pick = () => "x" + Math.floor(m.next() * vocab);
      const [a, b] = [Array.from({ length: r }, pick), Array.from({ length: w }, pick)];
      assert.equal(inOrderCount(a, b), table(a, b), `${r} words in ${w}, from ${vocab}`);
      assert.equal(inOrderCount(b, a), table(b, a));
    }
  });
});

describe("matchVersion", () => {
  it("a re-export of the same talk matches its episode", () => {
    const old = { id: "e-20261020-aaaaaa", folder: "A", kind: "finished", archived: false, session: null, seconds: 800, fingerprint: fingerprintOf(words(TALK)) };
    assert.deepEqual(matchVersion({ seconds: 790, fingerprint: fingerprintOf(words(TALK)), words: words(TALK) }, [old], () => words(TALK)), { id: old.id, folder: "A" });
  });
  it("no match: another length, a session, unanswered, or words not on this Mac", () => {
    const base = { id: "e-20261020-aaaaaa", folder: "A", kind: "finished", archived: false, session: null, seconds: 800, fingerprint: fingerprintOf(words(TALK)) };
    const mine = { seconds: 790, fingerprint: base.fingerprint, words: words(TALK) };
    assert.equal(matchVersion({ ...mine, seconds: 500 }, [base], () => words(TALK)), null);
    assert.equal(matchVersion(mine, [{ ...base, kind: "session", session: { marked: AT } }], () => words(TALK)), null);
    assert.equal(matchVersion(mine, [{ ...base, kind: null }], () => words(TALK)), null);
    assert.equal(matchVersion(mine, [base], () => null), null);
  });

  const said = maker(7).talk(1200);
  const mine = arrival(said);
  /** A shelf of words by folder (every folder holds the talk when none is given), and the folders that were asked for. */
  const reads = (shelf) => {
    const asked = [];
    const talk = maker().timed(said);
    return { asked, read: (folder) => (asked.push(folder), shelf ? shelf[folder] : talk) };
  };
  it("gives only the id and the folder of the episode", () => {
    const old = episode(said, { id: "e-20261001-bbbbbb", folder: "Pricing", extra: "x" });
    assert.deepEqual(matchVersion(mine, [old], reads().read), { id: "e-20261001-bbbbbb", folder: "Pricing" });
  });
  it("takes an episode of any answered kind but a session: finished, raw, an iPhone clip, or a raw recording imported before the switch", () => {
    for (const kind of ["finished", "raw", "short video", "episode"]) assert.notEqual(matchVersion(mine, [episode(said, { kind })], reads().read), null, kind);
  });
  it("leaves out a session, by its kind or by a mark that has not been cleared, and an archived episode", () => {
    const marked = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
    const cleared = { ...marked, cleared: { at: AT, on: "Sallie's laptop", to: "finished", confirmed: "dialog" } };
    const none = reads();
    for (const over of [{ kind: "session" }, { kind: "session", session: cleared }, { session: marked }, { session: { marked: AT } }, { archived: { at: AT } }, { kind: null }, { kind: undefined }]) {
      assert.equal(matchVersion(mine, [episode(said, over)], none.read), null, JSON.stringify(over));
    }
    assert.deepEqual(none.asked, [], "no file was read for any of them");
    assert.notEqual(matchVersion(mine, [episode(said, { session: cleared })], reads().read), null, "a session that was cleared is an episode again");
  });
  it("wants the lengths to differ by no more than a fifth of the longer one, whichever it is, and reads no file for another", () => {
    const none = reads();
    for (const [theirs, ours] of [[800, 640], [640, 800], [800, 1000], [1000, 800], [800, 800]]) assert.notEqual(matchVersion({ ...mine, seconds: ours }, [episode(said, { seconds: theirs })], reads().read), null, `${theirs} and ${ours}`);
    for (const [theirs, ours] of [[800, 639], [639, 800], [800, 1001], [1001, 800], [800, 0], [0, 800], [800, NaN], [800, undefined]]) {
      assert.equal(matchVersion({ ...mine, seconds: ours }, [episode(said, { seconds: theirs })], none.read), null, `${theirs} and ${ours}`);
    }
    assert.equal(matchVersion(mine, [episode(said, { seconds: undefined }), episode(said, { seconds: "800" })], none.read), null);
    assert.deepEqual(none.asked, []);
  });
  it("wants at least half of the new file's hashes in the episode's, and reads no file for less", () => {
    const m = maker(8);
    const none = reads();
    const [sameHalf, lessHalf] = [m.edited(said, 0.1), m.edited(said, 0.25)];
    assert.ok(shareOf(mine.fingerprint, episode(sameHalf).fingerprint) >= 0.5 && shareOf(mine.fingerprint, episode(lessHalf).fingerprint) < 0.5);
    assert.notEqual(matchVersion(mine, [episode(sameHalf)], reads({ A: maker().timed(sameHalf) }).read), null);
    assert.equal(matchVersion(mine, [episode(lessHalf)], none.read), null);
    assert.equal(matchVersion(mine, [episode(maker(9).talk(1200))], none.read), null, "another talk of the same length");
    assert.equal(matchVersion(mine, [episode(said, { fingerprint: "" }), episode(said, { fingerprint: undefined })], none.read), null, "an episode with no fingerprint");
    assert.equal(matchVersion({ ...mine, fingerprint: "" }, [episode(said)], none.read), null, "a new file with none");
    assert.deepEqual(none.asked, []);
  });
  it("finds nothing for no candidates, no words or no length", () => {
    assert.equal(matchVersion(mine, [], reads().read), null);
    assert.equal(matchVersion(mine, undefined, reads().read), null);
    assert.equal(matchVersion({ ...mine, words: [] }, [episode(said)], reads().read), null);
    assert.equal(matchVersion({ ...mine, words: undefined }, [episode(said)], reads().read), null);
    assert.equal(matchVersion({ ...mine, seconds: 0 }, [episode(said)], reads().read), null);
  });
  it("counts in order on the one best by share, and reads only its words", () => {
    const m = maker(10);
    const closest = episode(m.edited(said, 0.02), { id: "e-20261002-cccccc", folder: "Closest" });
    const near = episode(m.edited(said, 0.1), { id: "e-20261003-dddddd", folder: "Near" });
    const far = episode(m.edited(said, 0.2), { id: "e-20261004-eeeeee", folder: "Far" });
    assert.ok(shareOf(mine.fingerprint, far.fingerprint) < 0.5 && shareOf(mine.fingerprint, near.fingerprint) > 0.5);
    for (const order of [[closest, near, far], [far, near, closest], [near, closest, far]]) {
      const some = reads();
      assert.deepEqual(matchVersion(mine, order, some.read), { id: "e-20261002-cccccc", folder: "Closest" });
      assert.deepEqual(some.asked, ["Closest"]);
    }
  });
  it("takes the length nearest when two have as much of the hashes, and the first of them when the length is no help either", () => {
    const [far, near] = [episode(said, { id: "e-20261001-aaaaaa", folder: "Far", seconds: 440 }), episode(said, { id: "e-20261002-bbbbbb", folder: "Near", seconds: 475 })];
    assert.equal(matchVersion({ ...mine, seconds: 480 }, [far, near], reads().read).folder, "Near");
    const twins = [episode(said, { folder: "First", seconds: 480 }), episode(said, { folder: "Second", seconds: 480 })];
    assert.equal(matchVersion({ ...mine, seconds: 480 }, twins, reads().read).folder, "First");
  });
  it("leaves the list it is given as it was", () => {
    const list = [episode(maker(16).edited(said, 0.1), { folder: "Near" }), episode(said, { folder: "Same" })];
    const before = JSON.stringify(list);
    assert.equal(matchVersion(mine, list, reads().read).folder, "Same");
    assert.equal(JSON.stringify(list), before);
  });
  it("skips an episode whose words are not whole on this Mac, and counts in order on the next best", () => {
    const [here, away] = [episode(maker(11).edited(said, 0.05), { folder: "Here" }), episode(said, { folder: "Away" })];
    const some = reads({ Here: maker().timed(said) });
    assert.deepEqual(matchVersion(mine, [away, here], some.read), { id: "e-20261020-aaaaaa", folder: "Here" });
    assert.deepEqual(some.asked, ["Away", "Here"]);
    assert.equal(matchVersion(mine, [away], reads({ Away: null }).read), null);
    assert.equal(matchVersion(mine, [away], () => undefined), null);
    assert.equal(matchVersion(mine, [away], () => "not words"), null);
  });

  /** The first `kept` words of the talk, then words that are in no episode. */
  const withNew = (kept, total = said.length) => [...said.slice(0, kept), ...Array.from({ length: total - kept }, (_, i) => "z" + i)];
  it("wants at least 70 in 100 of the new file's words found in order in the episode's", () => {
    const old = episode(said);
    for (const [kept, found] of [[1200, true], [900, true], [841, true], [840, true], [839, false], [800, false], [650, false]]) {
      assert.equal(matchVersion(arrival(withNew(kept)), [old], reads().read) !== null, found, `${kept} of 1200`);
    }
    assert.ok(shareOf(arrival(withNew(650)).fingerprint, old.fingerprint) >= 0.5, "so it is the words that are counted for the last of them");
  });
  it("counts the new file's words, not the episode's: a shorter export of the talk is all there, a longer one has its first part there", () => {
    for (const kept of [1000, 960]) assert.deepEqual(matchVersion(arrival(said.slice(0, kept)), [episode(said)], reads().read), { id: "e-20261020-aaaaaa", folder: "A" }, `${kept} words in 1200`);
    const shorter = episode(said.slice(0, 960));
    assert.deepEqual(matchVersion(arrival(said), [shorter], reads({ A: maker().timed(said.slice(0, 960)) }).read), { id: "e-20261020-aaaaaa", folder: "A" }, "960 of 1200 is 80 in 100");
  });
  it("does not find a talk whose runs are all there in another order: its hashes match, its words do not follow", () => {
    const swapped = [...said.slice(600), ...said.slice(0, 600)];
    const old = episode(swapped);
    assert.ok(shareOf(mine.fingerprint, old.fingerprint) > 0.99);
    const some = reads({ A: maker().timed(swapped) });
    assert.equal(matchVersion(mine, [old], some.read), null);
    assert.deepEqual(some.asked, ["A"]);
  });
  it("counts on the one best only: when it fails, the next is not tried", () => {
    const swapped = [...said.slice(600), ...said.slice(0, 600)];
    const [wrong, right] = [episode(swapped, { folder: "Wrong" }), episode(maker(13).edited(said, 0.05), { folder: "Right" })];
    const some = reads({ Wrong: maker().timed(swapped), Right: maker().timed(said) });
    assert.equal(matchVersion(mine, [right, wrong], some.read), null);
    assert.deepEqual(some.asked, ["Wrong"]);
  });
  it("agrees with inMain where inMain finds the new file in the episode's", () => {
    const m = maker(14);
    for (const share of [0, 0.03, 0.05]) {
      const theirs = m.timed(m.edited(said, share));
      assert.notEqual(inMain(mine.words, theirs, mine.seconds, theirs[theirs.length - 1].end), null, `inMain finds ${share}`);
      assert.ok(inOrderCount(said, theirs.map((w) => w.w)) >= said.length * 0.9);
    }
  });

  describe("at the cost of two talks of about 9,000 words", () => {
    const m = maker(15);
    const talk = m.talk(9000);
    const SECONDS = talk.length * 0.4;
    it("matches an edited, shortened re-export within a second", () => {
      const old = episode(talk, { seconds: SECONDS });
      const edited = m.edited(talk.slice(0, 8600), 0.03);
      const timed = m.timed(edited);
      const some = reads({ A: m.timed(talk) });
      const started = performance.now();
      const found = matchVersion({ seconds: edited.length * 0.4, fingerprint: fingerprintOf(timed), words: timed }, [old], some.read);
      const took = performance.now() - started;
      assert.deepEqual(found, { id: "e-20261020-aaaaaa", folder: "A" });
      assert.deepEqual(some.asked, ["A"]);
      assert.ok(took < 1000, `${Math.round(took)} ms`);
    });
    it("passes over a talk with the same runs in another order within a second, which is the dearest it can be", () => {
      const swapped = [...talk.slice(4500), ...talk.slice(0, 4500)];
      const old = episode(swapped, { seconds: SECONDS });
      assert.ok(shareOf(fingerprintOf(m.timed(talk)), old.fingerprint) > 0.99, "so the words are counted");
      const timed = m.timed(talk);
      const some = reads({ A: m.timed(swapped) });
      const started = performance.now();
      const found = matchVersion({ seconds: SECONDS, fingerprint: fingerprintOf(timed), words: timed }, [old], some.read);
      const took = performance.now() - started;
      assert.equal(found, null);
      assert.deepEqual(some.asked, ["A"]);
      assert.ok(took < 1000, `${Math.round(took)} ms`);
    });
  });
});
