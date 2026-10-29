// finish "<episode>" reels, the module on its own (plan PR 9, groups 1, 3 and 10; architecture 2026-10-27, 4.3 and 8.7): the word that asks
// for it, the sentences it says, what the next revision of a finished video's hand-off is made of (nextHandoff), which parts of the last
// finish a hand-off still holds (heldReelParts), and the hand-off on file that it is made from (reelsBase, finish.js). Nothing here runs a
// program: the folders are made for each test, in the temporary directory.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REELS_WORD, START, SAY_AGAIN, BRINGING, heldReelParts, keepOldWords, lostReelsWords, missingWords, nextHandoff, nothingNewWords, noHandoffWords, noReelWords, otherKindWords, rawWords, reelsAsked, retitledReels, unusableWords } from "../finish-reels.js";
import { reelsBase } from "../finish.js";

const NAME = "Pricing: what to charge?";
/** Nothing she reads holds a path (but the folder name final/), a flag, or the name of a command. */
const PLAIN = /\/(?!$)|~|--|\bedit\.js\b|\bnode\b|\bnpx\b|\bStudio\b/;

describe("the word that asks for the Reels of a finished video", () => {
  it("is `reels`, and counts as the form only as the last word and after another word, in any case", () => {
    assert.equal(REELS_WORD, "reels");
    assert.deepEqual(reelsAsked(["Pricing talk", "reels"]), { episode: ["Pricing talk"] });
    assert.deepEqual(reelsAsked(["Pricing", "talk", "Reels"]), { episode: ["Pricing", "talk"] });
    assert.deepEqual(reelsAsked(["3fa9c1", "REELS"]), { episode: ["3fa9c1"] });
  });
  it("takes any other words as the name of an episode, as `finish reels` alone names an episode called reels", () => {
    for (const words of [["reels"], ["Pricing reels"], ["Pricing talk"], ["Pricing talk", "reel", "2"], ["reels", "Pricing"], ["Pricing", "reels", "talk"], []]) assert.equal(reelsAsked(words), null, JSON.stringify(words));
    assert.equal(reelsAsked(undefined), null);
    assert.equal(reelsAsked("reels"), null);
  });
  it("leaves the words it was given as they were", () => {
    const words = ["Pricing", "talk", "reels"];
    reelsAsked(words);
    assert.deepEqual(words, ["Pricing", "talk", "reels"]);
  });
});

describe("what the next revision of a finished video's hand-off is made of", () => {
  const main = { file: "Pricing talk.mp4", seconds: 63.72, srt: "1\n00:00:00,000 --> 00:00:03,200\n Welcome to the show.\n\n" };
  const suggestion = (n) => ({ n, start: n, end: n + 5, stretches: [{ start: n, end: n + 5 }], first: "a", last: "b", why: "c", point: "d" });
  const reel = (n, over = {}) => ({ n, title: `Reel ${n}`, file: `Pricing talk reel ${n}.mp4`, seconds: 10 + n, inMain: { start: n, end: n + 5 }, srt: `${n}\n00:00:00,000 --> 00:00:02,000\n Reel ${n}.\n\n`, fromSuggestion: n, ...over });
  const onFile = (reels, over = {}) => ({ format: "brimm-video hand-off", version: 2, revision: 1, main, suggestions: [suggestion(1), suggestion(2)], reels, session: null, ...over });

  it("is main as it was, the suggestions as they were, and the Reels it holds with the new ones added in the order of their numbers", () => {
    const made = nextHandoff({ onFile: onFile([reel(2)]), reels: [reel(3), reel(1)] });
    assert.deepEqual(made.main, main);
    assert.deepEqual(made.suggestions, [suggestion(1), suggestion(2)]);
    assert.deepEqual(made.reels, [reel(1), reel(2), reel(3)]);
    assert.deepEqual(Object.keys(made), ["main", "suggestions", "reels"]);
  });
  it("keeps the Reels it holds exactly as they were, every key of each", () => {
    const earlier = [reel(2, { title: "Kept" }), reel(4, { inMain: undefined, fromSuggestion: null })];
    const made = nextHandoff({ onFile: onFile(earlier), reels: [reel(3)] });
    assert.deepEqual(made.reels.filter((r) => r.n !== 3), earlier);
  });
  it("puts a Reel taken again in the place of the Reel of its number, so that no number is there twice", () => {
    const made = nextHandoff({ onFile: onFile([reel(1), reel(2)]), reels: [reel(2, { file: "new.mp4", title: "New" })] });
    assert.deepEqual(made.reels.map((r) => r.n), [1, 2]);
    assert.deepEqual(made.reels[1], reel(2, { file: "new.mp4", title: "New" }));
    assert.deepEqual(made.reels[0], reel(1));
  });
  it("has no suggestions when the hand-off on file has none, and no Reels beyond the new ones when it holds none", () => {
    const none = nextHandoff({ onFile: onFile([], { suggestions: undefined }), reels: [reel(2)] });
    assert.equal("suggestions" in none, false);
    assert.deepEqual(none.reels, [reel(2)]);
    assert.equal("suggestions" in nextHandoff({ onFile: onFile([], { suggestions: [] }), reels: [] }), false);
    assert.deepEqual(nextHandoff({ onFile: onFile(undefined), reels: [reel(2)] }).reels, [reel(2)]);
  });
  it("changes nothing of what it is given", () => {
    const given = onFile([reel(2)]);
    const before = JSON.stringify(given);
    const added = [reel(1)];
    const addedBefore = JSON.stringify(added);
    nextHandoff({ onFile: given, reels: added });
    assert.equal(JSON.stringify(given), before);
    assert.equal(JSON.stringify(added), addedBefore);
  });
});

describe("the parts of the last finish that a hand-off still holds", () => {
  const part = (n) => ({ file: `final/reel ${n}.mp4`, bytes: n, seconds: 10, source: { bytes: n, mtimeMs: n }, project: `reel ${n} project` });
  const parts = { main: { v: 0, file: "final/Talk.mp4", import: true, kind: "finished" }, "reel 3": part(3), "reel 1": part(1), "reel 2": part(2), "story": { file: "x" } };

  it("are those of the Reels it holds, in the order of their numbers, and never main", () => {
    const held = heldReelParts(parts, [{ n: 2 }, { n: 3 }]);
    assert.deepEqual(Object.keys(held), ["reel 2", "reel 3"]);
    assert.deepEqual(held["reel 2"], part(2));
  });
  it("are none when the hand-off holds no Reel, or the finish had no parts", () => {
    assert.deepEqual(heldReelParts(parts, []), {});
    assert.deepEqual(heldReelParts(parts, undefined), {});
    assert.deepEqual(heldReelParts(undefined, [{ n: 1 }]), {});
    assert.deepEqual(heldReelParts({ main: parts.main }, [{ n: 1 }]), {});
  });
  it("leave out a Reel of the hand-off that the finish has no part for", () => {
    assert.deepEqual(Object.keys(heldReelParts(parts, [{ n: 1 }, { n: 9 }])), ["reel 1"]);
  });
});

describe("the Reels whose title was changed since the hand-off was made (the review's M1)", () => {
  const held = [{ n: 1, title: "The opening" }, { n: 2, title: "Know your costs" }, { n: 5, title: "Say it again" }];
  it("are those the hand-off holds whose title in the record is another, with the number of each", () => {
    const record = [{ n: 1, title: "The opening" }, { n: 2, title: "Know your costs, again" }, { n: 3, title: "Not handed off" }, { n: 5, title: "Say it better" }];
    assert.deepEqual(retitledReels(held, record), [2, 5]);
  });
  it("are none when the titles are the same, the record has none, or the Reel is not in the record", () => {
    assert.deepEqual(retitledReels(held, [{ n: 1, title: "The opening" }, { n: 2, title: " Know your costs " }]), [], "a title is compared trimmed, as the quick part reads one");
    assert.deepEqual(retitledReels(held, [{ n: 1, title: "" }, { n: 2 }, { n: 5, title: "   " }]), [], "a Reel with no title in the record is asked for one, never taken as a change");
    assert.deepEqual(retitledReels(held, []), []);
    assert.deepEqual(retitledReels(held, undefined), []);
    assert.deepEqual(retitledReels(undefined, [{ n: 1, title: "x" }]), []);
  });
});

describe("the words she reads", () => {
  it("are these, and hold no path, flag or command", () => {
    const said = [
      [rawWords(NAME), `${NAME} is a raw video: its Reels are handed off with its main video. Say "hand it off".`],
      [noHandoffWords(NAME), `${NAME}'s hand-off is written once its spellings are answered, and its Reels go into it after that. Say "show me the spellings".`],
      [otherKindWords(NAME), `${NAME}'s hand-off was made as another kind than it is now: it waits for its new reading.`],
      [unusableWords(NAME), `${NAME}'s hand-off cannot be used as it stands, so its Reels cannot be added to it. Ask Jason.`],
      [missingWords(NAME), `${NAME}'s hand-off is not there, so its Reels cannot be added to it. Ask Jason.`],
      [lostReelsWords(NAME), `${NAME}'s hand-off is not there or cannot be read, so a new one would leave out the Reels it holds. Nothing was written. Ask Jason.`],
      [noReelWords(NAME), `${NAME} has no Reel made in HyperFrames yet. Say "show me the Reels" to see Claude's suggestions.`],
      [nothingNewWords(NAME, 3), `${NAME} has no Reel exported since its hand-off was made, as revision 3, so there is nothing new to hand off. Export one from HyperFrames on This Mac, then say "hand off the Reels".`],
      [nothingNewWords(NAME, 3, [2]), `${NAME} has no Reel exported since its hand-off was made, as revision 3, so there is nothing new to hand off. Export one from HyperFrames on This Mac, then say "hand off the Reels". Reel 2 has a new title since its hand-off was made: it goes in once you export Reel 2 again.`],
      [nothingNewWords(NAME, 3, [2, 5]), `${NAME} has no Reel exported since its hand-off was made, as revision 3, so there is nothing new to hand off. Export one from HyperFrames on This Mac, then say "hand off the Reels". Reel 2 and Reel 5 have new titles since their hand-off was made: they go in once you export each again.`],
      [keepOldWords([2]), `Reel 2's captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".`],
      [keepOldWords([2, 3]), `Reel 2's and Reel 3's captions keep the old spelling until you export each again from HyperFrames and say "hand off the Reels".`],
      [keepOldWords([1, 2, 5]), `Reel 1's, Reel 2's and Reel 5's captions keep the old spelling until you export each again from HyperFrames and say "hand off the Reels".`],
      [START, 'Say "yes, hand off the Reels" to start.'],
      [SAY_AGAIN, 'Say "hand off the Reels" again.'],
      [BRINGING, "Dropbox is still bringing the hand-off over: say it again in a minute."]
    ];
    for (const [words, expected] of said) {
      assert.equal(words, expected);
      assert.doesNotMatch(words, PLAIN, words);
    }
  });
});

describe("the hand-off on file, which the next revision is made from (reelsBase)", () => {
  const REL = "final/Talk.brimm-ops.json";
  const HANDOFF = { format: "brimm-video hand-off", version: 2, revision: 4, video: { id: "e-20261014-3fa9c1", kind: "finished", name: "Talk" }, main: { file: "Talk.mp4", seconds: 10, srt: "1\n00:00:00,000 --> 00:00:02,000\n Hello.\n\n" }, reels: [], session: null };
  const finished = (over = {}) => ({ revision: 4, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", handoff: REL, parts: { main: { v: 0, file: "final/Talk.mp4", import: true, kind: "finished" } }, ...over });
  const record = (over = {}) => ({ id: "e-20261014-3fa9c1", kind: "finished", name: { text: "Talk", placeholder: false }, finished: finished(), ...over });
  /** A folder with the hand-off in it (or what `text` says), and the result of reelsBase for `rec`. */
  function look(rec, { text = JSON.stringify(HANDOFF), whole = true, rel = REL } = {}) {
    const folder = mkdtempSync(join(tmpdir(), "brimm-reels-base-"));
    try {
      if (text !== null) {
        mkdirSync(join(folder, rel, ".."), { recursive: true });
        writeFileSync(join(folder, rel), text);
      }
      return reelsBase(folder, rec, { isWhole: () => whole });
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  it("is the hand-off and the path and revision it was read at, for a finished video whose hand-off the import's captions made", () => {
    assert.deepEqual(look(record()), { onFile: HANDOFF, base: { handoff: REL, revision: 4 } });
  });
  it("says the hand-off is written once the spellings are answered, when the record has none yet", () => {
    assert.deepEqual(look(record({ finished: undefined })), { why: noHandoffWords("Talk") });
    assert.deepEqual(look(record({ finished: null })), { why: noHandoffWords("Talk") });
  });
  it("says it waits for the new reading when the hand-off was made as another kind than the video is now", () => {
    const made = (kind) => record({ finished: finished({ parts: { main: { v: 0, file: "final/Talk.mp4", import: true, kind } } }) });
    assert.deepEqual(look(made("short video")), { why: otherKindWords("Talk") });
    assert.deepEqual(look(made(undefined)), { why: otherKindWords("Talk") });
  });
  it("says it cannot be used when it was not made from the import, or is named where final/ is not directly", () => {
    const why = { why: unusableWords("Talk") };
    assert.deepEqual(look(record({ finished: finished({ parts: { main: { v: 0, file: "final/Talk.mp4", noHandEdits: true } } }) })), why);
    assert.deepEqual(look(record({ finished: finished({ parts: {} }) })), why);
    for (const handoff of ["history/Talk.brimm-ops.json", "final/sub/Talk.brimm-ops.json", "../final/Talk.brimm-ops.json", "final/Talk.json", "Talk.brimm-ops.json", "final/", 7, undefined]) {
      assert.deepEqual(look(record({ finished: finished({ handoff }) })), why, String(handoff));
    }
  });
  it("says it cannot be used when it cannot be read, is not version 2, is not a finished video's, has no main video or no revision", () => {
    const why = { why: unusableWords("Talk") };
    for (const text of ["", "not json", "[]", "7", "null", JSON.stringify({ ...HANDOFF, version: 1 }), JSON.stringify({ ...HANDOFF, video: { ...HANDOFF.video, kind: "raw" } }), JSON.stringify({ ...HANDOFF, video: undefined }), JSON.stringify({ ...HANDOFF, main: undefined }), JSON.stringify({ ...HANDOFF, main: "Talk.mp4" }), JSON.stringify({ ...HANDOFF, revision: undefined }), JSON.stringify({ ...HANDOFF, revision: 0 }), JSON.stringify({ ...HANDOFF, revision: 1.5 })]) {
      assert.deepEqual(look(record(), { text }), why, String(text));
    }
  });
  it("asks for it to be brought over when it is there but not whole on this Mac (a placeholder Dropbox has not filled), and reads nothing", () => {
    assert.deepEqual(look(record(), { whole: false }), { coming: REL });
    assert.deepEqual(look(record(), { whole: false, text: "not even json" }), { coming: REL }, "it is not read before it is whole");
  });
  it("says it is not there, and to ask Jason, when the file is not in the folder at all: there is nothing for Dropbox to bring over (the review's I2)", () => {
    for (const whole of [true, false]) assert.deepEqual(look(record(), { whole, text: null }), { why: missingWords("Talk") }, `whole: ${whole}`);
  });
  it("names the video as edit.js names it, never by its file", () => {
    assert.deepEqual(look(record({ name: { text: NAME, placeholder: false }, finished: undefined })), { why: noHandoffWords(NAME) });
  });
  it("only reads: the folder is as it was", () => {
    const folder = mkdtempSync(join(tmpdir(), "brimm-reels-base-"));
    try {
      mkdirSync(join(folder, "final"));
      writeFileSync(join(folder, REL), JSON.stringify(HANDOFF));
      const got = reelsBase(folder, record(), { isWhole: () => true });
      assert.equal(got.base.revision, 4);
      assert.deepEqual(JSON.parse(JSON.stringify(got.onFile)), HANDOFF);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
