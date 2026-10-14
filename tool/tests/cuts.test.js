// The rules of the unedited-video workflow: what it asks the programs to do, how it reads what they say, and how it decides what
// to suggest cutting. None of it needs a video, a disk or a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { probeArgs, factsOf, wordArgs, pauseArgs, wordsOf, pausesOf, phrasesOf, cutPlan, cutReason, planText, keptSpans, encodeArgs, joinNotes, roughRate, roughCutArgs, roughCaptions, cutOutputs, clipOutputs, clipFiles, waitingToCut } from "../cuts.js";
import { whisperArgs, stampedText, captionCount } from "../lib.js";
import { probed, told, TOLD, PAUSES } from "./fixtures.js";

describe("what it asks the programs for, before any cutting", () => {
  it("has ffprobe write what it knows about the file as JSON, into a file of its own", () => {
    assert.deepEqual(probeArgs("/in/a b.mp4", "/tmp/facts.json"), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "-o", "/tmp/facts.json", "/in/a b.mp4"]);
  });
  it("has the transcriber write the captions as the transcript tool does and, in the same pass, a time for every word", () => {
    const given = { model: "/m/model.bin", wav: "/tmp/x.wav", outBase: "/tmp/x" };
    const a = wordArgs(given);
    assert.deepEqual(a.slice(0, whisperArgs(given).length), whisperArgs(given));
    assert.deepEqual(a.slice(whisperArgs(given).length), ["-ojf", "-nfa", "-dtw", "large.v3.turbo"]);
  });
  it("has ffmpeg say where the pauses are: quieter than -35 dB for 0.3 seconds or more", () => {
    assert.deepEqual(pauseArgs("/tmp/x.wav"), ["-nostdin", "-hide_banner", "-nostats", "-i", "/tmp/x.wav", "-af", "silencedetect=noise=-35dB:d=0.3", "-f", "null", "-"]);
  });
  it("has ffmpeg count the time after the sound has ended, up to the end of the recording, as silence too", () => {
    // The recording goes on for 23.4234 seconds from the start of its sound. Where the sound is shorter, silence is put after it.
    const a = pauseArgs("/tmp/x.wav", 23.4234);
    assert.equal(a[a.indexOf("-af") + 1], "apad=whole_dur=23.423,silencedetect=noise=-35dB:d=0.3");
    assert.deepEqual([a.slice(0, 5), a.slice(-3)], [pauseArgs("/tmp/x.wav").slice(0, 5), ["-f", "null", "-"]]);
    assert.equal(pauseArgs("/tmp/x.wav", 0)[6], "silencedetect=noise=-35dB:d=0.3");
  });
});

describe("the facts about a file", () => {
  it("are its length, the size and frame rate of its picture, and whether it has sound", () => {
    assert.deepEqual(factsOf(probed()), { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 });
  });
  it("say when the sound starts, counted from the first picture", () => {
    assert.equal(factsOf(probed({ sound: { start_time: "0.021333" } })).soundStart, 0.021);
    assert.equal(factsOf(probed({ picture: { start_time: "0.033367" } })).soundStart, -0.033);
    assert.equal(factsOf(probed({ picture: { start_time: "1.400000" }, sound: { start_time: "1.400000" } })).soundStart, 0);
  });
  it("say so when there is no sound, or no picture", () => {
    assert.deepEqual(factsOf(probed({ sound: null })), { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: false, soundStart: 0 });
    assert.deepEqual(factsOf(probed({ picture: null })), { duration: 23.423, width: 0, height: 0, fps: "", sound: true, soundStart: 0 });
  });
  it("do not take the cover of a sound file for a picture", () => {
    const f = factsOf(probed({ picture: { width: 600, height: 600, disposition: { attached_pic: 1 } } }));
    assert.deepEqual([f.width, f.height, f.fps], [0, 0, ""]);
  });
  it("give the size as the picture is shown, for a phone video that is stored on its side", () => {
    const stored = { width: 1920, height: 1080 };
    assert.deepEqual([factsOf(probed({ picture: { ...stored, side_data_list: [{ rotation: -90 }] } })).width, factsOf(probed({ picture: { ...stored, side_data_list: [{ rotation: -90 }] } })).height], [1080, 1920]);
    assert.equal(factsOf(probed({ picture: { ...stored, tags: { rotate: "90" } } })).height, 1920);
    assert.equal(factsOf(probed({ picture: { ...stored, side_data_list: [{ rotation: 180 }] } })).height, 1080);
  });
  it("take the average frame rate when the file's own is not one a video is shown at", () => {
    assert.equal(factsOf(probed({ picture: { r_frame_rate: "90000/1", avg_frame_rate: "2997/100" } })).fps, "2997/100");
    assert.equal(factsOf(probed({ picture: { r_frame_rate: "0/0", avg_frame_rate: "0/0" } })).fps, "");
  });
  it("take the length from the picture when the file does not give its own", () => {
    assert.equal(factsOf(probed({ duration: null, picture: { duration: "12.500000" } })).duration, 12.5);
  });
  it("are null when ffprobe wrote nothing that can be read, or no length", () => {
    assert.equal(factsOf(""), null);
    assert.equal(factsOf("moov atom not found"), null);
    assert.equal(factsOf("{}"), null);
    assert.equal(factsOf(probed({ duration: "N/A" })), null);
  });
});

describe("the words and their times", () => {
  const words = wordsOf(TOLD);
  it("are rebuilt from the transcriber's tokens: a token that begins with a space starts a new word", () => {
    assert.equal(words.length, 48);
    assert.deepEqual(words.slice(0, 7).map((w) => w.w), ["Welcome", "to", "the", "show.", "Today", "we", "are..."]);
    assert.deepEqual(wordsOf(told([[0, 2000, [[" Found", 40], ["er", 62], [" For", 90], ["um", 120], ["'s", 131]]]])).map((w) => w.w), ["Founder", "Forum's"]);
  });
  it("leave out the tokens in square brackets, which are the transcriber's own marks", () => {
    assert.ok(words.every((w) => !w.w.includes("[")));
    assert.deepEqual(wordsOf(told([[0, 3000, [["[_BEG_]", -1, 0], [" Hello", 80], ["[_TT_150]", -1], [" [", 120], ["BLANK", 150], ["_", 160], ["AUDIO", 200], ["]", 210], [" there", 260], ["[_TT_300]", -1]]]])).map((w) => w.w), ["Hello", "there"]);
  });
  it("end each word where its last token ends, and start it where the word before it ended", () => {
    assert.deepEqual(words.slice(0, 3), [{ w: "Welcome", start: 0, end: 1.4 }, { w: "to", start: 1.4, end: 1.62 }, { w: "the", start: 1.62, end: 1.74 }]);
    assert.deepEqual(wordsOf(told([[0, 2000, [[" Found", 40], ["er", 62], [" For", 90], ["um", 120]]]])), [{ w: "Founder", start: 0, end: 0.62 }, { w: "Forum", start: 0.62, end: 1.2 }]);
  });
  it("do not count a full stop or a comma as part of the sound of a word: the transcriber's time for one drifts into the pause after it", () => {
    // "again." is followed by a pause from 4.843 to 6.070. Its letters end at 4.76 and its full stop at 5.54.
    assert.deepEqual(words[11], { w: "again.", start: 4.4, end: 4.76 });
    assert.deepEqual(words.find((w) => w.w === "important."), { w: "important.", start: 18.32, end: 18.8 });
    assert.deepEqual(words.find((w) => w.w === "very,"), { w: "very,", start: 17.48, end: 17.78 });
  });
  it("start the first word after a pause at the start of its own segment", () => {
    // "pricing." ends at 9.46, and the segment that holds "So" starts at 12.16.
    assert.deepEqual(words[24], { w: "So", start: 12.16, end: 12.66 });
    assert.deepEqual(words[12], { w: "Welcome", start: 4.78, end: 6.36 });
    // A segment that starts before the word before it ended does not pull the word back.
    assert.deepEqual(words[23], { w: "pricing.", start: 9, end: 9.46 });
  });
  it("fall back to the token's own time where the transcriber gave it no finer one", () => {
    assert.deepEqual(wordsOf(told([[1000, 3000, [[" Hello", -1, 1800], [" there", 260]]]])), [{ w: "Hello", start: 1, end: 1.8 }, { w: "there", start: 1.8, end: 2.6 }]);
    const none = told([[1000, 3000, [[" Hello", 0, 1800]]]]);
    delete none.transcription[0].tokens[0].t_dtw;
    assert.deepEqual(wordsOf(none), [{ w: "Hello", start: 1, end: 1.8 }]);
  });
  it("never end a word before it starts, whatever the times say", () => {
    assert.deepEqual(wordsOf(told([[0, 3000, [[" one", 150], [" two", 120], [" three", 200]]]])), [{ w: "one", start: 0, end: 1.5 }, { w: "two", start: 1.5, end: 1.5 }, { w: "three", start: 1.5, end: 2 }]);
  });
  it("carry the same spelling of the host's name as the captions", () => {
    assert.equal(words[47].w, "Sallie.");
  });
  it("leave out the words of a caption that lies in a long silence, as the captions leave the caption out", () => {
    const invented = told([[0, 29980, [[" Thank", 1200], [" you", 1400], [".", 1500]]], [105000, 106740, [[" Hey", 10530], [",", 10540], [" Charlie", 10600]]]]);
    assert.deepEqual(wordsOf(invented, { silent: [[0, 104.286812]] }), [{ w: "Hey,", start: 105, end: 105.3 }, { w: "Charlie", start: 105.3, end: 106 }]);
    assert.equal(wordsOf(invented).length, 4);
  });
  it("are timed on the video's clock when the sound starts later than the picture, to three decimals", () => {
    assert.deepEqual(wordsOf(TOLD, { shift: 0.0213 }).slice(0, 2), [{ w: "Welcome", start: 0.021, end: 1.421 }, { w: "to", start: 1.421, end: 1.641 }]);
  });
  it("are none when the transcriber wrote nothing that can be read", () => {
    assert.deepEqual(wordsOf(null), []);
    assert.deepEqual(wordsOf({}), []);
    assert.deepEqual(wordsOf({ transcription: [{ offsets: { from: 0, to: 1000 } }] }), []);
  });
});

/** Words for a test, from a line such as "So the|1.2 first thing.|3": each word takes 0.2 seconds, and a number after a bar is
    a pause of that many seconds after the word. Returns the words and the pauses. */
function spoken(line, from = 0) {
  const words = [];
  const pauses = [];
  let t = from;
  for (const part of line.split(" ")) {
    const [w, pause] = part.split("|");
    words.push({ w, start: t, end: Math.round((t + 0.2) * 1000) / 1000 });
    t = words[words.length - 1].end;
    if (pause) {
      pauses.push([t, Math.round((t + Number(pause)) * 1000) / 1000]);
      t = pauses[pauses.length - 1][1];
    }
  }
  return { words, pauses, duration: t };
}

describe("the pauses", () => {
  it("are read from what ffmpeg prints, to the millisecond", () => {
    assert.deepEqual(pausesOf(PAUSES), [[0, 1.111], [2.788, 3.695], [4.843, 6.07], [9.638, 12.459], [13.06, 13.583], [16.33, 17.246], [19.022, 19.414], [21.097, 23.423]]);
    assert.deepEqual(pausesOf("size=N/A time=00:00:23.42 bitrate=N/A\n"), []);
  });
  it("are put on the video's clock when the sound starts later than the picture", () => {
    assert.deepEqual(pausesOf(PAUSES, 0.5).slice(1, 3), [[3.288, 4.195], [5.343, 6.57]]);
  });
  it("start with the time before a sound that starts later than the picture: there is nothing to hear in it", () => {
    const heard = "[silencedetect @ 0x1] silence_start: 2\n[silencedetect @ 0x1] silence_end: 3.5 | silence_duration: 1.5\n";
    assert.deepEqual(pausesOf(heard, 0.5), [[0, 0.5], [2.5, 4]]);
    // The sound itself opens with a pause, and the two are one.
    assert.deepEqual(pausesOf(PAUSES, 0.5)[0], [0, 1.611]);
    assert.deepEqual(pausesOf(heard), [[2, 3.5]]);
    assert.deepEqual(pausesOf("", 0.5), [[0, 0.5]]);
  });
  it("include one that never ends, which lasts to the end of the recording", () => {
    const heard = "[silencedetect @ 0x1] silence_start: 2\n[silencedetect @ 0x1] silence_end: 3.5 | silence_duration: 1.5\n[silencedetect @ 0x1] silence_start: 9.25\n";
    assert.deepEqual(pausesOf(heard, 0.5).slice(1), [[2.5, 4], [9.75, Infinity]]);
  });
});

describe("the phrases", () => {
  const phrases = phrasesOf(wordsOf(TOLD), pausesOf(PAUSES));
  it("end at a pause, or at a word that ends a sentence", () => {
    assert.deepEqual(phrases.map((p) => [p.id, p.text]), [
      ["p1", "Welcome to the show."],
      ["p2", "Today we are..."],
      ["p3", "Let me do that again."],
      ["p4", "Welcome to the show."],
      ["p5", "Today we are going to talk about pricing."],
      ["p6", "So the..."],
      ["p7", "So the first thing you need to do is know your costs."],
      ["p8", "It is very, very important."],
      ["p9", "Thank you so much, Sallie."]
    ]);
  });
  it("start and end on the edges of the pauses around them, which are exact, and on the word times only where there is no pause", () => {
    assert.deepEqual(phrases.map((p) => [p.start, p.end]), [[1.111, 1.94], [1.94, 2.788], [3.695, 4.843], [6.07, 7.04], [7.04, 9.638], [12.459, 13.06], [13.583, 16.33], [17.246, 19.022], [19.414, 21.097]]);
  });
  it("hold their own words, with each word's times", () => {
    assert.deepEqual(phrases[1].words, [{ w: "Today", start: 1.94, end: 2.26 }, { w: "we", start: 2.26, end: 2.44 }, { w: "are...", start: 2.44, end: 2.72 }]);
    assert.equal(phrases.reduce((n, p) => n + p.words.length, 0), 48);
  });
  it("end at a question or an exclamation too, with or without a closing quote, and never at a comma or at words trailing off", () => {
    const { words, pauses } = spoken('Really? Yes! She said "no." Well, so... the thing is fine');
    assert.deepEqual(phrasesOf(words, pauses).map((p) => p.text), ["Really?", "Yes!", 'She said "no."', "Well, so... the thing is fine"]);
  });
  it("touch when there is no pause between them: the one starts at the moment the other ends", () => {
    const { words, pauses } = spoken("One two. Three four.|0.5 Five six.");
    assert.deepEqual(phrasesOf(words, pauses).map((p) => [p.text, p.start, p.end]), [["One two.", 0, 0.4], ["Three four.", 0.4, 0.8], ["Five six.", 1.3, 1.7]]);
    // The second sentence is timed as starting half a second after the first ends, and no pause was heard there.
    const apart = [{ w: "One.", start: 0, end: 0.4 }, { w: "Two.", start: 0.9, end: 1.3 }];
    assert.deepEqual(phrasesOf(apart, []).map((p) => [p.start, p.end]), [[0, 0.4], [0.4, 1.3]]);
  });
  it("take a pause for the gap between the two words whose times it falls between, though the times are a little off", () => {
    // The pause is from 1.0 to 1.4. The word before it is timed as ending inside it, and the word after as starting inside it.
    const words = [{ w: "one", start: 0.5, end: 1.15 }, { w: "two", start: 1.15, end: 1.7 }, { w: "three", start: 1.7, end: 2 }];
    assert.deepEqual(phrasesOf(words, [[1, 1.4]]).map((p) => [p.text, p.start, p.end]), [["one", 0.5, 1], ["two three", 1.4, 2]]);
  });
  it("leave a sound that is not a word, between two pauses, out of the phrases on both sides of it", () => {
    const { words } = spoken("One two three four");
    // A cough between 1.0 and 1.3, after "two" and before "three".
    const moved = words.map((w, i) => (i < 2 ? w : { ...w, start: w.start + 1.5, end: w.end + 1.5 }));
    assert.deepEqual(phrasesOf(moved, [[0.4, 1], [1.3, 1.9]]).map((p) => [p.text, p.start, p.end]), [["One two", 0, 0.4], ["three four", 1.9, 2.3]]);
  });
  it("start after the silence the recording opens with, and end before the silence it closes with", () => {
    const { words } = spoken("One two.", 2);
    assert.deepEqual(phrasesOf(words, [[0, 1.95], [2.45, 6]]).map((p) => [p.start, p.end]), [[1.95, 2.45]]);
    assert.deepEqual(phrasesOf(words, []).map((p) => [p.start, p.end]), [[2, 2.4]]);
  });
  it("never go backwards in time, whatever the word times say", () => {
    // The sentence is timed as ending before the pause in front of it does.
    const words = [{ w: "One.", start: 0, end: 0.9 }, { w: "Two.", start: 0.9, end: 2 }];
    assert.deepEqual(phrasesOf(words, [[0, 1.2]]).map((p) => [p.start, p.end]), [[1.2, 1.2], [1.2, 2]]);
  });
  it("are none when there are no words", () => {
    assert.deepEqual(phrasesOf([], [[0, 5]]), []);
  });
});

/** The cut plan for words and the pauses heard among them. */
const planned = (words, pauses, duration) => cutPlan(phrasesOf(words, pauses), { duration, pauses });
/** The cut plan for a line of made-up speech (see `spoken`). */
function planOf(line) {
  const s = spoken(line);
  return planned(s.words, s.pauses, s.duration);
}
/** What the plan says of each phrase: its words, and whether it is kept or which kind of cut it is. */
const verdicts = (line) => planOf(line).phrases.map((p) => [p.text, p.kind]);
const kinds = (line) => planOf(line).phrases.map((p) => p.kind);

describe("the cut plan for the made-up recording", () => {
  const plan = cutPlan(phrasesOf(wordsOf(TOLD), pausesOf(PAUSES)), { duration: 23.423, pauses: pausesOf(PAUSES) });
  it("keeps or cuts each phrase, with a kind and a reason in plain words", () => {
    assert.deepEqual(plan.phrases.map((p) => [p.id, p.keep, p.kind, p.why]), [
      ["p1", false, "retake", "said again at 0:06, the later one is kept"],
      ["p2", false, "retake", "said again at 0:06, the later one is kept"],
      ["p3", false, "cue", "a spoken cue to start over"],
      ["p4", true, "keep", ""],
      ["p5", true, "keep", ""],
      ["p6", false, "false start", "begun again at 0:13"],
      ["p7", true, "keep", ""],
      ["p8", true, "keep", ""],
      ["p9", true, "keep", ""]
    ]);
    assert.deepEqual(plan.phrases[0].words.map((w) => w.w), ["Welcome", "to", "the", "show."]);
    assert.deepEqual([plan.phrases[0].text, plan.phrases[0].start, plan.phrases[0].end], ["Welcome to the show.", 1.111, 1.94]);
  });
  it("is a list of ranges, each kept or cut, with the phrases and the words in it", () => {
    assert.deepEqual(plan.ranges, [
      { start: 0, end: 3.695, keep: false, kind: "retake", why: "said again at 0:06, the later one is kept", phrases: ["p1", "p2"], text: "Welcome to the show. Today we are..." },
      { start: 3.695, end: 5.87, keep: false, kind: "cue", why: "a spoken cue to start over", phrases: ["p3"], text: "Let me do that again." },
      { start: 5.87, end: 9.838, keep: true, kind: "keep", why: "", phrases: ["p4", "p5"], text: "Welcome to the show. Today we are going to talk about pricing." },
      { start: 9.838, end: 13.383, keep: false, kind: "false start", why: "begun again at 0:13", phrases: ["p6"], text: "So the..." },
      { start: 13.383, end: 21.297, keep: true, kind: "keep", why: "", phrases: ["p7", "p8", "p9"], text: "So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie." },
      { start: 21.297, end: 23.423, keep: false, kind: "pause", why: "silence after the last words", phrases: [], text: "" }
    ]);
  });
  it("covers the whole recording in order, and adds up what is kept and what is cut", () => {
    assert.equal(plan.ranges[0].start, 0);
    assert.equal(plan.ranges[plan.ranges.length - 1].end, 23.423);
    for (let i = 1; i < plan.ranges.length; i++) assert.equal(plan.ranges[i].start, plan.ranges[i - 1].end);
    assert.deepEqual([plan.kept, plan.cut], [11.882, 11.541]);
  });
  it("places every cut inside a pause, a fifth of a second from the words that are kept", () => {
    const pauses = pausesOf(PAUSES);
    for (const r of plan.ranges.slice(1)) assert.ok(pauses.some(([a, b]) => r.start >= a && r.start <= b), `${r.start} is not in a pause`);
    // "Welcome to the show", the second time, starts at 6.07, and "pricing." ends at 9.638.
    assert.deepEqual([plan.ranges[2].start, plan.ranges[2].end], [5.87, 9.838]);
  });
});

describe("a retake", () => {
  it("is a phrase whose first four words or more begin a later phrase. The earlier telling is cut and the later one kept", () => {
    const plan = planOf("Welcome to the show today we are|1 Welcome to the show today we talk about pricing.");
    assert.deepEqual(plan.phrases.map((p) => [p.keep, p.kind, p.why]), [[false, "retake", "said again at 0:02, the later one is kept"], [true, "keep", ""]]);
  });
  it("is one for the same first four words even when the rest is said another way", () => {
    assert.deepEqual(kinds("Welcome to the show today we are going to talk about hiring.|1 Welcome to the show and thanks for coming."), ["retake", "keep"]);
  });
  it("is not one for three words the same", () => {
    assert.deepEqual(verdicts("Thanks for coming everyone.|1 Thanks for coming to the show today."), [["Thanks for coming everyone.", "keep"], ["Thanks for coming to the show today.", "keep"]]);
  });
  it("is also a phrase that shares at least 70% of its words, in order, with what is said later, whatever the case and the punctuation", () => {
    assert.deepEqual(kinds("So, the FIRST thing you need to do is price it right.|1 The first thing you need to do is price it correctly."), ["retake", "keep"]);
    // The second telling drops the first word of the first, above, or puts a word in front of it.
    assert.deepEqual(kinds("Welcome to the show today we are|0.5 And welcome to the show today we talk about pricing."), ["retake", "keep"]);
    assert.deepEqual(kinds("I think pricing is the hardest part of running a company.|1 I think hiring is the easiest thing about starting out."), ["keep", "keep"]);
  });
  it("needs four words to be shared, so a word or two that come up again are never one", () => {
    assert.deepEqual(kinds("Okay.|1 Okay so here is the plan for today."), ["keep", "keep"]);
    assert.deepEqual(kinds("Right, so.|1 Right, so the plan for today is short."), ["keep", "keep"]);
  });
  it("does not find its words scattered through a long phrase: they have to come about as close together as they first did", () => {
    assert.deepEqual(kinds("So that is why I|1 So when you look at it that way it is clear to everyone why I said it."), ["keep", "keep"]);
  });
  it("is said again within the next 90 seconds, or it is not one", () => {
    assert.deepEqual(kinds("Welcome to the show today we are|85 Welcome to the show today we talk."), ["retake", "keep"]);
    assert.deepEqual(kinds("Welcome to the show today we are|95 Welcome to the show today we talk."), ["keep", "keep"]);
  });
  it("is said again straight after it, with no more than a few words between: a point made a second time after other things are said is kept", () => {
    assert.deepEqual(kinds("Welcome to the show today we are live.|0.5 Pricing is the first lever a founder can pull.|0.5 Welcome to the show today we talk about hiring."), ["keep", "keep", "keep"]);
    // Six words between the two tellings, and then seven.
    assert.deepEqual(kinds("Welcome to the show today we are live.|0.5 Where was I? Okay, here goes.|0.5 Welcome to the show today we talk about hiring."), ["retake", "keep", "keep", "keep"]);
    assert.deepEqual(kinds("Welcome to the show today we are live.|0.5 Where was I? Okay, here we go.|0.5 Welcome to the show today we talk about hiring."), ["keep", "keep", "keep", "keep"]);
  });
  it("keeps the last telling of three and cuts the two before it, and each reason names the one that is kept", () => {
    const plan = planOf("Welcome to the show today we are now|1 Welcome to the show today we are now going|1 Welcome to the show today we are now going live.");
    assert.deepEqual(plan.phrases.map((p) => [p.kind, p.why]), [["retake", "said again at 0:05, the later one is kept"], ["retake", "said again at 0:05, the later one is kept"], ["keep", ""]]);
  });
  it("can be a run of phrases that is said again, though no one of them has four words", () => {
    const plan = planOf("Hello everyone. Welcome back.|1 Hello everyone. Welcome back to the show.");
    assert.deepEqual(plan.phrases.map((p) => [p.text, p.kind]), [["Hello everyone.", "retake"], ["Welcome back.", "retake"], ["Hello everyone.", "keep"], ["Welcome back to the show.", "keep"]]);
    assert.deepEqual(plan.ranges.map((r) => [r.keep, r.phrases]), [[false, ["p1", "p2"]], [true, ["p3", "p4"]]]);
  });
  it("as a run goes on through a pause, stops where the two tellings part, and names the phrase the later telling starts with", () => {
    const plan = planOf("Welcome to the show.|0.5 Today we, uh|0.5 Where was I?|1 Welcome to the show. Today we are going to talk about pricing.");
    assert.deepEqual(plan.phrases.map((p) => p.kind), ["retake", "retake", "keep", "keep", "keep"]);
    assert.deepEqual(plan.phrases.slice(0, 2).map((p) => p.why), ["said again at 0:04, the later one is kept", "said again at 0:04, the later one is kept"]);
  });
  it("as a run goes on past a cue, which adds no words to it, and a false start in it is still called one", () => {
    assert.deepEqual(kinds("Welcome to the show.|0.5 Take two.|0.5 Hi everyone.|1 Welcome to the show. Hi everyone, today we talk."), ["retake", "cue", "retake", "keep", "keep"]);
    const plan = planOf("Welcome to the show.|0.5 So the|0.5 So the first thing is cost.|1 Welcome to the show. So the first thing is cost.");
    assert.deepEqual(plan.phrases.map((p) => [p.kind, p.why]), [["retake", "said again at 0:04, the later one is kept"], ["false start", "begun again at 0:04"], ["retake", "said again at 0:04, the later one is kept"], ["keep", ""], ["keep", ""]]);
  });
  it("takes with it a sound before it that the transcriber wrote as no word at all", () => {
    assert.deepEqual(kinds("—|0.5 Welcome to the show today we are|0.5 Welcome to the show today we talk."), ["retake", "retake", "keep"]);
    assert.deepEqual(kinds("So the plan is simple.|0.5 —|0.5 We start with price."), ["keep", "keep", "keep"]);
  });
  it("is never said again by a cue, though the cue has its words in it, and a cue between the two tellings is not words between them", () => {
    assert.deepEqual(kinds("Let me do that again with numbers.|0.6 Pricing comes first.|0.6 Let me do that again.|0.6 Pricing comes first, then hiring."), ["keep", "retake", "cue", "keep"]);
    assert.deepEqual(kinds("Let me do that again with numbers.|0.6 Let me do that again.|0.6 Pricing comes first."), ["keep", "cue", "keep"]);
    assert.deepEqual(kinds("Welcome to the show today we are going to talk about hiring.|0.5 Okay, let me do that one more time.|0.5 Welcome to the show and thanks for coming."), ["retake", "cue", "keep"]);
  });
  it("is never words repeated inside one phrase", () => {
    assert.deepEqual(kinds("It is very, very important to be very, very clear about it."), ["keep"]);
    assert.deepEqual(kinds("We went on and on and on and on and on and then we stopped."), ["keep"]);
  });
});

describe("a false start", () => {
  it("is a short phrase that does not end a sentence and whose words begin the phrase after it", () => {
    const plan = planOf("So the|1.5 So the first thing is cost.");
    assert.deepEqual(plan.phrases.map((p) => [p.keep, p.kind, p.why]), [[false, "false start", "begun again at 0:01"], [true, "keep", ""]]);
    assert.deepEqual(kinds("And then|0.5 and then we went home."), ["false start", "keep"]);
  });
  it("is never a single word: a word said twice across a pause may be said twice on purpose", () => {
    assert.deepEqual(verdicts("Never,|0.4 never give up."), [["Never,", "keep"], ["never give up.", "keep"]]);
    assert.deepEqual(kinds("And|0.5 and then we went home."), ["keep", "keep"]);
  });
  it("is not one when the phrase ends a sentence, or the next phrase begins another way", () => {
    // The transcriber writes the same broken-off words now with dots and now with a full stop. With a full stop they are
    // taken for a sentence and kept: a cut that is missed costs less than a sentence cut for being built on.
    assert.deepEqual(kinds("So the.|0.5 So the first thing is cost."), ["keep", "keep"]);
    assert.deepEqual(kinds("We did it.|0.5 We did it together."), ["keep", "keep"]);
    assert.deepEqual(kinds("So the|0.5 The first thing is cost."), ["keep", "keep"]);
  });
  it("is only begun again by the phrase right after it", () => {
    assert.deepEqual(kinds("So the|0.5 Anyway.|0.5 So the first thing is cost."), ["keep", "keep", "keep"]);
  });
  it("is at most six words: a longer one that is begun again is a retake", () => {
    assert.deepEqual(kinds("So the very first thing is|0.5 So the very first thing is cost."), ["false start", "keep"]);
    assert.deepEqual(kinds("So the very first thing is the|0.5 So the very first thing is the cost."), ["retake", "keep"]);
  });
});

describe("a spoken cue to start over", () => {
  it("is cut, whichever of the usual ways it is said", () => {
    for (const cue of ["Let me do that again.", "let me start over", "Take two.", "One more time.", "Sorry, again.", "Okay, let me do that again.", "Sorry, let me try that again.", "Let's do that again, sorry."]) {
      assert.deepEqual(kinds(`Pricing comes first.|0.6 ${cue}|0.6 Then comes hiring.`), ["keep", "cue", "keep"], cue);
    }
    assert.equal(planOf("Pricing comes first.|0.6 Take two.|0.6 Then comes hiring.").phrases[1].why, "a spoken cue to start over");
  });
  it("is not one when the phrase says anything more", () => {
    assert.deepEqual(kinds("Pricing comes first.|0.6 We will go through it one more time.|0.6 Then comes hiring."), ["keep", "keep", "keep"]);
    assert.deepEqual(kinds("Pricing comes first.|0.6 Let me do that again with numbers.|0.6 Then comes hiring."), ["keep", "keep", "keep"]);
  });
  it("takes the phrase before it with it when that phrase is then said again, however short it is", () => {
    const plan = planOf("So pricing.|0.6 Sorry, again.|0.6 So pricing is the first lever.");
    assert.deepEqual(plan.phrases.map((p) => [p.kind, p.why]), [["retake", "said again at 0:02 after a cue to start over, the later one is kept"], ["cue", "a spoken cue to start over"], ["keep", ""]]);
    assert.deepEqual(kinds("Today we are|0.6 let me start over.|0.6 Hi everyone.|0.4 Today we are going to talk."), ["retake", "cue", "keep", "keep"]);
    // Short as it is, and though its words begin what comes after the cue, it is not called a false start: the cue is between.
    assert.equal(planOf("Today we are|0.6 let me start over.|0.6 Today we are going to talk.").phrases[0].why, "said again at 0:02 after a cue to start over, the later one is kept");
  });
  it("leaves the phrase before it alone when that phrase is not said again", () => {
    assert.deepEqual(kinds("That is the whole idea.|0.6 Let me do that again.|0.6 Pricing is the first lever."), ["keep", "cue", "keep"]);
  });
  it("is not what the phrase before a cue is said again by, and that phrase is said again within 90 seconds or not at all", () => {
    assert.deepEqual(kinds("Sorry.|0.6 Take two.|0.6 Sorry, again.|0.6 Pricing comes first."), ["keep", "cue", "cue", "keep"]);
    assert.equal(planOf("So pricing.|0.6 Sorry, again.|0.6 Take two.|0.6 So pricing is the first lever.").phrases[0].why, "said again at 0:03 after a cue to start over, the later one is kept");
    assert.deepEqual(kinds("So pricing.|0.6 Sorry, again.|80 So pricing is the first lever."), ["retake", "cue", "keep"]);
    assert.deepEqual(kinds("So pricing.|0.6 Sorry, again.|95 So pricing is the first lever."), ["keep", "cue", "keep"]);
  });
});

describe("words the transcriber wrote and nobody said", () => {
  // After a pause the transcriber sometimes writes the sentence before it a second time, all of it in a twentieth of a second.
  // It did so twice in five minutes of made-up speech on 2026-10-13. Nothing is ever cut for being said again by such words:
  // the cut would take out the only time the sentence was said.
  const written = (line, at) => line.split(" ").map((w) => ({ w, start: at, end: at + 0.05 }));
  const kindsOf = (words, pauses, duration) => planned(words, pauses, duration).phrases.map((p) => p.kind);
  it("are not a later telling of the sentence they repeat", () => {
    const sentence = "Your calendar shapes who stays for the long run.";
    const words = [...spoken(sentence).words, ...written(sentence, 3.1), ...spoken("A good offer limits how much rest you get.", 3.15).words];
    assert.deepEqual(kindsOf(words, [[1.8, 3.1]], 4.95), ["keep", "keep", "keep"]);
    // The same three phrases, the second one said in the time it takes to say it, are a retake and its later telling.
    const said = [...spoken(sentence).words, ...spoken(sentence, 3.1).words, ...spoken("A good offer limits how much rest you get.", 4.9).words];
    assert.deepEqual(kindsOf(said, [[1.8, 3.1]], 6.7), ["retake", "keep", "keep"]);
  });
  it("are not what a false start is begun again by, or what the phrase before a cue is said again by", () => {
    const start = [...spoken("So the").words, ...written("So the first thing is cost.", 0.9), ...spoken("Then comes hiring.", 0.95).words];
    assert.deepEqual(kindsOf(start, [[0.4, 0.9]], 1.55), ["keep", "keep", "keep"]);
    const cued = [...spoken("So pricing.|0.6 Sorry, again.").words, ...written("So pricing is first.", 2), ...spoken("Then comes hiring.", 2.05).words];
    assert.deepEqual(kindsOf(cued, [[0.4, 1], [1.4, 2]], 2.65), ["keep", "cue", "keep", "keep"]);
  });
});

describe("a pause", () => {
  it("of a second and a half or more between two kept phrases is shortened to 0.4 seconds, with 0.2 kept on each side", () => {
    const plan = planOf("One two three.|2 Four five six.");
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.keep, r.kind, r.why]), [
      [0, 0.8, true, "keep", ""],
      [0.8, 2.4, false, "pause", "2.0 seconds of silence, shortened to 0.4"],
      [2.4, 3.2, true, "keep", ""]
    ]);
    assert.deepEqual([plan.kept, plan.cut], [1.6, 1.6]);
    assert.deepEqual(plan.phrases.map((p) => p.keep), [true, true]);
  });
  it("of exactly a second and a half is shortened too", () => {
    const phrases = [{ id: "p1", start: 0, end: 1, text: "One two three.", words: [] }, { id: "p2", start: 2.5, end: 3.5, text: "Four five six.", words: [] }];
    assert.deepEqual(cutPlan(phrases, { duration: 3.5, pauses: [[1, 2.5]] }).ranges.map((r) => [r.start, r.end, r.keep, r.why]), [[0, 1.2, true, ""], [1.2, 2.3, false, "1.5 seconds of silence, shortened to 0.4"], [2.3, 3.5, true, ""]]);
  });
  it("is only what ffmpeg heard as silent: a sound between two pauses that no word was written for is kept, and each pause is shortened on its own", () => {
    // Something is heard from 2.8 to 3.1, between a pause of 2 seconds and one of 3. The transcriber wrote nothing for it.
    const words = [...spoken("One two three.").words, ...spoken("Four five six.", 6.1).words];
    const plan = planned(words, [[0.6, 2.8], [3.1, 6.1]], 6.7);
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.keep, r.kind, r.why, r.phrases]), [
      [0, 0.8, true, "keep", "", ["p1"]],
      [0.8, 2.6, false, "pause", "2.2 seconds of silence, shortened to 0.4", []],
      [2.6, 3.3, true, "keep", "", []],
      [3.3, 5.9, false, "pause", "3.0 seconds of silence, shortened to 0.4", []],
      [5.9, 6.7, true, "keep", "", ["p2"]]
    ]);
    assert.deepEqual([plan.kept, plan.cut], [2.3, 4.4]);
  });
  it("is not shortened for being long when it is two short pauses with a sound between them", () => {
    const words = [...spoken("One two three.").words, ...spoken("Four five six.", 2.9).words];
    assert.deepEqual(planned(words, [[0.6, 1.6], [1.9, 2.9]], 3.5).ranges.map((r) => [r.start, r.end, r.keep]), [[0, 3.5, true]]);
  });
  it("does not take a word with it that is said between two pauses and timed a fifth of a second late", () => {
    // "Okay." is said from 4.6 to 4.9. The transcriber has it end at 5.1, which is past the middle of the pause after it, so
    // both pauses are taken to come before it.
    const words = [...spoken("One two.", 0.8).words, { w: "Okay.", start: 4.6, end: 5.1 }, ...spoken("Three four.", 5.25).words];
    const plan = planned(words, [[0, 0.8], [1.2, 4.6], [4.9, 5.25]], 5.65);
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.keep, r.why, r.text]), [
      [0, 0.6, false, "silence before the first words", ""],
      [0.6, 1.4, true, "", "One two."],
      [1.4, 4.4, false, "3.4 seconds of silence, shortened to 0.4", ""],
      [4.4, 5.65, true, "", "Okay. Three four."]
    ]);
  });
  it("before the first words is cut only where it was heard: a sound before it is kept, with the silence before that sound cut", () => {
    const { words } = spoken("One two.", 6);
    // A door closes from 2 to 2.5, before anybody speaks.
    const plan = planned(words, [[0, 2], [2.5, 6], [6.4, 9]], 9);
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.keep, r.why]), [
      [0, 1.8, false, "silence before the first words"],
      [1.8, 2.7, true, ""],
      [2.7, 5.8, false, "3.5 seconds of silence, shortened to 0.4"],
      [5.8, 6.6, true, ""],
      [6.6, 9, false, "silence after the last words"]
    ]);
    // The recording opens with the sound: there is no silence before it to cut.
    assert.deepEqual(planned(words, [[1, 6]], 6.4).ranges.map((r) => [r.start, r.end, r.keep]), [[0, 1.2, true], [1.2, 5.8, false], [5.8, 6.4, true]]);
  });
  it("is not cut at the start or the end of the recording where none was heard there: the time of a word is no place to cut", () => {
    // Music plays from the start to the end, and the words are timed from 3.2 to 6.2.
    const words = [{ w: "One", start: 3.2, end: 4 }, { w: "two.", start: 4, end: 6.2 }];
    assert.deepEqual(planned(words, [], 12).ranges, [{ start: 0, end: 12, keep: true, kind: "keep", why: "", phrases: ["p1"], text: "One two." }]);
    // A pause before the words and none after them, and the other way round.
    assert.deepEqual(planned(words, [[0, 3]], 12).ranges.map((r) => [r.start, r.end, r.keep]), [[0, 2.8, false], [2.8, 12, true]]);
    assert.deepEqual(planned(words, [[6.3, 12]], 12).ranges.map((r) => [r.start, r.end, r.keep]), [[0, 6.5, true], [6.5, 12, false]]);
  });
  it("runs to the end of the recording when it never ends", () => {
    const { words } = spoken("One two.");
    assert.deepEqual(planned(words, [[0.4, Infinity]], 5).ranges.map((r) => [r.start, r.end, r.keep]), [[0, 0.6, true], [0.6, 5, false]]);
  });
  it("beside a phrase that is cut is cut with it, and so is a sound there that no word was written for", () => {
    // Something is heard from 1.4 to 1.7, between the false start and the words that begin again.
    const words = [...spoken("So the").words, ...spoken("So the first thing is cost.", 2.4).words];
    assert.deepEqual(planned(words, [[0.4, 1.4], [1.7, 2.4]], 3.6).ranges.map((r) => [r.start, r.end, r.keep, r.kind]), [[0, 2.2, false, "false start"], [2.2, 3.6, true, "keep"]]);
  });
  it("shorter than that is kept whole, and the phrases on both sides of it are one range", () => {
    const plan = planOf("One two three.|1.4 Four five six.");
    assert.deepEqual(plan.ranges, [{ start: 0, end: 2.6, keep: true, kind: "keep", why: "", phrases: ["p1", "p2"], text: "One two three. Four five six." }]);
    assert.deepEqual([plan.kept, plan.cut], [2.6, 0]);
  });
  it("before the first kept words and after the last is cut, but for 0.2 seconds", () => {
    const { words } = spoken("One two.", 2);
    const plan = planned(words, [[0, 2], [2.4, 6]], 6);
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.keep, r.kind, r.why]), [
      [0, 1.8, false, "pause", "silence before the first words"],
      [1.8, 2.6, true, "keep", ""],
      [2.6, 6, false, "pause", "silence after the last words"]
    ]);
  });
  it("is cut whole when what is cut lies on both sides of it, and belongs to the range before it", () => {
    const plan = planOf("So pricing.|3 Sorry, again.|0.6 So pricing is the first lever.");
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.kind, r.phrases]), [[0, 3.4, "retake", ["p1"]], [3.4, 4.2, "cue", ["p2"]], [4.2, 5.6, "keep", ["p3"]]]);
  });
  it("too short to keep 0.2 seconds of is kept as far as it goes", () => {
    const words = [...spoken("So the").words, ...spoken("So the first thing is cost.", 0.55).words];
    const plan = planned(words, [[0.4, 0.55]], 1.75);
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.keep]), [[0, 0.4, false], [0.4, 1.75, true]]);
    // The same on the other side: what is kept comes first, then the short pause, then a cue.
    const cued = [...spoken("Pricing comes first.").words, ...spoken("Take two.", 0.75).words];
    assert.deepEqual(planned(cued, [[0.6, 0.75]], 1.15).ranges.map((r) => [r.start, r.end, r.keep]), [[0, 0.75, true], [0.75, 1.15, false]]);
  });
});

describe("a cut", () => {
  it("is only ever made at a pause: a phrase that runs straight on into kept words is kept with them", () => {
    // The same words, with and without a pause between the two tellings.
    assert.deepEqual(kinds("Thank you so much.|0.5 Thank you so much for coming."), ["retake", "keep"]);
    assert.deepEqual(kinds("Thank you so much. Thank you so much for coming."), ["keep", "keep"]);
    assert.deepEqual(kinds("That is the whole idea. Let me do that again.|0.6 Pricing is the first lever."), ["keep", "keep", "keep"]);
  });
  it("never takes part of what runs on without a pause: all of it is said again, or all of it is kept", () => {
    assert.deepEqual(kinds("Welcome to the show. Today we are, um, where was I?|1 Welcome to the show. Today we are going to talk about pricing."), ["keep", "keep", "keep", "keep"]);
  });
  it("can be made at the very start and the very end of the recording, where there is no pause", () => {
    assert.deepEqual(planOf("So the|0.5 So the first thing is cost.").ranges.map((r) => [r.start, r.end, r.keep]), [[0, 0.7, false], [0.7, 2.1, true]]);
    assert.deepEqual(planOf("Pricing comes first.|0.6 Take two.").ranges.map((r) => [r.start, r.end, r.keep, r.kind]), [[0, 0.8, true, "keep"], [0.8, 1.6, false, "cue"]]);
  });
  it("has a range of its own when its reason is its own, though the cut before it is of the same kind", () => {
    const plan = planOf("Welcome to the show today we are|0.5 So pricing|0.5 take two|0.5 Welcome to the show today we talk about hiring and culture and money too.|0.5 So pricing is first.");
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.kind, r.why, r.phrases]), [
      [0, 1.9, "retake", "said again at 0:03, the later one is kept", ["p1"]],
      [1.9, 2.8, "retake", "said again at 0:07 after a cue to start over, the later one is kept", ["p2"]],
      [2.8, 3.5, "cue", "a spoken cue to start over", ["p3"]],
      [3.5, 7.8, "keep", "", ["p4", "p5"]]
    ]);
  });
  it("never reaches past the end of the recording, though the last word is timed as ending after it", () => {
    const plan = planned(spoken("One two three.").words, [], 0.5);
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.keep]), [[0, 0.5, true]]);
    assert.deepEqual([plan.kept, plan.cut], [0.5, 0]);
  });
  it("leaves every phrase in a range, even one the times leave no length", () => {
    const words = [{ w: "One.", start: 0, end: 0.9 }, { w: "Two.", start: 0.9, end: 2 }];
    const plan = planned(words, [[0, 1.2]], 2);
    assert.deepEqual(plan.ranges.map((r) => [r.start, r.end, r.keep, r.phrases, r.text]), [[0, 1, false, [], ""], [1, 2, true, ["p1", "p2"], "One. Two."]]);
  });
  it("of everything leaves a plan that keeps nothing", () => {
    const plan = planOf("Take two.");
    assert.deepEqual(plan.ranges, [{ start: 0, end: 0.4, keep: false, kind: "cue", why: "a spoken cue to start over", phrases: ["p1"], text: "Take two." }]);
    assert.deepEqual([plan.kept, plan.cut], [0, 0.4]);
  });
  it("is the whole recording when nobody speaks in it", () => {
    assert.deepEqual(cutPlan([], { duration: 12.5 }), { phrases: [], ranges: [{ start: 0, end: 12.5, keep: false, kind: "pause", why: "silence, with no words in it", phrases: [], text: "" }], kept: 0, cut: 12.5 });
  });
});

describe("the plan for a person to read", () => {
  const plan = cutPlan(phrasesOf(wordsOf(TOLD), pausesOf(PAUSES)), { duration: 23.423, pauses: pausesOf(PAUSES) });
  it("is a first line with the totals, then one line for each range", () => {
    assert.equal(planText(plan), [
      "Kept 0:12 of 0:23. Cut 0:11.",
      "0:00 to 0:03  CUT  retake: said again at 0:06, the later one is kept  |  Welcome to the show. Today we are...",
      "0:03 to 0:05  CUT  cue: a spoken cue to start over  |  Let me do that again.",
      "0:05 to 0:09  KEEP  |  Welcome to the show. Today we are going to talk about pricing.",
      "0:09 to 0:13  CUT  false start: begun again at 0:13  |  So the...",
      "0:13 to 0:21  KEEP  |  So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie.",
      "0:21 to 0:23  CUT  pause: silence after the last words",
      ""
    ].join("\n"));
  });
  it("has totals that add up as they are shown", () => {
    assert.match(planText({ ranges: [], kept: 59.6, cut: 30.6 }), /^Kept 1:00 of 1:30\. Cut 0:30\.\n$/);
  });
  it("starts with a note when something is missing, before the totals", () => {
    assert.deepEqual(planText(plan, "The rough cut could not be made: ffmpeg stopped (no such encoder).").split("\n").slice(0, 2), ["The rough cut could not be made: ffmpeg stopped (no such encoder).", "Kept 0:12 of 0:23. Cut 0:11."]);
  });
  it("names a cut by its kind and then says why, and names a cut of Claude's once: its reason says already whose it is", () => {
    assert.equal(cutReason({ kind: "retake", why: "said again at 0:06, the later one is kept" }), "retake: said again at 0:06, the later one is kept");
    assert.equal(cutReason({ kind: "claude", why: "Claude: It adds nothing to the line before it." }), "Claude: It adds nothing to the line before it.");
    // Only a reason that opens with the kind itself stands alone. One that only has the word in it does not.
    assert.equal(cutReason({ kind: "pause", why: "pause of 2.0 seconds: shortened" }), "pause: pause of 2.0 seconds: shortened");
    assert.equal(cutReason({ kind: "claude", why: "" }), "claude: ");
    // Claude cut "It is very, very important.", which the rules kept.
    const ranges = plan.ranges.flatMap((r) => (r.start === 13.383 ? [
      { ...r, end: 16.53, phrases: ["p7"], text: "So the first thing you need to do is know your costs." },
      { start: 16.53, end: 19.214, keep: false, kind: "claude", why: "Claude: It adds nothing to the line before it.", phrases: ["p8"], text: "It is very, very important." },
      { ...r, start: 19.214, phrases: ["p9"], text: "Thank you so much, Sallie." }
    ] : [r]));
    assert.deepEqual(planText({ ranges, kept: 9.198, cut: 14.225 }).split("\n").slice(5, 8), [
      "0:13 to 0:16  KEEP  |  So the first thing you need to do is know your costs.",
      "0:16 to 0:19  CUT  Claude: It adds nothing to the line before it.  |  It is very, very important.",
      "0:19 to 0:21  KEEP  |  Thank you so much, Sallie."
    ]);
  });
  it("shows what is cut in full, and of a long kept stretch only how it begins and ends", () => {
    const telling = "Welcome to the show today we are now going live|1 ";
    const long = planOf(telling + telling + Array.from({ length: 40 }, (_, i) => "word" + (i + 1)).join(" "));
    assert.deepEqual(planText(long).split("\n"), [
      "Kept 0:11 of 0:14. Cut 0:03.",
      "0:00 to 0:02  CUT  retake: said again at 0:03, the later one is kept  |  Welcome to the show today we are now going live",
      "0:02 to 0:14  KEEP  |  Welcome to the show today we are now going live word1 word2 ... word33 word34 word35 word36 word37 word38 word39 word40",
      ""
    ]);
  });
});

describe("the rough cut", () => {
  const plan = cutPlan(phrasesOf(wordsOf(TOLD), pausesOf(PAUSES)), { duration: 23.423, pauses: pausesOf(PAUSES) });
  const micro = (spans) => spans.map((s) => [s.start, s.end, s.at].map((t) => Math.round(t * 1e6) / 1e6));
  it("is the kept ranges, each moved to the nearest whole picture so that sound and picture stay together over many cuts", () => {
    // At 30000/1001 pictures a second, 5.87 seconds is picture 176 and 9.838 is picture 295.
    assert.deepEqual(micro(keptSpans(plan.ranges, "30000/1001")), [[5.872533, 9.843167, 0], [13.380033, 21.287933, 3.970633]]);
    assert.deepEqual(micro(keptSpans(plan.ranges, "25")), [[5.88, 9.84, 0], [13.4, 21.28, 3.96]]);
  });
  it("is the kept ranges as they are for a file with no picture", () => {
    assert.deepEqual(micro(keptSpans(plan.ranges, "")), [[5.87, 9.838, 0], [13.383, 21.297, 3.968]]);
  });
  it("has no range that rounds away to nothing", () => {
    assert.deepEqual(keptSpans([{ start: 1.001, end: 1.01, keep: true }, { start: 2, end: 3, keep: false }], "25"), []);
  });
  it("is made by ffmpeg in one pass: the kept pictures and the kept sound are picked out and their times made to run on", () => {
    assert.deepEqual(roughCutArgs("/in/a b.mov", "/in/a b.rough-cut.mp4.writing", { ranges: plan.ranges, fps: "30000/1001" }), [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", "/in/a b.mov",
      "-vf", "fps=30000/1001:start_time=0,select='gte(t,5.855850)*lt(t,9.826483)+gte(t,13.363350)*lt(t,21.271250)',setpts=N/FRAME_RATE/TB,scale=-2:'2*trunc(min(1080,ih)/2)',format=yuv420p",
      "-af", "aresample=async=1:first_pts=0,asetnsamples=n=128:p=0,aselect='gte(t,5.872533)*lt(t,9.843167)+gte(t,13.380033)*lt(t,21.287933)',asetpts=N/SR/TB",
      "-sn", "-dn", "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000",
      "-movflags", "+faststart", "-f", "mp4", "/in/a b.rough-cut.mp4.writing"
    ]);
  });
  it("is asked for as a tree of brackets when many ranges are kept: ffmpeg cannot read a row of a hundred added together", () => {
    // How deep a sum goes as ffmpeg reads it. A row is read from the left, and each thing added puts all before it one deeper.
    const deep = (sum) => {
      const terms = [];
      let level = 0;
      let from = 0;
      for (let i = 0; i <= sum.length; i++) {
        if (sum[i] === "(") level += 1;
        else if (sum[i] === ")") level -= 1;
        else if (level === 0 && (sum[i] === "+" || i === sum.length)) {
          terms.push(sum.slice(from, i));
          from = i + 1;
        }
      }
      return terms.map((t) => (t.startsWith("(") ? deep(t.slice(1, -1)) : 0)).reduce((d, t) => Math.max(d, t) + 1);
    };
    // Five hours of talk with a long pause every minute.
    const many = Array.from({ length: 300 }, (_, i) => ({ start: i * 60 + 5, end: i * 60 + 55, keep: true }));
    const a = roughCutArgs("/in/a.mov", "/out/a.mp4", { ranges: many, fps: "25" });
    const RANGE = /gte\(t,[\d.]+\)\*lt\(t,[\d.]+\)/g;
    for (const [flag, name, early] of [["-vf", "select", 0.02], ["-af", "aselect", 0]]) {
      const picked = new RegExp(`,${name}='([^']*)',`).exec(a[a.indexOf(flag) + 1])[1];
      // Every range is in it once, in order, with nothing but brackets and plus signs between them.
      assert.deepEqual(picked.match(RANGE), many.map((r) => `gte(t,${(r.start - early).toFixed(6)})*lt(t,${(r.end - early).toFixed(6)})`), name);
      assert.match(picked.replace(RANGE, "r"), /^[r+()]+$/, name);
      assert.equal(picked.split("(").length, picked.split(")").length, name);
      // ffmpeg 9 reads 99 ranges in a row and refuses 100. A tree of 300 is 9 deep.
      assert.ok(deep(picked) < 20, `${name} is ${deep(picked)} deep`);
    }
    assert.equal(deep("r+r+r+r"), 3);
    assert.equal(deep("(r+r)+(r+r)"), 2);
  });
  it("has the sound put on the file's clock before any of it is picked, so a sound that starts late does not run ahead of its picture", () => {
    // A kept range can start before the sound does. Silence is put there first: otherwise the sound of that range comes out
    // shorter than its picture, and every sound after it comes early by as much.
    const a = roughCutArgs("/in/a.mov", "/out/a.mp4", { ranges: plan.ranges, fps: "30000/1001" });
    assert.match(a[a.indexOf("-af") + 1], /^aresample=async=1:first_pts=0,asetnsamples=n=128:p=0,aselect='/);
  });
  it("scales the picture down to 1080 lines at most and never up, and is encoded as H.264 by quality, not at a fixed bitrate", () => {
    // At a fixed 8 megabits, the rough cut of a 32-minute Zoom recording of 182 MB came out at 1.32 GB.
    const a = roughCutArgs("/in/a.mov", "/out/a.mp4", { ranges: plan.ranges, fps: "30000/1001" });
    const after = (flag) => a[a.indexOf(flag) + 1];
    assert.match(after("-vf"), /,scale=-2:'2\*trunc\(min\(1080,ih\)\/2\)',/);
    assert.deepEqual([after("-c:v"), after("-preset"), after("-crf"), after("-pix_fmt"), after("-f")], ["libx264", "medium", "23", "yuv420p", "mp4"]);
    assert.ok(!a.includes("-b:v") && !a.includes("-maxrate"));
  });
  it("has AAC sound at 48 kHz, whatever the recording's own rate, and its index at the front, so it plays before it is all read", () => {
    const a = roughCutArgs("/in/a.mov", "/out/a.mp4", { ranges: plan.ranges, fps: "30000/1001" });
    const after = (flag) => a[a.indexOf(flag) + 1];
    assert.deepEqual([after("-c:a"), after("-ar"), after("-movflags")], ["aac", "48000", "+faststart"]);
  });
  it("is made at the file's own rate, or at 30 pictures a second for a picture that gives none, and a file with no picture has no rate", () => {
    assert.equal(roughRate({ fps: "30000/1001", height: 720 }), "30000/1001");
    assert.equal(roughRate({ fps: "", height: 720 }), "30");
    assert.equal(roughRate({ fps: "", height: 0 }), "");
  });
  it("is made at 30 pictures a second when the file does not say how many it has", () => {
    const a = roughCutArgs("/in/a.mov", "/out/a.mp4", { ranges: [{ start: 1, end: 2.02, keep: true }], fps: "" });
    assert.match(a[a.indexOf("-vf") + 1], /^fps=30:start_time=0,select='gte\(t,0\.983333\)\*lt\(t,2\.016667\)',/);
    assert.match(a[a.indexOf("-af") + 1], /aselect='gte\(t,1\.000000\)\*lt\(t,2\.033333\)'/);
  });
});

describe("the captions of the rough cut", () => {
  const plan = cutPlan(phrasesOf(wordsOf(TOLD), pausesOf(PAUSES)), { duration: 23.423, pauses: pausesOf(PAUSES) });
  const srt = roughCaptions(plan.phrases, keptSpans(plan.ranges, "30000/1001"));
  it("are the kept phrases, each at the time it has in the rough cut", () => {
    assert.equal(srt, `1
00:00:00,197 --> 00:00:01,167
Welcome to the show.

2
00:00:01,167 --> 00:00:03,765
Today we are going to talk about pricing.

3
00:00:04,174 --> 00:00:06,921
So the first thing you need to do is know your costs.

4
00:00:07,837 --> 00:00:09,613
It is very, very important.

5
00:00:10,005 --> 00:00:11,688
Thank you so much, Sallie.
`);
  });
  it("read as a transcript of the video as it will be seen, without the retakes", () => {
    assert.equal(stampedText(srt), "[0:00] Welcome to the show.\n[0:01] Today we are going to talk about pricing.\n[0:04] So the first thing you need to do is know your costs.\n[0:07] It is very, very important.\n[0:10] Thank you so much, Sallie.\n");
    assert.equal(captionCount(srt), 5);
  });
  it("are lines of 60 characters at most: a longer phrase is more than one caption, each timed by its own words", () => {
    // The pause before it ends at 0.92, which is when the phrase starts, though its first word is timed as starting at 1.
    const s = spoken(Array.from({ length: 21 }, () => "alpha").join(" "), 1);
    const long = planned(s.words, [[0, 0.92]], s.duration);
    assert.equal(roughCaptions(long.phrases, keptSpans(long.ranges, "25")), `1
00:00:00,200 --> 00:00:02,280
alpha alpha alpha alpha alpha alpha alpha alpha alpha alpha

2
00:00:02,280 --> 00:00:04,280
alpha alpha alpha alpha alpha alpha alpha alpha alpha alpha

3
00:00:04,280 --> 00:00:04,480
alpha
`);
  });
  it("are none when the plan keeps nothing", () => {
    const none = planOf("Take two.");
    assert.equal(roughCaptions(none.phrases, keptSpans(none.ranges, "25")), "");
  });
});

describe("the files of a video", () => {
  it("are all named after it, beside it or in the folder asked for", () => {
    assert.deepEqual(cutOutputs("/in/My Talk.raw.mov"), {
      base: "My Talk.raw", srt: "/in/My Talk.raw.srt", txt: "/in/My Talk.raw.transcript.txt", failed: "/in/My Talk.raw.failed.txt",
      words: "/in/My Talk.raw.words.json", plan: "/in/My Talk.raw.cut-plan.json", planTxt: "/in/My Talk.raw.cut-plan.txt",
      rough: "/in/My Talk.raw.rough-cut.mp4", roughSrt: "/in/My Talk.raw.rough-cut.srt", roughTxt: "/in/My Talk.raw.rough-cut.transcript.txt",
      vertical: "/in/My Talk.raw.rough-cut.vertical.mp4", fcpxml: "/in/My Talk.raw.fcpxml", notes: "/in/My Talk.raw.edit-notes.txt"
    });
    assert.equal(cutOutputs("/in/a.mov", "/out").plan, "/out/a.cut-plan.json");
    assert.deepEqual([cutOutputs("/in/a.mov", "/out").vertical, cutOutputs("/in/a.mov", "/out").fcpxml, cutOutputs("/in/a.mov", "/out").notes], ["/out/a.rough-cut.vertical.mp4", "/out/a.fcpxml", "/out/a.edit-notes.txt"]);
  });
});

describe("the files of a short clip", () => {
  it("are named after the video and the clip's number: the clip, and its captions", () => {
    assert.deepEqual(clipOutputs("/in/My Talk.raw.mov", 2), { video: "/in/My Talk.raw.reel-2.mp4", srt: "/in/My Talk.raw.reel-2.srt", story: [] });
    assert.deepEqual(clipOutputs("/in/a.mov", 1, 1, "/out"), { video: "/out/a.reel-1.mp4", srt: "/out/a.reel-1.srt", story: [] });
  });
  it("have a file for each part of its Story as well, when the Story has more than one part", () => {
    assert.deepEqual(clipOutputs("/in/a.mov", 4, 3).story, ["/in/a.reel-4.story-1.mp4", "/in/a.reel-4.story-2.mp4", "/in/a.reel-4.story-3.mp4"]);
    assert.deepEqual(clipOutputs("/in/a.mov", 4, 2, "/out").story, ["/out/a.reel-4.story-1.mp4", "/out/a.reel-4.story-2.mp4"]);
  });
  it("are known again among the names in a folder, for one video and no other", () => {
    const names = ["a.mov", "a.reel-1.mp4", "a.reel-1.srt", "a.reel-12.story-2.mp4", "a.rough-cut.mp4", "a.srt", "a.edit-notes.txt", "ab.reel-1.mp4", "a.b.reel-1.mp4", "a.reel-x.mp4", "a.reel-1.txt", "reel-1.mp4"];
    assert.deepEqual(clipFiles(names, "a"), ["a.reel-1.mp4", "a.reel-1.srt", "a.reel-12.story-2.mp4"]);
    assert.deepEqual(clipFiles(names, "a.b"), ["a.b.reel-1.mp4"]);
    assert.deepEqual(clipFiles(names, "c"), []);
    // Every name clipOutputs gives is one of them.
    const made = clipOutputs("/in/My Talk.raw.mov", 3, 2);
    const all = [made.video, made.srt, ...made.story].map((path) => path.slice("/in/".length));
    assert.deepEqual(clipFiles([...all, "My Talk.raw.mov"], "My Talk.raw"), all);
  });
  it("are known again half written too, under the name a run that was stopped left them under", () => {
    // Each file is written under its own name with .writing after it. A run that is killed part-way leaves that name behind.
    const names = ["a.mov", "a.reel-3.mp4.writing", "a.reel-3.srt.writing", "a.reel-3.story-2.mp4.writing", "a.reel-1.mp4", "a.rough-cut.mp4.writing", "a.reel-3.mp4.part", "a.reel-3.writing", "a.reel-3.txt.writing", "b.reel-1.mp4.writing"];
    assert.deepEqual(clipFiles(names, "a"), ["a.reel-3.mp4.writing", "a.reel-3.srt.writing", "a.reel-3.story-2.mp4.writing", "a.reel-1.mp4"]);
    assert.deepEqual(clipFiles(names, "b"), ["b.reel-1.mp4.writing"]);
    // Every name clipOutputs gives, with .writing after it, is one of them.
    const made = clipOutputs("/in/My Talk.raw.mov", 3, 2);
    const all = [made.video, made.srt, ...made.story].map((path) => path.slice("/in/".length) + ".writing");
    assert.deepEqual(clipFiles([...all, "My Talk.raw.mov"], "My Talk.raw"), all);
    // And a half-written clip is never a video that waits.
    assert.deepEqual(waitingToCut(names), ["a.mov"]);
  });
});

describe("the videos in a folder that still wait for a cut plan", () => {
  it("are the ones with no cut plan beside them and no note saying it failed, in order", () => {
    assert.deepEqual(waitingToCut(["b.mp4", "a.mov", "a.cut-plan.json", "c.mp4", "c.failed.txt", "d.MP4", "notes.txt", ".hidden.mp4", "e.mp4.part"]), ["b.mp4", "d.MP4"]);
    assert.deepEqual(waitingToCut([]), []);
  });
  it("include one that only has a transcript, which is not a cut plan", () => {
    assert.deepEqual(waitingToCut(["a.mp4", "a.srt", "a.transcript.txt"]), ["a.mp4"]);
  });
  it("do not include one whose plan could not be made: the note that says so is in the plan's place", () => {
    assert.deepEqual(waitingToCut(["a.mp4", "a.srt", "a.cut-plan.txt"]), []);
  });
  it("never include a rough cut, which is a video the tool made itself", () => {
    assert.deepEqual(waitingToCut(["a.rough-cut.mp4", "a.rough-cut.srt", "talk.Rough-Cut.MP4"]), []);
  });
  it("never include the upright version of a rough cut, which the tool made too", () => {
    assert.deepEqual(waitingToCut(["a.rough-cut.vertical.mp4", "talk.Rough-Cut.Vertical.MP4"]), []);
    // A video somebody named vertical is a video like any other.
    assert.deepEqual(waitingToCut(["a.vertical.mp4", "vertical.mp4"]), ["a.vertical.mp4", "vertical.mp4"]);
  });
  it("never include a short clip, or a part of its Story: the tool cut those too", () => {
    assert.deepEqual(waitingToCut(["a.reel-1.mp4", "a.reel-1.srt", "a.reel-12.mp4", "a.reel-2.story-1.mp4", "a.reel-2.story-2.mp4", "talk.Reel-3.MP4", "talk.REEL-3.Story-2.MP4"]), []);
    // Every video clipOutputs names is one of them.
    const made = clipOutputs("/in/a.mov", 3, 2);
    assert.deepEqual(waitingToCut([made.video, ...made.story].map((path) => path.slice("/in/".length))), []);
    // A video somebody named reel, or a clip of a kind the tool does not make, is a video like any other.
    assert.deepEqual(waitingToCut(["a.reel.mp4", "reel-1.mp4", "a.reel-one.mp4", "a.story-1.mp4"]), ["a.reel-one.mp4", "a.reel.mp4", "a.story-1.mp4", "reel-1.mp4"]);
  });
});

describe("how a video is written", () => {
  it("writes at the speed it is asked for, and at x264's medium when it is not asked", () => {
    assert.deepEqual(encodeArgs(30, "veryfast"), ["-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart"]);
    assert.equal(encodeArgs(23)[encodeArgs(23).indexOf("-preset") + 1], "medium");
  });
});

describe("the notes at each join", () => {
  it("say how much was taken out at each join and why, one note for what is cut with nothing kept between", () => {
    const ranges = [{ start: 0, end: 2, keep: false, kind: "pause", why: "a long pause" }, { start: 2, end: 5, keep: true }, { start: 5, end: 6.5, keep: false, kind: "retake", why: "said again at 0:07" }, { start: 6.5, end: 7, keep: false, kind: "claude", why: "Claude: it trails off" }, { start: 7, end: 9, keep: true }];
    assert.deepEqual(joinNotes(ranges), [{ at: 0, text: "Taken out, 2.0 seconds. Pause: a long pause" }, { at: 5, text: "Taken out, 2.0 seconds. Retake: said again at 0:07. Claude: it trails off" }]);
  });
});
