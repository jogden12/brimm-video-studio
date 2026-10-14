// The hand-off file, version 1: what brimm-video gives BRIMM Ops at the end of an edit, and where a Reel's words fall in the
// finished main video. The contract tests, against the fixture builder D copies to brimm-operations, are at the end.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildHandoff, handoffText, handoffFault, normalWords, inMain } from "../handoff.js";
import { tidyTranscript } from "../shared/transcript.js";
import { captionsOf } from "../lib.js";

const round = (t) => Math.round(t * 1000) / 1000;
/** Words said evenly from `start` to `end`, as the word pass gives them. */
const spread = (text, start, end) => {
  const said = text.trim().split(/\s+/);
  const each = (end - start) / said.length;
  return said.map((w, i) => ({ w, start: round(start + each * i), end: round(start + each * (i + 1)) }));
};

describe("normalWords", () => {
  it("matches words whatever their case and punctuation, and a number however it is written", () => {
    assert.deepEqual(normalWords([{ w: "Three,", start: 1, end: 1.2 }, { w: "3.", start: 2, end: 2.1 }, { w: "Sallie's", start: 3, end: 3.4 }]).map((x) => x.w), ["3", "3", "sallies"]);
  });
  it("makes one figure of a number said as tens and units, as the transcriber writes it in figures", () => {
    const said = (text) => normalWords([{ w: text, start: 0, end: 1 }]).map((x) => x.w);
    assert.deepEqual(said("twenty-five"), ["25"]);
    assert.deepEqual(normalWords([{ w: "Twenty", start: 0, end: 0.4 }, { w: "five", start: 0.4, end: 0.8 }]), [{ w: "25", start: 0, end: 0.8 }]);
    assert.deepEqual(said("twenty"), ["20"]);
    assert.deepEqual(said("25"), ["25"]);
    assert.deepEqual(normalWords([{ w: "twenty.", start: 0, end: 0.4 }, { w: "One", start: 0.4, end: 0.8 }]).map((x) => x.w), ["20", "1"]);
    assert.deepEqual(normalWords([{ w: "twenty,", start: 0, end: 0.4 }, { w: "five", start: 0.4, end: 0.8 }]).map((x) => x.w), ["20", "5"]);
    assert.deepEqual(normalWords([{ w: "20", start: 0, end: 0.4 }, { w: "5", start: 0.4, end: 0.8 }]).map((x) => x.w), ["20", "5"]);
  });
  it("gives each part of a word the word's times, and leaves out what has no letter or number", () => {
    assert.deepEqual(normalWords([{ w: "well-known", start: 1, end: 2 }, { w: "—", start: 2, end: 2.1 }]), [{ w: "well", start: 1, end: 2 }, { w: "known", start: 1, end: 2 }]);
  });
});

describe("inMain", () => {
  const MAIN = [...spread("Welcome to the show. Today we are going to talk about pricing.", 0, 3.9), ...spread("So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 4.1, 11.8)];
  it("finds where a Reel's words fall in the finished main video, to the hundredth of a second", () => {
    assert.deepEqual(inMain(spread("So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 0, 7.7), MAIN, 7.7), { start: 4.1, end: 11.8 });
  });
  it("finds them when the main lost a word or two of the Reel's, at least 90 in 100 of them in order", () => {
    const reel = spread("So the first thing you need to do is know your costs. It is very, very, very important. Thank you so much, Sallie.", 0, 8);
    assert.deepEqual(inMain(reel, MAIN, 8), { start: 4.1, end: 11.8 });
  });
  const REEL = "So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.";
  it("ends on the earliest place the Reel's last words can be, when the main goes on to say them again", () => {
    const main = [...MAIN, ...spread("And thank you so much for watching.", 12, 13.5)];
    assert.deepEqual(inMain(spread(REEL, 0, 7.7), main, 7.7), { start: 4.1, end: 11.8 });
    const long = spread("one two three four five six seven eight nine ten ".repeat(8).trim(), 0, 30);
    const talk = [...spread("we begin", 0, 2), ...spread("one two three four five six seven eight nine ten ".repeat(8).trim(), 2, 32), ...spread("and that is nine ten again nine ten", 32, 42)];
    assert.deepEqual(inMain(long, talk, 30), { start: 2, end: 32 });
  });
  it("starts on the latest place the Reel's first words can be, when a stray copy of a word the main cut comes just before", () => {
    const main = [...spread("Welcome to the show and so on.", 0, 7.4), ...spread("the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 8, 15)];
    assert.deepEqual(inMain(spread(REEL, 0, 7.7), main, 7.7), { start: 8, end: 15 });
  });
  it("keeps a true first and last word when the main has a filler beside it", () => {
    const main = [...spread("Welcome to the show.", 0, 3), ...spread("So um the first thing you need to do is know your costs. It is very, very important. Thank you so much, um Sallie.", 4.1, 12.5)];
    const found = inMain(spread(REEL, 0, 7.7), main, 7.7);
    assert.equal(found.start, 4.1);
    assert.equal(found.end, 12.5);
  });
  it("leaves out a stray first word only when its spacing to the next word is far from the Reel's", () => {
    const stray = [...spread("We were talking about more than one thing here today and", 0, 4), ...spread("leads is a solution, not a diagnosis. Two owners can say it and need completely different help.", 31, 37)];
    assert.deepEqual(inMain(spread("More leads is a solution, not a diagnosis. Two owners can say it and need completely different help.", 0, 6.2), stray, 6.2), { start: 31, end: 37 });
  });
  it("takes the earliest place when the main says the Reel's words twice, as an outro repeats them, never the tightest", () => {
    const twice = [...spread(REEL, 2, 9.7), ...spread("and the rest of the episode goes on here for a long time ".repeat(40), 10, 1200), ...spread(REEL, 1200, 1207.4)];
    assert.deepEqual(inMain(spread(REEL, 0, 7.7), twice, 7.7), { start: 2, end: 9.7 });
  });
  it("finds a Reel whose parts lie apart in the main, when the whole stretch is within one and a half times the Reel", () => {
    const partA = "The first thing you need to do is know your costs, and then you can see what each sale is really worth to you and to the business.";
    const partB = "When the price covers the cost and the time, every sale you make moves the business forward instead of keeping it where it is.";
    const reel = [...spread(partA, 0, 20), ...spread(partB, 20, 40)];
    const story = "Let me tell you about a client of mine who sold wedding dresses from a small shop downtown for many years.";
    const main = [...spread("Welcome back everybody to another episode of the show where we talk about growing a business.", 90, 100), ...spread(partA, 100, 120), ...spread(story, 120, 135), ...spread(partB, 135, 155), ...spread("Thanks for watching and see you next week.", 156, 160)];
    assert.deepEqual(inMain(reel, main, 40), { start: 100, end: 155 });
  });
  it("leaves no word out by its spacing when the times on either side are only spread over captions", () => {
    const reel = [...spread("So", 0, 2), ...spread("the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 2, 9.7)];
    const main = spread("So well the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 4.1, 12.5);
    assert.equal(inMain(reel, main, 9.7, Infinity, { spacing: false }).start, 4.1);
    assert.notEqual(inMain(reel, main, 9.7).start, 4.1, "with real times on both sides, the spacing would leave it out");
  });
  it("looks no further than the Reel's own length and a little more, without word times, so an end is never half a Reel late", () => {
    // A Reel of 17 seconds whose last word the main cut, and says again seven seconds after: within one and a half times
    // the Reel, beyond its own length and the slack.
    const said = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const reel = spread(`${said} Sallie`, 0, 17);
    const main = [...spread(said, 100, 116.5), ...spread("Sallie", 123, 123.5)];
    assert.equal(inMain(reel, main, 17, Infinity, { spacing: false }).end, 116.5);
  });
  it("keeps the true opening words of a Reel tightened by hand, whose pauses the main still has", () => {
    const tight = spread("So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 0, 7);
    const slow = [{ w: "So", start: 4.1, end: 4.4 }, { w: "the", start: 5.6, end: 5.9 }, { w: "first", start: 7.1, end: 7.4 }, ...spread("thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.", 7.5, 13.5)];
    assert.equal(inMain(tight, slow, 7).start, 4.1);
  });
  it("leaves out by spacing no more than two seconds of the Reel's own opening or closing words", () => {
    const said = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
    const reel = spread(said, 0, 33);
    const words = said.split(" ");
    const main = [...spread(words.slice(0, 8).join(" "), 50, 52.64), ...spread("and that is the whole point of it", 52.64, 54.64), ...spread(words.slice(8).join(" "), 54.64, 85)];
    assert.equal(inMain(reel, main, 33).start, 50);
  });
  it("keeps the end within the main's length, where the transcriber timed the last words past the end of the file", () => {
    const main = [...MAIN.slice(0, -1), { ...MAIN[MAIN.length - 1], end: 12.2 }];
    assert.deepEqual(inMain(spread(REEL, 0, 7.7), main, 7.7, 11.878), { start: 4.1, end: 11.88 });
    const short = [...MAIN.slice(0, -1), { ...MAIN[MAIN.length - 1], end: 12.2 }].map((w) => ({ ...w, start: w.start - 7.45, end: w.end - 7.45 })).filter((w) => w.start >= 0);
    assert.equal(inMain(spread("very important. Thank you so much, Sallie.", 0, 4.35), short, 4.35, 4.35).end, 4.35);
  });
  it("gives nothing when fewer than 90 in 100 of the Reel's words are found there", () => {
    assert.equal(inMain(spread("Welcome to the show. Today we are... Let me do that again.", 0, 4.78), MAIN, 4.78), null);
  });
  it("gives nothing when the words are found only spread over more than one and a half times the Reel's length", () => {
    const far = [...spread("So the first thing you need to do", 0, 3), ...spread("other words ".repeat(40), 3, 40), ...spread("is know your costs", 40, 42)];
    assert.equal(inMain(spread("So the first thing you need to do is know your costs", 0, 4), far, 4), null);
  });
  it("gives nothing for a Reel or a main with no words", () => {
    assert.equal(inMain([], MAIN, 5), null);
    assert.equal(inMain(spread("Know your costs", 0, 2), [], 2), null);
  });
  it("finds a Reel of 90 seconds in an hour of talk in well under a second", () => {
    const sentence = "So the first thing you need to do is know your costs, and then you can see what each sale is really worth to you. ";
    const said = sentence.repeat(10).trim();
    const talk = "and so we talk about the business and the money and the people who work in it ".repeat(300);
    const main = [...spread(talk, 0, 1800), ...spread(said, 1800, 1890), ...spread(talk, 1890, 3600)];
    const began = Date.now();
    assert.deepEqual(inMain(spread(said, 0, 90), main, 90), { start: 1800, end: 1890 });
    assert.ok(Date.now() - began < 1000, `it took ${Date.now() - began} ms`);
  });
  it("searches an hour of talk in well under a second", () => {
    const talk = "and so we talk about the business and the money and the people who work in it ".repeat(300);
    const said = "So the first thing you need to do is know your costs. It is very, very important.";
    const reel = spread(said, 0, 30);
    const main = [...spread(talk, 0, 1800), ...spread(said, 1800, 1830), ...spread(talk, 1830, 3600)];
    const began = Date.now();
    assert.deepEqual(inMain(reel, main, 30), { start: 1800, end: 1830 });
    assert.ok(Date.now() - began < 1000, `it took ${Date.now() - began} ms`);
  });
});

describe("buildHandoff and handoffFault", () => {
  const RECORD = { version: 1, id: "e-20261014-3fa9c1", rev: 12, kind: "episode", video: { file: "Pricing talk.mp4", bytes: 1823400112, seconds: 23.423, recorded: "2026-10-14", recordedFrom: "video" }, name: { text: "Pricing: what to charge?", placeholder: false }, title: { text: "Price like you mean it", from: "person", approved: true } };
  const GIVEN = { record: RECORD, revision: 1, made: "2026-10-20T15:02:11-05:00", madeOn: "Mac Studio", commit: "c709b57", main: { file: "a main v5 3fa9c1.mp4", seconds: 11.878, srt: "1\n00:00:00,000 --> 00:00:03,250\n Welcome.\n\n" }, reels: [{ n: 3, title: "Hook", file: "a reel 3 v1 3fa9c1.mp4", seconds: 4.78, inMain: null, srt: "1\n00:00:00,000 --> 00:00:04,780\n Hello.\n\n" }] };
  it("writes the spec's fields in the spec's order, and leaves inMain out when it was not found", () => {
    const h = buildHandoff(GIVEN);
    assert.deepEqual(Object.keys(h), ["format", "version", "revision", "made", "madeOn", "madeBy", "episode", "main", "reels"]);
    assert.deepEqual(Object.keys(h.episode), ["id", "kind", "name", "recorded", "recordedFrom", "title"]);
    assert.deepEqual(Object.keys(h.reels[0]), ["n", "title", "file", "seconds", "srt"]);
    assert.equal(h.madeBy, "brimm-video c709b57");
    assert.equal(h.episode.name, "Pricing: what to charge?");
    assert.equal(handoffFault(h), "");
  });
  it("gives a title only when it is approved", () => {
    assert.equal(buildHandoff({ ...GIVEN, record: { ...RECORD, kind: "short video", title: { ...RECORD.title, approved: false } }, reels: [] }).episode.title, null);
  });
  it("finds what is wrong with a hand-off, in plain words", () => {
    const h = buildHandoff(GIVEN);
    assert.match(handoffFault({ ...h, version: 2 }), /version 1/);
    assert.match(handoffFault({ ...h, revision: 0 }), /revision/);
    assert.match(handoffFault({ ...h, made: "2026-10-20 15:02" }), /made/);
    assert.match(handoffFault({ ...h, episode: { ...h.episode, id: "pricing" } }), /id/);
    assert.match(handoffFault({ ...h, episode: { ...h.episode, title: null } }), /title/);
    assert.match(handoffFault({ ...h, main: { ...h.main, srt: "Hello" } }), /main.*captions/);
    assert.match(handoffFault({ ...h, reels: [{ ...h.reels[0], inMain: { start: 5, end: 4 } }] }), /Reel 3/);
    assert.match(handoffFault({ ...h, reels: [h.reels[0], h.reels[0]] }), /Reel 3.*twice/);
    assert.match(handoffFault({ ...h, episode: { ...h.episode, kind: "short video" } }), /short video.*no Reels/);
  });
});

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
/** The words of captions, said evenly over each caption, as the word pass would time them. */
const wordsOfSrt = (srt) => captionsOf(srt).flatMap((c) => spread(c.text, c.start, c.end));

describe("the contract with BRIMM Ops (fixtures/handoff-v1.json, copied to brimm-operations for L7)", () => {
  const sent = JSON.parse(fixture("handoff-v1.json"));
  const RECORD = { version: 1, id: "e-20261014-3fa9c1", rev: 12, kind: "episode", video: { file: "Pricing talk.mp4", bytes: 1823400112, seconds: 23.423, recorded: "2026-10-14", recordedFrom: "video" }, name: { text: "Pricing: what to charge?", placeholder: false }, title: { text: "Price like you mean it", from: "person", approved: true } };
  const [mainSrt, reel1, reel3] = [sent.main.srt, sent.reels[0].srt, sent.reels[1].srt];
  const MAIN_WORDS = wordsOfSrt(mainSrt);

  it("is what brimm-video writes for the made-up episode, byte for byte", () => {
    const made = buildHandoff({
      record: RECORD, revision: 1, made: "2026-10-20T15:02:11-05:00", madeOn: "Mac Studio", commit: "c709b57",
      main: { file: "Pricing- what to charge- main v5 3fa9c1.mp4", seconds: 11.878, srt: mainSrt },
      reels: [
        { n: 1, title: "Know your costs", file: "Pricing- what to charge- reel 1 v1 3fa9c1.mp4", seconds: 7.7, inMain: inMain(wordsOfSrt(reel1), MAIN_WORDS, 7.7, 11.878), srt: reel1 },
        { n: 3, title: "Say it again, better", file: "Pricing- what to charge- reel 3 v2 3fa9c1.mp4", seconds: 4.78, inMain: inMain(wordsOfSrt(reel3), MAIN_WORDS, 4.78, 11.878), srt: reel3 }
      ]
    });
    assert.equal(handoffText(made), fixture("handoff-v1.json"));
  });
  it("writes the short video's hand-off byte for byte: no title, no Reels", () => {
    const short = JSON.parse(fixture("handoff-v1-short-video.json"));
    const record = { ...RECORD, id: "e-20261015-0b7d2e", kind: "short video", video: { ...RECORD.video, recorded: "2026-10-15", recordedFrom: "import" }, name: { text: "Know your costs", placeholder: false }, title: null };
    const made = buildHandoff({ record, revision: 2, made: "2026-10-21T09:30:00-05:00", madeOn: "Sallie's laptop", commit: "c709b57", main: { file: "Know your costs main v2 0b7d2e.mp4", seconds: 7.7, srt: short.main.srt }, reels: [] });
    assert.equal(handoffText(made), fixture("handoff-v1-short-video.json"));
  });
  it("passes its own check, both of them", () => {
    assert.equal(handoffFault(sent), "");
    assert.equal(handoffFault(JSON.parse(fixture("handoff-v1-short-video.json"))), "");
  });
  it("has captions that the BRIMM Ops page's own reader turns into timed lines, every one", () => {
    for (const name of ["handoff-v1.json", "handoff-v1-short-video.json"]) {
      const h = JSON.parse(fixture(name));
      for (const srt of [h.main.srt, ...h.reels.map((r) => r.srt)]) {
        const lines = tidyTranscript(srt).split("\n");
        assert.ok(lines.length >= 1 && lines.every((line) => /^\[\d+:\d{2}\] \S/.test(line)), `${name}: ${lines.join(" / ")}`);
      }
    }
  });
  it("says where Reel 1 falls in the main, and nothing for Reel 3, whose retake the main cut", () => {
    assert.deepEqual(sent.reels[0].inMain, { start: 4.1, end: 11.8 });
    assert.equal("inMain" in sent.reels[1], false);
  });
});
