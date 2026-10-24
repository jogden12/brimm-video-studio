// Claude's reading of a video, once Sallie has said what it is (spec 2026-10-22, section 2, "What the answer does" and "The one
// Claude call", and section 3, "The reading, per kind"). `kind` starts it detached, as `read --now <folder> --kind <kind> --rev
// <rev>` (edit.js), and this is the work of that run: one Claude call, with the request of the kind (readings.js), tried twice,
// and what it read written into the episode by the rule (unedited.js intoEpisode), with its late check.
// - A finished video: its Reel suggestions, and the spellings, as offers for her to answer. Its plan is not changed: a finished
//   video keeps the whole of itself, so each suggestion's stretch is its phrases' own times, on the video's own clock.
// - A raw video: the plan changed by Claude's decisions, with the pauses the import kept, its cut log, the rough cut's captions
//   and transcript, Claude's notes, the Reel suggestions and the spellings as offers; and the rough cut rendered on this Mac, by
//   today's ffmpeg, as version 0 of the main video, from the timeline kept as edit/main.v0.fcpxml, and opened in QuickTime
//   Player. It replaces files the import's late check looks at, so it waits first while that check still holds the video.
// - An iPhone clip: the spellings as offers, and one line on what the clip is.
// - A client or group session, once she has asked for its teachings (`teachings`, edit.js) and while this Mac's training gate is
//   on: every speaker of the meeting's own transcript but her is replaced before the call, the reply is read for principles,
//   recurring principles and Reel ideas, every field that holds a name brimm-video can see is taken out (sessions.js), and what
//   is left is written under the session's name, for her to decide in her chat. Asked for again, the earlier teachings are set
//   aside into history/ first.
// The suggestions are Reel candidates with no crops yet (reels.json version 2), numbered on from the highest number ever given to
// the video, so that no number is given twice under one id. The record keeps what the call did (`reading`). Before anything is
// asked, and again just before the call, the record must still be the answer the run was started for. The log and the result
// name the episode by its name and id, and never quote Claude's reply or the transcript.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { requestFor, readReading } from "./readings.js";
import { applyDecisions, clipRanges, notesText, pausesOfPlan } from "./notes.js";
import { keptSpans, roughRate, roughCaptions, planText, probeArgs, factsOf, streamsOf } from "./cuts.js";
import { stampedText } from "./lib.js";
import { stretchesOf, fitReel } from "./reframe.js";
import { reelsFile, reelEntries, REELS_FILE } from "./reels.js";
import { readEpisode, writeEpisode, localStamp, kindOf, shownName, heldElsewhere, undone, recordNumbers } from "./episode.js";
import { commitOf } from "./filing.js";
import { gated } from "./gate.js";
import { highestNumberOf } from "./finish.js";
import { timelineFor } from "./timeline.js";
import { episodeWork, runsFolder, readSettings } from "./settings.js";
import { fileSafe, shortId, timelineFile } from "./names.js";
import { askOnce, roughCut, intoEpisode, filesOf, importHold, sameVideo, CLAUDE_MODEL, CLAUDE_TRIES, AGAIN_MS } from "./unedited.js";
import { noProgress } from "./progress.js";
import { isWhole, readThrough, textWriter, LATE_CHECK_MS } from "./dropbox.js";
import { lastLine } from "./run.js";
import { stamp } from "./shared/text.js";
import { checkNames } from "./sessions.js";
import { TEACHINGS_FORMAT, accountWhy, teachingsWhy, teachingsFiles, earlierTeachings, sessionSeen, seenFrom, planOf, teachingsText, ideasText } from "./teachings.js";

/** How often a raw reading looks again while the import's late check holds its video, and how long it waits in all before it
    gives up and says why: the check comes at most LATE_CHECK_MS after the import filed the video, and a little more is allowed. */
export const READ_LOOK_MS = 60 * 1000;
export const READ_HOLD_MS = LATE_CHECK_MS + 15 * 60 * 1000;
/** How long `claude auth status` may take. */
const ACCOUNT_MS = 30 * 1000;

/** The kinds `read` is started for (`--kind`), as the record keeps them: an iPhone clip is a "short video". */
export const READ_KINDS = ["finished", "raw", "short video", "session"];
/** What each kind is called to her. */
const KIND_SAID = { finished: "finished by your editor", raw: "raw with retakes", "short video": "an iPhone clip", session: "a client or group session" };

const READINGS_OFF = "Readings are off on this Mac: ask Jason.";
/** What a reading of another kind says of a session, which is read only for its teachings, through `teachings`. */
const SESSION_LATER = "A session is read only for its teachings, which come in a later step.";
/** What to say next when nothing was read, and Claude may be asked again. */
const AGAIN = "Nothing was changed. Say what it is again, with --again, to have Claude read it.";
/** The same, for a session, whose teachings are asked for again. */
const AGAIN_TEACHINGS = "Nothing was changed. Ask for its teachings again to have Claude read it.";
/** The notice a reading posts on this Mac once what it read is in the episode, and what to say next. */
const noticeOf = (name) => `Claude has read ${name}: say "what did Claude find?"`;
const FOUND = 'Say "what did Claude find?"';

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isText = (v) => typeof v === "string" && v.trim() !== "";
/** A sum to the thousandth of a second. */
const ms = (t) => Math.round(t * 1000) / 1000;
/** "1 thing", "2 things". */
const counted = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Text with its first letter in capitals. */
const capital = (text) => text[0].toUpperCase() + text.slice(1);
/** A part of a sentence, made a sentence: with its full stop. */
const sentence = (part) => `${String(part).replace(/\.$/, "")}.`;

/** Why the run cannot go on with the episode's `record` as the answer it was started for (`kind`, `rev`), in plain words, or "":
    for any kind but a session, a session, which is read only for its teachings; one whose kind is not the kind any more (or that
    has none, as a video not answered); for any kind but a session, one whose session mark is not cleared (the gate's own
    predicate), and one read already for this answer (one reading for each answer: its `reading.at` is not before `answer.at`,
    or either cannot be read; `kind … --again` sets an old reading aside); for a session, one whose teachings were not asked for
    (`session.teachings` "asked", at `session.asked`), and one read already since they were (one reading for each ask: its
    `reading.at` is not before `session.asked`, or either cannot be read; asking again is what reads it again); one whose answer
    Dropbox undid (its rev is below the answer's); one another Mac has open (its claim); and one whose last change on this Mac
    Dropbox took away. Each names the video as edit.js does (shownName). */
function notAsAnswered(record, { kind, rev, machine, home }) {
  const name = shownName(record);
  const read = record.reading !== undefined && record.reading !== null;
  if (kind === "session") {
    if (kindOf(record) !== "session") return `${name} is no longer answered as ${KIND_SAID[kind]}, so Claude did not read it. Nothing was changed.`;
    const mark = isObject(record.session) ? record.session : {};
    const asked = mark.teachings === "asked" ? Date.parse(mark.asked) : NaN;
    if (!Number.isFinite(asked)) return `${name}'s teachings were not asked for, so Claude did not read it. Nothing was changed.`;
    if (read && !(isObject(record.reading) && Date.parse(record.reading.at) < asked)) return `${name} was read already since its teachings were asked for. Nothing was asked of Claude.`;
  } else {
    if (kindOf(record) === "session") return SESSION_LATER;
    if (kindOf(record) !== kind) return `${name} is no longer answered as ${KIND_SAID[kind]}, so Claude did not read it. Nothing was changed.`;
    if (gated(record)) return `${name} is marked a client or group session, so Claude did not read it. Nothing was changed.`;
    const answeredAt = isObject(record.answer) ? Date.parse(record.answer.at) : NaN;
    if (read && !(isObject(record.reading) && Date.parse(record.reading.at) < answeredAt)) return `${name} was read already for this answer. Nothing was asked of Claude.`;
  }
  if (record.rev < rev) return `Dropbox undid the answer for ${name}, so Claude did not read it. Say what it is again.`;
  const held = heldElsewhere(record, machine);
  if (held) return `${held.by} has ${name} open, so Claude did not read it. Nothing was changed.`;
  return undone(record, home);
}

/** The account Claude Code is signed in to on this Mac, as `claude auth status` says it: "<email> (<organisation>)", or the email
    alone, or "" when it cannot be read. It is run as the call is, through `run`, in a new empty folder `folder` of the run's own,
    and with the call's one option that applies to it, reading no settings file (--setting-sources ""). It is kept in the
    record, and never printed. */
export async function accountOf({ run, tools }, folder) {
  try {
    mkdirSync(folder, { recursive: true });
    const ended = await run(tools.claude, ["--setting-sources", "", "auth", "status", "--json"], { cwd: folder, limit: ACCOUNT_MS, out: 100000 });
    if (ended.outOfTime || ended.code !== 0) return "";
    const told = JSON.parse(ended.stdout);
    if (!isObject(told)) return "";
    const email = [told.email, told.emailAddress, isObject(told.account) ? told.account.email : ""].find(isText) || "";
    const org = [told.orgName, told.organizationName, isObject(told.organization) ? told.organization.name : told.organization].find(isText) || "";
    return email ? `${email.trim()}${org ? ` (${org.trim()})` : ""}` : "";
  } catch (e) {
    return "";
  }
}

/** Whether a reading read nothing at all from a reply: every list empty, every text empty, and something wrong with it. A reply
    that finds nothing to suggest and nothing to spell is whole, and is not one of these. */
const nothingRead = (read) => read.problems.length > 0 && Object.entries(read).every(([key, value]) => key === "problems" || (Array.isArray(value) ? value.length === 0 : !value));

/** The first few words of a stretch's words, and its last few, when Claude did not say them. */
const opening = (words) => words.split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
const closing = (words) => words.split(/\s+/).filter(Boolean).slice(-4).join(" ");

/** A Reel candidate with no crops yet (reels.json version 2), numbered `n`, of a suggestion `item`: { ranges, phrases, why, point,
    first, last, hook, check }, where `ranges` are its stretches in seconds of the video and `phrases` the plan's phrases it holds.
    Its stretches are put on the video's picture grid, each end on a whole picture as reelCandidates puts them, and none has a
    crop; it has no preview and its `title` is "". null when it comes to less than one picture. */
function candidateOf(item, n, facts) {
  const stretches = stretchesOf(keptSpans(item.ranges.map((range) => ({ ...range, keep: true })), roughRate(facts)));
  if (!stretches.length) return null;
  const seconds = ms(stretches.reduce((sum, s) => sum + s.end - s.start, 0));
  const words = item.phrases.map((p) => String(p.text).trim()).filter(Boolean).join(" ");
  return {
    n, start: stretches[0].start, end: stretches[stretches.length - 1].end, ranges: stretches.map(({ start, end }) => ({ start, end })), seconds, fits: fitReel({ start: 0, end: seconds }),
    title: "", reason: item.why || "", point: item.point || "", first: item.first || opening(words), last: item.last || closing(words), ...(item.hook ? { hook: item.hook } : {}),
    words, phrases: item.phrases.map((p) => p.id), ...(item.check ? { check: item.check } : {}), preview: null
  };
}

/** A finished video's suggestions as stretches of the whole video: each from its first phrase's start to its last phrase's end,
    the rules' cuts not run on it, since nothing of a finished video is cut. One that names a phrase the plan does not have, or
    ends before it starts, is left out. { items, left }. */
function wholeStretches(plan, suggestions) {
  const phrases = Array.isArray(plan.phrases) ? plan.phrases : [];
  const place = new Map(phrases.map((p, i) => [p.id, i]));
  const items = [];
  let left = 0;
  for (const s of suggestions) {
    const [i, j] = [place.get(s.from), place.get(s.to)];
    if (i === undefined || j === undefined || j < i) {
      left += 1;
      continue;
    }
    items.push({ ranges: [{ start: phrases[i].start, end: phrases[j].end }], phrases: phrases.slice(i, j + 1), why: s.why, point: s.point, first: s.first, last: s.last });
  }
  return { items, left };
}

/** The suggestions as she can read them beside the video, `<name>.reel-suggestions.txt`: a convenience copy, written at the
    reading. What Claude shows her is written from reels.json when she asks, on her current clock. */
function suggestionsText({ name, kind, candidates, problems, at }) {
  const head = [
    `Reel suggestions for ${name}, from Claude's reading of its words on ${at.slice(0, 10)}. Claude could not see or hear the video, so check each one against it.`,
    `The times are the recording's own, from its start${kind === "raw" ? ", not the rough cut's" : ""}.`
  ].join("\n");
  const blocks = candidates.map((c) => {
    const seconds = Math.round(c.seconds);
    return [
      `${c.n}. ${stamp(c.start)} to ${stamp(c.end)}, ${seconds} second${seconds === 1 ? "" : "s"}${c.ranges.length > 1 ? ", without what is cut in between" : ""}.`,
      c.first && `   Opens with: ${c.first}`,
      c.last && `   Closes with: ${c.last}`,
      c.reason && `   Why: ${c.reason}`,
      c.point && `   Its point: ${c.point}`,
      c.hook && `   Words for the screen: ${c.hook}`,
      !c.fits.fits && `   It does not fit a Reel. ${c.fits.why}`,
      c.check && `   ${c.check}`
    ].filter(Boolean).join("\n");
  });
  const body = blocks.length ? blocks : ["Claude suggested no stretch that stands alone."];
  const unused = problems.length ? [["What could not be used from its reply:", ...problems.map((p) => `- ${p}`)].join("\n")] : [];
  return [head, ...body, ...unused].join("\n\n") + "\n";
}

/** The first line of the cut log a raw reading writes: its times are the recording's, and what Claude did to the plan. */
const readPlanNote = (changes, notes) => `The times here are the recording's own, from its start.\nClaude read this plan and ${changes ? `changed it in ${counted(changes, "place")}` : "changed nothing in it"}.${notes ? ` Its notes are in ${notes}.` : ""}`;

/** The spellings Claude offers, less any the episode has already, and each word heard once. */
function offersFor(spellings, record) {
  const known = new Set((Array.isArray(record.spellings) ? record.spellings : []).map((pair) => pair[0]));
  const seen = new Set();
  return spellings.filter((s) => !known.has(s.heard) && !seen.has(s.heard) && Boolean(seen.add(s.heard)));
}


/** The rules' plan of a raw video as its first reading set it aside in history/ (written(), below): `<moment> <stem>.cut-plan.json`,
    with its cut log `<moment> <stem>.cut-plan.txt` beside it. { json, txt, text }: their paths from the episode's `folder` (`txt`
    null when there is no cut log of that moment) and the plan's text, of the newest such plan that Claude has not read (it holds
    no `claude` block); or null when there is none. A raw video read again starts from it (edit.js, `kind … --again`). */
export function rulesPlanKept(folder, stem) {
  let names = [];
  try {
    names = readdirSync(join(folder, "history"));
  } catch (e) {
    return null;
  }
  const ending = ` ${stem}.cut-plan.json`;
  for (const name of names.filter((n) => n.endsWith(ending)).sort().reverse()) {
    try {
      const text = readFileSync(join(folder, "history", name), "utf8");
      const plan = JSON.parse(text);
      if (!isObject(plan) || plan.claude || !Array.isArray(plan.phrases)) continue;
      const txt = `history/${name.slice(0, -ending.length)} ${stem}.cut-plan.txt`;
      return { json: `history/${name}`, txt: existsSync(join(folder, txt)) ? txt : null, text };
    } catch (e) {
      // One that cannot be read is no plan to start from.
    }
  }
  return null;
}

/** Claude's clips, as clipRanges names one it left out ("Clip 1 was left out: …", "… it overlaps clip 2."), named so that their
    numbers, which are Claude's own, are not taken for the numbers the reading gives the suggestions it keeps. */
const claudesClip = (line) => String(line).replace(/^Clip (\d+) was left out: /, "Claude's clip $1 was left out: ").replace(/overlaps clip (\d+)\./, "overlaps Claude's clip $1.");

/** Read the episode `found` ({ folder, name, record }, as findEpisode found it) as `deps.kind` (finished, raw, short video), the
    answer of rev `deps.rev`: the detached run's work. Resolves { ok, made, failed, next }, the run's result, in plain words that
    name the episode by its name (shownName) and never quote Claude's reply or the transcript. `ctx` is edit.js's (this Mac's
    settings, home, root, isWhole, openApp, and its deps for timelineFor), and `deps` are the run's: `run` and `tools` (the
    programs, Claude Code among them), `wait`, `now`, `log`, `notify` (the import's notice), `readAll` (how a file is brought over),
    `early` (runDetached's, for the result once what it read is in), and the rule's options, as askAgain is given them. Nothing
    is asked of Claude, and nothing written, when:
    - this Mac's readings are off, at the start or after a wait for the import (its settings are read again then);
    - the record is not the answer it was started for (notAsAnswered: read already for this answer among them, or for a session,
      for this ask of its teachings), at the start, after each look while it waits, and right before each try of the call; or a
      newer record is still coming over;
    - for a session, right before each try of the call, by this Mac's settings read again: its training gate is off or lapsed,
      the claude command is signed in to another account than the one Jason checked, or its readings are off (the gate and
      `teachings` checked them before; this is the backstop);
    - Claude Code is not on this Mac; the import still holds the video (importHold), for a raw reading, and for a finished one
      that would replace a file the import put in (reels.json, its suggestions), and that does not clear within READ_HOLD_MS,
      or clears only by a person's hand; or a file it reads is not on this Mac and cannot be brought over.
    When Claude cannot be asked, nothing is written either. Otherwise what it read goes in by the rule, with the record; then the
    rough cut opens, the notice is posted and the result is written early, before the late check is waited for. */
export async function readEpisodeNow(ctx, found, deps) {
  const { kind, rev } = deps;
  const home = ctx.home;
  const log = deps.log || (() => {});
  const wait = deps.wait || ((ms_) => new Promise((done) => setTimeout(done, ms_)));
  const now = () => (deps.now || ctx.now)();
  const whole = deps.isWhole || ctx.isWhole || ((path) => isWhole(path));
  const stop = (why, next = "") => ({ ok: false, made: [], failed: [why], next });
  /** Whether this Mac's readings are off, as its settings say now: read again from its disk, or as the run was given them. */
  const readingsOff = () => (readSettings(home).settings || ctx.settings).readings === false;
  if (ctx.settings.readings === false) return stop(READINGS_OFF);
  const session = kind === "session";
  const asWas = { kind, rev, machine: ctx.machine, home };
  let record = found.record;
  const first = notAsAnswered(record, asWas);
  if (first) return stop(first);
  const name = shownName(record);
  const named = `${name} (${shortId(record.id)})`;
  if (!deps.tools.claude) return stop("Claude Code is not installed on this Mac, so Claude cannot read it.");
  /** The record read again: { record } while it is still the answer, and no newer one is coming over; or { why }. */
  const again = () => {
    const read = readEpisode(found.folder);
    if (!read.record) return { why: `The record of ${name} cannot be read now (${String(read.why).replace(/\.$/, "")}), so Claude did not read it.` };
    if (read.newer) return { why: `${name} was written by a newer brimm-video meanwhile, so Claude did not read it. Ask Jason to update this Mac.` };
    // A record file above the one read, which Dropbox is still bringing over, may be another Mac's answer, or its session mark.
    if ((recordNumbers(found.folder)[0] || 0) > read.record.rev) return { why: `Dropbox is still bringing a newer record of ${name} over, so Claude did not read it.` };
    const why = notAsAnswered(read.record, asWas);
    return why ? { why } : { record: read.record };
  };
  const video = record.video.file;
  const stem = basename(video, extname(video));

  // A reading that replaces a file the import's late check looks at waits while that check is still to come, and asks nothing
  // and writes nothing meanwhile: a raw reading always (the plan, the cut log, the rough cut's captions), and a finished one when
  // the import put in a reels.json or suggestions (as the full import does).
  const replaces = kind === "raw" || (kind === "finished" && [REELS_FILE, `${stem}.reel-suggestions.txt`].some((rel) => existsSync(join(found.folder, rel))));
  if (replaces) {
    let waited = 0;
    for (;;) {
      const hold = importHold({ root: ctx.root, home, machine: ctx.machine, record, now: now() });
      if (!hold.why) break;
      if (!hold.waits || waited >= READ_HOLD_MS) return stop(hold.why);
      if (!waited) log(`${named}: Claude reads it once the import has checked its copies.`);
      await wait(READ_LOOK_MS);
      waited += READ_LOOK_MS;
      const read = again();
      if (read.why) return stop(read.why);
      record = read.record;
    }
    if (readingsOff()) return stop(READINGS_OFF);
  }

  // The files it reads: the plan, for a raw video the video, its captions, its words and its cut log, which the rough cut, its
  // timeline and what is set aside are made of, and for a session the meeting's own transcript, when there is one, and the
  // teachings an earlier reading wrote, which it sets aside. One Dropbox has not brought over yet is read through, so that it
  // does. A session's files are said by what they are, never by name.
  const planRel = `${stem}.cut-plan.json`;
  const there = (rel) => existsSync(join(found.folder, rel));
  const earlier = session ? earlierTeachings(record) : [];
  const need = session ? [...seenFrom(record), ...earlier.filter(there)] : [planRel, ...(kind === "raw" ? [video, `${stem}.srt`, ...[`${stem}.words.json`, `${stem}.cut-plan.txt`].filter(there)] : [])];
  const said = (rel) => (!session ? rel : rel === planOf(record) ? "its cut plan" : earlier.includes(rel) ? "its earlier teachings" : "the meeting's own transcript");
  const gone = need.find((rel) => !there(rel));
  if (gone) return stop(session ? `${capital(said(gone))} is not in the episode's folder, so Claude did not read ${name}.` : `${gone} is not in the episode's folder, so Claude did not read ${name}.`);
  const bring = deps.readAll || readThrough;
  for (const rel of need.filter((r) => !whole(join(found.folder, r)))) {
    try {
      await bring(join(found.folder, rel));
    } catch (e) {
      // It is said below, with the others that are not here.
    }
  }
  const coming = need.filter((rel) => !whole(join(found.folder, rel)));
  if (coming.length) return stop(`Dropbox is still bringing ${coming.map(said).join(", ")} over to this Mac, so Claude did not read ${name}.`, session ? AGAIN_TEACHINGS : AGAIN);
  let plan;
  // What a session's names are checked against, and the meeting's speakers, its own replaced (teachings.js sessionSeen).
  let seen = null;
  if (session) {
    seen = sessionSeen(found.folder, record, { host: ctx.settings.host });
    if (seen.why) return stop(`${capital(seen.why)}, so Claude did not read ${name}.`);
    plan = seen.plan;
  } else {
    try {
      plan = JSON.parse(readFileSync(join(found.folder, planRel), "utf8"));
      if (!isObject(plan) || !Array.isArray(plan.phrases) || !Array.isArray(plan.ranges)) throw new Error("it is not a cut plan this tool wrote");
    } catch (e) {
      return stop(`The cut plan of ${name} cannot be read (${e instanceof SyntaxError ? "it is not JSON" : e.code || e.message}), so Claude did not read it.`);
    }
  }
  const facts = isObject(plan.facts) ? plan.facts : {};
  const duration = Number.isFinite(facts.duration) ? facts.duration : record.video.seconds;
  // A session is shown no file name, and the meeting's speakers only when one but her was replaced: the same `about` reads it.
  const about = session ? { duration, ...(seen.speakers ? { speakers: seen.speakers } : {}) } : { video, duration };
  const request = requestFor(kind, plan, about);
  /** For a session, why it may not be read now, by this Mac's settings read again and the account it is signed in to, or "".
      Settings that cannot be read now are a refusal: nothing says the gate is still on. */
  const sessionWhy = (account) => {
    if (!session) return "";
    const settings = readSettings(home).settings;
    if (!settings) return `This Mac's settings cannot be read now, so Claude did not read ${name}: ask Jason.`;
    return teachingsWhy(settings, now()) || accountWhy(account, settings) || (settings.readings === false ? READINGS_OFF : "");
  };
  const work = join(runsFolder(home), `read-${process.pid}-${now()}`);
  mkdirSync(work, { recursive: true });
  try {
    // The account first: the record is read again after it, right before each try of the call.
    let account = await accountOf(deps, join(work, "account"));
    log(`${named}: Claude is asked to read it as ${KIND_SAID[kind]}.`);
    let read = null;
    let why = "";
    for (let n = 1; n <= CLAUDE_TRIES && !read; n++) {
      if (n > 1) await wait(AGAIN_MS);
      // A session's account is read again before each try after the first: it is checked right before every call.
      if (session && n > 1) account = await accountOf(deps, join(work, "account"));
      const gate = sessionWhy(account);
      if (gate) return stop(gate);
      const still = again();
      if (still.why) return stop(still.why);
      record = still.record;
      const got = await askOnce(request, join(work, `claude-${n}`), deps, { read: (reply) => readReading(kind, reply, about), nothing: nothingRead, quote: false }).catch((e) => ({ why: `the work stopped (${(e && e.code) || "an error"})` }));
      if (got.read) read = got.read;
      else {
        why = got.why;
        log(`${named}: Claude could not be asked (${why})${n < CLAUDE_TRIES ? ". It is asked once more." : "."}`);
      }
    }
    if (!read) return stop(`Claude could not read it: ${sentence(why)}`, session ? AGAIN_TEACHINGS : AGAIN);
    const at = localStamp(new Date(now()));
    log(`${named}: Claude has read it.`);
    if (session) return await writtenSession(ctx, found, deps, { record, read, at, account, work, named, name, log, now, seen });
    return await written(ctx, found, deps, { kind, record, plan, facts, read, at, account, work, named, name, stem, log, now });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** What a reading writes of what Claude read (`read`), by the rule, and the result it ends with: see readEpisodeNow. */
async function written(ctx, found, deps, { kind, record, plan, facts, read, at, account, work, named, name, stem, log, now }) {
  const home = ctx.home;
  const folder = found.folder;
  const files = filesOf(work, { name: named, hold: true, log });
  const madeAt = [];
  const text = (rel, body) => {
    const to = join(folder, rel);
    files.text(to, body);
    madeAt.push(to);
  };
  const made = [];
  const failed = [];
  // What of Claude's reply could not be used: said in the files she reads, and counted, never quoted, in the result.
  let unused = [...read.problems];
  let candidates = [];
  let render = null;
  let planLast = "";
  const reeled = kind === "finished" || kind === "raw";
  // Numbers are never given twice under one video's id: a reading numbers on from the highest ever given (finish.js).
  const base = highestNumberOf(ctx.root, record, folder);
  const number = (items) => {
    const out = [];
    for (const item of items) {
      const candidate = facts.height ? candidateOf(item, base + out.length + 1, facts) : null;
      if (candidate) out.push({ candidate, item });
      else if (facts.height) unused.push("A suggestion was left out: it comes to less than one picture.");
    }
    return out;
  };

  if (kind === "finished") {
    const stretched = wholeStretches(plan, read.suggestions);
    if (stretched.left) unused.push(`${counted(stretched.left, "suggestion")} named phrases the plan does not have, or ended before it started, and ${stretched.left === 1 ? "was" : "were"} left out.`);
    candidates = number(stretched.items).map((n) => n.candidate);
  }

  if (kind === "raw") {
    // The import's plan, the rules' alone, and its cut log are set aside in history/ by the rule, put in before the reading
    // replaces them, so that a raw reading made again can start from them.
    // A rules' plan that `kind … --again` put back from history/ is kept there already, whole: it is not set aside twice.
    const rules = plan.claude ? null : rulesPlanKept(folder, stem);
    if (!plan.claude && !(rules && rules.text === readFileSync(join(folder, `${stem}.cut-plan.json`), "utf8"))) {
      const aside = `${localStamp(new Date(now())).replace(/:/g, "-")} ${stem}`;
      for (const ending of [".cut-plan.json", ".cut-plan.txt"]) {
        const at_ = join(folder, `${stem}${ending}`);
        if (existsSync(at_)) text(`history/${aside}${ending}`, readFileSync(at_, "utf8"));
      }
    }
    // The plan changed by Claude's decisions with the pauses the import kept (pausesOfPlan), so a cut falls where the rules'
    // cuts fall, and its suggestions taken from the plan as it then is.
    const pauses = pausesOfPlan(plan);
    const applied = applyDecisions(plan, read.decisions, pauses);
    const next = applied.plan;
    const picked = clipRanges(next, read.suggestions, pauses);
    unused = [...unused, ...applied.ignored, ...picked.ignored.map(claudesClip)];
    const points = new Map(read.suggestions.map((s) => [s.n, s.point]));
    const kept = number(picked.clips.map((clip) => ({ ranges: clip.ranges, phrases: next.phrases.filter((p) => p.keep && p.start < clip.end && p.end > clip.start), why: clip.why, point: points.get(clip.n), hook: clip.hook, check: clip.check, clip })));
    candidates = kept.map((k) => k.candidate);
    const clips = kept.map((k) => ({ ...k.item.clip, n: k.candidate.n }));
    const notesFile = `${stem}.edit-notes.txt`;
    const changes = (next.changes || []).length;
    const spans = keptSpans(next.ranges, roughRate(facts));
    const roughSrt = roughCaptions(next.phrases, spans);
    // The plan as the import writes it: it keeps the pauses, and what Claude made of it, its ideas for graphics among them,
    // which the timeline marks.
    const claude = { decisions: read.decisions, graphics: read.graphics, ignored: unused, clips: clips.map((clip) => ({ ...clip, files: [] })) };
    const readPlan = { ...plan, phrases: next.phrases, ranges: next.ranges, kept: next.kept, cut: next.cut, by: next.by || plan.by || "rules", ...(next.changes ? { changes: next.changes } : {}), claude };
    text(notesFile, notesText({ notes: read.notes, graphics: read.graphics, problems: unused }, next, clips));
    text(`${stem}.rough-cut.srt`, roughSrt);
    text(`${stem}.rough-cut.transcript.txt`, stampedText(roughSrt));
    text(`${stem}.cut-plan.txt`, planText(next, readPlanNote(changes, notesFile)));
    // The rough cut, rendered as version 0, and the timeline it is made from, as the main video's timeline is built (timelineFor).
    const v0 = timelineFile({ part: "main", v: 0 });
    const timeline = await timelineFor({ folder, name: found.name, record }, "main", ctx, { build: true, plan: readPlan }).catch((e) => ({ why: `the work stopped (${(e && e.code) || "an error"})` }));
    if (timeline.xml) {
      text(v0, timeline.xml);
      const rendered = await renderRough(ctx, found, deps, { record, plan: next, facts, work, named, name, log, now });
      if (rendered.why) failed.push(`The rough cut could not be made: ${sentence(rendered.why)}`);
      else render = { ...rendered, file: v0 };
    } else failed.push(`The rough cut could not be made: its timeline could not be built (${String(timeline.why || `Dropbox is still bringing ${timeline.coming} over`).replace(/\.$/, "")}).`);
    // The plan is put in last of the files, as the import writes it last.
    planLast = JSON.stringify(readPlan, null, 2) + "\n";
    made.push("the cut plan as Claude read it", "Claude's notes", ...(render ? ["the rough cut, version 0"] : []));
  }

  if (reeled) {
    text(`${stem}.reel-suggestions.txt`, suggestionsText({ name, kind, candidates, problems: unused, at }));
    const none = !facts.height ? "it has no picture" : "Claude suggested no stretch that stands alone";
    text(REELS_FILE, JSON.stringify(reelsFile({ video: record.video.file, by: "read", made: at, candidates, highest: base, ...(candidates.length ? {} : { none }) }), null, 2) + "\n");
    if (candidates.length) made.push(candidates.length === 1 ? `Reel suggestion ${candidates[0].n}` : `Reel suggestions ${candidates[0].n} to ${candidates[candidates.length - 1].n}`);
  }
  if (planLast) text(`${stem}.cut-plan.json`, planLast);
  if (kind === "short video") made.push("a line on what the clip is");
  const offered = (r) => offersFor(read.spellings, r);
  const spellingCount = offered(record).length;
  if (spellingCount) made.push(`${counted(spellingCount, "spelling")} to check`);
  if (unused.length) failed.push(`${counted(unused.length, "part")} of Claude's reply could not be used${reeled ? `: ${stem}.reel-suggestions.txt says which` : ""}.`);

  // Version 0 of the main video is the rough cut, rendered, made from edit/main.v0.fcpxml; it counts as shown once it has opened
  // in QuickTime Player, which it does as soon as the record holding it is in (onPut), at the moment `opened` says.
  const change = (r) => ({
    ...r,
    ...(reeled ? { reels: [...(Array.isArray(r.reels) ? r.reels : []).filter((reel) => reel.status !== "candidate"), ...reelEntries(candidates)] } : {}),
    offers: { ...(isObject(r.offers) ? r.offers : {}), spellings: offered(r) },
    reading: { kind, model: CLAUDE_MODEL, at, on: ctx.machine, account, outcome: "read", ...(kind === "short video" ? { about: read.about } : {}) },
    ...(render ? { main: { ...r.main, pushed: [{ v: 0, how: "render", at: render.at, on: ctx.machine, file: render.file, opened: localStamp(new Date(now())) }, ...(Array.isArray(r.main.pushed) ? r.main.pushed : []).filter((p) => p.v !== 0)] } } : {})
  });
  const okNow = () => !failed.some((f) => f.startsWith("The rough cut"));
  // Once what it read is in: the rough cut opens, the notice goes out, and the result is written early, before the late check.
  const onPut = () => {
    if (render) {
      try {
        ctx.openApp("QuickTime Player", render.to);
      } catch (e) {
        failed.push(`The rough cut could not be opened in QuickTime Player: ${sentence(e.message || e)}`);
      }
    }
    try {
      (deps.notify || (() => {}))(noticeOf(name));
    } catch (e) {
      // A notice is a courtesy: the result says the same.
    }
    if (deps.early) deps.early({ ok: okNow(), made, failed: [...failed], next: FOUND });
  };
  const file = record.video.file;
  // An iPhone clip's reading changes the record alone: it is written by the rule, as a command that writes only the record writes
  // it, on the record the call was made from.
  if (!madeAt.length) {
    try {
      const writer = { commit: deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine };
      const opts = { ...(deps.clone ? { clone: deps.clone } : {}), ...(deps.sameDisk ? { sameDisk: deps.sameDisk } : {}) };
      writeEpisode(folder, change(record), { expectRev: record.rev, writeText: textWriter({ work: join(work, "record"), ...opts }), writer, home });
    } catch (e) {
      const why = e.code === "CHANGED" ? "this episode changed while Claude read it" : String(e.message).replace(/\.$/, "");
      return { ok: false, made: [], failed: [...failed, `Nothing was written: ${why}.`], next: AGAIN };
    }
    try {
      (deps.notify || (() => {}))(noticeOf(name));
    } catch (e) {
      // A notice is a courtesy: the result says the same.
    }
    log(`${named}: read.`);
    return { ok: true, made, failed, next: FOUND };
  }
  // The rule's own lines name the video's file first: the reading names the episode by its name and id.
  const intoLog = (line) => log(line.startsWith(`${file}: `) ? `${named}: ${line.slice(file.length + 2)}` : `${named}: ${line}`);
  const into = await intoEpisode(join(folder, file), madeAt, work, { ...deps, home, settings: ctx.settings, files, log: intoLog }, { change, expectRev: record.rev, onPut });
  const problems = [...into.problems, ...into.notes].map(sentence);
  if (!into.put) {
    // Nothing of it is in the episode, nor opened: the rough cut stays on this Mac, named as the episode is named.
    const kept = render ? [`The rough cut of ${name} is kept on this Mac, in BRIMM Video Work, as "${basename(render.to)}".`] : [];
    return { ok: false, made: [], failed: [...failed, ...problems, ...kept], next: AGAIN };
  }
  log(`${named}: read.`);
  return { ok: !into.problems.length && okNow(), made, failed: [...failed, ...problems], next: FOUND };
}

/** What a session's reading writes of what Claude read (`read`), by the rule, and the result it ends with (see readEpisodeNow):
    - every list's numbers (the place in Claude's list) offset together, each Reel idea's principle with them, to number on from
      the highest number ever given to the video (highestNumberOf), so that no number is given twice under its id;
    - every field that holds a name brimm-video can see taken out (sessions.js checkNames, with `seen.names`), and only what is
      left kept: the teachings file `<name>.principles.json` (teachings.js TEACHINGS_FORMAT), which holds her items, what was taken
      out (by field and why, never the name) and what of the reply could not be used, and the copies she reads beside it,
      `<name>.principles.txt` and `<name>.reel-ideas.txt`, all named by the session's name (teachingsFiles), never by its file's;
    - the teachings an earlier reading wrote, set aside into history/ whole first, by the rule, in the same put;
    - the record: its reading, which names the teachings file, and no decision of hers any more, since those were of the items
      set aside. No reels.json, no Reel suggestions and no spellings: a session has none.
    The result counts what it kept, says each field taken out as "<field>: <why>." and the line that the capitalised words were
    not checked (namesSkipped), and counts what could not be used: nothing of the reply. */
async function writtenSession(ctx, found, deps, { record, read, at, account, work, named, name, log, now, seen }) {
  const folder = found.folder;
  const files = filesOf(work, { name: named, hold: true, log });
  const madeAt = [];
  const text = (rel, body) => {
    const to = join(folder, rel);
    files.text(to, body);
    madeAt.push(to);
  };
  // Numbers are never given twice under one video's id: every list numbers on from the highest ever given (finish.js), and a
  // Reel idea names the principle it shows by that principle's number.
  const base = highestNumberOf(ctx.root, record, folder);
  const on = (n) => n + base;
  const numbered = {
    principles: read.principles.map((p) => ({ ...p, n: on(p.n) })),
    recurringPrinciples: read.recurringPrinciples.map((r) => ({ ...r, n: on(r.n) })),
    reelIdeas: read.reelIdeas.map((r) => ({ ...r, n: on(r.n), principle: Number.isInteger(r.principle) ? on(r.principle) : null }))
  };
  const { kept, dropped } = checkNames(numbered, seen.names);
  const names = teachingsFiles(record);
  // The teachings an earlier reading of it wrote are set aside in history/ by the rule, whole (the reading brought them over
  // first), put in before they are replaced.
  const aside = localStamp(new Date(now())).replace(/:/g, "-");
  for (const rel of earlierTeachings(record)) {
    const was = join(folder, rel);
    if (existsSync(was)) text(`history/${aside} ${rel}`, readFileSync(was, "utf8"));
  }
  const teachings = { format: TEACHINGS_FORMAT, version: 1, made: at, principles: kept.principles, recurringPrinciples: kept.recurringPrinciples, reelIdeas: kept.reelIdeas, dropped, skipped: seen.skipped, problems: read.problems };
  text(names.json, JSON.stringify(teachings, null, 2) + "\n");
  text(names.txt, teachingsText(name, at.slice(0, 10), teachings));
  text(names.ideas, ideasText(name, at.slice(0, 10), teachings));
  const made = [counted(kept.principles.length, "principle"), counted(kept.recurringPrinciples.length, "recurring principle"), counted(kept.reelIdeas.length, "Reel idea")];
  const failed = [
    ...dropped.map((d) => `${d.field}: ${d.why}.`),
    ...(seen.skipped ? [seen.skipped] : []),
    ...(read.problems.length ? [`${counted(read.problems.length, "part")} of Claude's reply could not be used: ${names.txt} says which.`] : [])
  ];
  // Her decisions were of the items it replaces: they are let go with them.
  const change = (r) => {
    const { decided, edits, ...mark } = isObject(r.session) ? r.session : {};
    return { ...r, session: mark, reading: { kind: "session", model: CLAUDE_MODEL, at, on: ctx.machine, account, outcome: "read", principles: names.json } };
  };
  const onPut = () => {
    try {
      (deps.notify || (() => {}))(noticeOf(name));
    } catch (e) {
      // A notice is a courtesy: the result says the same.
    }
    if (deps.early) deps.early({ ok: true, made, failed: [...failed], next: FOUND });
  };
  // The rule's own lines name the video's file first: the reading names the session by its name and id.
  const file = record.video.file;
  const intoLog = (line) => log(line.startsWith(`${file}: `) ? `${named}: ${line.slice(file.length + 2)}` : `${named}: ${line}`);
  const into = await intoEpisode(join(folder, file), madeAt, work, { ...deps, home: ctx.home, settings: ctx.settings, files, log: intoLog }, { change, expectRev: record.rev, onPut });
  const problems = [...into.problems, ...into.notes].map(sentence);
  if (!into.put) {
    // Her answer of the transcript only, given while Claude read it, is why: nothing it read is kept, as she asked.
    const now_ = readEpisode(folder).record;
    if (now_ && isObject(now_.session) && now_.session.teachings === "transcript only") return { ok: false, made: [], failed: [`You asked for the transcript only of ${name} while Claude read it, so nothing it read was kept.`], next: "" };
    return { ok: false, made: [], failed: [...problems], next: AGAIN_TEACHINGS };
  }
  log(`${named}: read.`);
  return { ok: !into.problems.length, made, failed: [...failed, ...problems], next: FOUND };
}

/** Render a raw video's rough cut on this Mac, as version 0 of its main video: today's ffmpeg rough cut (unedited.js roughCut,
    cuts.js roughCutArgs) of the plan `plan`, into BRIMM Video Work, `<folder>/renders/<name> – version 0.mp4`, never into
    Dropbox. ffprobe is asked first which streams the video has, and whether it is the video the plan was made of. It is opened
    once the reading is in the episode, not here. Resolves { at, to } or { why }. */
async function renderRough(ctx, found, deps, { record, plan, facts, work, named, name, log, now }) {
  const video = join(found.folder, record.video.file);
  try {
    const probed = join(work, "facts.json");
    const probe = await deps.run(deps.tools.ffprobe, probeArgs(video, probed));
    const printed = probe.code === 0 && existsSync(probed) ? readFileSync(probed, "utf8") : "";
    const seen = printed ? factsOf(printed) : null;
    if (!seen) return { why: `${record.video.file} could not be read (${lastLine(probe.stderr)})` };
    if (!sameVideo(facts, seen)) return { why: `${record.video.file} is not the video its cut plan was made of` };
    const to = join(episodeWork(ctx.home, found.name), "renders", `${fileSafe(name)} – version 0.mp4`);
    mkdirSync(dirname(to), { recursive: true });
    log(`${named}: making the rough cut, version 0.`);
    const files = filesOf(join(work, "render"), { name: named, log });
    const why = await roughCut(video, to, { plan, facts, spans: keptSpans(plan.ranges, roughRate(facts)), streams: streamsOf(printed) }, { ...deps, files, log: () => {}, progress: deps.progress || noProgress });
    if (why) return { why };
    return { at: localStamp(new Date(now())), to };
  } catch (e) {
    return { why: `the work stopped (${(e && e.code) || "an error"})` };
  }
}
