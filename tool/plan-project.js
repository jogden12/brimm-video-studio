// What the plan a video was made from gives its main HyperFrames project (design 2026-11-04, H5 and H6; PR H5b, and PR H6, which moved it here from
// join.js, as the plan's ruling 2 asked, since the explainer's project adds to it): the plan's guide as the project's cues, each cue that shows footage
// named after its file, and the footage that may go into the project's media/. It is read at the moment the project is made and at every open, so
// that a part her client agrees to later, and a copy made since, are found the next time.
//
// app.js is given `planProject` as a function (its `plan` dep, which edit.js passes) and does not import this module: footage.js reaches app.js
// through finish.js, and this module reads the plan's parts through footage.js, so an import would make a cycle.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { GRAPHIC_CUE_KINDS, SHOT_KINDS, graphicCuesOf } from "./graphic-cues.js";
import { isFromPlan, isPart } from "./episode.js";
import { linksForParts, mayGoIn, partHeld, partsOf } from "./footage.js";
import { footageCopyPaths, workCopyKey } from "./workcopy.js";
import { fileAt } from "./where.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);

// --- The footage a plan's parts give its project ---

/** The kinds of part that are footage for a project: b-roll and a screen recording. A talking part is joined into the plan's video. */
export const FOOTAGE_KINDS = ["b-roll", "screen"];

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
  const links = linksForParts(parts);
  return list(parts)
    .filter((part) => isObject(part) && isPart(part.record) && part.record.partOf.id === record?.id && FOOTAGE_KINDS.includes(part.record.partOf.as))
    .filter((part) => shots.some((shot) => shot.n === part.record.partOf.shot && shot.kind === part.record.partOf.as))
    .filter((part) => partHeld(part, links()) === null)
    .map((part) => ({ part, as: part.record.partOf.as, shot: part.record.partOf.shot, path: footagePath(part.record.partOf.as, part.record.partOf.shot) }));
}

/** The footage of the plan `record` that may go into its project now (PR H5b): footageOf's, of the parts her client has agreed to or that show no
    client (footage.js mayGoIn). Every copy of footage that is made, and every file that is moved into a project's media/, is of these and of no other. */
export const footageToUse = (record, parts) => footageOf(record, parts).filter(({ part }) => mayGoIn(part, record.planned));

/** What a held part (footage.js partHeld) is called in the log. */
const HELD_SAID = { conflicted: "its episode holds a conflicted copy", newer: "a newer BRIMM Video Studio wrote its record", unreadable: "its record cannot be read", session: "it is held as a session" };

/** The b-roll and screen parts of the plan `record` among `parts` that give no footage now, each as { part, why } in the order given, `why` being
    what the log says: that its episode is held (conflicted copies, a record a newer brimm-video wrote, a record that cannot be read: ruling 1),
    that its shot is no longer a shot of its kind in the plan (ruling 4), or that her client has not agreed to it. A part a newer brimm-video wrote
    is among them whatever its kind, since its record cannot be read as a part's. Talking parts, parts of other plans and what is no part are not. */
export function footageWithheld(record, parts) {
  const going = new Set(footageToUse(record, parts).map(({ part }) => part));
  const shots = list(record?.planned?.shots);
  const links = linksForParts(parts);
  return list(parts)
    .filter((part) => isObject(part) && !going.has(part) && (part.newer === true || (isPart(part.record) && part.record.partOf.id === record?.id && FOOTAGE_KINDS.includes(part.record.partOf.as))))
    .map((part) => {
      const held = partHeld(part, links());
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
    const raw = statSync(fileAt(ctx, part, part.record.video.file));
    const paths = footageCopyPaths(ctx.home, found.name, shot, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
    return existsSync(paths.video) && existsSync(paths.facts) ? paths.video : null;
  } catch (e) {
    return null;
  }
}

/** What the plan a video was made from gives its main project (PR H5b), once its parts are read from Episodes (`ctx` is edit.js's: { home, root }):
    { cues, footage }, or null for a record that is no video made from a plan (episode.js isFromPlan). It is read at the moment the project is made
    and at every open, so that a part her client agrees to later, and a copy made since, are found the next time.
    - `cues` are the plan's guide's, planned.cues read again as a package's are (graphicCuesOf), each b-roll and screen cue of a script named after
      its footage's file (withMaterial), whether or not the file is in yet. An explainer's (PR H6) are its graphic and words cues alone (SHOT_KINDS: it
      has no footage to show), read again as a plan holds them;
    - `footage` are the files that may go into the project's media/ (footageToUse), each { path, as, shot, from }: `from` is the copy of the part's
      footage, made for HyperFrames with no sound (workcopy.js), or null while it is not made. An explainer has no footage: its `footage` is null,
      which gives its project no rule for footage cues, and an open nothing to move in.
    app.js is given this as a function (its `plan` dep) rather than importing it: footage.js reaches app.js through finish.js. */
export function planProject(ctx, { found, record }) {
  if (!isFromPlan(record)) return null;
  if (record.planned.route === "explainer") return { cues: graphicCuesOf(record.planned.cues, { kinds: SHOT_KINDS }).cues, footage: null };
  const parts = partsOf(ctx.root, record.id, { newer: true });
  const cues = withMaterial(graphicCuesOf(record.planned.cues, { kinds: GRAPHIC_CUE_KINDS }).cues, record, parts);
  const footage = footageToUse(record, parts).map(({ part, as, shot, path }) => ({ path, as, shot, from: copyOfFootage(ctx, found, part, shot) }));
  return { cues, footage };
}
