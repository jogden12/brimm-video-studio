// Makes hand-off version 2's five contract fixtures again, from the builder (tool/handoff-v2.js) and made-up records, and writes
// them beside this file:
//   handoff-v2-finished.json, handoff-v2-raw.json, handoff-v2-session.json, handoff-v2-short-video.json,
//   handoff-v2-session-replacing.json (the session that corrects the finished video's id, one revision on)
// Run it from tool/:  node tests/fixtures/make-handoff-v2.mjs
// The fixtures are its output, committed. tests/contract.test.js pins their sha256 and checks that they are what this makes.
// Changing a word here changes the contract with BRIMM Ops: brimm-operations keeps a copy of each file, so a session there
// copies them again before the hashes in the test are set.
// Everything in them is made up: the episode is "Pricing: what to charge?", the one hand-off version 1's fixtures use, and
// nothing is any real person's or client's words. A session's principles hold no names.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildHandoffV2, handoffFaultV2 } from "../../handoff-v2.js";
import { handoffText } from "../../handoff.js";

const ms = (seconds) => Math.round(seconds * 1000);

/** Captions as the transcript tool times them. Each is [how long it runs in seconds, its words, the pause before it in
    seconds], and becomes { words, start, end } in milliseconds, so that nothing drifts. */
function timed(captions) {
  let at = 0;
  return captions.map(([length, words, pause = 0]) => {
    const start = at + ms(pause);
    at = start + ms(length);
    return { words, start, end: at };
  });
}

/** A time in milliseconds as a caption file writes it: 00:01:07,250. */
function clock(t) {
  const part = (n, width) => String(n).padStart(width, "0");
  return `${part(Math.floor(t / 3600000), 2)}:${part(Math.floor(t / 60000) % 60, 2)}:${part(Math.floor(t / 1000) % 60, 2)},${part(t % 1000, 3)}`;
}

/** Captions `from` to `to` as the transcript tool writes an .srt: each numbered, its words after a space, a blank line after it,
    and the first at 0. A whole video's, or a Reel's, which has its own clock. */
function srtOf(cues, from = 0, to = cues.length - 1) {
  const zero = cues[from].start;
  return cues.slice(from, to + 1).map((c, i) => `${i + 1}\n${clock(c.start - zero)} --> ${clock(c.end - zero)}\n ${c.words}\n\n`).join("");
}

/** Where captions `from` to `to` fall in the video they are cues of, in seconds. */
const stretchOf = (cues, from, to) => ({ start: cues[from].start / 1000, end: cues[to].end / 1000 });
/** How long captions `from` to `to` run, in seconds. */
const lengthOf = (cues, from, to) => (cues[to].end - cues[from].start) / 1000;
/** How long a video is whose last caption is `cues`' last: a moment longer, as a file runs past its last word. */
const videoLength = (cues) => (cues[cues.length - 1].end + ms(0.12)) / 1000;

/** What every hand-off says of the program that made it. */
const MADE_BY = { commit: "c709b57" };

/** A record as the builder reads it: its kind, its name, and the day it was recorded and where that day was read from. */
const record = ({ kind, name, recorded, recordedFrom }) => ({ version: 3, kind, name: { text: name, placeholder: false }, video: { recorded, recordedFrom } });

// ---- A finished video, as its editor sent it: "Pricing: what to charge?". Two Reel suggestions; Reel 2 was made from the second.
const FINISHED_CUES = timed([
  [3.2, "Welcome to the show. Today we are going to talk about"],
  [3.0, "pricing, and how to decide what to charge."],
  [3.1, "I get asked this more than almost anything else,", 0.3],
  [2.6, "so let's take it one step at a time."],
  [3.4, "Most people price their work by what feels safe.", 0.4],
  [4.1, "They look at what others charge, they shave a little off,"],
  [4.0, "and they hope nobody pushes back. But your price is not"],
  [3.9, "a guess about the market. It is a message about what"],
  [2.4, "you believe the work is worth."],
  [2.8, "Now, I know that sounds nice in theory.", 0.5],
  [2.7, "So let me show you what I actually do."],
  [4.0, "Here's the thing about discounts. The moment you offer one,", 0.3],
  [3.6, "you teach people that the first price was never real."],
  [3.7, "So start with your costs, add the time it takes,"],
  [3.6, "add what the result is worth to the person buying,"],
  [4.2, "and then stand behind that number, and that's why it works."],
  [3.8, "That's it for today. If this helped, send it to a friend", 0.6],
  [3.4, "who is stuck on their pricing. See you next time."]
]);

const finished = () => {
  const cues = FINISHED_CUES;
  const second = stretchOf(cues, 11, 15);
  return buildHandoffV2({
    ...MADE_BY,
    record: record({ kind: "finished", name: "Pricing: what to charge?", recorded: "2026-10-22", recordedFrom: "video" }),
    id: "e-20261022-3fa9c1",
    revision: 1,
    made: "2026-10-22T15:02:11-04:00",
    madeOn: "Sallie's laptop",
    // The dropped file is the editor's, and is the main video as it is.
    main: { file: "Pricing talk.mov", seconds: videoLength(cues), srt: srtOf(cues) },
    suggestions: [
      { n: 1, ...stretchOf(cues, 4, 8), stretches: [stretchOf(cues, 4, 8)], first: "Most people price", last: "the work is worth.", why: "It stands alone: one claim, the reason for it, and the line that ties them together.", point: "A price is a message about what the work is worth, not a guess about the market." },
      { n: 2, ...second, stretches: [second], first: "Here's the thing about", last: "and that's why it works.", why: "It gives the whole method in one breath and ends on its point.", point: "Do not discount: build the price from costs, time and worth, then stand behind it." }
    ],
    // Reel 2 was made from suggestion 2 and took its number. Suggestion 1 has no Reel.
    reels: [
      { n: 2, title: "Stop discounting your best work", file: "Pricing- what to charge- reel 2 v3 3fa9c1.mp4", seconds: lengthOf(cues, 11, 15), inMain: second, srt: srtOf(cues, 11, 15), fromSuggestion: 2 }
    ]
  });
};

// ---- A raw video, as its final render: "Pricing: when to raise it?". Suggestions 1 and 3, and the words drawn on its picture.
// Suggestion 1 is made of two stretches, with an aside between them that the suggestion leaves out. Suggestion 2 was read once
// and left out of the hand-off, since its words were cut from the final video, but Reel 2 was made from it and keeps its number,
// so its place in the main is not found. Reel 4 was made from times she gave: a fresh number, no suggestion, and no words on its
// picture (an empty title).
const RAW_CUES = timed([
  [3.3, "Hi, I'm Sallie, and today we're talking about when to"],
  [1.8, "raise your prices."],
  [3.0, "Someone asked me last week if it was too early,", 0.4],
  [3.0, "and my answer was, you do not need a reason."],
  [3.6, "You need a pattern. If three people in a row say yes"],
  [3.4, "without a single question, your price is too low."],
  [3.5, "That is the signal. Not your birthday, not inflation."],
  [3.8, "When you raise a price, tell people early and plainly.", 0.5],
  [3.0, "Say what is changing, say when it starts,"],
  [2.9, "and thank the people who have been with you."],
  [2.8, "And yes, it will feel awkward the first time.", 0.3],
  [3.3, "Keep the old price for anyone who is mid-project,", 0.2],
  [3.0, "so nobody feels caught out. Then move on."],
  [3.6, "People ask me what percent is fair. Here is my answer.", 0.5],
  [3.0, "Raise it until you hear a little hesitation,"],
  [3.5, "then stay right there for a month. If the hesitation"],
  [2.3, "goes away, you can go higher."],
  [2.8, "That's it for today. Thanks for watching,", 0.5],
  [2.4, "and I'll see you in the next one."]
]);
/** The words of Reel 2, which the final video no longer holds. */
const CUT_CUES = timed([
  [3.4, "Some people tell me prices are going up everywhere,"],
  [3.2, "so they wait. That's a trap. Waiting for everyone"],
  [3.6, "else to move first means you are always the last"],
  [2.6, "one to be paid properly."]
]);

const raw = () => {
  const cues = RAW_CUES;
  const one = [stretchOf(cues, 7, 9), stretchOf(cues, 11, 12)];
  const three = stretchOf(cues, 13, 16);
  return buildHandoffV2({
    ...MADE_BY,
    record: record({ kind: "raw", name: "Pricing: when to raise it?", recorded: "2026-10-20", recordedFrom: "video" }),
    id: "e-20261020-c4e5a7",
    revision: 1,
    made: "2026-10-21T11:48:30-04:00",
    madeOn: "Mac Studio",
    main: { file: "Pricing- when to raise it- main v4 c4e5a7.mp4", seconds: videoLength(cues), srt: srtOf(cues) },
    // The name title brimm-video drew over her first minute: her name, then her role.
    onPicture: ["Sallie Ogden", "Founder, The BRIMM"],
    suggestions: [
      { n: 1, start: one[0].start, end: one[1].end, stretches: one, first: "When you raise a price", last: "Then move on.", why: "Two short stretches that read as one: how to announce a price change, and who keeps the old price.", point: "Raise a price early and plainly, and keep the old one for work already started." },
      { n: 3, ...three, stretches: [three], first: "People ask me what", last: "you can go higher.", why: "One question, one answer, and a rule that can be tried this week.", point: "Raise a price until people hesitate, hold it for a month, then decide." }
    ],
    reels: [
      { n: 2, title: "Do not wait for everyone else", file: "Pricing- when to raise it- reel 2 v1 c4e5a7.mp4", seconds: lengthOf(CUT_CUES, 0, 3), srt: srtOf(CUT_CUES), fromSuggestion: 2 },
      { n: 4, title: "", file: "Pricing- when to raise it- reel 4 v2 c4e5a7.mp4", seconds: lengthOf(cues, 2, 6), inMain: stretchOf(cues, 2, 6), srt: srtOf(cues, 2, 6), fromSuggestion: null }
    ]
  });
};

// ---- A client or group session: no transcript, no file name, only what Sallie approved. "Session, 2026-10-22".
// The principles are made up and hold no names. Reel 3 was cut from the session once the client's agreement was noted (the day
// only, never who), from words that Sallie alone says: it has its own captions, and no suggestion.
const SESSION_REEL_CUES = timed([
  [3.4, "Your price tells people what to expect"],
  [3.3, "before you have said a word about the work."],
  [3.4, "If it is too low, they wonder what is wrong."],
  [3.2, "If it is a little higher than they thought,"],
  [3.0, "they lean in. So choose it on purpose."]
]);

const SESSION_BODY = {
  principles: [
    {
      n: 1,
      name: "Price the outcome",
      category: "pricing",
      description: "Charge for what the work changes for the buyer, not for the hours it takes.",
      steps: ["Name the result the buyer wants", "Put a number on what that result is worth to them", "Set the price as a fair share of that number"],
      red_flags: ["Pricing by the hour because it feels safe", "Matching someone else's price without a reason of your own"],
      green_flags: ["A price you can explain in one sentence", "Buyers asking what is included, not what it costs"],
      decision_criteria: ["Does the price say what the work is worth?", "Could you say it out loud without apologising?"],
      example_application: "A baker who sells wedding cakes prices by the celebration the cake serves, not by the hours in the kitchen.",
      verbatim_key_phrases: ["What is it worth to them?", "Your price is a message."]
    },
    {
      n: 2,
      name: "Say the price first",
      category: "sales conversations",
      description: "Name the number early in a conversation, so that the rest of it can be about fit and not about waiting for the cost.",
      steps: ["Say the price in the first few minutes", "Stop talking and let it land", "Ask whether it works for them, then move to what would make it a yes"],
      red_flags: ["Circling for ten minutes before the number comes up", "Softening the price with an apology"],
      green_flags: ["The buyer asks about the work after hearing the price", "A no that comes early and costs nobody anything"],
      decision_criteria: ["Has the buyer heard the number yet?", "Is the next question about fit?"],
      example_application: "A service provider states the price in the first call, asks whether it works, and spends the rest of the call on what would make it a yes.",
      verbatim_key_phrases: []
    },
    {
      n: 3,
      name: "Check one number each week",
      category: "operations",
      description: "Choose the one number that says whether the business is healthy, look at it on the same day every week, and change one thing at a time.",
      steps: ["Pick the one number that matters most this quarter", "Look at it every Monday", "Change one thing, then watch the number for a month"],
      red_flags: ["Tracking ten numbers and acting on none", "Changing three things at once"],
      green_flags: ["This week's number can be said without looking it up", "Each change has a before and an after"],
      decision_criteria: ["Will this number move if the work is done well?", "Is there one thing to change this week?"],
      example_application: "The owner of a small shop watches the number of returning customers each Monday and tries one new thing a month to raise it.",
      verbatim_key_phrases: ["One number, every Monday."]
    }
  ],
  recurringPrinciples: [
    { n: 1, text: "Price is a message." },
    { n: 2, text: "Decide once, then stop re-deciding." }
  ],
  reelsToFilm: [
    { n: 1, idea: "Why price is a message", words: "Your price tells people what to expect before you have said a word about the work.", why: "It was said more than any other point, and it stands alone.", principle: 1 },
    { n: 2, idea: "The day after you raise a price", words: "The day after you raise a price, change nothing. Same warmth, same work, same you.", why: "A calming note that belongs to no one principle.", principle: null }
  ]
};

const session = () => buildHandoffV2({
  ...MADE_BY,
  record: record({ kind: "session", name: "Session, 2026-10-22", recorded: "2026-10-22", recordedFrom: "video" }),
  id: "e-20261022-77ab12",
  revision: 1,
  made: "2026-10-23T10:15:40-04:00",
  madeOn: "Mac Studio",
  session: SESSION_BODY,
  reels: [
    { n: 3, title: "Price is a message", file: "Session, 2026-10-22 reel 3 v1 77ab12.mp4", seconds: lengthOf(SESSION_REEL_CUES, 0, 4), srt: srtOf(SESSION_REEL_CUES), fromSuggestion: null, clientAgreed: "2026-10-23" }
  ]
});

// ---- A session that replaces a finished video: "Pricing: what to charge?" was handed off as finished (revision 1) and then
// corrected to a session. It is the finished video's id, one revision on, with nothing in it yet: the page redacts the earlier
// revision's words in place when it takes this one.
const sessionReplacing = () => buildHandoffV2({
  ...MADE_BY,
  record: record({ kind: "session", name: "Session, 2026-10-22", recorded: "2026-10-22", recordedFrom: "video" }),
  id: "e-20261022-3fa9c1",
  revision: 2,
  made: "2026-10-22T16:40:05-04:00",
  madeOn: "Sallie's laptop"
});

// ---- An iPhone clip: its main video only, with a text card drawn on its picture. No suggestions, and no reels key at all.
const SHORT_CUES = timed([
  [2.6, "So the first thing you need to do is know your"],
  [2.4, "costs. It is very, very important."],
  [3.6, "Write down what each job takes, in time and in money,", 0.3],
  [2.2, "and only then pick a price."]
]);

const shortVideo = () => buildHandoffV2({
  ...MADE_BY,
  record: record({ kind: "short video", name: "Know your costs", recorded: "2026-10-21", recordedFrom: "import" }),
  id: "e-20261021-6e90b3",
  revision: 1,
  made: "2026-10-22T09:30:00-04:00",
  madeOn: "Sallie's laptop",
  main: { file: "Know your costs main v1 6e90b3.mp4", seconds: videoLength(SHORT_CUES), srt: srtOf(SHORT_CUES) },
  onPicture: ["Know your costs"]
});

/** The five fixtures' texts by file name. Each is checked by the hand-off's own check first: a fixture that does not pass it
    is not made. */
export function fixtures() {
  const made = {
    "handoff-v2-finished.json": finished(),
    "handoff-v2-raw.json": raw(),
    "handoff-v2-session.json": session(),
    "handoff-v2-short-video.json": shortVideo(),
    "handoff-v2-session-replacing.json": sessionReplacing()
  };
  const texts = {};
  for (const [name, handoff] of Object.entries(made)) {
    const fault = handoffFaultV2(handoff);
    if (fault) throw new Error(`${name} does not pass handoffFaultV2: ${fault}`);
    texts[name] = handoffText(handoff);
  }
  return texts;
}

// Run as a program, it writes them next to this file and says each one's sha256, for the pins in tests/contract.test.js.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [name, text] of Object.entries(fixtures())) {
    writeFileSync(fileURLToPath(new URL(name, import.meta.url)), text);
    console.log(`${createHash("sha256").update(text).digest("hex")}  ${name}`);
  }
}
