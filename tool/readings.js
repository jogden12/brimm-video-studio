// Having Claude read the words of a video, whatever kind of video it is: what it is asked of each kind, and how its reply is read.
// There are four kinds. A finished video is asked for Reel suggestions and for the spellings of names and words. A raw video is
// asked what notes.js asks, with the spellings and the point of each clip as well. A short video, filmed on an iPhone, is asked
// for the spellings and one line on what it is. A session, a private recording with a client or a group, is asked for what the
// host teaches, as general principles, and for Reel ideas.
// What Claude is given is the words and the time each phrase starts, with the same guard lines as in notes.js. It is not given
// what the rules decided, except for a raw video: the rules' cuts are not used for the other kinds. It is never given a session's
// file name, and is asked to leave out of every field the client's name, business, industry, numbers and story.
// Its reply is read as notes.js reads one: what is whole is read, and what could not be is named in plain words and never guessed at.
// Nothing here touches a disk, runs a program or asks Claude anything. It takes plain data and gives back plain data.
import { notesRequest, readNotes, objectIn, asked, section, runsOf, oneLine, ASK, GUARD, DATA } from "./notes.js";
import { plain, stamp, list } from "./shared/text.js";
import { SHOW, HOST } from "./shared/show.js";
import { REEL_MIN, REEL_MAX } from "./reframe.js";

const KINDS = ["finished", "raw", "session", "short video"];
const text = (v) => plain(v).trim();

/** How many Reel suggestions are asked for, and read, at most. The request says it in words. */
const MAX_SUGGESTIONS = 8;

const WHOLE = 'Each line inside <phrases> is one phrase: its id, the time it starts, and its words. A phrase ends at a pause or at the end of a sentence. A phrase marked "straight on from" has no pause before it, so a stretch never starts or ends between it and the phrase it names.';

const START = "Read every phrase before you answer. Reply with one JSON object and nothing else: no introduction, no code fence, no closing note. Use exactly these keys:";

const SPELLINGS = '- "spellings": a list of {"heard", "spelled", "why"}: the names and words the transcriber most likely got wrong. "heard" is the one word as it is written in the phrases, "spelled" is how it is spelled, and "why" is one plain sentence. An empty list when there are none.';

const SUGGESTIONS = `- "suggestions": at most eight {"from", "to", "first", "last", "why", "point"}. Each is a stretch that would stand alone as a short vertical clip of ${REEL_MIN} to ${REEL_MAX} seconds. It runs from the phrase "from" to a later phrase "to", and is all of the video between them. Start it on a phrase that is not marked "straight on from", and end it on a phrase that the one after it is not straight on from. "first" is its first few words and "last" its last few, as the phrases have them. "why" is one sentence on why it stands alone, and "point" one sentence on the point it makes. An empty list when nothing stands alone.`;

const ABOUT = `- "about": one line on what the clip is, for ${HOST} to know it by, not for posting.`;

const EVERY_FIELD = "Of every field: no client's name, business, industry, numbers or story.";

const FRAMEWORKS = `- "frameworks": the business principles and teachings ${HOST} gives in it, each {"name", "category", "description", "steps", "red_flags", "green_flags", "decision_criteria", "example_application", "verbatim_key_phrases", "source_context"}. "name" is a short name for the principle, "category" a word or two for what it is about, and "description" one or two sentences on what it says. "steps", "red_flags", "green_flags" and "decision_criteria" are lists of short texts: how to put it to work, signs it is being missed, signs it is working, and the questions that decide it. "example_application" is a general example of it at work, made up, about nobody in the session. "verbatim_key_phrases" are short phrases ${HOST} says herself, word for word, taken only from her own lines: an empty list when the speaker labels do not show which lines are hers. "source_context" is one sentence on where in the session it came up, for her eyes only. An empty list when it teaches nothing.`;

const RECURRING = `- "recurring_principles": a list of short sentences, each a point ${HOST} makes more than once in the session and that is part of no one framework. An empty list when there are none.`;

const REEL_IDEAS = `- "reel_ideas": a list of {"from", "to", "idea", "words", "why", "refilm", "principle"}, only from stretches where ${HOST} alone speaks, judged from the words and the speaker labels. "from" and "to" are the ids of the phrases it runs from and to. "idea" is what the Reel would say, in one sentence; "words" are the words she would say in it; "why" is one sentence. "refilm" is true when it is better filmed again by her on its own, and false when the stretch could be cut from the session as it is. "principle" is the place in "frameworks", counted from 1, of the framework it shows, or null. An empty list when nothing fits.`;

/** What a raw video is asked: what notes.js asks, less the title, with the point of each clip and the spellings as well. */
const RAW_TASK = [ASK.start, ASK.decisions, ASK.notes, ASK.graphics, `${ASK.clips} Each clip has a "point" too: one sentence on the point it makes.`, SPELLINGS].join("\n");

/** The file and the length, which a finished video and a short video are shown. */
const fileAndLength = (about) => [`File: ${oneLine(about.video)}`, `Length: ${stamp(Math.round(about.duration))}`];

/** What each of the other three kinds is told it is, what it is shown of the recording, and what it is asked. */
const ASKS = {
  finished: {
    opening: `This is a finished video for ${SHOW}, edited by her editor and ready to post. The host is ${HOST}, founder of The BRIMM.`,
    recording: fileAndLength,
    task: [START, SUGGESTIONS, SPELLINGS]
  },
  "short video": {
    opening: `This is a short video for ${SHOW}, filmed on an iPhone. The host is ${HOST}, founder of The BRIMM.`,
    recording: fileAndLength,
    task: [START, SPELLINGS, ABOUT]
  },
  session: {
    opening: `This is a recording of a private session that ${HOST}, founder of The BRIMM, held with a client or with a group. What is wanted from it is what she teaches, as general principles, and nothing about the people she teaches.`,
    // A session is shown no file name, as its name may be that of a client. `speakers` is the meeting's own transcript, with
    // every speaker but her named "Participant 1", "Participant 2" and so on, and is shown as it is.
    recording: (about) => [
      `Length: ${stamp(Math.round(about.duration))}`,
      ...(typeof about.speakers === "string" && about.speakers.trim()
        ? [`Who says what, from the meeting's own transcript. ${HOST}'s lines carry her name; every other speaker is named "Participant 1", "Participant 2" and so on:`, about.speakers]
        : ["There are no speaker labels for this recording, so who says what is not known."])
    ],
    task: [START, EVERY_FIELD, FRAMEWORKS, RECURRING, REEL_IDEAS]
  }
};

/** Nothing is asked or read for a kind that is none of the four. Whoever asks has made a mistake, which no reply can cause. */
function known(kind) {
  if (!KINDS.includes(kind)) throw new Error(`"${String(kind)}" is not a kind of video to read. The kinds are ${KINDS.map((k) => `"${k}"`).join(", ")}.`);
}

/** The whole text of one request to Claude about a video of this kind: "finished", "raw", "session" or "short video". `plan` is
    the cut plan, as notesRequest takes it. `about` is {video, duration}: the file's name and its length in seconds. For a session
    it is {duration, speakers}: no file name is ever shown, and `video`, when it is given, is not read. `speakers` is the text of
    the meeting's own transcript, or nothing when there is none.
    A raw video's request is notesRequest's, with what else is asked. The others show each phrase of the plan on a line of its own,
    with its id, when it starts and its words, and not what the rules decided for it. What is asked comes last, after everything
    that comes from the recording. Throws for any other kind. */
export function requestFor(kind, plan, about) {
  known(kind);
  if (kind === "raw") return notesRequest(plan, about, RAW_TASK);
  const ask = ASKS[kind];
  const phrases = list(plan.phrases);
  const runs = runsOf(phrases);
  const shown = phrases.map((p, i) => {
    // As in notesRequest: Claude is shown which phrases have no pause before them, because a stretch is cut at a pause.
    const on = runs[i] !== i ? `, straight on from ${phrases[i - 1].id}` : "";
    return `${p.id} | ${stamp(p.start)}${on} | ${oneLine(p.text)}`;
  });
  return [`${ask.opening}\n\n${GUARD}`, section("recording", ask.recording(about)), WHOLE, section("phrases", shown), DATA, section("task", [ask.task.join("\n")])].join("\n\n");
}

/** The lists of a reply, as readNotes reads them. `entries(key, into, entry, bad, most)` reads each entry of the reply's list `key`
    with `entry`. It is given the entry as an object (an empty one when the entry is not), the entry's place in the list counted
    from 1, and the entry as it was given, and gives null for one it cannot read. What it reads is put in `into`, and for each
    one it cannot read, `bad` gives the problem to put in `problems`. Only the first `most` entries are read. A reply with no
    such list, or one that is not a list, is said so in `problems` too. */
function listsOf(data, problems) {
  return (key, into, entry, bad, most = Infinity) => {
    if (data[key] === undefined) problems.push(`Its reply has no "${key}".`);
    else if (!Array.isArray(data[key])) problems.push(`"${key}" in its reply is not a list, so nothing was read from it.`);
    else {
      data[key].slice(0, most).forEach((given, i) => {
        const got = entry(given && typeof given === "object" ? given : {}, i + 1, given);
        if (got) into.push(got);
        else problems.push(bad(i + 1));
      });
    }
  };
}

/** Claude's reply, read for the things in `keys`. `empty` gives the reading of a reply with nothing in it, without its problems,
    and `fill` reads what is in the reply into it. It is given the object found in the reply, the reading and the means to read
    its lists (listsOf). A reply that cannot be read at all gives `empty` and one problem. */
function reading(reply, keys, empty, fill) {
  const read = { ...empty(), problems: [] };
  const none = (problem) => ({ ...read, problems: [problem] });
  if (reply == null || (typeof reply === "string" && !reply.trim())) return none("Claude sent nothing back.");
  const answer = typeof reply === "string" ? objectIn(reply, keys) : { data: null };
  const data = answer.data;
  if (!data) return none("Its reply could not be read: there is no JSON object in it.");
  if (!asked(data, keys)) return none("Its reply could not be read: it has none of the things that were asked for.");
  if (answer.partial) read.problems.push("Its reply breaks off part-way, and only the finished part of it was read.");
  fill(data, read, listsOf(data, read.problems));
  return read;
}

/** A spelling is {heard, spelled, why} and needs the first two: it is read without a reason. */
const spelling = (s) => (text(s.heard) && text(s.spelled) ? { heard: text(s.heard), spelled: text(s.spelled), why: text(s.why) } : null);
const badSpelling = (n) => `Spelling ${n} could not be read: it needs a "heard" and a "spelled".`;
/** The texts in a list, and no entry that is not text. */
const texts = (v) => list(v).map(text).filter(Boolean);

const readFinished = (reply) => reading(reply, ["suggestions", "spellings"], () => ({ suggestions: [], spellings: [] }), (data, read, entries) => {
  entries("suggestions", read.suggestions, (s, n) => (text(s.from) && text(s.to) ? { n, from: text(s.from), to: text(s.to), first: text(s.first), last: text(s.last), why: text(s.why), point: text(s.point) } : null), (n) => `Suggestion ${n} could not be read: it needs a "from" and a "to", each the id of a phrase.`, MAX_SUGGESTIONS);
  if (list(data.suggestions).length > MAX_SUGGESTIONS) read.problems.push("Its reply gives more than eight suggestions, and only the first eight were read.");
  entries("spellings", read.spellings, spelling, badSpelling);
});

const readShort = (reply) => reading(reply, ["spellings", "about"], () => ({ spellings: [], about: "" }), (data, read, entries) => {
  entries("spellings", read.spellings, spelling, badSpelling);
  if (data.about === undefined) read.problems.push('Its reply has no "about".');
  else if (typeof data.about !== "string") read.problems.push('"about" in its reply is not text, so it was left out.');
  else read.about = oneLine(data.about);
});

const readSession = (reply) => reading(reply, ["frameworks", "recurring_principles", "reel_ideas"], () => ({ principles: [], recurringPrinciples: [], reelIdeas: [], spellings: [] }), (data, read, entries) => {
  const framework = (f, n) => (text(f.name) ? { n, name: text(f.name), category: text(f.category), description: text(f.description), steps: texts(f.steps), red_flags: texts(f.red_flags), green_flags: texts(f.green_flags), decision_criteria: texts(f.decision_criteria), example_application: text(f.example_application), verbatim_key_phrases: texts(f.verbatim_key_phrases), source_context: text(f.source_context) } : null);
  // A Reel idea names the framework it shows by its place in the reply. Only a framework that was read is one it can show.
  const idea = (r, n) => {
    if (!text(r.idea) || !text(r.words) || typeof r.refilm !== "boolean" || (!r.refilm && !(text(r.from) && text(r.to)))) return null;
    const shows = Number.isInteger(r.principle) && read.principles.some((f) => f.n === r.principle);
    return { n, from: text(r.from), to: text(r.to), idea: text(r.idea), words: text(r.words), why: text(r.why), refilm: r.refilm, principle: shows ? r.principle : null };
  };
  entries("frameworks", read.principles, framework, (n) => `Framework ${n} could not be read: it needs a "name".`);
  entries("recurring_principles", read.recurringPrinciples, (r, n, given) => (text(given) ? { n, text: text(given) } : null), (n) => `Recurring principle ${n} could not be read: it is not text.`);
  entries("reel_ideas", read.reelIdeas, idea, (n) => `Reel idea ${n} could not be read: it needs an "idea", "words", "refilm" as true or false, and for a Reel cut from the session, a "from" and a "to".`);
});

/** A raw video's reply is read by readNotes, which has the problems of everything it reads. Each clip it reads becomes a
    suggestion, with the point the reply gives for the clip at the same place in its list. The spellings are read from the
    object readNotes read. When readNotes could not read the reply at all, nothing more is said of it. There is no title: it is
    not asked for. */
function readRaw(reply) {
  const old = readNotes(reply);
  const read = { decisions: old.decisions, notes: old.notes, graphics: old.graphics, suggestions: [], spellings: [], problems: old.problems };
  const data = typeof reply === "string" ? objectIn(reply).data : null;
  if (!asked(data)) return read;
  const clips = list(data.clips);
  read.suggestions = old.clips.map((c) => ({ ...c, point: text((clips[c.n - 1] || {}).point) }));
  listsOf(data, read.problems)("spellings", read.spellings, spelling, badSpelling);
  return read;
}

const READERS = { finished: readFinished, raw: readRaw, session: readSession, "short video": readShort };

/** Claude's reply to the request for a video of this kind, read into what that kind asks for, with `problems` as well:
    - "finished": {suggestions, spellings}. A suggestion is {n, from, to, first, last, why, point}: the ids of its first phrase and
      its last, and the rest as texts, which may be empty. At most eight are read. A spelling is {heard, spelled, why}.
    - "raw": {decisions, notes, graphics, suggestions, spellings}. The first three are as readNotes reads them. A suggestion is a
      clip as readNotes reads it, {n, from, to, hook, why}, with its `point`. A reply's title is not read.
    - "short video": {spellings, about}. `about` is one line on what the clip is.
    - "session": {principles, recurringPrinciples, reelIdeas, spellings}. A principle is {n, name, category, description, steps,
      red_flags, green_flags, decision_criteria, example_application, verbatim_key_phrases, source_context}. A recurring principle
      is {n, text}. A Reel idea is {n, from, to, idea, words, why, refilm, principle}: `principle` is the `n` of the principle it
      shows, or null when it shows none or one that could not be read. `spellings` is always empty: none are asked for.
    `n` is the place of an entry in Claude's list, counted from 1: one that could not be read is named by that number in
    `problems`, and the entries after it keep theirs. The reply may be in a code fence, have words around it, or break off
    part-way: what is whole is read. What was missing or in a form that could not be read is said in `problems`, in plain words,
    and left out. A reply that cannot be read at all gives empty lists and one problem. Nothing is thrown from here, whatever
    the reply is, but for a kind that is none of the four. */
export function readReading(kind, reply) {
  known(kind);
  return READERS[kind](reply);
}
