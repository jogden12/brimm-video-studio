// The running captions of a timeline: its kept words, grouped and fitted as a caption style says, never over a join, and
// shown long enough to read (the research's rules 1 and 4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf, pausesOf, phrasesOf } from "../cuts.js";
import { heardWords } from "../clock.js";
import { captionsFor, SHORTEST, FASTEST } from "../captions.js";
import { captionLook } from "../styles.js";
import { TOLD, PAUSES } from "./fixtures.js";

/** The made-up recording's words, each from when it is said (clock.js heardWords), as a push gives them. */
const RAW = wordsOf(TOLD);
const WORDS = heardWords(RAW, phrasesOf(RAW, pausesOf(PAUSES)));
/** The main video's kept pieces in the made-up recording, as its cut plan gives them. */
const MAIN = [{ start: 5.87, end: 9.838 }, { start: 13.383, end: 16.53 }, { start: 19.214, end: 21.297 }];
const UPRIGHT = { width: 1080, height: 1920 };
const PLAIN = captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
const BOLD = captionLook({ style: "bold", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
const said = (made) => made.captions.map((c) => [c.start, c.end, c.lines.join(" / ")]);

describe("the running captions", () => {
  it("are the kept words, a sentence at a time, in the fewest and most even captions that fit Plain's line of 19", () => {
    const made = captionsFor({ words: WORDS, ranges: MAIN, look: PLAIN });
    assert.deepEqual(said(made), [
      [6.07, 6.58, "Welcome to"], [6.58, 7.04, "the show."],
      [7.04, 7.98, "Today we are"], [7.98, 8.72, "going to talk"], [8.72, 9.55, "about pricing."],
      [13.583, 14.42, "So the first thing"], [14.42, 15.12, "you need to do"], [15.12, 16.2, "is know your costs."],
      [19.414, 19.94, "Thank you so"], [19.94, 20.94, "much, Sallie."]
    ]);
    assert.deepEqual(made.told, ["2 captions were split to fit the line.", "5 captions still show for under 0.83 s, and 3 still run faster than 20 characters a second."]);
  });
  it("start a piece's first words when they are said, at the end of the pause before them, not where the word before them ended", () => {
    assert.equal(RAW.find((w) => w.w === "Welcome" && w.end > 6).start, 4.78);
    assert.equal(captionsFor({ words: WORDS, ranges: MAIN, look: PLAIN }).captions[0].start, 6.07);
  });
  it("never runs a caption over a join: a sentence cut in two is two captions", () => {
    const made = captionsFor({ words: WORDS, ranges: [{ start: 5.87, end: 8.0 }, { start: 8.2, end: 9.838 }], look: PLAIN });
    assert.ok(made.captions.every((c) => c.end <= 8.0 || c.start >= 8.2), JSON.stringify(said(made)));
    assert.deepEqual(said(made).slice(2), [[7.04, 7.98, "Today we are"], [8.2, 8.72, "going to talk"], [8.72, 9.55, "about pricing."]]);
  });
  it("puts Bold in capitals on two lines", () => {
    assert.deepEqual(said(captionsFor({ words: WORDS, ranges: [MAIN[1]], look: BOLD })).slice(0, 2), [[13.583, 14.2, "SO THE / FIRST"], [14.2, 14.8, "THING / YOU NEED"]]);
  });
  it("draws a single word too wide for the line smaller, and says by how much", () => {
    const made = captionsFor({ words: [{ w: "Entrepreneurship.", start: 1, end: 2 }], ranges: [{ start: 0, end: 3 }], look: { ...PLAIN, chars: 12 } });
    assert.deepEqual(made.captions, [{ start: 1, end: 2, lines: ["Entrepreneurship."], scale: 0.71 }]);
    assert.deepEqual(made.told, ["1 single word was drawn smaller, the smallest at 71% of the style's size."]);
  });
  it("holds a short caption into the pause ffmpeg heard after it, inside one stretch of speech", () => {
    // The transcriber starts "Then" where "this." ended; the phrases put it after the pause, so the caption before it is held.
    const raw = [{ w: "Know", start: 1, end: 1.3 }, { w: "this.", start: 1.3, end: 1.5 }, { w: "Then", start: 1.5, end: 3.3 }, { w: "act.", start: 3.3, end: 3.6 }];
    const words = heardWords(raw, [{ id: "p1", start: 1, end: 1.5 }, { id: "p2", start: 3, end: 3.6 }]);
    assert.deepEqual(said(captionsFor({ words, ranges: [{ start: 0, end: 4 }], look: PLAIN })), [[1, 1.83, "Know this."], [3, 3.83, "Then act."]]);
    assert.deepEqual(said(captionsFor({ words: raw, ranges: [{ start: 0, end: 4 }], look: PLAIN }))[0], [1, 1.5, "Know this."]);
  });
  it("holds a caption too short to read into the pause after it (rule 4), up to the next word", () => {
    const words = [{ w: "Know", start: 1, end: 1.3 }, { w: "this.", start: 1.3, end: 1.6 }, { w: "Then", start: 3, end: 3.3 }, { w: "act.", start: 3.3, end: 3.5 }];
    assert.deepEqual(said(captionsFor({ words, ranges: [{ start: 0, end: 4 }], look: PLAIN })), [[1, 1.83, "Know this."], [3, 3.83, "Then act."]]);
    assert.equal(SHORTEST, 0.83);
    assert.equal(FASTEST, 20);
  });
  it("leaves a short caption inside a sentence as it is, and counts it", () => {
    const words = ["So", "we", "will", "talk"].map((w, i) => ({ w, start: 1 + i * 0.2, end: 1.2 + i * 0.2 }));
    const made = captionsFor({ words, ranges: [{ start: 0, end: 4 }], look: { ...PLAIN, most: 2 } });
    assert.deepEqual(said(made), [[1, 1.4, "So we"], [1.4, 2.23, "will talk"]]);
    assert.deepEqual(made.told, ["1 caption still shows for under 0.83 s, and 0 still run faster than 20 characters a second."]);
  });
});
