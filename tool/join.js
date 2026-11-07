// The talking parts joined into the plan's video, and the plan's footage ready for its project (design 2026-11-04, H5; PR H5b). A planned
// video (plan.js) waits for its footage; each piece she drops is a part of it (footage.js). When she says all the footage is in, the talking
// parts are put in the order of the teleprompter script, joined by copying their streams, taken in with the light import's own steps, and
// filed as the plan's own video: the plan's record, written once more as the video it was waiting to be (episode.js isFromPlan). Its b-roll
// and screen recordings are made into copies with no sound for the HyperFrames project (workcopy.js) and moved into its media/ (app.js).
//
// This first half is pure: the parts' words and what ffprobe printed of them go in, and the order they come in, whether they can be joined, and the
// list and the arguments ffmpeg is given come out. The only thing it looks at is whether a part's episode is held (footage.js partHeld), which every
// consumer of a part asks (PR H5b, ruling 1). The footage a plan's parts give its project is plan-project.js's (PR H6 moved it there).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { PIN } from "./hyperframes.js";
import { voiceCase } from "./explainer.js";
import { basename, extname, join } from "node:path";
import { cueTokens } from "./graphic-cues.js";
import { factsOf, framesASecond, probeArgs, streamsOf, soundStream } from "./cuts.js";
import { isFromPlan, isPlannedRecord, localStamp, readEpisode, shownName, undone } from "./episode.js";
import { keepTitle, labelOf, linksForParts, partHeld, partNamed, partsOf } from "./footage.js";
import { HELD, MATCHED_SESSION } from "./gate.js";
import { runningCommand, startDetached } from "./detached.js";
import { LATE_CHECK_MS, readThrough } from "./dropbox.js";
import { episodeKind, fileEpisode, pendingFor, writePending } from "./filing.js";
import { runGuarded } from "./guard.js";
import { fileSafe } from "./names.js";
import { FOOTAGE_KINDS } from "./plan-project.js";
import { lastLine } from "./run.js";
import { appOf, isLocal, runsFolder } from "./settings.js";
import { banner, clockAt, importInto } from "./unedited.js";
import { copyIn } from "./guide.js";
import { waitFacts } from "./late-wait.js";
import { progressFolder, readRates } from "./progress.js";
import { requestWorkCopy, workCopyLimits } from "./workcopy.js";
import { ON_OTHER_MAC, fileAt, keptOnAMac, onOtherMac, roleOf } from "./where.js";

export { isFromPlan };

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};

// --- The order of the talking parts ---

/** How many of a part's tokens are a run that votes for its place in the script, and how many votes a part needs to have a place. */
const RUN = 4;
const VOTES = 3;

/** The text of a word of a part: the episode's own words are { w, start, end }, and a bare text is itself. */
const textOf = (word) => (typeof word === "string" ? word : isObject(word) ? String(word.w ?? word.text ?? "") : "");

/** The order the talking parts are joined in, by where each one's words fall in the teleprompter script (design 2026-11-04, H5; ruling 15 of
    the plan): [{ id, label, place }] for each of `parts`, which are given in the order they were answered. A part is { id, label, words } (the
    words it says, each { w } as the episode's .words.json has them, or a text), or a part as footage.js partsOf lists it, whose id and label are
    its record's. `lines` are the script's lines. Words are compared as the cues' words are (graphic-cues.js cueTokens): in any case, without
    accents and marks. Each run of four of a part's tokens that the script holds once votes for the place it is at there, a place being the
    number of the script's token it starts at; a run the script holds more than once votes for nothing, and so does a run it does not hold. The
    part's place is the middle vote, so that a paragraph read twice (a retake) is not read as two places; with fewer than three votes it has
    none, and `place` is null. Parts with a place come first, in the order of their places (two at one place in the order given), and the
    others after them, in the order given. Nothing is cut: a part is not left out. */
export function partOrder(parts, lines) {
  const script = list(lines).flatMap((line) => cueTokens(String(line ?? "")));
  const where = new Map();
  for (let i = 0; i + RUN <= script.length; i++) {
    const key = script.slice(i, i + RUN).join(" ");
    where.set(key, [...(where.get(key) ?? []), i]);
  }
  const placed = list(parts).map((part, order) => {
    const tokens = list(part?.words).flatMap((word) => cueTokens(textOf(word)));
    const votes = [];
    for (let i = 0; i + RUN <= tokens.length; i++) {
      const at = where.get(tokens.slice(i, i + RUN).join(" "));
      if (at !== undefined && at.length === 1) votes.push(at[0]);
    }
    votes.sort((a, b) => a - b);
    const place = votes.length >= VOTES ? votes[Math.floor(votes.length / 2)] : null;
    return { id: part?.id ?? part?.record?.id, label: part?.label ?? part?.record?.label, place, order };
  });
  placed.sort((a, b) => Number(a.place === null) - Number(b.place === null) || (a.place ?? 0) - (b.place ?? 0) || a.order - b.order);
  return placed.map(({ id, label, place }) => ({ id, label, place }));
}

// --- Whether the parts can be joined by copying their streams ---

/** The rotation a picture is stored with, in degrees from 0 up to 360, as ffprobe says it (the display matrix's, or the old `rotate` tag). */
function rotationOf(picture) {
  const noted = list(picture.side_data_list).map((d) => d.rotation).find((r) => r != null) ?? picture.tags?.rotate ?? 0;
  const degrees = Number(noted);
  return Number.isFinite(degrees) ? ((degrees % 360) + 360) % 360 : 0;
}

/** What ffprobe printed of a part, as the join compares it: { facts, picture, sound, streams }, or null when it cannot be read as a video with a
    picture and a length. A cover picture is no picture (factsOf). `sound` is undefined for a part with none. */
function shapeOf(printed) {
  let told;
  try {
    told = JSON.parse(printed);
  } catch (e) {
    return null;
  }
  const facts = factsOf(printed);
  const picture = list(told?.streams).find((s) => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic));
  if (!facts || !picture) return null;
  return { facts, picture, sound: soundStream(list(told.streams)), streams: streamsOf(printed) };
}

/** A rate to two places, as it is said: 30 and 29.97. */
const rateText = (fps) => String(Math.round(framesASecond(fps) * 100) / 100);

/** Why talking parts cannot be joined by copying their streams, in plain words, or "" when they can. `probes` are what ffprobe printed of each
    part (a JSON text, as workcopy.js reads one), in the order they would be joined. Each part is compared with the first, and the first that
    differs is said, in its words and of its own difference alone, the first that applies in this order:
    - `talking part 2 is 3840 by 2160, and talking part 1 is 1920 by 1080`: the size of the picture as it is shown;
    - `talking part 2 was filmed at 60 pictures a second, and talking part 1 at 30`;
    - `talking part 2 has its picture in another form`: its codec, its pixel format, the size it is stored at or the way it is stored turned;
    - `talking part 2 has its sound in another form`: its codec, its rate or its channels;
    - `talking part 2 has its streams in another order`: the picture and the sound are not the streams of the same numbers;
    and, before any of them, `talking part 2 could not be read as a video`, of the first part whose probe holds no picture or no length. */
export function partsFault(probes) {
  const shapes = list(probes).map(shapeOf);
  const unreadable = shapes.findIndex((shape) => shape === null);
  if (unreadable !== -1) return `talking part ${unreadable + 1} could not be read as a video`;
  const [first, ...rest] = shapes;
  const soundKey = (shape) => (shape.sound ? [shape.sound.codec_name, shape.sound.sample_rate, shape.sound.channels].join("/") : "");
  const pictureKey = (shape) => [shape.picture.codec_name, shape.picture.pix_fmt, shape.picture.width, shape.picture.height, rotationOf(shape.picture)].join("/");
  for (const [i, shape] of rest.entries()) {
    const n = i + 2;
    if (shape.facts.width !== first.facts.width || shape.facts.height !== first.facts.height) {
      return `talking part ${n} is ${shape.facts.width} by ${shape.facts.height}, and talking part 1 is ${first.facts.width} by ${first.facts.height}`;
    }
    if (rateText(shape.facts.fps) !== rateText(first.facts.fps)) return `talking part ${n} was filmed at ${rateText(shape.facts.fps)} pictures a second, and talking part 1 at ${rateText(first.facts.fps)}`;
    if (pictureKey(shape) !== pictureKey(first)) return `talking part ${n} has its picture in another form`;
    if (soundKey(shape) !== soundKey(first)) return `talking part ${n} has its sound in another form`;
    if (shape.streams.video !== first.streams.video || shape.streams.audio !== first.streams.audio) return `talking part ${n} has its streams in another order`;
  }
  return "";
}

// --- What ffmpeg is given ---

/** The list the concat demuxer reads: `ffconcat version 1.0` and a line `file '<path>'` for each file, in the order given. Inside the quotes
    every mark is itself but the apostrophe, which is written '\'' (a quote that ends, an apostrophe, a quote that begins). A path with a line
    break in it cannot be written in a list and is refused. */
export function concatList(paths) {
  for (const path of list(paths)) {
    if (/[\n\r\0]/.test(String(path))) throw new Error("A path with a line break in it cannot be in a list of files to join.");
  }
  return `ffconcat version 1.0\n${list(paths).map((path) => `file '${String(path).replace(/'/g, "'\\''")}'`).join("\n")}\n`;
}

/** The arguments that have ffmpeg join the files of the list `list` into `output`, a .mov, by copying their streams: the picture and the sound
    of the numbers `video` and `audio` (streamsOf's, those of the first part, which partsFault has seen the others to share), and nothing
    re-encoded. The list holds absolute paths, which the concat demuxer takes only with `-safe 0`. */
export const joinArgs = (listFile, output, { video, audio }) => [
  "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
  "-f", "concat", "-safe", "0", "-i", listFile,
  "-map", `0:${video}`, "-map", `0:${audio}`,
  "-c", "copy", "-sn", "-dn",
  output
];

// --- plan "<planned>" join ["<video>"…]: "that's all the footage" ---

/** Whether a part of the plan is a talking part. A part a newer brimm-video wrote (`newer: true`) is taken for one unless its record says it is
    b-roll or a screen recording: a talking part that cannot be read is refused, and never left out of the video without a word. */
const isTalking = (part) => (part.newer === true ? !FOOTAGE_KINDS.includes(part.record?.partOf?.as) : part.record.partOf.as === "talking");

/** Whether a part of an explainer is its voiceover (PR H6). A part a newer brimm-video wrote is taken for one unless its record says it is another
    kind of part: a voiceover that cannot be read is refused, and never left out of the video without a word. */
const isVoiceover = (part) => (part.newer === true ? !["talking", ...FOOTAGE_KINDS].includes(part.record?.partOf?.as) : part.record.partOf.as === "voiceover");

/** The parts a join takes of the plan `record`: its talking parts (a script's), or its voiceover (an explainer's, PR H6). */
const takenOf = (record) => (record.planned.route === "explainer" ? isVoiceover : isTalking);

/** The words a talking part is read from, for the order it comes in: the words file its light import filed. [] when it is not there, is not whole
    or cannot be read, and the part then has no place in the script. */
function wordsOfPart(ctx, part) {
  const stem = basename(part.record.video.file, extname(part.record.video.file));
  try {
    const held = JSON.parse(readFileSync(fileAt(ctx, part, `${stem}.words.json`), "utf8"));
    return Array.isArray(held?.words) ? held.words : [];
  } catch (e) {
    return [];
  }
}

/** What is said of a talking part that must not be joined (footage.js partHeld), the words a command gives that episode today with the part's
    label first, so that she knows which video to sort out: Dropbox's conflicted copy, or a record a newer brimm-video wrote, or one that cannot
    be read. `kit` is edit.js's (notRead, newerWhy). */
export function heldWords(part, held, kit) {
  // A part held as a session (the final review, fix 1): the gate's words for a video held as one, with the part's label first. They name no session.
  if (held.why === "session") return `${labelOf(part)}: ${held.matched ? MATCHED_SESSION : HELD}`;
  if (held.why === "newer") {
    const label = typeof part.record?.label === "string" && part.record.label !== "" ? `${part.record.label}: ` : "";
    return `${label}${kit.newerWhy(held.record)}`;
  }
  if (held.read) return kit.notRead({ name: part.name, folder: part.folder }, held.read);
  return `${labelOf(part)}: its record cannot be read now. Dropbox may still be bringing it: ask again in a few minutes. If it says this again, tell Jason.`;
}

/** What a join of the plan `record` takes, and every reason it cannot be made, in the one place that knows them (the plan's ruling 1 of PR H6: H5b wrote
    this sequence twice, in `plan … join` and in the run, which could then have refused differently). `plan … join` (joinFor) is given the words she
    said for the parts (`videos`), and the run (joinRun) the ids it was started with (`ids`); both ask this, so that what one refuses the other refuses,
    in the same words. From one look at Episodes, in this order, it refuses with `{ why }`:
    - an explainer a HeyGen voice reads: its voice is made in its project and taken from there (`plan … voice`), and it has no footage to join;
    - no part to join: no talking part (a script's), or no voiceover (an explainer's, PR H6);
    - a part that must not be joined (footage.js partHeld): the words of its episode's conflict, or of its newer record, with its label first;
    - an explainer with more than one voiceover: it has one voice;
    - parts that are not each of the plan's, once, in the plan's words with the plan's parts named.
    Otherwise it gives { parts, ordered, explainer }: `parts` are partsOf's, in the order they are joined, the ones named or the one there is; or null
    when there are several and none was named, which is for the caller to say the order of (`ordered`: partOrder's { id, label, place } for the talking
    parts of a script, in the order the script puts them in, and the voiceover alone for an explainer). Each part is hidden from what is said first
    (kit.hide), and the plan's title is kept (footage.js keepTitle). */
export function joinCase(ctx, record, kit, { videos = [], ids = null } = {}) {
  const title = shownName(record);
  keepTitle(ctx, title);
  const explainer = record.planned.route === "explainer";
  if (explainer && record.planned.voice === "heygen") return { why: `"${title}" is an explainer: its voice makes it, and it has no footage to join.` };
  const taken = partsOf(ctx.root, record.id, { newer: true }).filter(takenOf(record));
  for (const part of taken) kit.hide(part.name);
  if (!taken.length) return { why: explainer ? `"${title}" has no voiceover yet: a video needs one.` : `"${title}" has no talking part yet: a video needs at least one.` };
  const links = linksForParts(taken);
  const held = taken.map((part) => ({ part, held: partHeld(part, links()) })).find((one) => one.held !== null);
  if (held) return { why: heldWords(held.part, held.held, kit) };
  const ordered = explainer
    ? taken.map((part) => ({ id: part.record.id, label: labelOf(part), place: null }))
    : partOrder(taken.map((part) => ({ id: part.record.id, label: labelOf(part), words: wordsOfPart(ctx, part) })), record.planned.lines);
  const labels = ordered.map((part) => part.label).join(", ");
  if (explainer && taken.length > 1) return { why: `"${title}" has more than one voiceover: ${labels}. Take the others back, each with "that's not footage for ${title}".` };
  if (ids !== null || videos.length) {
    const wanted = ids !== null ? ids.map((id) => taken.find((part) => part.record.id === id)) : videos.map((word) => partNamed(taken, word));
    if (wanted.some((part) => !part) || wanted.length !== taken.length || new Set(wanted).size !== taken.length) {
      return { why: explainer ? `Those aren't the voiceover of "${title}". It is: ${labels}.` : `Those aren't the talking parts of "${title}". They are: ${labels}.` };
    }
    return { parts: wanted, ordered, explainer };
  }
  return { parts: taken.length > 1 ? null : taken, ordered, explainer };
}

/** `plan "<planned>" join ["<video>"…]`, for "that's all the footage", once edit.js has found the plan through the gate (its record is `got.record`) and
    plan.js has shown it is no video made from its footage already. In this order it refuses, writing nothing and starting nothing, with 1:
    - a run at work on the plan, as `kind` says it;
    - anything joinCase refuses, in its words: no part to join, a part that must not be joined, videos that are not each of the plan's parts once.
    With two talking parts or more and none named, it says the order the script puts them in (partOrder) and which has no place in it, and that no
    more can be added once they are joined; it writes nothing and starts nothing, and ends 0. With one part to join (a talking part, or the voiceover of
    an explainer, PR H6), or the parts named, it starts the join run (`join --now <the plan's folder> --parts <ids, in her order>`, detached) and says
    a notice comes when it is ready. */
export function joinFor(ctx, got, asked, kit) {
  const { found, record } = got;
  const title = shownName(record);
  keepTitle(ctx, title);
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) return refuse(ctx, `${running} is running for ${kit.calledAs(found)} already. Say it again when it has finished.`);
  const joined = joinCase(ctx, record, kit, { videos: asked.videos });
  if (joined.why) return refuse(ctx, joined.why);
  if (joined.parts === null) {
    ctx.say(`The talking parts of "${title}", in the order of its script:`);
    joined.ordered.forEach((part, i) => ctx.say(`${i + 1}. ${part.label}${part.place === null ? ", whose words weren't found in the script" : ""}`));
    ctx.say("Once they are joined, no more talking parts can be added.");
    return 0;
  }
  startDetached(ctx, { command: "join", folder: found.name, args: ["--parts", joined.parts.map((part) => part.record.id).join(",")] });
  ctx.say(joined.explainer ? `The voiceover of "${title}" is being taken in. A notice comes when it is ready.` : `"${title}" is being made from its footage. A notice comes when it is ready.`);
  return 0;
}

// --- The join run: the plan made its video ---

/** The step of the progress panel while the parts are joined into one file. */
export const JOIN_STEP = "Joining the parts";

/** The result of a join run that did not make the plan its video: nothing of the plan was changed, and its result says why in the words the guide
    sends her to ("how far is it?"). The run of an explainer (`voice`, PR H6) takes its voice in, and says so. */
/** Whether the file at `path` is not the size its record holds (`bytes`), or cannot be looked at: a file Dropbox is still bringing over or another Mac
    changed. A record that holds no size for it says nothing (the file is as it is). */
const differs = (path, bytes) => {
  if (!Number.isInteger(bytes)) return false;
  try {
    return statSync(path).size !== bytes;
  } catch (e) {
    return true;
  }
};
/** What the run says of a part whose file is not the one that came in. */
const changedWords = (part) => `${labelOf(part)} has changed since it came in, so it can't be joined yet. Say it again in a few minutes.`;

const stopped = (title, why, voice = false) => ({
  ok: false, made: [],
  failed: [`${voice ? `The voice of "${title}" couldn't be taken in` : `The footage of "${title}" couldn't be made into one video`}: ${String(why).replace(/\.$/, "")}.`],
  next: ""
});

/** The record the join writes, from the plan's own (`plan`) and the record a new episode would have had (`made`, fileEpisode's `first`): the plan
    written once more as the video it was waiting to be (episode.js isFromPlan). Its kind is the rule's ("raw", or "short video"; an explainer is
    always a short video: `kind`), its video, files and fingerprint those of the video that was filed, with the plan's own files kept; its answer
    says it is answered, by this Mac, now, as no card asked her anything: what was seen of it and how it came are the first talking part's (`seen` is
    that of the video the light import read, for several parts); and its plan is kept whole but for `filmed`, { at, parts }: when, and which parts,
    in the order they were joined. Nothing else of the plan's record changes: its name stays its title, and it stays at layout 5 (at 6, with its
    `local`, for a plan kept on one Mac).
    An explainer (PR H6) is given the voice it has, hers when it had none (`voice`); one read by a HeyGen voice (`project`, the entry of its project
    for `app.projects`, which is the main project in use from now on) moves its project out of its plan, where it was kept until the voice was in. */
function videoOf(plan, made, { at, machine, ids, came, seen, kind = made.kind, voice = null, project = null }) {
  const { project: _kept, ...planned } = plan.planned;
  return {
    ...plan,
    kind,
    video: made.video,
    files: { ...plan.files, ...made.files },
    ...(made.fingerprint ? { fingerprint: made.fingerprint } : {}),
    answer: { state: "answered", guess: null, seen, came, by: machine, on: machine, at, private: "no" },
    planned: { ...planned, ...(voice ? { voice } : {}), filmed: { at, parts: ids } },
    ...(project ? { app: { toolchain: PIN.version, projects: [project] } } : {})
  };
}

/** Why a recording cannot be the voiceover of an explainer (PR H6), from what ffprobe printed of it, in plain words with the part's label first, or "":
    it could not be read as a sound; it has a picture (a voiceover is sound alone); it has no sound this Mac's ffmpeg can read. A video with no sound
    takes no kind (the plan's ruling 22), so one is never filed as the plan's video: this is met before anything is filed. */
function voiceoverFault(printed, part) {
  const facts = factsOf(printed);
  if (!facts) return `${labelOf(part)} could not be read as a sound`;
  if (facts.height > 0) return `${labelOf(part)} has a picture: a voiceover is sound alone`;
  if (streamsOf(printed).audio === null) return `${labelOf(part)} has no sound, so it can't be a voiceover`;
  return "";
}

/** Why a HeyGen voice cannot be taken in (PR H6), from what ffprobe printed of its copy, or "": it could not be read as a sound; it has a picture (a voice is
    sound alone, and BRIMM uses no AI avatar); it has no sound this Mac's ffmpeg can read. A video with no sound takes no kind, so this is met before anything is filed. */
function voiceFault(printed) {
  const facts = factsOf(printed);
  if (!facts) return "the voice could not be read as a sound";
  if (facts.height > 0) return "the voice has a picture: a voice is sound alone";
  if (streamsOf(printed).audio === null) return "the voice has no sound";
  return "";
}

/** The join run, `join --now "<the plan's folder>" --parts <id>[,<id>…]`, once edit.js has found the plan through the gate and holds the plan's episode
    lock (detached.js runDetached): the plan's talking parts joined into one video, which is filed as the plan's own video. It is a detached run's
    alone, started by `plan … join` (joinFor). Resolves { ok, made, failed, next, started }, the shape runDetached takes, and never throws. A run that
    does not make the video leaves the plan, its folder and Dropbox as they were, and its result says `The footage of "<title>" couldn't be made into
    one video: <why>.`
    In this order it reads the plan again, since she may have changed it since `plan … join` looked, and refuses, as that does: a plan that is no plan
    (a video made from its footage already, an explainer, one dropped); no talking part; a talking part that must not be joined (partHeld: a
    conflicted copy in its episode, a record a newer brimm-video wrote), with its label first; and parts that are not the plan's talking parts, each
    once. Then each part's video is read through from Dropbox when it is not whole here, and ffprobe reads it.
    - One talking part: its video and the files its light import filed are cloned into the plan's folder under their own names (ruling 12 of the
      plan: Dropbox holds it twice), and its words, plan and fingerprint are the part's. A talking part has sound, and a video with no sound takes
      no kind (ruling 5): one with no sound this Mac can read (streamsOf) is stopped before anything is filed, `<label> has no sound, so it can't be
      a talking part`.
    - Several: partsFault says whether they can be joined by copying, in the words of the first that cannot (a part with no sound among parts that
      have some is another form of sound); ffmpeg joins them in the order given (joinArgs, concatList) into `<file-safe title>.mov` in the run's own
      folder, in BRIMM Video Work and not in Dropbox, unless the first has no picture or no sound this Mac can read; and that file is taken in with
      the light import's own steps (unedited.js importInto), so its words are transcribed across the joins. A joined file with no sound fails there.
    The video is filed as an import files one (filing.js fileEpisode, `into`): by clones, never over a file, the record last with the rev the plan was
    read at (a record written meanwhile stops it), and the run's own folder kept for the late check, which is kept on this Mac (writePending). Right
    before the record is written the talking parts are looked at again: one that has changed, been taken back or been held, or a new one, stops it.
    The filing itself refuses a record with a kind and a video with no sound, whoever asks.
    `deps` is what edit.js gives the run: `run`, `runGuarded`, `tools`, `model`, `progress`, `log`, `now` (a Date), `clock` (ms), `wait`, `isWhole`,
    `readAll`, `commit` and the rule's `clone` and `sameDisk`. `kit` is edit.js's (notRead, newerWhy, hide). */
export async function joinRun(ctx, { found }, asked, deps, kit) {
  // `asked` is the ids of the parts to join, or { voice: true } (PR H6): the run `plan … voice` starts, which takes a HeyGen voice in from the plan's project.
  const voice = asked !== null && typeof asked === "object" && !Array.isArray(asked) && asked.voice === true;
  const ids = voice ? null : asked;
  const episode = { root: ctx.root, machine: ctx.machine, checkout: deps.checkout, home: ctx.home };
  const read = readEpisode(found.folder);
  const named = read.record ? shownName(read.record) : found.name;
  // An explainer's run takes its voice in, and its failures say so (stopped).
  let voiced = false;
  const stop = (why) => {
    ctx.say(`${named}: ${why}`);
    return stopped(named, why, voiced);
  };
  if (!read.record) return stop(String(read.why).replace(/\.$/, ""));
  if (read.newer) return stop(kit.newerWhy(read.record));
  let plan = read.record;
  if (voice) voiced = true;
  const title = shownName(plan);
  keepTitle(ctx, title);
  const gone = undone(plan, ctx.home);
  if (gone) return stop(gone);
  if (isFromPlan(plan)) return stop(voice ? `"${title}" has its voice already.` : `"${title}" is made from its footage already.`);
  if (!isPlannedRecord(plan) || plan.archived) return stop(plan.archived ? `The plan for "${title}" was dropped.` : `"${title}" is not a planned video.`);
  voiced = plan.planned.route === "explainer";
  // What it takes and why it cannot is joinCase's, the very function `plan … join` asks (voiceCase's, for a HeyGen voice, which `plan … voice` asks).
  const heard = voice ? voiceCase(ctx, found, plan) : null;
  if (heard && heard.why) return stop(heard.why);
  const taken = voice ? { parts: [], explainer: true } : joinCase(ctx, plan, kit, { ids });
  if (taken.why) return stop(taken.why);
  // On a Mac with a drop folder of its own, a HeyGen voice's plan is marked as filmed here before its voice is filed as the plan's video (Phase 3, L4); a script's
  // is marked by its first footage already, and one whose footage began before the switch has no `local` and is joined the old way (D9).
  if (voice && isLocal(ctx.settings) && !keptOnAMac(plan)) {
    if ((await kit.save({ ...found, record: plan }, { ...plan, local: { on: ctx.machine } }, "")) !== 0) return stop("the plan could not be marked as made on this Mac");
    const marked = readEpisode(found.folder);
    if (!marked.record || marked.newer) return stop("the plan could not be read again");
    plan = marked.record;
  }
  // A plan kept on this Mac has its video filed into its own video/ here, with no late check of Dropbox's.
  const here = keptOnAMac(plan);
  const chosen = taken.parts;
  const tools = deps.tools;
  const work = join(runsFolder(ctx.home), `join-${process.pid}-${ctx.now()}`);
  // The run's own folder is kept once the video is filed, for the late check; until then it is taken away with whatever is in it.
  let kept = false;
  try {
    mkdirSync(work, { recursive: true });
    const bring = deps.readAll || readThrough;
    /** Make a file of a part whole on this Mac (Dropbox may show only a placeholder), or say why not: "" when it is here. A part kept on another Mac is that
        Mac's, and one kept on this Mac that is not whole in its video/ is for Jason: neither is Dropbox's to bring (Phase 3, L4). */
    const hereWhy = async (part, path, rel) => {
      if (keptOnAMac(part.record)) {
        const away = onOtherMac(ctx, part.record);
        if (away) return ON_OTHER_MAC(labelOf(part), away);
        return ctx.isWhole(path) ? "" : `${labelOf(part)}'s ${roleOf(rel)} is not whole on this Mac. Ask Jason.`;
      }
      if (!ctx.isWhole(path)) {
        try {
          await bring(path);
        } catch (e) {
          return `${labelOf(part)} could not be read from Dropbox (${String(e.message).replace(/\.$/, "")})`;
        }
      }
      return ctx.isWhole(path) ? "" : `Dropbox is still bringing ${labelOf(part)} over to this Mac`;
    };
    if (voice) {
      // A HeyGen voice (PR H6): copied out of the project (never moved), read, taken in with the light import's steps, and filed as the plan's video,
      // with the project as the main project in use, in one write.
      const copy = join(work, basename(heard.file));
      copyFileSync(heard.file, copy);
      const out = join(work, "probe-voice.json");
      const ran = await deps.run(tools.ffprobe, probeArgs(copy, out));
      let printed = "";
      try {
        printed = ran.code === 0 ? readFileSync(out, "utf8") : "";
      } catch (e) {
        printed = "";
      }
      const fault = voiceFault(printed);
      if (fault) return stop(fault);
      const facts = factsOf(printed);
      const modified = localStamp(statSync(copy).mtime);
      const at = localStamp(new Date(ctx.now()));
      const { project } = heard;
      const imported = await importInto(copy, {
        folder: found.folder,
        record: plan,
        local: here,
        change: (made) => videoOf(plan, made, {
          at, machine: ctx.machine, ids: [], came: "sound", seen: made.answer && typeof made.answer.seen === "string" ? made.answer.seen : "", kind: "short video", voice: "heygen",
          project: {
            key: "main", name: project.name, madeAt: project.madeAt, on: project.on, from: { file: made.video.file, bytes: made.video.bytes, modified },
            workingCopy: { bytes: made.video.bytes, seconds: facts.duration, fps: 30 }, opened: project.opened, handover: false, fromSuggestion: null, state: "opened"
          }
        })
      }, { ...deps, episode, work, shown: title });
      if (!imported.filed) return stop(String(imported.message || "the work stopped").replace(/^it could not be filed into Episodes: /, ""));
      kept = !here;
      if (!imported.ok) ctx.say(`${title}: ${imported.message}.`);
      ctx.say(`${title}: made from its voice, as ${imported.filed.record.id}.`);
      return {
        ok: true, made: ["the video from its voice"], failed: [], next: "",
        started: { kind: imported.filed.record.kind, rev: imported.filed.record.rev, video: imported.filed.record.video.file, explainer: true, project: true }
      };
    }
    // What ffprobe prints of each part's video, as a JSON text, "" for one it cannot read.
    const printeds = [];
    for (const [i, part] of chosen.entries()) {
      const video = fileAt(ctx, part, part.record.video.file);
      const why = await hereWhy(part, video, part.record.video.file);
      if (why) return stop(why);
      // The video is the one that came in: a plan made its video can never be joined again, so a file Dropbox is still changing makes no video (the final review, fix 3).
      if (differs(video, part.record.video?.bytes)) return stop(changedWords(part));
      const out = join(work, `probe-${i + 1}.json`);
      const ran = await deps.run(tools.ffprobe, probeArgs(video, out));
      let printed = "";
      try {
        printed = ran.code === 0 ? readFileSync(out, "utf8") : "";
      } catch (e) {
        printed = "";
      }
      printeds.push(printed);
    }
    // The talking parts must be joinable by copying; the one voiceover of an explainer is a sound alone, with nothing to compare (PR H6).
    const fault = taken.explainer ? voiceoverFault(printeds[0], chosen[0]) : partsFault(printeds);
    if (fault) return stop(fault);
    const machine = ctx.machine;
    const at = localStamp(new Date(ctx.now()));
    const joinedIds = chosen.map((part) => part.record.id);
    const came = chosen[0].record.answer.came ?? null;
    /** Right before the record is written: the talking parts are the ones this run joined, as they were. It throws, and the files are taken out again. */
    const unchanged = () => {
      const now = partsOf(ctx.root, plan.id, { newer: true }).filter(takenOf(plan));
      const same = now.length === chosen.length && chosen.every((part) => {
        const again = now.find((one) => one.record.id === part.record.id);
        return again !== undefined && again.record.rev === part.record.rev && partHeld(again) === null;
      });
      if (!same) throw new Error(taken.explainer ? "the voiceover changed while it was taken in" : "a talking part changed while the footage was joined");
    };
    const into = (seen) => ({
      folder: found.folder,
      record: plan,
      local: here,
      change: (made) => {
        unchanged();
        // An explainer is a short video whatever its voice is (a recording of sound alone is an episode by the import's rule), and its voice is hers when
        // it had none chosen: the voiceover is hers.
        return videoOf(plan, made, {
          at, machine, ids: joinedIds, came, seen: seen ?? (made.answer && typeof made.answer.seen === "string" ? made.answer.seen : ""),
          ...(taken.explainer ? { kind: "short video", voice: plan.planned.voice ?? "sallie" } : {})
        });
      }
    });
    const fdeps = { ...deps, episode };
    let filed;
    let late = "";
    if (chosen.length === 1) {
      const [part] = chosen;
      // A talking part has sound, and a video with no sound takes no kind (ruling 5): one alone with no sound this Mac can read is never taken in
      // as the plan's video. Several are held to the sound of the first by partsFault, and to a sound to join by the check of its streams below.
      if (streamsOf(printeds[0]).audio === null) return stop(`${labelOf(part)} has no sound, so it can't be a talking part`);
      const facts = factsOf(printeds[0]);
      const video = fileAt(ctx, part, part.record.video.file);
      // The files its light import filed beside it: the part's record lists them.
      const rels = Object.keys(part.record.files).filter((rel) => rel !== part.record.video.file && !rel.startsWith("record/"));
      for (const rel of rels) {
        const why = await hereWhy(part, fileAt(ctx, part, rel), rel);
        if (why) return stop(why);
        if (differs(fileAt(ctx, part, rel), part.record.files[rel])) return stop(changedWords(part));
      }
      try {
        filed = fileEpisode({
          file: video, made: rels.map((rel) => fileAt(ctx, part, rel)), at: (to) => to, facts, printed: printeds[0], kind: taken.explainer || episodeKind(facts) === "short video" ? "short video" : "raw",
          read: null, reels: [], work, fingerprint: typeof part.record.fingerprint === "string" ? part.record.fingerprint : "", into: into(part.record.answer.seen)
        }, fdeps);
      } catch (e) {
        return stop(String(e.message).replace(/\.$/, ""));
      }
      kept = !here;
      // A plan kept on this Mac was filed into its own video/ here: nothing is in Dropbox but its record, and no late check is owed (D4).
      if (!here) {
        const pending = pendingFor(filed, { video: part.record.video.file, drop: join(work, "not in a drop folder"), work, planTxt: `${basename(part.record.video.file, extname(part.record.video.file))}.cut-plan.txt`, label: title }, { episode, clock: deps.clock || Date.now });
        try {
          writePending(ctx.home, pending);
          ctx.say(`${title}: copied into Dropbox. Dropbox's check of its copies is made in ${LATE_CHECK_MS / 60000} minutes.`);
          // The result keeps it too (plan R1a), with no title: "how far is it?" and the guide's tell read the result, not the log.
          late = `copied into Dropbox, and Dropbox's check of its copies is made in ${LATE_CHECK_MS / 60000} minutes`;
        } catch (e) {
          ctx.say(`${title}: copied into Dropbox, but the check of its copies could not be kept (${e.code || e.message}), so it is not made.`);
        }
      }
    } else {
      const output = join(work, `${fileSafe(title)}.mov`);
      const list = join(work, "parts.txt");
      const streams = streamsOf(printeds[0]);
      if (streams.video === null || streams.audio === null) return stop("talking part 1 has no picture or no sound this Mac can read, so the parts cannot be joined");
      try {
        writeFileSync(list, concatList(chosen.map((part) => fileAt(ctx, part, part.record.video.file))));
      } catch (e) {
        return stop(String(e.message).replace(/\.$/, ""));
      }
      const seconds = printeds.reduce((sum, printed) => sum + (factsOf(printed)?.duration ?? 0), 0);
      deps.progress.begin(title);
      deps.progress.steps([JOIN_STEP]);
      deps.progress.step(JOIN_STEP);
      let ended;
      try {
        ended = await (deps.runGuarded || runGuarded)(tools.ffmpeg, joinArgs(list, output, streams), workCopyLimits(seconds));
      } finally {
        deps.progress.end(false);
      }
      if (ended.overMemory || ended.outOfTime) return stop(`ffmpeg was stopped: ${ended.stopped}`);
      if (ended.signal) return stop(`ffmpeg was killed by ${ended.signal}`);
      if (ended.code !== 0 || !existsSync(output) || !(statSync(output).size > 0)) return stop(lastLine(ended.stderr) || "ffmpeg wrote nothing");
      const imported = await importInto(output, into(null), { ...fdeps, work, shown: title });
      if (!imported.filed) return stop(String(imported.message || "the work stopped").replace(/^it could not be filed into Episodes: /, ""));
      filed = imported.filed;
      kept = !here;
      if (!imported.ok) ctx.say(`${title}: ${imported.message}.`);
    }
    ctx.say(`${title}: made from its ${taken.explainer ? "voice" : "footage"}, as ${filed.record.id}.`);
    return {
      ok: true, made: [taken.explainer ? "the video from its voice" : "the video from its footage", ...(late ? [late] : [])], failed: [], next: "",
      started: { kind: filed.record.kind, rev: filed.record.rev, video: filed.record.video.file, explainer: taken.explainer }
    };
  } catch (e) {
    return stop(`the work stopped (${e.code || e.message})`);
  } finally {
    if (!kept) rmSync(work, { recursive: true, force: true });
  }
}

/** When the video for HyperFrames that was asked for will be ready, as the notice says it (plan R1a): " It opens in HyperFrames about 17:26.", by the
    speed this Mac measured of making one and the length of the video, from when the copy can begin: now, or, while it must wait for the import's late
    check (late-wait.js waitFacts), when that is made. Nothing while this Mac has measured no speed, so that no time is named that cannot be backed. */
function opensAt(ctx, record) {
  const seconds = copyIn(readRates(progressFolder(ctx.home)), record.video && record.video.seconds);
  if (seconds === null) return "";
  const wait = waitFacts(ctx, record, seconds);
  const at = wait ? wait.readyAt : clockAt(Math.round((ctx.now() + seconds * 1000) / 60000) * 60000);
  return ` It opens in HyperFrames about ${at}.`;
}

/** What follows a join run that made the plan its video (`started`: its kind, its rev and its video's file), once the run has let go of the plan's lock,
    which the reading needs: as `kind` does after its answer. The record is read again and must be the one the run wrote. Claude's reading of the
    video is started (`read --kind <kind> --rev <rev>`, detached, which waits for the late check as a raw reading does), unless this Mac's readings
    are off; then the working copy of the video, on a Mac set up for HyperFrames and when the video is whole here (workcopy.js requestWorkCopy: it
    makes the copies of the footage after it); then the launch agent is asked to look, which makes this Mac's late check at its time, as it does of
    an import's (the join is no import, and nothing else would make it); and the notice is posted: `Ready: "<title>" is made from its footage.` */
export function afterJoin(ctx, found, started, notify = banner) {
  const wrote = readEpisode(found.folder);
  if (!wrote.record || wrote.newer || wrote.record.rev !== started.rev || wrote.record.kind !== started.kind) return;
  const title = shownName(wrote.record);
  // A HeyGen voice's video (PR H6) is read, for its spellings, but has no working copy made: its project holds the voice already.
  let copyAsked = false;
  if (ctx.settings.readings !== false) {
    startDetached(ctx, { command: "read", folder: found.name, args: ["--kind", started.kind, "--rev", String(started.rev)] });
    if (started.project !== true && appOf(ctx.settings) !== "" && ctx.isWhole(fileAt(ctx, { folder: found.folder, record: wrote.record }, started.video))) {
      requestWorkCopy(ctx, { folder: found.name });
      copyAsked = true;
    }
  }
  // A plan kept on this Mac owes no late check, so the launch agent is not asked to make one (Phase 3, L4, D4), and the copy starts at once: the notice names no time.
  const here = keptOnAMac(wrote.record);
  if (!here && !ctx.agentRunning()) {
    try {
      ctx.kickstart();
    } catch (e) {
      ctx.say(`${title}: the launch agent could not be asked to make the check of its copies (${String(e.message).replace(/\.$/, "")}). It is made when the Mac's import next runs.`);
    }
  }
  // A video kept on this Mac whose video for HyperFrames is being made opens by itself once it is ready, when she asks for it (Phase 3, L7).
  if (started.explainer !== true && copyAsked && here) {
    notify(`Ready: "${title}" is made from its footage. Say "open ${title} in HyperFrames": it opens by itself once its video is ready.`);
    return;
  }
  notify(started.explainer === true ? `Ready: "${title}" has its voice. In Claude, say "what's next?"` : `Ready: "${title}" is made from its footage.${copyAsked && !here ? opensAt(ctx, wrote.record) : ""} In Claude, say "what's next?"`);
}
