// The episode's own spellings: a word as the transcriber writes it, and as it is spelled, in the timelines' words and the
// final transcripts.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spellingFault, withSpelling, spellWords, respelledPart, respelledHandoff } from "../spelling.js";
import { spelled } from "../final-transcript.js";
import { buildHandoff, handoffFault } from "../handoff.js";

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
