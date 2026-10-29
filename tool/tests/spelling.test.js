// The episode's own spellings: a word as the transcriber writes it, and as it is spelled, in the timelines' words and the
// final transcripts.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spellingFault, withSpelling, spellWords, respelledHeldReel, respelledPart, respelledHandoff, respelledHandoffV2 } from "../spelling.js";
import { spelled } from "../final-transcript.js";
import { buildHandoff, handoffFault } from "../handoff.js";
import { handoffFaultV2 } from "../handoff-v2.js";

const SALLIE = [["Sally", "Sallie"]];

describe("a spelling", () => {
  it("is one word as heard and one to four words as spelled, not the same", () => {
    assert.equal(spellingFault("Hormozy", "Hormozi"), "");
    assert.equal(spellingFault("Sally Ogden", "Sallie Ogden"), '"Sally Ogden" is not one word. Say the one word as the transcriber writes it.');
    assert.equal(spellingFault("Sally", ""), 'Say how "Sally" is spelled, in one to four words.');
    assert.equal(spellingFault("Sallie", "Sallie"), '"Sallie" is spelled that way already.');
  });
  it("is refused for a word the show's own names spell already, which it could never change", () => {
    assert.equal(spellingFault("Sally", "Sallie"), '"Sally" is spelled "Sallie" already: it is one of the show\'s own names.');
    assert.equal(spellingFault("Sally", "Sal"), '"Sally" is always written "Sallie", the show\'s own spelling. To spell it another way, give "Sallie" as the word heard.');
  });
  it("is kept once for each word as heard, the newest", () => {
    assert.deepEqual(withSpelling([["Sally", "Sally O"], ["Hormozy", "Hormozi"]], "Sally", "Sallie"), [["Hormozy", "Hormozi"], ["Sally", "Sallie"]]);
  });
  it("is applied to a words file's words, as written, with what is around it, and never inside a longer word", () => {
    assert.deepEqual(spellWords([{ w: "Sally.", start: 1, end: 2 }, { w: "Sally,", start: 2, end: 3 }, { w: "Sally's", start: 3, end: 4 }, { w: "Sallyport", start: 4, end: 5 }], SALLIE).map((w) => w.w), ["Sallie.", "Sallie,", "Sallie's", "Sallyport"]);
  });
  it("is one spelled() takes: every spelling accepted changes a text that has its word", () => {
    for (const [heard, meant] of [["Hormozy", "Hormozi"], ["O'Brien", "O’Brien"], ["co-op", "Co-op"], ["10", "ten"]]) {
      assert.equal(spellingFault(heard, meant), "", heard);
      assert.notEqual(spelled(`and ${heard} said`, [[heard, meant]]), `and ${heard} said`, heard);
    }
    assert.equal(spellingFault("O’Brien", "O'Brien"), `"O’Brien" has a curly apostrophe, and the transcriber writes a straight one ('): give it that way.`);
  });
});

describe("the final transcripts, spelled again", () => {
  it("spell the captions, make the transcript again from them, and spell the words, never a caption's number or times", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nThank you, Sally.\n\n";
    const made = respelledPart({ srt, words: JSON.stringify({ video: "a.mov", duration: 2, words: [{ w: "Sally.", start: 1, end: 2 }] }) }, SALLIE);
    assert.equal(made.srt, "1\n00:00:01,000 --> 00:00:02,000\nThank you, Sallie.\n\n");
    assert.match(made.txt, /Thank you, Sallie\./);
    assert.deepEqual(JSON.parse(made.words).words, [{ w: "Sallie.", start: 1, end: 2 }]);
    assert.equal(respelledPart({ srt, words: null }, SALLIE).words, null);
  });
  it("make the hand-off again as the next revision, with each part's captions as spelled now, by this brimm-video", () => {
    const srt = (words) => `1\n00:00:01,000 --> 00:00:02,000\n${words}\n\n`;
    const record = { id: "e-20261014-3fa9c1", kind: "episode", name: { text: "Pricing talk" }, video: { recorded: "2026-10-14", recordedFrom: "video" }, title: { text: "Price like you mean it", approved: true }, reels: [{ n: 2, title: "Know your costs" }] };
    const handoff = buildHandoff({ record, revision: 1, made: "2026-10-20T15:00:00-05:00", madeOn: "Mac Studio", commit: "c709b57", main: { file: "m.mov", seconds: 9, srt: srt("Sally.") }, reels: [{ n: 2, title: "Know your costs", file: "r.mov", seconds: 7, srt: srt("Sally.") }] });
    const next = respelledHandoff(handoff, { record, srts: { main: srt("Sallie."), "reel 2": srt("Sallie, yes.") }, revision: 2, made: "2026-10-21T09:00:00-05:00", madeOn: "Sallie's laptop", commit: "e72a170" });
    assert.deepEqual([next.revision, next.madeOn, next.madeBy, next.main.srt, next.reels[0].srt, next.reels[0].title], [2, "Sallie's laptop", "brimm-video e72a170", srt("Sallie."), srt("Sallie, yes."), "Know your costs"]);
    assert.equal(handoffFault(next), "");
  });
  it("make the hand-off again with the episode's name and approved title as the record has them now, as a finish would", () => {
    const srt = (words) => `1\n00:00:01,000 --> 00:00:02,000\n${words}\n\n`;
    const record = { id: "e-20261014-3fa9c1", kind: "episode", name: { text: "Pricing talk" }, video: { recorded: "2026-10-14", recordedFrom: "video" }, title: { text: "Price like you mean it", approved: true }, reels: [] };
    const handoff = buildHandoff({ record, revision: 1, made: "2026-10-20T15:00:00-05:00", madeOn: "Mac Studio", commit: "c709b57", main: { file: "m.mov", seconds: 9, srt: srt("Sally.") } });
    // Named and titled again since the finish: the next revision carries what the record says now.
    const now = { ...record, name: { text: "Pricing, part one" }, title: { text: "What to charge, and why", approved: true } };
    const next = respelledHandoff(handoff, { record: now, srts: { main: srt("Sallie.") }, revision: 2, made: "2026-10-21T09:00:00-05:00", madeOn: "Sallie's laptop", commit: "e72a170" });
    assert.deepEqual([next.episode.name, next.episode.title, next.main.file], ["Pricing, part one", "What to charge, and why", "m.mov"]);
    assert.equal(handoffFault(next), "");
  });
});

describe("a Reel a hand-off holds, spelled again (plan PR 9, the review's I1)", () => {
  const srt = "1\n00:00:01,000 --> 00:00:02,000\n Thank you, Cynthia and Sallie.\n\n";
  const words = `${JSON.stringify({ video: "r.mp4", duration: 2, words: [{ w: "Cynthia", start: 1, end: 1.5 }, { w: "Sallie.", start: 1.5, end: 2 }] }, null, 2)}\n`;
  const ALLISON = ["Cynthia", "Allison"];
  it("applies the pairs it does not hold to its captions, its transcript and its word times, and holds those that changed them", () => {
    const made = respelledHeldReel({ srt, words }, { held: [], now: [ALLISON, ["Hormozy", "Hormozi"]] });
    assert.equal(made.srt, srt.replace("Cynthia", "Allison"));
    assert.match(made.txt, /Thank you, Allison and Sallie\./);
    assert.deepEqual(JSON.parse(made.words).words.map((w) => w.w), ["Allison", "Sallie."]);
    assert.deepEqual(made.held, [ALLISON], "a pair whose word is not in it is not held");
    assert.equal(made.keeps, false);
  });
  it("applies none twice: a pair it holds is left, and what it gives back is what it was given", () => {
    const spelled = respelledHeldReel({ srt, words }, { held: [], now: [ALLISON] });
    const again = respelledHeldReel({ srt: spelled.srt, words: spelled.words }, { held: spelled.held, now: [ALLISON] });
    assert.deepEqual([again.srt, again.words, again.held, again.keeps], [spelled.srt, spelled.words, [ALLISON], false]);
    const unchanged = respelledHeldReel({ srt, words }, { held: [], now: [] });
    assert.deepEqual([unchanged.srt, unchanged.words, unchanged.held], [srt, words, []], "byte for byte");
    // A spelling that holds its own word would grow at every spelling after, were it applied again.
    const FULL = ["Sallie", "Sallie Ogden"];
    const full = respelledHeldReel({ srt, words }, { held: [], now: [FULL] });
    assert.match(full.srt, /Cynthia and Sallie Ogden\./);
    const next = respelledHeldReel({ srt: full.srt, words: full.words }, { held: full.held, now: [FULL, ALLISON] });
    assert.match(next.srt, /Allison and Sallie Ogden\./);
    assert.doesNotMatch(next.srt, /Ogden Ogden/);
    assert.deepEqual(next.held, [FULL, ALLISON]);
  });
  it("keeps what a spelling gave it that was taken back or changed since, and says so, when its captions still hold it: the spelling cannot be taken out of words that hold it", () => {
    const spelled = respelledHeldReel({ srt, words }, { held: [], now: [ALLISON] });
    for (const now of [[], [["Cynthia", "Alison"]]]) {
      const made = respelledHeldReel({ srt: spelled.srt, words: spelled.words }, { held: [ALLISON], now });
      assert.deepEqual([made.srt, made.words, made.keeps, made.held], [spelled.srt, spelled.words, true, [ALLISON]], JSON.stringify(now));
    }
    assert.equal(respelledHeldReel({ srt, words }, { held: [ALLISON], now: [] }).keeps, false, "its captions do not hold it, so there is nothing it keeps");
  });
  it("cannot be done for words that are not a words file, which it says by throwing, for its caller to say the Reel keeps its captions", () => {
    assert.throws(() => respelledHeldReel({ srt, words: "not json" }, { held: [], now: [ALLISON] }));
  });
});

describe("the hand-off made again as version 2", () => {
  const FIXTURE = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
  const srt = (words) => `1\n00:00:01,000 --> 00:00:02,000\n${words}\n\n`;
  const GIVEN = { revision: 7, made: "2026-10-23T09:00:00-04:00", madeOn: "Sallie's laptop", commit: "e72a170" };
  it("keeps what a version 2 hand-off held, with each part's captions as spelled now, the video's first id and its name now", () => {
    const was = FIXTURE("handoff-v2-raw");
    const before = JSON.stringify(was);
    // A new version of the video, named again since: the hand-off keeps the first version's id, given.
    const record = { id: "e-20261023-0b1c2d", kind: "raw", name: { text: "Pricing: when to raise it, again" }, video: { recorded: "2026-10-20", recordedFrom: "video" }, main: { texts: [] }, reels: [] };
    const srts = { main: srt("Folks ask me what to charge."), "reel 2": srt("Some folks wait."), "reel 4": srt("Someone asked me.") };
    const next = respelledHandoffV2(was, { ...GIVEN, record, id: was.video.id, srts, spellings: [["People", "Folks"]] });
    assert.equal(handoffFaultV2(next), "");
    assert.deepEqual([next.version, next.revision, next.made, next.madeOn, next.madeBy], [2, 7, GIVEN.made, "Sallie's laptop", "brimm-video e72a170"]);
    assert.deepEqual(next.video, { id: "e-20261020-c4e5a7", kind: "raw", name: "Pricing: when to raise it, again", recorded: "2026-10-20", recordedFrom: "video" });
    assert.deepEqual(next.main, { ...was.main, srt: srts.main }, "the words on its picture are what the finished file holds, kept");
    // The suggestions' first and last words are the main video's words, spelled as its captions are now.
    assert.deepEqual(next.suggestions, [was.suggestions[0], { ...was.suggestions[1], first: "Folks ask me what" }]);
    assert.deepEqual(next.reels, was.reels.map((r) => ({ ...r, srt: srts[`reel ${r.n}`] })), "each Reel's title, file, place and suggestion kept");
    assert.equal(next.session, null);
    assert.equal(JSON.stringify(was), before, "the hand-off given is not changed");
  });
  it("never makes up a suggestion's words: one missing from the hand-off given is still missing, and the check refuses it", () => {
    const was = FIXTURE("handoff-v2-raw");
    delete was.suggestions[1].first;
    const record = { id: "e-20261020-c4e5a7", kind: "raw", name: { text: "Pricing: when to raise it?" }, video: { recorded: "2026-10-20", recordedFrom: "video" }, main: { texts: [] }, reels: [] };
    const next = respelledHandoffV2(was, { ...GIVEN, record, id: was.video.id, srts: { main: was.main.srt, "reel 2": was.reels[0].srt, "reel 4": was.reels[1].srt }, spellings: [["People", "Folks"]] });
    assert.equal("first" in next.suggestions[1], false);
    assert.equal(handoffFaultV2(next), "Suggestion 3 has no first words.");
  });
  it("is made from a version 1 hand-off as a finish makes version 2: the words on the picture and each Reel's suggestion from the record, and no title", () => {
    const was = buildHandoff({
      record: { id: "e-20261014-3fa9c1", kind: "episode", name: { text: "Pricing talk" }, video: { recorded: "2026-10-14", recordedFrom: "video" }, title: { text: "Price like you mean it", approved: true } },
      revision: 2, made: "2026-10-20T15:00:00-05:00", madeOn: "Mac Studio", commit: "c709b57",
      main: { file: "m.mov", seconds: 9, srt: srt("Sally.") },
      reels: [{ n: 1, title: "Know your costs", file: "r1.mov", seconds: 7, inMain: { start: 1, end: 8 }, srt: srt("Sally.") }, { n: 3, title: "The opening", file: "r3.mov", seconds: 4, srt: srt("Sally.") }]
    });
    const texts = [{ id: "t2", kind: "lower-third", at: 6, for: 3, lines: ["Alex Hormozi"] }, { id: "t1", kind: "lower-third", at: 1, for: 3, lines: ["Sallie Ogden", "Founder, The BRIMM"] }];
    const record = { id: "e-20261014-3fa9c1", kind: "episode", name: { text: "Pricing talk" }, video: { recorded: "2026-10-14", recordedFrom: "video" }, title: { text: "Price like you mean it", approved: true }, main: { texts }, reels: [{ n: 1, title: "Know your costs" }, { n: 3, title: "The opening" }] };
    const next = respelledHandoffV2(was, { ...GIVEN, record, id: "e-20261014-3fa9c1", srts: { main: srt("Sallie."), "reel 1": srt("Sallie."), "reel 3": srt("Sallie.") }, spellings: [["Sally", "Sallie"]] });
    assert.equal(handoffFaultV2(next), "");
    assert.deepEqual([next.version, next.revision, "episode" in next, "suggestions" in next, next.session], [2, 7, false, false, null]);
    assert.deepEqual(next.video, { id: "e-20261014-3fa9c1", kind: "raw", name: "Pricing talk", recorded: "2026-10-14", recordedFrom: "video" });
    assert.doesNotMatch(JSON.stringify(next), /Price like you mean it/);
    assert.deepEqual(next.main, { file: "m.mov", seconds: 9, srt: srt("Sallie."), onPicture: ["Sallie Ogden", "Founder, The BRIMM", "Alex Hormozi"] });
    assert.deepEqual(next.reels.map((r) => [r.n, r.title, r.file, r.inMain, r.srt, r.fromSuggestion]), [[1, "Know your costs", "r1.mov", { start: 1, end: 8 }, srt("Sallie."), 1], [3, "The opening", "r3.mov", undefined, srt("Sallie."), 3]]);
  });
});
