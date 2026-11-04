// The talking parts joined into the plan's video, and the plan's footage ready for its project (design 2026-11-04, H5; PR H5b). A planned
// video (plan.js) waits for its footage; each piece she drops is a part of it (footage.js). When she says all the footage is in, the talking
// parts are put in the order of the teleprompter script, joined by copying their streams, taken in with the light import's own steps, and
// filed as the plan's own video: the plan's record, written once more as the video it was waiting to be (episode.js isFromPlan). Its b-roll
// and screen recordings are made into copies with no sound for the HyperFrames project (workcopy.js) and moved into its media/ (app.js).
//
// This first half is pure: the parts' words and what ffprobe printed of them go in, and the order they come in, whether they can be joined,
// the list and the arguments ffmpeg is given, and the footage a plan's parts give its project come out. The only thing it looks at is whether
// a part's episode is held (footage.js partHeld), which every consumer of a part asks (PR H5b, ruling 1).
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { GRAPHIC_CUE_KINDS, cueTokens, graphicCuesOf } from "./graphic-cues.js";
import { factsOf, framesASecond, probeArgs, streamsOf, soundStream } from "./cuts.js";
import { isFromPlan, isPart, isPlannedRecord, localStamp, readEpisode, shownName, undone } from "./episode.js";
import { keepTitle, labelOf, mayGoIn, partHeld, partNamed, partsOf } from "./footage.js";
import { runningCommand, startDetached } from "./detached.js";
import { LATE_CHECK_MS, readThrough } from "./dropbox.js";
import { episodeKind, fileEpisode, pendingFor, writePending } from "./filing.js";
import { runGuarded } from "./guard.js";
import { fileSafe } from "./names.js";
import { lastLine } from "./run.js";
import { appOf, runsFolder } from "./settings.js";
import { banner, importInto } from "./unedited.js";
import { footageCopyPaths, requestWorkCopy, workCopyKey, workCopyLimits } from "./workcopy.js";

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

// --- The footage a plan's parts give its project ---

/** The kinds of part that are footage for a project: b-roll and a screen recording. A talking part is joined into the plan's video. */
const FOOTAGE_KINDS = ["b-roll", "screen"];

/** The file in a project's media/ that the footage of a shot is, whether or not it is there yet: `media/b-roll-2.mp4`, `media/screen-4.mp4`. */
export const footagePath = (as, shot) => `media/${as}-${shot}.mp4`;

/** The b-roll and screen parts among `parts` (as partsOf lists them) that are footage for the plan `record`, each as { part, as, shot, path }, in
    the order given. A part gives footage only while it may be used to make something, as far as its episode goes (footage.js partHeld: no
    conflicted copy, no record a newer brimm-video wrote), and only while its shot is still a shot of its kind in the plan's shot list: `plan …
    set` may change the shot list after parts exist, and a b-roll part whose shot is a screen recording now, or is not there, gives nothing
    (ruling 4). Whether her client agreed to it (footage.js mayGoIn) is not asked here: a cue names the file of such a part all the same, and the
    file goes into a project only once it has. */
export function footageOf(record, parts) {
  const shots = list(record?.planned?.shots);
  return list(parts)
    .filter((part) => isObject(part) && isPart(part.record) && part.record.partOf.id === record?.id && FOOTAGE_KINDS.includes(part.record.partOf.as))
    .filter((part) => shots.some((shot) => shot.n === part.record.partOf.shot && shot.kind === part.record.partOf.as))
    .filter((part) => partHeld(part) === null)
    .map((part) => ({ part, as: part.record.partOf.as, shot: part.record.partOf.shot, path: footagePath(part.record.partOf.as, part.record.partOf.shot) }));
}

/** The footage of the plan `record` that may go into its project now (PR H5b): footageOf's, of the parts her client has agreed to or that show no
    client (footage.js mayGoIn). Every copy of footage that is made, and every file that is moved into a project's media/, is of these and of no other. */
export const footageToUse = (record, parts) => footageOf(record, parts).filter(({ part }) => mayGoIn(part, record.planned));

/** What a held part (footage.js partHeld) is called in the log. */
const HELD_SAID = { conflicted: "its episode holds a conflicted copy", newer: "a newer brimm-video wrote its record", unreadable: "its record cannot be read" };

/** The b-roll and screen parts of the plan `record` among `parts` that give no footage now, each as { part, why } in the order given, `why` being
    what the log says: that its episode is held (conflicted copies, a record a newer brimm-video wrote, a record that cannot be read: ruling 1),
    that its shot is no longer a shot of its kind in the plan (ruling 4), or that her client has not agreed to it. A part a newer brimm-video wrote
    is among them whatever its kind, since its record cannot be read as a part's. Talking parts, parts of other plans and what is no part are not. */
export function footageWithheld(record, parts) {
  const going = new Set(footageToUse(record, parts).map(({ part }) => part));
  const shots = list(record?.planned?.shots);
  return list(parts)
    .filter((part) => isObject(part) && !going.has(part) && (part.newer === true || (isPart(part.record) && part.record.partOf.id === record?.id && FOOTAGE_KINDS.includes(part.record.partOf.as))))
    .map((part) => {
      const held = partHeld(part);
      if (held) return { part, why: HELD_SAID[held.why] ?? HELD_SAID.unreadable };
      const { as, shot } = part.record.partOf;
      if (!shots.some((one) => one.n === shot && one.kind === as)) return { part, why: "its shot is not a shot of its kind in the plan any more" };
      return { part, why: "her client has not agreed to it" };
    });
}

/** The cues of a plan's video with the file each cue that shows footage names, as `material`: a b-roll or a screen cue, which names the shot it
    shows (`shot`), is given the file of that shot's footage (`media/b-roll-2.mp4`), whether or not the file is in the project yet. A cue of
    any other kind is left as it is. A cue whose shot has a part that is withheld (footageOf gives nothing of it: its shot is of another kind
    now, or its episode is held) is given none; and a cue whose shot has no part yet is given the file it will have, so that the project's
    notes can tell her it has no footage yet. */
export function withMaterial(cues, record, parts) {
  const given = footageOf(record, parts);
  const aPart = (cue) => list(parts).some((part) => isObject(part) && isPart(part.record) && part.record.partOf.id === record?.id && part.record.partOf.as === cue.kind && part.record.partOf.shot === cue.shot);
  return list(cues).map((cue) => {
    if (!isObject(cue) || !FOOTAGE_KINDS.includes(cue.kind) || !Number.isInteger(cue.shot)) return cue;
    const footage = given.find((one) => one.as === cue.kind && one.shot === cue.shot);
    if (footage) return { ...cue, material: footage.path };
    return aPart(cue) ? cue : { ...cue, material: footagePath(cue.kind, cue.shot) };
  });
}

/** Where the copy of a part's footage is made, as the path of its video, or null while it is not whole there (its video and its facts, workcopy.js
    footageCopyPaths): the copy is named for its shot and the key of the part's own video, so a part whose video has changed has none. */
function copyOfFootage(ctx, found, part, shot) {
  try {
    const raw = statSync(join(part.folder, part.record.video.file));
    const paths = footageCopyPaths(ctx.home, found.name, shot, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
    return existsSync(paths.video) && existsSync(paths.facts) ? paths.video : null;
  } catch (e) {
    return null;
  }
}

/** What the plan a video was made from gives its main project (PR H5b), once its parts are read from Episodes (`ctx` is edit.js's: { home, root }):
    { cues, footage }, or null for a record that is no video made from a plan (episode.js isFromPlan). It is read at the moment the project is made
    and at every open, so that a part her client agrees to later, and a copy made since, are found the next time.
    - `cues` are the plan's guide's, planned.cues read again as a package's are (graphicCuesOf with every kind of cue), each b-roll and screen cue
      named after its footage's file (withMaterial), whether or not the file is in yet;
    - `footage` are the files that may go into the project's media/ (footageToUse), each { path, as, shot, from }: `from` is the copy of the part's
      footage, made for HyperFrames with no sound (workcopy.js), or null while it is not made.
    app.js is given this as a function (its `plan` dep) rather than importing it: footage.js reaches app.js through finish.js. */
export function planProject(ctx, { found, record }) {
  if (!isFromPlan(record)) return null;
  const parts = partsOf(ctx.root, record.id, { newer: true });
  const cues = withMaterial(graphicCuesOf(record.planned.cues, { kinds: GRAPHIC_CUE_KINDS }).cues, record, parts);
  const footage = footageToUse(record, parts).map(({ part, as, shot, path }) => ({ path, as, shot, from: copyOfFootage(ctx, found, part, shot) }));
  return { cues, footage };
}

// --- plan "<planned>" join ["<video>"…]: "that's all the footage" ---

/** Whether a part of the plan is a talking part. A part a newer brimm-video wrote (`newer: true`) is taken for one unless its record says it is
    b-roll or a screen recording: a talking part that cannot be read is refused, and never left out of the video without a word. */
const isTalking = (part) => (part.newer === true ? !FOOTAGE_KINDS.includes(part.record?.partOf?.as) : part.record.partOf.as === "talking");

/** The words a talking part is read from, for the order it comes in: the words file its light import filed. [] when it is not there, is not whole
    or cannot be read, and the part then has no place in the script. */
function wordsOfPart(part) {
  const stem = basename(part.record.video.file, extname(part.record.video.file));
  try {
    const held = JSON.parse(readFileSync(join(part.folder, `${stem}.words.json`), "utf8"));
    return Array.isArray(held?.words) ? held.words : [];
  } catch (e) {
    return [];
  }
}

/** What is said of a talking part that must not be joined (footage.js partHeld), the words a command gives that episode today with the part's
    label first, so that she knows which video to sort out: Dropbox's conflicted copy, or a record a newer brimm-video wrote, or one that cannot
    be read. `kit` is edit.js's (notRead, newerWhy). */
export function heldWords(part, held, kit) {
  if (held.why === "newer") {
    const label = typeof part.record?.label === "string" && part.record.label !== "" ? `${part.record.label}: ` : "";
    return `${label}${kit.newerWhy(held.record)}`;
  }
  if (held.read) return kit.notRead({ name: part.name, folder: part.folder }, held.read);
  return `${labelOf(part)}: its record cannot be read now. Ask Jason.`;
}

/** The talking parts of the plan `record`, in the order they come in by its script, and what is wrong with them, from one look at Episodes: { talking,
    ordered, held } or { why }. `talking` are partsOf's (answered order; a part a newer brimm-video wrote among them), `ordered` the same as
    partOrder gives them ({ id, label, place }), and `held` the first of them that must not be joined, { part, held }, or null. Each part is hidden
    from what is said first (kit.hide), and the plan's title is kept (footage.js keepTitle). */
function talkingOf(ctx, record, kit) {
  const talking = partsOf(ctx.root, record.id, { newer: true }).filter(isTalking);
  for (const part of talking) kit.hide(part.name);
  const first = talking.map((part) => ({ part, held: partHeld(part) })).find(({ held }) => held !== null) ?? null;
  const ordered = partOrder(talking.map((part) => ({ id: part.record.id, label: labelOf(part), words: wordsOfPart(part) })), record.planned.lines);
  return { talking, ordered, held: first };
}

/** `plan "<planned>" join ["<video>"…]`, for "that's all the footage", once edit.js has found the plan through the gate (its record is `got.record`) and
    plan.js has shown it is no video made from its footage already. In this order it refuses, writing nothing and starting nothing, with 1:
    - an explainer: its voice makes it, and it has no footage to join;
    - a run at work on the plan, as `kind` says it;
    - a plan with no talking part yet;
    - a talking part that must not be joined (partHeld): the words of its episode's conflict, or of its newer record, with its label first;
    - videos that are not each of the plan's talking parts once, in the plan's words, with the talking parts named.
    With two talking parts or more and none named, it says the order the script puts them in (partOrder) and which has no place in it, and that no
    more can be added once they are joined; it writes nothing and starts nothing, and ends 0. With one talking part, or the parts named, it starts the
    join run (`join --now <the plan's folder> --parts <ids, in her order>`, detached) and says a notice comes when it is ready. */
export function joinFor(ctx, got, asked, kit) {
  const { found, record } = got;
  const title = shownName(record);
  keepTitle(ctx, title);
  if (record.planned.route === "explainer") return refuse(ctx, `"${title}" is an explainer: its voice makes it, and it has no footage to join.`);
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) return refuse(ctx, `${running} is running for ${kit.calledAs(found)} already. Say it again when it has finished.`);
  const { talking, ordered, held } = talkingOf(ctx, record, kit);
  if (!talking.length) return refuse(ctx, `"${title}" has no talking part yet: a video needs at least one.`);
  if (held) return refuse(ctx, heldWords(held.part, held.held, kit));
  let ids = ordered.map((part) => part.id);
  if (asked.videos.length) {
    const named = asked.videos.map((word) => partNamed(talking, word));
    if (named.some((part) => !part) || named.length !== talking.length || new Set(named).size !== talking.length) {
      return refuse(ctx, `Those aren't the talking parts of "${title}". They are: ${ordered.map((part) => part.label).join(", ")}.`);
    }
    ids = named.map((part) => part.record.id);
  } else if (talking.length > 1) {
    ctx.say(`The talking parts of "${title}", in the order of its script:`);
    ordered.forEach((part, i) => ctx.say(`${i + 1}. ${part.label}${part.place === null ? ", whose words weren't found in the script" : ""}`));
    ctx.say("Once they are joined, no more talking parts can be added.");
    return 0;
  }
  startDetached(ctx, { command: "join", folder: found.name, args: ["--parts", ids.join(",")] });
  ctx.say(`"${title}" is being made from its footage. A notice comes when it is ready.`);
  return 0;
}

// --- The join run: the plan made its video ---

/** The step of the progress panel while the parts are joined into one file. */
export const JOIN_STEP = "Joining the parts";

/** The result of a join run that did not make the plan its video: nothing of the plan was changed, and its result says why in the words the guide
    sends her to ("how far is it?"). */
const stopped = (title, why) => ({ ok: false, made: [], failed: [`The footage of "${title}" couldn't be made into one video: ${String(why).replace(/\.$/, "")}.`], next: "" });

/** The record the join writes, from the plan's own (`plan`) and the record a new episode would have had (`made`, fileEpisode's `first`): the plan
    written once more as the video it was waiting to be (episode.js isFromPlan). Its kind is the rule's ("raw", or "short video"), its video, files
    and fingerprint those of the video that was filed, with the plan's own files kept; its answer says it is answered, by this Mac, now, as no card
    asked her anything: what was seen of it and how it came are the first talking part's (`seen` is that of the video the light import read, for
    several parts); and its plan is kept whole but for `filmed`, { at, parts }: when, and which parts, in the order they were joined. Nothing else
    of the plan's record changes: its name stays its title, and it stays at layout 5. */
function videoOf(plan, made, { at, machine, ids, came, seen }) {
  return {
    ...plan,
    kind: made.kind,
    video: made.video,
    files: { ...plan.files, ...made.files },
    ...(made.fingerprint ? { fingerprint: made.fingerprint } : {}),
    answer: { state: "answered", guess: null, seen, came, by: machine, on: machine, at, private: "no" },
    planned: { ...plan.planned, filmed: { at, parts: ids } }
  };
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
export async function joinRun(ctx, { found }, ids, deps, kit) {
  const episode = { root: ctx.root, machine: ctx.machine, checkout: deps.checkout, home: ctx.home };
  const read = readEpisode(found.folder);
  const named = read.record ? shownName(read.record) : found.name;
  const stop = (why) => {
    ctx.say(`${named}: ${why}`);
    return stopped(named, why);
  };
  if (!read.record) return stop(String(read.why).replace(/\.$/, ""));
  if (read.newer) return stop(kit.newerWhy(read.record));
  const plan = read.record;
  const title = shownName(plan);
  keepTitle(ctx, title);
  const gone = undone(plan, ctx.home);
  if (gone) return stop(gone);
  if (isFromPlan(plan)) return stop(`"${title}" is made from its footage already.`);
  if (!isPlannedRecord(plan) || plan.archived) return stop(plan.archived ? `The plan for "${title}" was dropped.` : `"${title}" is not a planned video.`);
  if (plan.planned.route === "explainer") return stop(`"${title}" is an explainer: its voice makes it, and it has no footage to join.`);
  const { talking, ordered, held } = talkingOf(ctx, plan, kit);
  if (!talking.length) return stop(`"${title}" has no talking part yet: a video needs at least one.`);
  if (held) return stop(heldWords(held.part, held.held, kit));
  const chosen = ids.map((id) => talking.find((part) => part.record.id === id));
  if (chosen.some((part) => !part) || chosen.length !== talking.length || new Set(chosen).size !== talking.length) {
    return stop(`Those aren't the talking parts of "${title}". They are: ${ordered.map((part) => part.label).join(", ")}.`);
  }
  const tools = deps.tools;
  const work = join(runsFolder(ctx.home), `join-${process.pid}-${ctx.now()}`);
  // The run's own folder is kept once the video is filed, for the late check; until then it is taken away with whatever is in it.
  let kept = false;
  try {
    mkdirSync(work, { recursive: true });
    const bring = deps.readAll || readThrough;
    /** Make a file of a part whole on this Mac (Dropbox may show only a placeholder), or say why not: "" when it is here. */
    const hereWhy = async (part, path) => {
      if (!ctx.isWhole(path)) {
        try {
          await bring(path);
        } catch (e) {
          return `${labelOf(part)} could not be read from Dropbox (${String(e.message).replace(/\.$/, "")})`;
        }
      }
      return ctx.isWhole(path) ? "" : `Dropbox is still bringing ${labelOf(part)} over to this Mac`;
    };
    // What ffprobe prints of each part's video, as a JSON text, "" for one it cannot read.
    const printeds = [];
    for (const [i, part] of chosen.entries()) {
      const video = join(part.folder, part.record.video.file);
      const why = await hereWhy(part, video);
      if (why) return stop(why);
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
    const fault = partsFault(printeds);
    if (fault) return stop(fault);
    const machine = ctx.machine;
    const at = localStamp(new Date(ctx.now()));
    const joinedIds = chosen.map((part) => part.record.id);
    const came = chosen[0].record.answer.came ?? null;
    /** Right before the record is written: the talking parts are the ones this run joined, as they were. It throws, and the files are taken out again. */
    const unchanged = () => {
      const now = partsOf(ctx.root, plan.id, { newer: true }).filter(isTalking);
      const same = now.length === chosen.length && chosen.every((part) => {
        const again = now.find((one) => one.record.id === part.record.id);
        return again !== undefined && again.record.rev === part.record.rev && partHeld(again) === null;
      });
      if (!same) throw new Error("a talking part changed while the footage was joined");
    };
    const into = (seen) => ({
      folder: found.folder,
      record: plan,
      change: (made) => {
        unchanged();
        return videoOf(plan, made, { at, machine, ids: joinedIds, came, seen: seen ?? (made.answer && typeof made.answer.seen === "string" ? made.answer.seen : "") });
      }
    });
    const fdeps = { ...deps, episode };
    let filed;
    if (chosen.length === 1) {
      const [part] = chosen;
      // A talking part has sound, and a video with no sound takes no kind (ruling 5): one alone with no sound this Mac can read is never taken in
      // as the plan's video. Several are held to the sound of the first by partsFault, and to a sound to join by the check of its streams below.
      if (streamsOf(printeds[0]).audio === null) return stop(`${labelOf(part)} has no sound, so it can't be a talking part`);
      const facts = factsOf(printeds[0]);
      const video = join(part.folder, part.record.video.file);
      // The files its light import filed beside it: the part's record lists them.
      const rels = Object.keys(part.record.files).filter((rel) => rel !== part.record.video.file && !rel.startsWith("record/"));
      for (const rel of rels) {
        const why = await hereWhy(part, join(part.folder, rel));
        if (why) return stop(why);
      }
      try {
        filed = fileEpisode({
          file: video, made: rels.map((rel) => join(part.folder, rel)), at: (to) => to, fcpxml: "", facts, printed: printeds[0], kind: episodeKind(facts) === "short video" ? "short video" : "raw",
          read: null, reels: [], work, fingerprint: typeof part.record.fingerprint === "string" ? part.record.fingerprint : "", into: into(part.record.answer.seen)
        }, fdeps);
      } catch (e) {
        return stop(String(e.message).replace(/\.$/, ""));
      }
      kept = true;
      const pending = pendingFor(filed, { video: part.record.video.file, drop: join(work, "not in a drop folder"), work, planTxt: `${basename(part.record.video.file, extname(part.record.video.file))}.cut-plan.txt`, label: title }, { episode, clock: deps.clock || Date.now });
      try {
        writePending(ctx.home, pending);
        ctx.say(`${title}: copied into Dropbox. Its late check is made in ${LATE_CHECK_MS / 60000} minutes.`);
      } catch (e) {
        ctx.say(`${title}: copied into Dropbox, but its late check could not be kept (${e.code || e.message}), so it is not made.`);
      }
    } else {
      const output = join(work, `${fileSafe(title)}.mov`);
      const list = join(work, "parts.txt");
      const streams = streamsOf(printeds[0]);
      if (streams.video === null || streams.audio === null) return stop("talking part 1 has no picture or no sound this Mac can read, so the parts cannot be joined");
      try {
        writeFileSync(list, concatList(chosen.map((part) => join(part.folder, part.record.video.file))));
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
      const imported = await importInto(output, into(null), { ...fdeps, work, shown: title, light: true });
      if (!imported.filed) return stop(String(imported.message || "the work stopped").replace(/^it could not be filed into Episodes: /, ""));
      filed = imported.filed;
      kept = true;
      if (!imported.ok) ctx.say(`${title}: ${imported.message}.`);
    }
    ctx.say(`${title}: made from its footage, as ${filed.record.id}.`);
    return { ok: true, made: ["the video from its footage"], failed: [], next: "", started: { kind: filed.record.kind, rev: filed.record.rev, video: filed.record.video.file } };
  } catch (e) {
    return stop(`the work stopped (${e.code || e.message})`);
  } finally {
    if (!kept) rmSync(work, { recursive: true, force: true });
  }
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
  if (ctx.settings.readings !== false) {
    startDetached(ctx, { command: "read", folder: found.name, args: ["--kind", started.kind, "--rev", String(started.rev)] });
    if (appOf(ctx.settings) !== "" && ctx.isWhole(join(found.folder, started.video))) requestWorkCopy(ctx, { folder: found.name });
  }
  if (!ctx.agentRunning()) {
    try {
      ctx.kickstart();
    } catch (e) {
      ctx.say(`${title}: the launch agent could not be asked to make its late check (${String(e.message).replace(/\.$/, "")}). It is made when the Mac's import next runs.`);
    }
  }
  notify(`Ready: "${title}" is made from its footage. In Claude, say "what's next?"`);
}
