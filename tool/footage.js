// Footage for a planned video (design 2026-11-04, H5; PR H5a). A planned episode (plan.js) waits for its footage, which Sallie drops in her
// drop folder like any video. A dropped video that is footage for a plan is answered so, by her cards and `footage`, and is then a PART of
// the plan: the video's own record, with no kind, the answer "part" and `partOf` (episode.js): which plan it is for, whether it is talking
// to the camera, a screen recording or b-roll, which shot of the plan's shot list a screen recording or b-roll shows, and whether it shows a
// client, a client's name or their work. A plan's record is never written for a part. A part is found by looking through Episodes for it.
//
// This is safety code, in four rules:
//   - Her cards answer a part (receipts.js): on a Mac whose lock is open, under Claude Code, `footage` writes nothing without her receipts of
//     the planned card and of the part card. It never takes a Zoom download, a video that holds a session's words, or one held beside a session.
//   - A part that shows a client goes into no project until the plan holds that client's agreement for it (`planned.consent`, mayGoIn). The
//     agreement is hers alone: a dialog Claude cannot press, whose answer goes to agreements.txt on this Mac and nowhere else. The record
//     holds the part's id, its label and the day, and nothing she typed.
//   - A part is found by its id, never by its file, whose name may be a client's: a plan's record is not gated (gate.js), so nothing in it
//     may hold a name that is. `consent` names a part by its id.
//   - A part is kept out of every list (episodes, the guide) and is refused by `kind` and `leave`: it is taken back by `footage … none`
//     until its plan is filmed, and not after.
//
// edit.js is only the wiring: it finds the video through the gate, holds the answer lock, and gives the commands here the few things of its
// own they need (the `kit`: how it saves a record, asks on a dialog, writes its log, and says what it says of a record it cannot read). Nothing
// here posts, sends or publishes anything.
//
// plan.js imports this file, to say the footage of a plan and to note a client's agreement; this file reads a plan's title (textArg) and says
// shots as plan.js does through sentences.js, a leaf that neither needs to have been read first (they were plan.js's own until PR H5b).
import { appendFileSync, chmodSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PART_KINDS, heldElsewhere, isFromPlan, isPart, isPlannedRecord, kindOf, localStamp, readEpisode, recordNumbers, shownName, undone, acceptRev } from "./episode.js";
import { episodesFolder, episodeWork } from "./settings.js";
import { runningCommand, startDetached } from "./detached.js";
import { linksOf, matchedSession } from "./finish.js";
import { gatedName } from "./gate.js";
import { isSeenLine, isZoomName, withoutNames } from "./kinds.js";
import { lockFor } from "./loosened.js";
import { NO_RECEIPT, expectedFootage, expectedVoiceover, footageOption, notSessionCardOf, partCardOf, plannedCardOf, receiptWhy, voiceoverOption } from "./receipts.js";
import { localDay } from "./shared/text.js";
import { SHOT_SAID, counted, dayText, joined, plainly, sentence, textArg } from "./sentences.js";

export { PART_KINDS };

/** The most plans the planned card offers, newest first. */
const MOST_OFFERS = 3;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};

// --- The plans a dropped video may be for ---

/** Whether a record is a plan that waits for its footage, whole and set: a script (an explainer has no footage), planned in full (its
    guide, shot list and teleprompter script are made: `planned.set`), not yet filmed (`planned.filmed`, PR H5b) and not dropped. */
const waitsForFootage = (record) => isPlannedRecord(record) && record.planned.route === "script" && !record.archived && record.planned.filmed === null;

/** Whether a record is a plan made from its footage that still takes footage (PR H5b): the join made its talking parts its video (episode.js
    isFromPlan), and until it is handed off a screen recording or b-roll may still be added to it, to be moved into its project. A talking part may
    not: the plan is made from its talking parts already. */
const joinedPlan = (record) => isFromPlan(record) && record.planned.route === "script" && !record.archived && !record.finished;

/** Whether a plan takes more footage: it waits for its footage, or it is made from it and not handed off yet. */
const takesFootage = (record) => waitsForFootage(record) || joinedPlan(record);

/** Whether a record is an explainer that waits for its voice (PR H6): a plan whose route is an explainer, whose voice is hers or not chosen yet (a
    HeyGen voice is made in the plan's HyperFrames project, and no recording is its voiceover), not filmed and not dropped. */
const waitsForVoiceover = (record) => isPlannedRecord(record) && record.planned.route === "explainer" && record.planned.voice !== "heygen" && !record.archived && record.planned.filmed === null;

/** The moment a plan was planned, in milliseconds, for ordering: 0 for one that cannot be read. */
const plannedAt = (record) => {
  const at = Date.parse(record.planned.at);
  return Number.isFinite(at) ? at : 0;
};

/** The plans a video may be for, from the records `records` (the plans among them are looked at, every other record passed over): each as
    { record, option }, the plan's record and its answer on the planned card, newest first by the moment it was planned, and at most three. A plan
    is named as every line names it (shownName), the name she gave it or its title. Which plans, and which answer, is by the video:
    - a video with a picture (`picture` true) is offered a script whose package is set (a plan with no shot list yet has nothing to show), not
      filmed and not dropped, and (PR H5b) a video made from a plan with no hand-off yet (joinedPlan), which takes b-roll and a screen recording
      still (`footage` refuses it a talking part), as Footage for its title (receipts.js footageOption). `sound` is whether the video has any;
      a picture with none is footage all the same (b-roll and a screen recording go in mute);
    - a video of sound alone (`picture` false, and sound) is offered each explainer whose voice is hers or not chosen yet (waitsForVoiceover),
      whose package is set, as The voiceover for its title (receipts.js voiceoverOption) (PR H6). A HeyGen explainer is offered to nothing;
    - a video the import could not read (`picture` null), and a file with no picture and no sound, are offered none. */
export function plannedOffers(records, { picture = false, sound = true } = {}) {
  if (!Array.isArray(records)) return [];
  const aVoice = picture === false && sound !== false;
  if (picture !== true && !aVoice) return [];
  return records
    .filter((record) => (aVoice ? waitsForVoiceover(record) : takesFootage(record)) && record.planned.set !== null)
    .map((record, order) => ({ record, order }))
    .sort((a, b) => plannedAt(b.record) - plannedAt(a.record) || a.order - b.order)
    .slice(0, MOST_OFFERS)
    .map(({ record }) => ({ record, option: (aVoice ? voiceoverOption : footageOption)(shownName(record)) }));
}

/** The episodes in Episodes, each as { name, folder, record }, by the record in force of each: the newest whole record, read past any
    conflicted copy Dropbox has kept, as plan.js reads the plans. An episode with no whole record, one a newer brimm-video wrote and a name
    that starts with a dot (the folder of the import's status files) are passed over. [] when Episodes cannot be read. With `newer`, one a newer
    brimm-video wrote is listed too, flagged `newer: true`, its record as this brimm-video can read it (the id, the rev and little more): it is
    for a caller that makes something of a part and must know of one it cannot use (partsOf). */
function episodesIn(root, { newer = false } = {}) {
  const episodes = episodesFolder(root);
  let names = [];
  try {
    names = readdirSync(episodes).filter((name) => !name.startsWith(".")).sort();
  } catch (e) {
    return [];
  }
  const found = [];
  for (const name of names) {
    const folder = join(episodes, name);
    const read = readEpisode(folder, { pastCopies: true });
    if (!read.record) continue;
    if (!read.newer) found.push({ name, folder, record: read.record });
    else if (newer) found.push({ name, folder, record: read.record, newer: true });
  }
  return found;
}

/** Every plan in Episodes, as { name, folder, record }: a planned record (episode.js isPlannedRecord), whatever its state, and (PR H5b) a plan
    made its video by the join (isFromPlan), which a part still names by its id. */
export const plansIn = (root) => episodesIn(root).filter(({ record }) => isPlannedRecord(record) || isFromPlan(record));

/** The parts of the plan with the id `id`, as { name, folder, record }: the dropped videos answered as footage for it (episode.js isPart),
    by their records in force, whole and not archived, in the order they were answered. A plan's record is never written for a part. A
    part in a conflicted episode is read past its copies, as every record in force is: whoever uses a part to make something checks that
    its folder is not conflicted (mayBeUsed, partHeld). With `newer`, a part whose record a newer brimm-video wrote is listed too (flagged
    `newer: true`, found by the plan id its record names), last of the answered ones, so that a caller that makes something of the parts can
    refuse it and say which it is; a list for a person (`plan "<planned>"`, the guide) never has it. */
export function partsOf(root, id, { newer = false } = {}) {
  return partsAmong(episodesIn(root, { newer }), id);
}

/** The parts of the plan with the id `id` among `episodes`, as episodesIn gives them: partsOf, for a caller that has read Episodes already. A
    record a newer brimm-video wrote (`newer: true`) is a part of the plan when its record names it as one: a `partOf` with the plan's id. */
function partsAmong(episodes, id) {
  const at = ({ record }) => {
    const answered = Date.parse(record.answer?.at);
    return Number.isFinite(answered) ? answered : 0;
  };
  const aPart = (entry) => (entry.newer === true ? isObject(entry.record.partOf) && entry.record.partOf.id === id : isPart(entry.record) && entry.record.partOf.id === id);
  return episodes
    .filter((entry) => aPart(entry) && !entry.record.archived)
    .sort((a, b) => Number(a.newer === true) - Number(b.newer === true) || at(a) - at(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** The parts of any plan from one look at Episodes: a function of a plan's id that says what partsOf says, reading Episodes when it is first
    asked and never again. The guide asks for every plan of a pass, and a pass is one `guide`, one look of `guide wait` (every 5 seconds) or one
    of `guide … tell` (every 15): a plan each reading every record of Episodes would make the cost of a pass the plans' number of times as much.
    It is made for a pass and let go of with it, so that the next pass looks again. */
export function partsReader(root) {
  let episodes = null;
  return (id) => partsAmong((episodes ??= episodesIn(root)), id);
}

/** Whether a part may go into a project: it shows no client, or the plan's `planned` holds a client's agreement for its id (`consent`). It
    fails closed: only a part that plainly shows no client (`client` is false) goes in without an agreement, and an agreement counts only as
    a { id } in a list of them. `part` is one of partsOf's, { name, folder, record }. */
export function mayGoIn(part, planned) {
  const record = isObject(part) ? part.record : null;
  if (!isPart(record)) return false;
  if (record.partOf.client === false) return true;
  const consent = isObject(planned) && Array.isArray(planned.consent) ? planned.consent : [];
  return consent.some((one) => isObject(one) && one.id === record.id);
}

/** A part as every line names it: by its label, which names it as `episodes` listed it and never by its file, or by its short id when it has none. */
export const labelOf = (part) => (typeof part?.record?.label === "string" && part.record.label !== "" ? part.record.label : shownName(part?.record));

/** Why a part must not be used to make anything, or null when its episode is as its record in force says (PR H5b, ruling 1). `mayGoIn` judges
    the record in force, which partsOf reads past any conflicted copy Dropbox kept, so that a part can be listed; but a conflicted copy may
    say what the record in force does not (that the part shows a client), and nothing is made of a part until a person has sorted that out. So
    a part is held when its episode's folder holds a conflicted copy of any file (episode.js conflictedCopies, as every command that names
    an episode refuses it), when its newest record is one a newer brimm-video wrote, and when its record cannot be read whole at all.
    { why: "conflicted" | "newer" | "unreadable", read, record }: `read` is readEpisode's of the folder, `record` the newer record. A part is
    one of partsOf's, { name, folder, record }, with `newer: true` when partsOf listed it as a newer brimm-video's.
    And a part is held as a session ({ why: "session", matched }) when it comes to be one after it was answered as a part (the final review, fix 1):
    the video its import matched (`answer.match`) is a client or group session not cleared (finish.js matchedSession: `matched` true), or the video is
    held beside one (linksOf sessionsBeside: it is a version of a session). The gate holds such a video as a session in everything else; here it is
    held in everything made of a part, whenever it is asked, not only when she answered it. `links` (finish.js linksOf) is read once by a caller that
    asks of many parts; without it Episodes is read for this part (its folder is in Episodes, so its root is two folders up). */
export function partHeld(part, links = null) {
  if (!isObject(part) || typeof part.folder !== "string") return { why: "unreadable" };
  if (part.newer === true) return { why: "newer", record: part.record };
  const read = readEpisode(part.folder);
  if (read.code === "CONFLICTED") return { why: "conflicted", read };
  if (!read.record) return { why: "unreadable", read };
  if (read.newer) return { why: "newer", read, record: read.record };
  const at = links ?? linksOf(dirname(dirname(part.folder)));
  if (matchedSession(at, read.record, { folder: part.folder })) return { why: "session", matched: true, read };
  if (at.sessionsBeside(read.record, part.folder).length > 0) return { why: "session", matched: false, read };
  return null;
}

/** Links to read Episodes with for the parts `parts`, once and only when first asked (partHeld's `links`), or null when none of them is listed. */
export function linksForParts(parts) {
  const one = (Array.isArray(parts) ? parts : []).find((part) => isObject(part) && typeof part.folder === "string");
  if (!one) return () => null;
  let links = null;
  return () => (links ??= linksOf(dirname(dirname(one.folder))));
}

/** Whether a part may be used to make something: a joined video, a copy of its footage with no sound, a file in a project's media/. It may when
    `mayGoIn` says it may (it shows no client, or the plan holds her client's agreement for it) and its episode is not held (partHeld). It is
    the question every consumer of a part asks (PR H5b); `mayGoIn` alone is for what is said of a part (the guide's "shows a client" line). */
export const mayBeUsed = (part, planned) => mayGoIn(part, planned) && partHeld(part) === null;

// --- What is said of the footage ---

/** A kind of part, counted: "2 talking parts", "1 screen recording", "3 b-roll clips". */
const COUNTED = { talking: ["talking part"], screen: ["screen recording"], "b-roll": ["b-roll clip"], voiceover: ["voiceover"] };

/** The parts of a plan counted by their kind, in a sentence's words: "2 talking parts, 1 screen recording and 2 b-roll clips". A kind with
    none is left out; "" for no part. */
export function footageCounts(parts) {
  return joined(PART_KINDS.map((kind) => [kind, parts.filter((part) => part.record.partOf.as === kind).length]).filter(([, n]) => n > 0).map(([kind, n]) => counted(n, ...COUNTED[kind])));
}

/** A part in the lines of `plan "<planned>"`: "Footage: <label>, talking to the camera.", "Footage: <label>, b-roll for shot 2." or
    "Footage: <label>, a screen recording for shot 4."; "Footage: <label>, the voiceover." for the voiceover of an explainer (PR H6); and for a
    part that shows a client " It shows a client, and waits for their agreement." or " It shows a client, who agreed on 4 November.", as the
    plan's `planned` holds. A part is named by its label. */
export function partLine(part, planned) {
  const { record } = part;
  const { as, shot, client } = record.partOf;
  const what = as === "voiceover" ? "the voiceover" : as === "talking" ? SHOT_SAID.talking : `${SHOT_SAID[as]} for shot ${shot}`;
  const agreed = client ? (Array.isArray(planned?.consent) ? planned.consent.find((one) => isObject(one) && one.id === record.id) : undefined) : undefined;
  const asked = !client ? "" : agreed ? ` It shows a client, who agreed on ${dayText(agreed.at)}.` : " It shows a client, and waits for their agreement.";
  return `Footage: ${record.label || shownName(record)}, ${what}.${asked}`;
}

// --- The words of the command ---

/** What `footage` is told, from the words after the command and its flags (edit.js flagsOf gives them, with --client and --shot taking a value
    each): { form: "set", video, planned, as, client, shot } for `footage "<video>" "<planned>" talking|screen|b-roll --client yes|no [--shot
    <n>]`, `client` true or false and `shot` a whole number from 1 or null; { form: "set", video, planned, as: "voiceover", client: null, shot:
    null, notASession } for `footage "<video>" "<planned>" voiceover [--not-a-session]` (PR H6), which takes no --client and no --shot, and
    `notASession` her answer on the not-a-session card; and { form: "none", video } for `footage "<video>" none`; or null for anything else,
    which is the help. The video and the plan are one word each, as every command has them. */
export function footageAsked(words, flags) {
  const [video, second, third, ...more] = words;
  const said = (word) => typeof word === "string" && word.trim() !== "";
  const only = (...allowed) => Object.keys(flags).every((flag) => allowed.includes(flag));
  if (!said(video) || !said(second)) return null;
  if (second === "none" && third === undefined) return only() ? { form: "none", video } : null;
  const as = typeof third === "string" ? third.toLowerCase() : "";
  if (more.length || !PART_KINDS.includes(as)) return null;
  if (as === "voiceover") return only("not-a-session") ? { form: "set", video, planned: second, as, client: null, shot: null, notASession: flags["not-a-session"] === true } : null;
  if (!only("client", "shot")) return null;
  const client = Array.isArray(flags.client) && flags.client.length === 1 ? String(flags.client[0]).trim().toLowerCase() : "";
  if (!["yes", "no"].includes(client)) return null;
  let shot = null;
  if (flags.shot !== undefined) {
    if (!Array.isArray(flags.shot) || flags.shot.length !== 1 || !/^[1-9]\d*$/.test(String(flags.shot[0]).trim())) return null;
    shot = Number(String(flags.shot[0]).trim());
  }
  return { form: "set", video, planned: second, as, client: client === "yes", shot };
}

// --- The cards under a video, and what a video is ---

/** Whether a video has a picture, as its record says what the import saw (answer.seen, answer.came): true; false for sound alone; null when
    the import could not say (ffprobe could not read the file, and what was seen is ""). */
export function pictureOf(record) {
  const answer = isObject(record) && isObject(record.answer) ? record.answer : {};
  if (answer.came === "sound" || (typeof answer.seen === "string" && answer.seen.startsWith("sound only"))) return false;
  return isSeenLine(answer.seen) ? true : null;
}

/** Whether a video came from Zoom, by how the import saw it come or by its file's name: a Zoom download is never footage. */
const fromZoom = (record) => (isObject(record.answer) && record.answer.came === "zoom") || (isObject(record.video) && isZoomName(record.video.file));

/** The line of the planned card for the video called `label` (receipts.js plannedCardOf), as `episodes` prints it, given the plans offered
    (plannedOffers): the card as JSON, which her skill asks as it is. */
const plannedLine = (label, offers) => `    Planned card: ${JSON.stringify(plannedCardOf({ label, offers }))}`;

/** The lines of the planned card and the part card for the video called `label` (receipts.js plannedCardOf, partCardOf), each as `episodes`
    prints it, given the plans offered (plannedOffers): one line each, as JSON, which her skill asks as it is. */
export const cardLines = (label, offers) => [plannedLine(label, offers), `    Part card: ${JSON.stringify(partCardOf({ label }))}`];

/** The cards `episodes` prints under the video waiting for her answer whose record is `record`, called `label`, as lines, or [] when a plan is not
    offered to it: it came from Zoom, it is `blocked` (its Maybe line is a session's, or it is held beside a session: edit.js says), the import
    could not say whether it has a picture, or no plan is offered to it among `records` (plannedOffers). A video with a picture is offered the
    scripts that wait for footage, and given the planned card and the part card; a video of sound alone (PR H6) is offered the explainers that wait
    for a voice, and given the planned card alone: a voiceover is asked no kind of shot and no client. */
export function footageCards({ record, label, records, blocked = false }) {
  if (blocked || !isObject(record) || !isObject(record.video) || fromZoom(record)) return [];
  const picture = pictureOf(record);
  if (picture === true) {
    const offers = plannedOffers(records, { picture: true, sound: record.video.sound !== false });
    return offers.length ? cardLines(label, offers) : [];
  }
  if (picture === false && record.video.sound !== false) {
    const offers = plannedOffers(records, { picture: false, sound: true });
    return offers.length ? [plannedLine(label, offers)] : [];
  }
  return [];
}

/** What `kind` and `leave` say of a part: it is footage for the plan called `title` (or for a planned video that is not on this Mac, when
    `title` is null), and is taken back first. */
export const partRefused = (name, title) => (title === null ? `${name} is footage for a planned video. Say "that's not footage" first.` : `${name} is footage for "${title}". Say "that's not footage for ${title}" first.`);

/** The title of the plan with the id `id`, as every line names it, or null when it is not on this Mac. */
export function planTitleOf(root, id) {
  const plan = plansIn(root).find(({ record }) => record.id === id);
  return plan ? shownName(plan.record) : null;
}

// --- footage "<video>" "<planned>" talking|screen|b-roll --client yes|no [--shot <n>], and footage "<video>" none ---

/** A kind of shot as a shot list is spoken of in a refusal that names a shot of that kind. */
const NOUN = { screen: "screen recording", "b-roll": "b-roll" };

/** The plans that wait for their footage and are called `said`: by the title they were made with or the name she gave them, in any case and
    spacing. The word as it was given comes first; with its codes turned (plan.js textArg) it is tried only when it fits none. */
function plansCalled(waiting, said) {
  const calledBy = (word) => waiting.filter(({ record }) => [record.planned.title, shownName(record)].some((known) => plainly(known) === plainly(word)));
  const fits = calledBy(said);
  const turned = textArg(said);
  return fits.length || turned === said ? fits : calledBy(turned);
}

/** The plan's title is hers, known to the chat, so a line that says it is not to lose it to the names of a video kept from the chat (a file
    named as the plan is, for one): it is kept in what `ctx.say` leaves alone. */
export function keepTitle(ctx, title) {
  if (ctx.hidden && Array.isArray(ctx.hidden.keep) && !ctx.hidden.keep.includes(title)) ctx.hidden.keep.push(title);
}

/** Why the video `record`, called `name`, cannot be footage, in plain words, or "": in this order, it came from Zoom; it holds most of the words
    of a client or group session (its match, or one of its versions is a session not cleared: edit.js's matchedSession and linksOf); it is
    answered already; it is footage for a plan already; it is sound alone, or the import could not read it. For the voiceover of an explainer
    (`voiceover`, PR H6) it is the other way about at the end: it is sound alone, or it has a picture (a voiceover is sound alone), or the import
    could not read it. */
function videoWhy(ctx, found, record, name, plans, kit, { voiceover = false } = {}) {
  if (fromZoom(record)) return `${name} came from Zoom, and a Zoom download is never footage.`;
  const links = linksOf(ctx.root);
  if (kit.matchedSession(links, record) || links.sessionsBeside(record, found.folder).length > 0) return `${name} holds most of the words of a client or group session, so it is never footage. Ask Jason.`;
  const kind = kindOf(record);
  if (kind !== null) return `${name} is answered already: it is ${kit.kindSaid[kind] ?? "answered"}.`;
  if (isPart(record)) {
    const other = plans.find((plan) => plan.record.id === record.partOf.id);
    return other ? `${name} is footage for "${shownName(other.record)}" already. To change that, say "that's not footage for ${shownName(other.record)}" first.` : `${name} is footage for a planned video already. To change that, say "that's not footage" first.`;
  }
  const picture = pictureOf(record);
  if (voiceover) {
    if (picture === true) return `${name} has a picture: a voiceover is sound alone.`;
    return picture === null ? `${name} could not be read when it was imported, so it can't be a voiceover.` : "";
  }
  if (picture === false) return `${name} is sound alone, so it can't be footage.`;
  if (picture === null) return `${name} could not be read when it was imported, so it can't be footage.`;
  return "";
}

/** The shot a screen recording or b-roll part shows, or why not: { shot } or { why }. The plan's shots of its kind (`as`): none is refused; with
    --shot, that shot must be in the list and of its kind; without it, the one shot of its kind is taken, and with two or more she is asked which. A
    shot that has its footage already (`parts`, the plan's) is refused, naming the video that has it. */
function shotFor({ planned, title, as, given, parts }) {
  const ofKind = planned.shots.filter((shot) => shot.kind === as);
  if (!ofKind.length) return { why: `"${title}" has no ${NOUN[as]} shot in its shot list.` };
  let shot;
  if (given !== null) {
    const named = planned.shots.find((one) => one.n === given);
    if (!named) return { why: `"${title}" has no shot ${given} in its shot list.` };
    if (named.kind !== as) return { why: `Shot ${given} of "${title}" is ${SHOT_SAID[named.kind]}, not ${SHOT_SAID[as]}.` };
    shot = named.n;
  } else if (ofKind.length > 1) {
    return { why: `Which ${NOUN[as]} shot is it? ${ofKind.map((one) => `Shot ${one.n}: ${sentence(one.what)}`).join(" ")} Say it again with its number.` };
  } else shot = ofKind[0].n;
  const taken = parts.find((part) => part.record.partOf.shot === shot);
  return taken ? { why: `Shot ${shot} of "${title}" has its footage already: ${taken.record.label || "another video"}.` } : { shot };
}

/** What `footage` says once the video is footage: <label> is footage for "<title>": talking to the camera. For a screen recording or b-roll it
    is the footage for a shot, and goes in with no sound; for a client it adds that it stays out until the client agreed. */
function madeLine({ name, title, as, shot, client }) {
  const what = as === "talking" ? SHOT_SAID.talking : `the ${as === "screen" ? "screen recording" : "b-roll"} for shot ${shot}. It goes in with no sound`;
  return `${name} is footage for "${title}": ${what}.${client ? " It shows a client, so it stays out of the HyperFrames project until you confirm they agreed." : ""} When all its footage is in, say "that's all the footage for ${title}".`;
}

/** Whether `footage` asks for her receipts: under Claude Code, on a Mac whose lock in effect is open (as edit.js receiptHeld asks for `kind`'s). In
    Terminal, on a strict Mac, and where no Claude Code is named for the lock, none is asked for. */
const receiptsAsked = (ctx) => (ctx.deps.env || process.env).CLAUDECODE === "1" && lockFor(ctx.settings, ctx.deps) === "open";

/** The plans the cards offer when `plan` was named: the three newest (plannedOffers), and the plan named as well when it is older than those,
    in place of the third, last, as the newest first order has it. For the voiceover of an explainer (`voiceover`, PR H6) they are the explainers
    a video of sound alone is offered, and the plan is named by The voiceover for its title. */
function offersNaming(records, plan, { voiceover = false } = {}) {
  const offers = plannedOffers(records, voiceover ? { picture: false, sound: true } : { picture: true });
  if (offers.some((offer) => offer.record.id === plan.id)) return offers;
  return [...offers.slice(0, MOST_OFFERS - 1), { record: plan, option: (voiceover ? voiceoverOption : footageOption)(shownName(plan)) }];
}

/** `footage "<video>" "<planned>" talking|screen|b-roll --client yes|no [--shot <n>]`, once edit.js has found the video through the gate, holds its
    answer lock and read its record: it is answered as footage for the plan, in one write by the rule, which claims nothing (the plan's record is not
    written). In this order it refuses, with 1 and nothing written:
    - the plan: none called so waits for its footage (or, PR H5b, is made from it already and takes b-roll and a screen recording still); it is not
      made yet;
    - the video: Zoom, a session's words, answered already, footage already, sound alone;
    - the kind: a talking part for a plan made from its footage already (its talking parts are joined), no sound, or a client, for a talking part;
    - the shot: a talking part's, none of the kind, one not of the kind, which one, one with its footage already;
    - the other Mac's claim;
    - and, under Claude Code on a Mac whose lock is open, a video she has not answered on both cards (NO_RECEIPT and the cards).
    Then it says what it did, and that she says when all the footage is in. */
async function makePart(ctx, found, record, name, asked, kit) {
  const plans = plansIn(ctx.root);
  const waiting = plans.filter(({ record: one }) => takesFootage(one));
  const fits = plansCalled(waiting, asked.planned);
  if (!fits.length) return refuse(ctx, `There's no planned video called "${asked.planned}" waiting for its footage.`);
  if (fits.length > 1) return refuse(ctx, `More than one planned video is called "${asked.planned}": ask Jason.`);
  const plan = fits[0].record;
  const title = shownName(plan);
  keepTitle(ctx, title);
  if (plan.planned.set === null) return refuse(ctx, `The plan for "${title}" isn't made yet: its guide, its shot list and its teleprompter script come first.`);
  const why = videoWhy(ctx, found, record, name, plans, kit);
  if (why) return refuse(ctx, why);
  // A plan made from its footage already takes b-roll and a screen recording still, and no talking part (PR H5b): its talking parts are joined.
  if (asked.as === "talking" && isFromPlan(plan)) return refuse(ctx, `"${title}" is made from its footage already: a talking part can't be added.`);
  if (asked.as === "talking" && isObject(record.video) && record.video.sound === false) return refuse(ctx, `${name} has no sound, so it can't be a talking part: it is b-roll or a screen recording.`);
  if (asked.as === "talking" && asked.client) return refuse(ctx, "A talking part is you talking to the camera. A video that shows a client is b-roll or a screen recording.");
  let shot = null;
  if (asked.as === "talking") {
    if (asked.shot !== null) return refuse(ctx, "A talking part has no shot: Studio puts the talking parts in order by their words.");
  } else {
    const chosen = shotFor({ planned: plan.planned, title, as: asked.as, given: asked.shot, parts: partsOf(ctx.root, plan.id) });
    if (chosen.why) return refuse(ctx, chosen.why);
    shot = chosen.shot;
  }
  const held = heldElsewhere(record, ctx.machine);
  if (held) return refuse(ctx, kit.beingAnswered(name, held.by));
  if (receiptsAsked(ctx)) {
    // Her receipts are of the card this video's line prints, and of the plan's title among plans that are each still offered now.
    const said = (text) => (ctx.hidden && ctx.hidden.names.length ? withoutNames(text, ctx.hidden.names, ctx.hidden.keep, { paths: false }) : text);
    const offeredNow = waiting.filter(({ record: one }) => one.planned.set !== null).map(({ record: one }) => footageOption(shownName(one)));
    const now = ctx.now();
    const answered = [...new Set([name, said(name)])].some((label) => receiptWhy({ home: ctx.home, expected: expectedFootage({ label, title, as: asked.as, client: asked.client, offeredNow }), now }) === "");
    if (!answered) {
      ctx.say(NO_RECEIPT);
      for (const line of cardLines(name, offersNaming(plans.map(({ record: one }) => one), plan))) ctx.say(line);
      return 1;
    }
  }
  const answer = { guess: null, seen: "", came: null, ...record.answer, state: "part", by: ctx.machine, on: ctx.machine, at: localStamp(new Date(ctx.now())), private: "no" };
  const partOf = { id: plan.id, as: asked.as, shot, client: asked.client };
  const code = await kit.save({ ...found, record }, { ...record, answer, partOf }, "");
  if (code !== 0) return code;
  ctx.say(madeLine({ name, title, as: asked.as, shot, client: asked.client }));
  return 0;
}

/** `footage "<video>" "<planned>" voiceover [--not-a-session]` (PR H6), once edit.js has found the video through the gate, holds its answer lock and
    read its record: a recording of sound alone is answered as the voiceover of an explainer, which becomes its video. In this order it refuses, with 1
    and nothing written:
    - the plan: none called so waits (it is not filmed or dropped); a script, which takes footage and no voiceover; one a HeyGen voice reads; one
      whose package is not made yet;
    - the video: Zoom, a session's words, answered already, footage already, a picture (a voiceover is sound alone), unreadable at the import, and no
      sound at all (a video with no sound takes no kind, and a voiceover is a voice);
    - the answer on the not-a-session card: sound alone is often a client or group session, so, as `kind` does, it asks for her answer first;
    - a plan that has its voiceover already, the other Mac's claim, and a run at work on the plan;
    - and, under Claude Code on a Mac whose lock is open, a video she has not answered on the planned card and the not-a-session card (NO_RECEIPT and
      both cards). Sound alone has no part card, and no client to ask about.
    Then, in this order, the plan is given its voice when it had none (`planned.voice` "sallie", in a record write of its own: an explainer whose
    voice is not chosen yet is hers once a voiceover is dropped for it), the video's own record is written by the rule as a part (answer "part",
    `partOf` { id, as: "voiceover", shot: null, client: null }), and the join run is started on the plan with that one part, which takes the voice
    in as the plan's video. The plan is written for its voice and for nothing else here: the run writes it as a video. */
async function makeVoiceover(ctx, found, record, name, asked, kit) {
  const plans = plansIn(ctx.root);
  const waiting = plans.filter(({ record: one }) => isPlannedRecord(one) && !one.archived && one.planned.filmed === null);
  const fits = plansCalled(waiting, asked.planned);
  if (!fits.length) return refuse(ctx, `There's no planned video called "${asked.planned}" waiting for its voiceover.`);
  if (fits.length > 1) return refuse(ctx, `More than one planned video is called "${asked.planned}": ask Jason.`);
  const [planFound] = fits;
  const plan = planFound.record;
  const title = shownName(plan);
  keepTitle(ctx, title);
  if (plan.planned.route === "script") return refuse(ctx, `"${title}" is a script: it takes footage, and no voiceover.`);
  if (plan.planned.voice === "heygen") return refuse(ctx, `"${title}" is read by a HeyGen voice, so it takes no voiceover.`);
  if (plan.planned.set === null) return refuse(ctx, `The plan for "${title}" isn't made yet: its guide and its teleprompter script come first.`);
  const why = videoWhy(ctx, found, record, name, plans, kit, { voiceover: true });
  if (why) return refuse(ctx, why);
  // A video with no sound takes no kind (PR H5b, ruling 5), and the voiceover is filed as the plan's video: it must have a voice.
  if (isObject(record.video) && record.video.sound === false) return refuse(ctx, `${name} has no sound, so it can't be a voiceover.`);
  if (!asked.notASession) return kit.askIfSession(name, record);
  const have = partsOf(ctx.root, plan.id, { newer: true }).find((part) => part.record?.partOf?.as === "voiceover");
  if (have) return refuse(ctx, `"${title}" has its voiceover already: ${labelOf(have)}. To change it, say "that's not footage for ${title}" first.`);
  const held = heldElsewhere(record, ctx.machine);
  if (held) return refuse(ctx, kit.beingAnswered(name, held.by));
  const running = runningCommand(ctx.home, planFound.name, ctx.alive);
  if (running) return refuse(ctx, `${running} is running for ${kit.calledAs(planFound)} already. Say it again when it has finished.`);
  const answer = record.answer;
  const came = answer.came === "zoom" || answer.came === "sound" ? answer.came : null;
  if (receiptsAsked(ctx)) {
    // Her receipts are of the cards this video's line prints, and of the plan's title among plans that are each still offered now.
    const said = (text) => (ctx.hidden && ctx.hidden.names.length ? withoutNames(text, ctx.hidden.names, ctx.hidden.keep, { paths: false }) : text);
    const offeredNow = plans.filter(({ record: one }) => one.planned.set !== null && (takesFootage(one) || waitsForVoiceover(one))).map(({ record: one }) => (waitsForVoiceover(one) ? voiceoverOption : footageOption)(shownName(one)));
    const now = ctx.now();
    const answered = [...new Set([name, said(name)])].some((label) => receiptWhy({ home: ctx.home, expected: expectedVoiceover({ label, title, came, offeredNow }), now }) === "");
    if (!answered) {
      ctx.say(NO_RECEIPT);
      ctx.say(plannedLine(name, offersNaming(plans.map(({ record: one }) => one), plan, { voiceover: true })));
      ctx.say(`    Card if not a session: ${JSON.stringify(notSessionCardOf({ label: name, came }))}`);
      return 1;
    }
  }
  if (plan.planned.voice === null) {
    const code = await kit.save({ name: planFound.name, folder: planFound.folder, record: plan }, { ...plan, planned: { ...plan.planned, voice: "sallie" } }, "");
    if (code !== 0) return code;
  }
  const next = { ...record, answer: { guess: null, seen: "", came: null, ...answer, state: "part", by: ctx.machine, on: ctx.machine, at: localStamp(new Date(ctx.now())), private: "no" }, partOf: { id: plan.id, as: "voiceover", shot: null, client: null } };
  const code = await kit.save({ ...found, record }, next, "");
  if (code !== 0) return code;
  startDetached(ctx, { command: "join", folder: planFound.name, args: ["--parts", record.id] });
  ctx.say(`${name} is the voiceover for "${title}". It is being taken in now. A notice comes when it is ready.`);
  return 0;
}

/** `footage "<video>" none`: a part waits for its answer again, with its cards, until its plan is filmed (PR H5b); after that it is Jason's to fix.
    A video that is no part is told so. The plan's record is not written; an agreement noted for the part stays in it. */
async function takeBack(ctx, found, record, name, kit) {
  if (!isPart(record)) return refuse(ctx, `${name} is not footage for a planned video.`);
  const plan = plansIn(ctx.root).find((one) => one.record.id === record.partOf.id);
  const title = plan ? shownName(plan.record) : null;
  if (plan && plan.record.planned.filmed !== null) return refuse(ctx, `"${title}" is made from its footage already: ask Jason.`);
  if (title !== null) keepTitle(ctx, title);
  const held = heldElsewhere(record, ctx.machine);
  if (held) return refuse(ctx, kit.beingAnswered(name, held.by));
  const { partOf, ...rest } = record;
  const { by, on, at, private: _private, ...kept } = record.answer;
  const code = await kit.save({ ...found, record }, { ...rest, answer: { ...kept, state: "needs your answer" } }, "");
  if (code !== 0) return code;
  ctx.say(`${name} is no longer footage for ${title === null ? "a planned video" : `"${title}"`}: it waits for its answer again.`);
  return 0;
}

/** `footage …`, once edit.js has found the video through the gate and holds its answer lock (`got` is { found, record }): the record is read
    again under the lock, and the video is made footage or taken back. Resolves 0, or 1 having said why. `kit` is what edit.js gives of its own:
    save, matchedSession, beingAnswered, kindSaid, notRead and newerWhy. */
export async function footageFor(ctx, got, asked, kit) {
  const { found } = got;
  const read = readEpisode(found.folder);
  if (!read.record) {
    ctx.say(kit.notRead(found, read));
    return 1;
  }
  if (read.newer) {
    ctx.say(kit.newerWhy(read.record));
    return 1;
  }
  const name = gatedName(read.record, Boolean(found.held));
  if (asked.form === "none") return takeBack(ctx, found, read.record, name, kit);
  return asked.as === "voiceover" ? makeVoiceover(ctx, found, read.record, name, asked, kit) : makePart(ctx, found, read.record, name, asked, kit);
}

/** Whether a part is waiting for a client's agreement (PR H6): it shows a client, and the plan holds none for it yet. The voiceover of an explainer
    shows no client (nothing was asked of it: its `client` is null) and waits for none; mayGoIn alone, which fails closed for anything that is not
    footage that plainly shows no client, would take it for one. `part` is one of partsOf's. */
export const waitsForClient = (part, planned) => isObject(part?.record?.partOf) && part.record.partOf.client === true && !mayGoIn(part, planned);

// --- plan "<planned>" agreed "<video>": a client's agreement to being shown in a part ---

/** What is said when an agreement is refused or does not happen: it was not noted. */
const NOT_NOTED = "Not noted:";
const NOT_AGREED = "The footage is not agreed.";
const AGREEMENT_TIMED_OUT = `${NOT_NOTED} the dialog was not answered within a minute, so it was closed. ${NOT_AGREED}`;
const NOTE_NOT_WRITTEN = `${NOT_NOTED} the note could not be written on this Mac. ${NOT_AGREED}`;
const AGREEMENT_NOT_RECORDED = "The footage is not agreed: the note of who agreed is on this Mac only. Say it again.";
/** What a person types in the agreement dialog, made one line: each line break and tab one space (the same marks as the Reel's agreement
    takes: a line feed, a carriage return, a tab, a vertical tab, a form feed, the next line mark and the line and paragraph separators). */
const LINE_BREAKS = new RegExp(`[\\r\\n\\t\\v\\f\\u0085${String.fromCharCode(0x2028, 0x2029)}]`, "g");

/** The part of `parts` that `said` names: by its label, in any case and spacing, by its id or its short id, or by the label and short id the lists
    give it ("<label> (3fa9c1)"). */
export function partNamed(parts, said) {
  const word = plainly(said);
  return parts.find(({ record }) => [record.label, record.id, record.id.slice(-6), record.label ? `${record.label} (${record.id.slice(-6)})` : ""].some((known) => known !== "" && plainly(known) === word));
}

/** The label of the video `said` names in any episode, which holds nothing of its file; "" when none is named so. */
function labelNamed(root, said) {
  const word = plainly(said);
  const one = episodesIn(root).find(({ record }) => typeof record.label === "string" && [record.label, record.id, record.id.slice(-6), `${record.label} (${record.id.slice(-6)})`].some((known) => plainly(known) === word));
  return one ? one.record.label : "";
}

/** `plan "<planned>" agreed "<video>"`, once edit.js has found the plan through the gate and holds its answer lock (`got` is { found, record }): a
    client's agreement to being shown in the part `asked.video` names, noted on a dialog Claude cannot press, in the order of `reel … --client-agreed`.
    Before any dialog it refuses, writing nothing: a video that is not one of the plan's parts; a part that shows no client; and for a part agreed
    already it says so and ends 0. Then it tells her to click, since Return presses Cancel, and shows the dialog (the kit's `ask`, for DIALOG_MS at
    most), which names the video by its label and asks who agreed and when. Only her click on "They agreed", with something typed (a letter or a digit),
    goes on. Cancel, a dialog that gave no click, nothing typed and a dialog not answered in time each say so, in a line of their own, and write nothing.
    Her click may come long after the records were read, so the plan and the part are read again, and each must be the record she was asked about, and
    the two refusals a record write would make (a newer record file still coming over, a change Dropbox undid) are made first. Then, in this order: one line
    in agreements.txt in this Mac's work folder for the plan, a file only she can read, with the moment, the part by its label and its id, and what she
    typed; and one write of the plan's record, by the rule, adding { id, label, at } to `planned.consent`. What she typed is in that note and nowhere
    else: not in a line said, the tool log, a record, a result, a file of the episode or the hand-off. The log says only that it was noted, by the plan's id
    and the label. A note that cannot be written writes no record; a record that cannot be written leaves the note, and says the footage is not agreed. */
export async function agreedFor(ctx, got, asked, kit) {
  const { found, record } = got;
  const title = shownName(record);
  keepTitle(ctx, title);
  const part = partNamed(partsOf(ctx.root, record.id), asked.video);
  if (!part) return refuse(ctx, `${labelNamed(ctx.root, asked.video) || "That video"} is not footage for "${title}".`);
  kit.hide(part.name);
  const label = part.record.label || shownName(part.record);
  // The part is read as a command reads any episode: Dropbox's conflicted copy of a record in it, or a record a newer brimm-video wrote, ends the
  // command here, before she is asked anything (partsOf reads a conflicted episode past its copies).
  const first = readEpisode(part.folder);
  if (!first.record) return refuse(ctx, kit.notRead({ name: part.name, folder: part.folder }, first));
  if (first.newer) return refuse(ctx, kit.newerWhy(first.record));
  if (part.record.partOf.client !== true) return refuse(ctx, `${label} shows no client, so no agreement is needed.`);
  const before = Array.isArray(record.planned.consent) ? record.planned.consent.find((one) => isObject(one) && one.id === part.record.id) : undefined;
  if (before) {
    ctx.say(`${label}'s client agreed already, on ${dayText(before.at)}.`);
    return 0;
  }
  ctx.say(`A dialog is open on this Mac for ${label}: type who agreed and when, then click "They agreed". Return presses Cancel.`);
  const { answer, outOfTime } = await kit.ask(`${label}\n\nWho agreed to being shown in this footage for "${title}", and when?`, { buttons: ["Cancel", "They agreed"], answer: true });
  if (outOfTime) return refuse(ctx, AGREEMENT_TIMED_OUT);
  if (!answer || answer.button !== "They agreed") {
    const why = answer && answer.button === null && typeof answer.why === "string" ? answer.why : "";
    return refuse(ctx, why ? `${NOT_NOTED} ${why} ${NOT_AGREED}` : `${NOT_NOTED} the footage is not agreed.`);
  }
  const typed = (typeof answer.text === "string" ? answer.text : "").replace(LINE_BREAKS, " ").trim();
  // Invisible characters, as a zero-width space, are not something typed: it holds a letter or a digit.
  if (!/[\p{L}\p{N}]/u.test(typed)) return refuse(ctx, `${NOT_NOTED} nothing was typed. ${NOT_AGREED}`);
  const stop = (why) => refuse(ctx, `${NOT_NOTED} ${why}`);
  // The plan and the part are read again, and each must be the one she was asked about.
  const planNow = readEpisode(found.folder);
  if (!planNow.record) return stop(kit.notRead(found, planNow));
  if (planNow.newer) return stop(kit.newerWhy(planNow.record));
  // The plan is still a plan, or (PR H5b) the video it was made into: a client's agreement is noted for either, in the record that holds the plan.
  if (planNow.record.rev !== record.rev || !(isPlannedRecord(planNow.record) || isFromPlan(planNow.record)) || planNow.record.archived) return stop(`${title} changed on the other Mac meanwhile. Say it again.`);
  const partNow = readEpisode(part.folder);
  if (!partNow.record || partNow.newer || partNow.record.rev !== part.record.rev || !isPart(partNow.record) || partNow.record.partOf.id !== record.id || partNow.record.partOf.client !== true) {
    return stop(`${label} changed meanwhile. Say it again.`);
  }
  // A write refuses a newer record file still coming over, and a change Dropbox undid: no note is made before such a refusal.
  if (recordNumbers(found.folder)[0] > planNow.record.rev) return stop(kit.pending);
  const gone = undone(planNow.record, ctx.home);
  if (gone) {
    acceptRev(ctx.home, planNow.record.id, planNow.record.rev);
    return stop(gone);
  }
  // The note first, on this Mac's own disk and never in Dropbox, then the record.
  const moment = new Date(ctx.now());
  const when = localStamp(moment);
  const day = localDay(moment);
  try {
    const folder = episodeWork(ctx.home, found.name);
    mkdirSync(folder, { recursive: true });
    const file = join(folder, "agreements.txt");
    appendFileSync(file, "", { mode: 0o600 });
    chmodSync(file, 0o600);
    appendFileSync(file, `${when} ${label} (${part.record.id}): ${typed}\n`);
  } catch (e) {
    // Bare on purpose: nothing of the error is said, so that no message quotes the file's path or what she typed.
    return refuse(ctx, NOTE_NOT_WRITTEN);
  }
  const consent = [...(Array.isArray(planNow.record.planned.consent) ? planNow.record.planned.consent : []), { id: part.record.id, label, at: day }];
  if ((await kit.save({ ...found, record: planNow.record }, { ...planNow.record, planned: { ...planNow.record.planned, consent } }, "")) !== 0) {
    ctx.say(AGREEMENT_NOT_RECORDED);
    return 1;
  }
  ctx.say(`${label}: the client's agreement is noted, on ${dayText(day)}. Who agreed is kept on this Mac only, and the footage goes into the HyperFrames project.`);
  kit.log(`${when} ${planNow.record.id} (${label}): a client's agreement to footage was noted by a click on this Mac's dialog.`, "the agreement");
  return 0;
}
