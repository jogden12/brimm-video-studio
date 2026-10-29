// finish, the detached part (spec section 5, steps 3 to 9). The quick part, in edit.js, found Final Cut's files, or HyperFrames' exports
// (exports.js), and asked what it had to; it wrote what it was told in finish.asked.json, on this Mac's own disk, and started this. This
// part waits until each finished video is whole, checks its shape, transcribes it again as the transcript tool does, cuts the parts of a
// Story from a finished Reel of more than a minute, and copies everything into the episode's final/ folder by the Dropbox rule, the
// hand-off last. Then it writes the record, shows the hand-off in Finder, and at least 15 minutes after the last copy checks the copies
// again; only when they are whole does it delete from From Final Cut, or from Downloads, what it took from there.
// A part is HyperFrames' when its entry in finish.asked.json names a `project`: its video is the export (no export of the edit goes with
// it), a Dropbox placeholder is brought over, its sound and colour are checked too, and what is removed after the late check is only a
// file in Downloads that has an export's name for that project (architecture 8.1 and 8.2). The other parts are Final Cut's, as they were.
// Nothing here asks anything: what a person must check is said in the result, which status shows.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { probeArgs, factsOf, colourOf, pauseArgs, pausesOf } from "./cuts.js";
import { clipArgs, storyCuts, STORY_MAX } from "./reframe.js";
import { captionsOf, settled, stampedText } from "./lib.js";
import { firstWordsMatch } from "./parts.js";
import { finalTranscript, spelled, spelledPairs, spelledCaptions } from "./final-transcript.js";
import { cutPhrases } from "./recut.js";
import { buildHandoff, handoffText, handoffFault, inMain } from "./handoff.js";
import { buildHandoffV2, handoffFaultV2, onPictureOf, fromSuggestionOf, hundredths, VERSION_2 } from "./handoff-v2.js";
import { cloneIn, replaceIn, lateCheck, textWriter, cloneFile, readThrough, LATE_CHECK_MS } from "./dropbox.js";
import { KEPT as PROJECT_KEPT, wordsIn } from "./app.js";
import { colourNote, isExportOf, shapeFault, soundFault } from "./exports.js";
import { REEL_KEY, SAY_AGAIN, heldReelParts, lostReelsWords, missingWords, nextHandoff, noHandoffWords, otherKindWords, unusableWords } from "./finish-reels.js";
import { respelledHeldReel } from "./spelling.js";
import { readEpisode, writeEpisode, localStamp, recordFile, heldElsewhere, kindOf, shownName, conflictedCopies, conflictedOf, recordCopies, undone, acceptRev } from "./episode.js";
import { gated, sessionNotCleared } from "./gate.js";
import { REELS_FILE, readReels } from "./reels.js";
import { fileSafe } from "./names.js";
import { downloadsFolder, episodeWork, episodesFolder, runsFolder } from "./settings.js";
import { noProgress } from "./progress.js";
import { runProgram } from "./run.js";
import { cantOpen, revealed } from "./reveal.js";
import { commitOf } from "./filing.js";
import { findPrograms } from "./unedited.js";
import { approvedSession, undecided } from "./sessions.js";
import { TEACHINGS_FORMAT, SESSION_LABEL, SESSION_NAME_MOST, herWordsName, isFilesName, isTeachingsName, itemsOf, readTeachings, seenFrom, sessionSeen } from "./teachings.js";

/** How often a finished video's size is looked at while Final Cut may still be writing it, and how many looks before the
    finish stops: ten minutes. */
const LOOK_MS = 5000;
const MOST_LOOKS = 120;
/** The steps of a finish, as the progress panel counts them. The first says what is waited for: Final Cut's files, HyperFrames' exports,
    or, when a finish takes both, the finished videos. */
const WAITING = { "final cut": "Waiting for Final Cut's files", hyperframes: "Waiting for HyperFrames' exports", both: "Waiting for the finished videos" };
const stepsFor = (waiting) => [WAITING[waiting], "Checking the files", "Writing the transcripts", "Cutting the Story parts", "Copying into the episode", "Checking the copies"];

const capital = (text) => text[0].toUpperCase() + text.slice(1);
const stem = (name) => basename(name, extname(name));
/** The folder in the run's own where a part's files are made: "main", "reel-1". */
const dirOf = (key) => key.replace(/\s+/g, "-");
const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
};
const sizeOf = (file) => {
  try {
    return statSync(file).size;
  } catch (e) {
    return 0;
  }
};
/** Where a file was when it changed, as a person is told it: " in From Final Cut", " in Downloads", or nothing for any other folder. */
const inPlace = (video) => (video.where === "From Final Cut" ? " in From Final Cut" : video.where === "Downloads" ? " in Downloads" : "");

/** The words of captions, said evenly over each caption: the best that can be done for a video whose word times are missing. */
function wordsOfCaptions(srt) {
  return captionsOf(srt).flatMap((c) => {
    const said = c.text.split(/\s+/).filter(Boolean);
    const each = (c.end - c.start) / Math.max(1, said.length);
    return said.map((w, i) => ({ w, start: c.start + each * i, end: c.start + each * (i + 1) }));
  });
}

/** Every file inside a folder, as paths from it. */
function filesIn(dir, from = dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const at = join(dir, name);
    if (statSync(at).isDirectory()) out = out.concat(filesIn(at, from));
    else out.push(relative(from, at));
  }
  return out;
}

/** What ffprobe says of a file, or null when it cannot read it, as of a file Final Cut has not finished writing. The facts of cuts.js
    factsOf, and `colour` too: { primaries, transfer } as the picture is tagged, or null when it has no tags (cuts.js colourOf). */
async function probe(file, work, my) {
  const out = join(work, `facts-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const ended = await my.run(my.tools.ffprobe, probeArgs(file, out));
  const printed = ended.code === 0 && existsSync(out) ? readFileSync(out, "utf8") : "";
  const facts = printed ? factsOf(printed) : null;
  rmSync(out, { force: true });
  return facts ? { ...facts, colour: colourOf(printed) } : null;
}

/** Wait until a finished video is whole: its size the same twice, LOOK_MS apart, its blocks all on this Mac, and ffprobe able
    to read it with a length. {facts}, or {why} after ten minutes of waiting. An export of HyperFrames' (`app`) may be a file Dropbox
    holds only as a placeholder, for Downloads is a link into Dropbox on the Mac Studio: it is read through once, which brings it
    down (dropbox.js readThrough), and {why} says so when that cannot be done. `again` is what she is told to say again. */
async function whole(file, work, my, { app = false, again = "hand it off" } = {}) {
  const sizes = [sizeOf(file)];
  let brought = false;
  for (let look = 0; look < MOST_LOOKS; look++) {
    await my.wait(LOOK_MS);
    sizes.push(sizeOf(file));
    if (!settled(sizes)) continue;
    if (!my.isWhole(file)) {
      if (!app || brought) continue;
      brought = true;
      try {
        await my.readAll(file);
      } catch (e) {
        return { why: `Dropbox could not bring ${basename(file)} over to this Mac (${String(e.message).replace(/\.$/, "")}). Say "${again}" again.` };
      }
      if (!my.isWhole(file)) continue;
    }
    const facts = await probe(file, work, my);
    if (facts && facts.duration) return { facts };
  }
  return { why: app ? `${basename(file)} is still being written. Say "${again}" again when HyperFrames has finished exporting it.` : `${basename(file)} is still being written by Final Cut. Say finish again when its Share is done.` };
}

/** The words a part is expected to start with: the first phrase kept, as the cut plan and the part's own cuts leave it (phase
    4), for a Reel the first from where it starts. */
export function expectedWords(part, record, plan) {
  const reel = part.reel ? (record.reels || []).find((r) => r.n === part.reel) : null;
  const cuts = (reel ? reel.cuts : record.main && record.main.cuts) || [];
  const phrases = plan && Array.isArray(plan.phrases) ? cutPhrases(plan.phrases, cuts).filter((p) => p.keep) : [];
  const first = reel ? phrases.find((p) => p.start >= reel.from - 0.25) : phrases[0];
  return first ? String(first.text).trim() : "";
}

/** A file or an export bundle as it is when finish takes it: its size and time, or for a bundle each file's. */
function snapshot(path) {
  if (statSync(path).isDirectory()) return { files: Object.fromEntries(filesIn(path).map((rel) => [rel, snapshot(join(path, rel))])) };
  const now = statSync(path);
  return { size: now.size, mtimeMs: now.mtimeMs };
}
/** Is a file or a bundle still as it was when it was taken? */
function unchanged(path, snap) {
  try {
    if (snap.files) {
      const now = filesIn(path);
      return now.length === Object.keys(snap.files).length && now.every((rel) => snap.files[rel] && unchanged(join(path, rel), snap.files[rel]));
    }
    const now = statSync(path);
    return now.size === snap.size && now.mtimeMs === snap.mtimeMs;
  } catch (e) {
    return false;
  }
}
/** Take a file or a bundle into the run's own folder, as a clone: what finish works from and copies into final/, whatever
    happens to the original after. */
function takeCopy(from, to, clone) {
  if (statSync(from).isDirectory()) {
    for (const rel of filesIn(from)) takeCopy(join(from, rel), join(to, rel), clone);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  clone(from, to);
}
/** The version a finished file is of: the push whose project name it bears. */
function versionOf(record, part, name) {
  const pushed = part.reel ? ((record.reels || []).find((r) => r.n === part.reel) || {}).pushed : record.main && record.main.pushed;
  const own = String(stem(name)).normalize("NFC");
  const push = (Array.isArray(pushed) ? pushed : []).find((p) => String(p.project).normalize("NFC") === own);
  return push ? push.v : undefined;
}
/** The files in a folder whose names end in `ending`, as paths from it, in order, at any depth when `deep`. A folder is read on
    its own, one at a time, so that one which cannot be read, or has gone, is passed over and loses only its own files. [] when
    the folder itself cannot be read. */
const namesIn = (dir, deep, ending) => {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch (e) {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (deep) found.push(...namesIn(join(dir, entry.name), true, ending).map((name) => join(entry.name, name)));
    } else if (entry.name.endsWith(ending)) {
      found.push(entry.name);
    }
  }
  return found;
};
/** Every hand-off of an episode as it is read: each in its final/ (`finalDir`), and each set aside into history/ beside it, at
    any depth, by every name that ends as a hand-off's does. One that cannot be read is passed over. */
const handoffsBeside = (finalDir) => [[finalDir, false], [join(dirname(finalDir), "history"), true]]
  .flatMap(([dir, deep]) => namesIn(dir, deep, ".brimm-ops.json").map((name) => readJson(join(dir, name))))
  .filter((h) => h !== null && typeof h === "object");
/** Is a hand-off one of the video's whose id is `id`: by its `episode.id` (version 1) or its `video.id` (version 2)? */
const handoffFor = (h, id) => [h.episode, h.video].some((who) => who && who.id === id);
/** Whether the episode in `folder` has been handed off to the BRIMM Ops page: its record says it was finished, or a hand-off (a
    .brimm-ops.json) is in its final/ or in its history/, at any depth, where a hand-off set aside is kept. A hand-off is known by
    its file's name alone, even one that cannot be read. And a final/ or a history/ that cannot be read is a doubt, and a doubt
    here is the safe side: it counts as handed off, unless the folder is not there (ENOENT) or is no folder (ENOTDIR). */
export function handedOff(folder, record) {
  if (record.finished) return true;
  return ["final", "history"].some((dir) => {
    try {
      return readdirSync(join(folder, dir), { recursive: true }).some((n) => String(n).endsWith(".brimm-ops.json"));
    } catch (e) {
      return !["ENOENT", "ENOTDIR"].includes(e && e.code);
    }
  });
}
/** The highest revision of the hand-offs of the video `id` among `handoffs`, or 0. */
const highestRevision = (handoffs, id) => handoffs.reduce((most, h) => (handoffFor(h, id) && Number.isInteger(h.revision) ? Math.max(most, h.revision) : most), 0);
/** The numbers a hand-off gives its suggestions and its Reels: a Reel made from a suggestion has the suggestion's. */
const numbersOf = (h) => [h.suggestions, h.reels].flatMap((list) => (Array.isArray(list) ? list : [])).map((item) => item && item.n).filter(Number.isInteger);
/** The highest revision of a hand-off of this video already in final/, or set aside into history/ beside it, at any depth: a
    revision is never used twice, even when the record of the last finish was never written, and one that was replaced or
    cleared is still one the page holds. A hand-off is the video's when its `episode.id` (version 1) or its `video.id`
    (version 2) is `id`. */
export function lastRevision(finalDir, id) {
  return highestRevision(handoffsBeside(finalDir), id);
}
/** The numbers of a session's items: those a session's hand-off gives (its `session`), and those its teachings file gives. */
const sessionNumbersOf = (s) => (s !== null && typeof s === "object" ? ["principles", "recurringPrinciples", "reelsToFilm", "reelIdeas"].flatMap((key) => (Array.isArray(s[key]) ? s[key] : [])).map((item) => item && item.n).filter(Number.isInteger) : []);
/** A session's teachings as its readings wrote them in an episode: the files in its folder, and each set aside into its history/,
    at any depth, by every name that ends as a teachings file's does. One that cannot be read, or is not such a file, is passed
    over. */
const teachingsIn = (folder) => [...namesIn(folder, false, ".principles.json").map((name) => join(folder, name)), ...namesIn(join(folder, "history"), true, ".principles.json").map((name) => join(folder, "history", name))]
  .map(readJson)
  .filter((file) => file !== null && typeof file === "object" && file.format === TEACHINGS_FORMAT);
/** An episode's lists of Reel candidates as they are read: its reels.json, and each one set aside into its history/, at any
    depth, by every name that ends as reels.json's does. One that cannot be read, or is not such a list, is passed over. */
const reelsListsIn = (folder) => [join(folder, REELS_FILE), ...namesIn(join(folder, "history"), true, REELS_FILE).map((name) => join(folder, "history", name))]
  .map(readJson)
  .filter((list) => list !== null && typeof list === "object" && list.format === "brimm-video reels");

/** Every folder in Episodes, each as { folder, record }, read as it lies now, past any conflicted copy: nothing is written. The
    record is null for a folder with no whole record, as an import not finished. */
function episodesIn(root) {
  let names = [];
  try {
    names = readdirSync(episodesFolder(root)).filter((name) => !name.startsWith(".")).sort();
  } catch (e) {
    return [];
  }
  return names.map((name) => {
    const folder = join(episodesFolder(root), name);
    return { folder, record: readEpisode(folder, { pastCopies: true }).record || null };
  });
}

/** The conflicted copies Dropbox has kept of an episode's records, as they are read (episode.js recordCopies). */
const recordCopiesIn = recordCopies;

/** What is in Episodes for the length of one call: read once, the first time it is asked for, and not again, so that a call
    which follows no link reads none. `all()` is every folder as episodesIn gives them; `find(id)` is the first one whose
    record has that id, or undefined; `copiesOf(folder)` is the conflicted copies of that folder's records (recordCopiesIn),
    read the first time they are asked for. */
function viewOf(root) {
  let all = null;
  let byId = null;
  const copies = new Map();
  const view = {
    all: () => (all = all || episodesIn(root)),
    find: (id) => {
      if (!byId) {
        byId = new Map();
        for (const one of view.all()) if (one.record && !byId.has(one.record.id)) byId.set(one.record.id, one);
      }
      return byId.get(id);
    },
    copiesOf: (folder) => {
      if (!folder) return [];
      if (!copies.has(folder)) copies.set(folder, recordCopiesIn(folder));
      return copies.get(folder);
    }
  };
  return view;
}

/** A video's versions as the records link them, newest first, the id the chain starts from, and the gap that stopped it, if one
    did. An episode is followed to the one it is a version of (`versionOf`) only when it is answered: the import no longer writes
    the link, only her answer does, so an unanswered record's chain is itself, and has no gap. The walk ends at an episode this
    Mac cannot read, as one not yet brought over by Dropbox, and then the id is the one the last record names and the gap is
    that id, `missing`; and it ends at an episode it has already been through, and then the gap is that id, `loop`. The
    episodes are read only when a link is to be followed. */
function walk(view, record, folder) {
  const chain = [{ folder: folder || null, record }];
  const seen = new Set([record.id]);
  let last = record;
  while (kindOf(last) !== null && typeof last.versionOf === "string" && last.versionOf !== "") {
    if (seen.has(last.versionOf)) return { chain, first: last.id, gap: { id: last.versionOf, reason: "loop" } };
    seen.add(last.versionOf);
    const old = view.find(last.versionOf);
    if (!old) return { chain, first: last.versionOf, gap: { id: last.versionOf, reason: "missing" } };
    chain.push(old);
    last = old.record;
  }
  return { chain, first: last.id, gap: null };
}

/** A video's versions, newest first, each as { folder, record }: the record, then every episode it is a version of, by
    `versionOf`, through the ones answered. `folder` is the record's own episode folder, found by its id when it is not given.
    This only reads: nothing is written into any folder of the chain. */
export function chainOf(root, record, folder) {
  return linksOf(root).chainOf(record, folder);
}

/** Whether a record is a client or group session whose mark is not cleared, as the gate reads one (gate.js gated), a video not yet
    answered not being a session. */
const heldSession = (record) => kindOf(record) !== null && gated(record);

/** A video's links, read from Episodes once for the length of a call: the one small, read-only helper over the walk and the set
    that edit.js reads them through when she answers what a video is (`kind`), so that no walk is copied there. Episodes are read
    only when a link is first followed, and no record is read again by a second question. Nothing is written. It gives:
    - `find(id)`: the episode whose record has that id, as { folder, record }, or undefined; as Episodes holds it now;
    - `chainOf(record, folder)`: the record's versions, newest first (chainOf), the folder found by the id when it is not given;
    - `firstOf(record, folder)`: the id its chain starts from, which is the id of its hand-off (handoffIdOf);
    - `gapOf(record, folder)`: why that chain cannot be followed to its first, or null (chainGap);
    - `setOf(first)`: the versions of the video that starts at the id `first`, { members, folders } as the hand-off writers
      read them (setOf below): every record whose own walk ends at the id, and the folders whose hand-offs are read for it;
    - `throughOf(id)`: every episode, as { folder, record }, in the order of Episodes' folders, whose chain passes through the
      record with that id: its later versions, the episode of that id itself included;
    - `handedOffThrough(id)`: those of them that were handed off to the BRIMM Ops page (handedOff). A link that is moved changes
      the id such an episode went to the page under;
    - `holdsSession(one)`: whether an episode, as { folder, record }, is a client or group session whose mark is not cleared, by
      the gate's predicate (a video not yet answered is none), its record or any conflicted copy of its records: the gate holds a
      video by any of them;
    - `besideOf(record, folder)`: the other versions of the record's video, as { folder, record }: every episode of Episodes whose
      walk ends at the id the record's own walk ends at (the members of setOf, as the hand-off writers read them), the record's own
      episode left out by its id. Episodes are grouped so once, the first time it is asked;
    - `sessionsBeside(record, folder)`: those of them that hold a session not cleared (holdsSession). A video one of whose versions
      does is held as a session (edit.js), fail closed, until it is answered as one itself or that mark is cleared. */
export function linksOf(root) {
  const view = viewOf(root);
  const through = (id) => view.all().filter((one) => one.record && walk(view, one.record, one.folder).chain.some((link) => link.record.id === id));
  const holdsSession = (one) => [one.record, ...view.copiesOf(one.folder)].some(heldSession);
  let groups = null;
  /** The episodes whose walk ends at `first`, read the first time any is asked for. */
  const groupOf = (first) => {
    if (!groups) {
      groups = new Map();
      for (const one of view.all()) {
        if (!one.record) continue;
        const at = walk(view, one.record, one.folder).first;
        if (!groups.has(at)) groups.set(at, []);
        groups.get(at).push(one);
      }
    }
    return groups.get(first) || [];
  };
  const besideOf = (record, folder) => groupOf(walk(view, record, folder || null).first).filter((one) => one.record.id !== record.id);
  return {
    find: (id) => view.find(id),
    chainOf: (record, folder) => {
      const { chain } = walk(view, record, folder);
      if (chain[0].folder === null) {
        const own = view.find(record.id);
        chain[0].folder = own ? own.folder : null;
      }
      return chain;
    },
    firstOf: (record, folder) => walk(view, record, folder || null).first,
    gapOf: (record, folder) => walk(view, record, folder || null).gap,
    setOf: (first) => setOf(view, { chain: [], first }),
    throughOf: through,
    handedOffThrough: (id) => through(id).filter((one) => handedOff(one.folder, one.record)),
    holdsSession,
    besideOf,
    sessionsBeside: (record, folder) => besideOf(record, folder).filter(holdsSession)
  };
}

/** Why the chain of a video's versions cannot be followed to its first, or null when it can: { id, reason }. `missing` is an
    episode `versionOf` names that this Mac cannot read in Episodes, the first version too, as one Dropbox has not yet brought
    over; `loop` is an episode the chain names a second time, as two episodes that each say they are a version of the other.
    `id` is that episode's. Anything that writes a hand-off for the video asks this first, since the id and the revision it
    would give are then not the chain's. An unanswered record has no chain to follow, so no gap. This only reads. */
export function chainGap(root, record) {
  return walk(viewOf(root), record, null).gap;
}

/** Why a hand-off writer refuses a video whose chain has a gap (chainGap), in plain words, after which it writes nothing. The
    video is named as edit.js names it (episode.js shownName), never by a file's name. A missing episode is named by its id.
    A loop that runs back through this video (`gap.id` is its own) is said of the video and the earlier version it names, as two
    that each say they are a version of the other; any other loop, where the earlier versions name each other and this video is
    not one of them, is said of the circle, by the id that is seen again. */
export function chainGapWords(record, gap) {
  const who = shownName(record);
  if (gap.reason === "loop" && gap.id === record.id) return `${who} and the video it names as its earlier version (${record.versionOf}) each say they are a version of the other: ask Jason. Nothing was written.`;
  if (gap.reason === "loop") return `${who} is a new version of a video whose earlier versions name each other as earlier versions, in a circle (${gap.id}): ask Jason. Nothing was written.`;
  return `${who} is a new version of a video that is not on this Mac yet (${gap.id}). Wait for Dropbox to bring it over, then say it again. Nothing was written.`;
}

/** Why the Final Cut finish cannot finish a record yet, in plain words, or "" when it can: a client or group session, whose own
    finish comes with its teachings (the hand-off writer refuses any transcript of a session, and none of one may be in the
    shared folder, spec 2026-10-22, section 2); a video of any other kind whose session mark is not cleared, by the gate's own
    predicate (gate.js gated: a mark is cleared only by her click on the dialog), since it is held back from the chat as a
    session is, and its words must not reach the shared folder either; and a video not yet answered, which has no kind to
    finish as. It is the same in both versions of the hand-off, and is asked before any folder is looked in, any claim is
    taken, or anything is made, so that nothing of such a video is read, printed or copied. The video is named as edit.js names
    it (episode.js shownName: a video not answered by its label, a session or a video marked one by its session label), never
    by a file's name. */
export function cannotFinish(record) {
  const who = shownName(record);
  const kind = kindOf(record);
  if (kind === "session" || (kind !== null && gated(record))) return `${who} is a client or group session: brimm-video cannot finish a session yet. Nothing was written.`;
  if (kind === null) return `${who} is not answered yet: say what it is first. Nothing was written.`;
  return "";
}

/** Do this Mac's settings say the hand-off is written as version 2 (spec 2026-10-22, section 8)? Until they do, it is version 1,
    as it has always been, title and all. */
export const writesHandoffV2 = (settings) => Boolean(settings) && settings.handoffVersion === VERSION_2;

/** Is the next hand-off of this video written as version 2? Yes when this Mac's settings say so, and also when the hand-off its
    last finish wrote (`record.finished.handoff`, a path from the episode's `folder`) is on file and is version 2 already, or any
    hand-off of the folder's own is (in its final/, or set aside in its history/: a correction clears record.finished and sets its
    hand-off aside, and the page keeps it): a version 1 hand-off is never written over a version 2 one, as with the setting back at
    1 after a rollback, or the two Macs not both switched yet, since a new version's version 1 hand-off would move the BRIMM Ops
    page's id for the video from its first version's to its own. A hand-off that is not there, or cannot be read, is not looked
    at: the setting decides. This only reads. */
export function writesV2For(settings, folder, record) {
  if (writesHandoffV2(settings)) return true;
  if (!folder) return false;
  const named = record && record.finished && record.finished.handoff;
  const onFile = typeof named === "string" && named !== "" ? readJson(join(folder, named)) : null;
  if (Boolean(onFile) && onFile.version === VERSION_2) return true;
  return handoffsBeside(join(folder, "final")).some((h) => h.version === VERSION_2);
}

/** The id a video's hand-off carries: the first version's, which every new version keeps (`video.id`), so that the BRIMM Ops
    page takes a new version as a later revision. */
export function handoffIdOf(root, record) {
  return linksOf(root).firstOf(record);
}

/** The revision of the next hand-off of this video: one above the highest revision written for the hand-off's id (that of
    `handoffIdOf`) on this Mac, whichever version of the video wrote it. Revisions only rise: the page refuses a hand-off at or
    below what it holds, so an old version handed off again is above its new version's, and the other way round. That is, the
    highest of `finished.revision` in the record, in every episode it is a version of and in every episode that is a version of
    it, directly or through others (every one whose own chain ends at the id), and of every hand-off for the id in final/ and in
    history/ of those episodes and of any episode whose record this Mac cannot read (setOf). The record's own folder is counted
    when `found.folder` is not given. `found` is { folder, record }. This only reads. */
export function nextRevision(root, found) {
  const view = viewOf(root);
  const walked = walk(view, found.record, found.folder);
  return revisionIn(setOf(view, walked), walked.first);
}

/** A video's versions on this Mac, for a chain already walked (`walked`, as walk gives it): `members`, every record whose own
    walk ends at the chain's first id, earlier versions and later ones alike, the chain's own records first, each as
    { folder, record } (a record may be there twice: once as the writer has it, once as its folder holds it); and `folders`, the
    folders whose hand-offs are read for that id: the members', and each folder in Episodes with no record this Mac can read
    (one Dropbox is still bringing over may be a version of it). Every record is read, and no other folder's hand-offs: a hand-off
    for the id lies only in a folder of the video's versions, since its id cannot move (handoffTarget), and the finished
    folders of other videos, which she may have made online-only, are not brought back down by a finish or a spelling. */
function setOf(view, { chain, first }) {
  const members = [...chain];
  const folders = new Set(chain.map((link) => link.folder).filter(Boolean));
  for (const one of view.all()) {
    if (!one.record) {
      folders.add(one.folder);
    } else if (walk(view, one.record, one.folder).first === first) {
      members.push(one);
      folders.add(one.folder);
    }
  }
  return { members, folders };
}

/** nextRevision, of a video's versions (setOf) under the id `first`. `handoffsAt` gives a folder's hand-offs (handoffsBeside),
    read once when it is asked again. */
function revisionIn({ members, folders }, first, handoffsAt = (folder) => handoffsBeside(join(folder, "final"))) {
  let most = 0;
  for (const { record } of members) if (record.finished && Number.isInteger(record.finished.revision)) most = Math.max(most, record.finished.revision);
  for (const folder of folders) most = Math.max(most, highestRevision(handoffsAt(folder), first));
  return most + 1;
}

/** The highest number ever given to a suggestion, a Reel or a session's item of a video, on this Mac, or 0 when none was: of
    every hand-off for the video's id (handoffIdOf) in final/ and history/ of the folders of its versions (setOf), its session's
    items too, of the Reels each version's record holds, of each version's reels.json and those set aside into its history/
    (their `highest`, and each candidate's number), and of each version's teachings files, in its folder and set aside into its
    history/ (the numbers of their principles, recurring principles and Reel ideas), and of the numbers each version's record
    holds a client's agreement for (`session.agreed`). Numbers never repeat within a video, across
    asking again, asking for a session's teachings again, a corrected kind and a new version (spec 2026-10-22, section 8), so a
    new reading numbers on from this one. `folder` is the record's own episode folder, found by its id when it is not given.
    This only reads. */
export function highestNumberOf(root, record, folder) {
  const view = viewOf(root);
  const walked = walk(view, record, folder || null);
  const { members, folders } = setOf(view, walked);
  let most = 0;
  const take = (n) => {
    if (Number.isInteger(n) && n > most) most = n;
  };
  for (const at of folders) for (const h of handoffsBeside(join(at, "final"))) if (handoffFor(h, walked.first)) [...numbersOf(h), ...sessionNumbersOf(h.session)].forEach(take);
  for (const { record: one } of members) for (const reel of Array.isArray(one.reels) ? one.reels : []) take(reel && reel.n);
  // A number a client's agreement was noted for stays taken, whatever else is lost: a new Reel idea must not inherit it.
  for (const { record: one } of members) for (const agreed of one.session && Array.isArray(one.session.agreed) ? one.session.agreed : []) take(agreed && agreed.n);
  for (const at of new Set(members.map((one) => one.folder).filter(Boolean))) {
    for (const list of reelsListsIn(at)) {
      take(list.highest);
      for (const candidate of Array.isArray(list.candidates) ? list.candidates : []) take(candidate && candidate.n);
    }
    for (const file of teachingsIn(at)) sessionNumbersOf(file).forEach(take);
  }
  return most;
}

/** Why a version 2 hand-off cannot be written because it gives a suggestion, a Reel, or a session's principle, recurring
    principle or Reel idea a number again that another version of the video gave already, in a hand-off for the same id (`taken`,
    as handoffTarget gives it), in plain words; or "" when it gives none. A number is an item's identity on the BRIMM Ops page,
    and never repeats within a video (spec 2026-10-22, section 8). Until a new version's reading numbers on from the highest ever given (highestNumberOf, Part F), such a
    hand-off is refused, and nothing is written. The video is named as edit.js names it (episode.js shownName). */
export function numbersTakenWords(record, handoff, taken) {
  const items = (key, words) => (handoff.session && Array.isArray(handoff.session[key]) ? handoff.session[key] : []).map((item) => [item && item.n, `${words} ${item && item.n}`]);
  const again = [
    ...(Array.isArray(handoff.suggestions) ? handoff.suggestions : []).map((s) => [s.n, `suggestion ${s.n}`]),
    ...(Array.isArray(handoff.reels) ? handoff.reels : []).map((r) => [r.n, `Reel ${r.n}`]),
    // A session's items too: a principle's, a recurring principle's and a Reel idea's number is its identity on the page.
    ...items("principles", "principle"),
    ...items("recurringPrinciples", "recurring principle"),
    ...items("reelsToFilm", "Reel idea")
  ].filter(([n]) => taken.includes(n));
  if (!again.length) return "";
  const named = again.map(([, words]) => words);
  const list = named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  const numbers = new Set(again.map(([n]) => n)).size === 1 ? "that number" : "those numbers";
  return `${shownName(record)}'s hand-off would give ${list} again: another version of the video gave ${numbers} already, and a number is never given twice within a video. Ask Jason. Nothing was written.`;
}

/** Is a record a client or group session whose mark is not cleared? One is known by its kind or by its mark, by the gate's own
    rule (gate.js sessionNotCleared: a mark is cleared only by her click on the dialog, and one that cannot be read is not), and a
    session with no mark at all is not cleared either. handoffTarget asks it of each version's record and of each conflicted copy of
    its records (the view's copiesOf), which nothing has checked as a record, as the gate holds a video by any of them. */
const unclearedSession = (record) => record !== null && typeof record === "object" && !Array.isArray(record) && sessionNotCleared(record);

/** Where the next hand-off of a video goes, as every hand-off writer asks it (finishEpisode, finishNow, saveSpellings, and
    Part F's writers), from one reading of Episodes: { v2, refusal, id, revision, taken }. `found` is { folder, record }, the
    record's own episode folder and the record as the writer has it. This only reads.
    - `v2` is whether it is written as version 2 (writesV2For: this Mac's settings, or a version 2 hand-off on file).
    - Version 1 is under the episode's own id, one revision above its record's last finish and every hand-off of that id in its
      own final/ and history/ (lastRevision), as it has always been: nothing else in Episodes is read, nothing is refused, and
      no number is taken.
    - Version 2 is under the video's first version's id (handoffIdOf), one revision above every one written for that id on this
      Mac (nextRevision). `taken` is the suggestion, Reel and session item numbers that the hand-offs for that id in the other folders of
      its versions give (their final/ and history/), in order, which this hand-off may not give again (numbersTakenWords): the
      writer's own folder is not among them, since its own earlier revisions give its numbers by right. `refusal` is why it
      cannot be written, in plain words, after which the writer writes nothing, or "".
      The first of these that applies:
      - a gap in the chain of the video's versions (chainGapWords);
      - for a video that is not a session, any version of it, earlier or later (every record whose walk ends at the id), that
        is a client or group session whose mark is not cleared, in its record or in a conflicted copy of it (spec 2026-10-22,
        sections 2 and 8): the page redacts a
        session's words by the id, and this hand-off, under the same id and above the session's revision, would bring them
        back. A session's own hand-off (Part F's empty session revision) is the session's, and is not refused for it. The
        video is named as edit.js names it (episode.js shownName), never by a file's name.
      - a version 2 hand-off in its own final/ or history/ under another id than the chain's first: the video went to the page
        under that id, which never changes across its revisions (spec 2026-10-22, section 8), and its versions lead elsewhere
        now, as after her answer linked it, or an earlier version of it, to another video since. Both ids are said.
      On a refusal, `id` and `revision` are null and `taken` is empty, since no hand-off is to be written under them. */
export function handoffTarget({ root, settings }, { folder, record }) {
  const v2 = writesV2For(settings, folder, record);
  if (!v2) return { v2, refusal: "", id: record.id, revision: Math.max((record.finished && record.finished.revision) || 0, lastRevision(join(folder, "final"), record.id)) + 1, taken: [] };
  const view = viewOf(root);
  const walked = walk(view, record, folder);
  const refused = (refusal) => ({ v2, refusal, id: null, revision: null, taken: [] });
  if (walked.gap) return refused(chainGapWords(record, walked.gap));
  const set = setOf(view, walked);
  const who = shownName(record);
  if (kindOf(record) !== "session" && set.members.some((one) => [one.record, ...view.copiesOf(one.folder)].some(unclearedSession))) return refused(`${who} is a version of a client or group session: ask Jason. Nothing was written.`);
  // Each folder's hand-offs are read once, for the id it went under, the revision and the numbers taken.
  const read = new Map();
  const handoffsAt = (at) => {
    const key = resolve(at);
    if (!read.has(key)) read.set(key, handoffsBeside(join(at, "final")));
    return read.get(key);
  };
  const ownFolder = folder || (view.find(record.id) || {}).folder || null;
  const own = ownFolder ? resolve(ownFolder) : null;
  // A version 2 hand-off in its own final/ or history/ under an id other than the one its versions lead to now: the video went
  // to the page under that id, which never changes (one set aside since, as by a corrected kind, is the page's still).
  const went = ownFolder ? wentElsewhere(handoffsAt(ownFolder), walked.first) : undefined;
  if (went) return refused(movedWords(record, went.video.id, walked.first));
  const taken = new Set();
  for (const at of set.folders) if (resolve(at) !== own) for (const h of handoffsAt(at)) if (handoffFor(h, walked.first)) [...numbersOf(h), ...sessionNumbersOf(h.session)].forEach((n) => taken.add(n));
  return { v2, refusal: "", id: walked.first, revision: revisionIn(set, walked.first, handoffsAt), taken: [...taken].sort((a, b) => a - b) };
}

/** Is this an id brimm-video gives an episode? Only such an id is ever said of a hand-off: it names no one. */
const isId = (id) => typeof id === "string" && /^e-\d{8}-[0-9a-f]{6}$/.test(id);

/** The version 2 hand-off among `handoffs` (a folder's own, in its final/ and history/) that went to the BRIMM Ops page under
    another id than `first`, the id the video's versions lead to now; or undefined. */
const wentElsewhere = (handoffs, first) => handoffs.find((h) => h.version === VERSION_2 && h.video && isId(h.video.id) && h.video.id !== first);
/** Why a video that went to the BRIMM Ops page under the id `went` is refused while its versions lead to `first`: by its name. */
const movedWords = (record, went, first) => `${shownName(record)} went to the BRIMM Ops page under ${went}, but its versions now lead to ${first}: ask Jason. Nothing was written.`;

/** The hand-offs of the episode in `folder` itself, as they are read: in its final/, and set aside into its history/ at any depth
    (handoffsBeside). One that cannot be read is passed over. This only reads. */
export const ownHandoffs = (folder) => handoffsBeside(join(folder, "final"));

/** The id a hand-off went to the BRIMM Ops page under: a version 2 one's `video.id`, a version 1 one's `episode.id`; "" when it
    names none that brimm-video gives. */
export const handoffIdIn = (h) => {
  const id = h && h.version === VERSION_2 ? h.video && h.video.id : h && h.episode && h.episode.id;
  return isId(id) ? id : "";
};

/** Why the record in the episode `folder` cannot keep the version it is of as it stands, in handoffTarget's words, or "": a version
    2 hand-off in its own final/ or history/ went to the BRIMM Ops page under another id than the one its versions lead to now
    (its earlier version was linked elsewhere since). `kind … --again`, which keeps the link it has, asks this of it again, as the
    hand-off writers do (handoffTarget). A chain with a gap is not judged here: the writers refuse it in their own words. This
    only reads. */
export function movedIdWords(root, folder, record) {
  const walked = walk(viewOf(root), record, folder);
  if (walked.gap) return "";
  const went = wentElsewhere(handoffsBeside(join(folder, "final")), walked.first);
  return went ? movedWords(record, went.video.id, walked.first) : "";
}

/** Is there a record of the episode numbered above `n`? */
function laterRecord(folder, n) {
  try {
    return readdirSync(join(folder, "record")).some((name) => /^\d+\.json$/.test(name) && Number.parseInt(name, 10) > n);
  } catch (e) {
    return false;
  }
}

/** Do finish's detached work for an episode, as finish.asked.json says. Resolves {ok, made, failed, next}, which runDetached
    writes as the finish's result: `made` the files copied into final/, `failed` what went wrong, `next` what a person is to
    check by eye, and the offers. Nothing is thrown from here. `deps.lateCheck` stands in for the late check in a test. */
/** Let go the claim a finish's quick part took for an episode nobody had open, when the finish did not write its record: the
    episode goes back to as it was. Only while the record is still the one the claim wrote, and still this Mac's. Gives
    back what to say, or "" when there was nothing to let go (the P1 check, T4 and T17). */
export function letGoClaim(ctx, found) {
  const asked = readJson(join(episodeWork(ctx.home, found.name), "finish.asked.json"));
  if (!asked || !asked.claimed) return "";
  const now = readEpisode(found.folder);
  if (!now.record || now.record.rev !== asked.rev || !now.record.editing || now.record.editing.by !== ctx.machine) return "";
  const opts = { ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) };
  const work = join(runsFolder(ctx.home), `let-go-${process.pid}-${Date.now()}`);
  try {
    writeEpisode(found.folder, { ...now.record, editing: null }, { expectRev: asked.rev, writeText: textWriter({ work, ...opts }), writer: { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine }, home: ctx.home });
    return "The episode is let go again, as it was before the finish.";
  } catch (e) {
    // A record written since (one not whole yet, say: the other Mac's take-over on its way) is not this Mac's claim to keep
    // (round 3, t1-5).
    if (e.code === "CHANGED") return "The episode changed on the other Mac while finish ran, so nothing was let go here: say open to see who has it now.";
    return `This Mac still has the episode open: it could not be let go (${String(e.message).replace(/\.$/, "")}). Say "hand it to Jason", or open it on the other Mac with "take it over".`;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export async function finishNow(ctx, found, deps = {}) {
  const progress = deps.progress || noProgress;
  const check = deps.lateCheck || lateCheck;
  const made = [];
  const failed = [];
  const next = [];
  const result = () => ({ ok: failed.length === 0, made, failed, next: next.join(" ") });
  // The programs, the clock's waits and the clone, as this Mac has them unless a test gives others.
  const tools = ctx.deps.tools || findPrograms();
  const my = { run: ctx.deps.run || runProgram, tools, model: tools.model, wait: ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))), isWhole: ctx.isWhole, readAll: ctx.deps.readAll || readThrough };
  const opts = { ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) };
  const writer = { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine };
  // The run's own folder is on the same disk as Dropbox, so what is made in it can be cloned in.
  // Named for this process, so a run that dies leaves nothing clearRuns keeps.
  const work = join(runsFolder(ctx.home), `finish-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  let ended = false;
  // Whether its record was written, and whether a record it wrote let its claim go already.
  let recordWritten = false;
  let letGoneAlready = false;
  try {
    const asked = readJson(join(episodeWork(ctx.home, found.name), "finish.asked.json"));
    if (!asked) {
      failed.push("Nothing says what to finish: say finish first.");
      return result();
    }
    const read = readEpisode(found.folder);
    if (!read.record) {
      failed.push(read.why);
      return result();
    }
    const record = read.record;
    if (record.rev !== asked.rev) {
      failed.push(`The episode changed since finish was asked. Say ${asked.base ? '"hand off the Reels"' : "finish"} again.`);
      return result();
    }
    // A session, and a video not yet answered, are not finished here, in either version of the hand-off: nothing is waited for,
    // taken, transcribed or copied, and nothing is said of the video but its label (the quick part refuses it first; this is
    // for one whose record says so only since finish was asked).
    const refused = cannotFinish(record);
    if (refused) {
      failed.push(refused);
      return result();
    }
    // The Reels of a video her editor finished (`finish "<episode>" reels`; plan PR 9): the quick part named the hand-off the next revision
    // is made from, and it is read again here, before anything is waited for. It must be the one named, as the record still has it.
    const base = asked.base || null;
    let onFile = null;
    if (base) {
      const got = reelsBase(found.folder, record, { isWhole: ctx.isWhole });
      if (got.coming) failed.push(`Dropbox is still bringing the hand-off over to this Mac. ${SAY_AGAIN}`);
      else if (got.why) failed.push(got.why);
      else if (got.base.handoff !== base.handoff || got.base.revision !== base.revision) failed.push(`The hand-off of ${shownName(record)} changed since finish was asked. ${SAY_AGAIN}`);
      else onFile = got.onFile;
      if (!onFile) return result();
    }
    const before = (record.finished && record.finished.parts) || {};
    // A part is HyperFrames' when the quick part gave it a project: its video is the export of that project.
    const parts = asked.parts.map((p) => ({ ...p, app: Boolean(p.project), path: p.video ? join(p.video.dir, p.video.name) : "" }));
    // What the first step waits for: HyperFrames' exports, Final Cut's files, or, when a finish takes both, the finished videos.
    const news = parts.filter((p) => !p.kept);
    const asking = news.length ? news : parts;
    const waiting = asking.every((p) => p.app) ? "hyperframes" : asking.some((p) => p.app) ? "both" : "final cut";
    // What to say again when it must be said again, in the words of the way the finish went: the way of the parts taken now, and not of a
    // Reel kept from Final Cut beside them. The Reels of a finished video are handed off again by their own words.
    const handOffAgain = base ? SAY_AGAIN : 'Say "hand it off" again.';
    const sayAgain = asking.every((p) => p.app) ? handOffAgain : "Say finish again.";
    // What she is told to say in the rare words about the other Mac and the record: the Reels of a finished video have their own.
    const finishAgain = base ? '"hand off the Reels"' : "finish";
    progress.begin(shownName(record));
    progress.steps(stepsFor(waiting));

    // Each new finished video whole, and its facts. Then the video, and its export, are taken into the run's own folder as
    // clones, with their sizes and times: everything after works from what was taken.
    progress.step(WAITING[waiting]);
    const clone = ctx.deps.clone || cloneFile;
    for (const part of news) {
      const got = await whole(part.path, work, my, { app: part.app, again: base ? "hand off the Reels" : "hand it off" });
      if (got.why) {
        failed.push(got.why);
        continue;
      }
      part.dir = join(work, dirOf(part.key));
      part.snap = snapshot(part.path);
      part.video = { ...part.video, bytes: part.snap.size, mtimeMs: part.snap.mtimeMs };
      part.copy = join(part.dir, "taken", part.video.name);
      takeCopy(part.path, part.copy, clone);
      // The facts of what was taken, which is what goes into final/.
      const facts = await probe(part.copy, work, my);
      if (!facts || !facts.duration) {
        failed.push(`${part.video.name} could not be read once it was taken. ${sayAgain}`);
        continue;
      }
      part.facts = facts;
      if (part.export) {
        part.exportPath = join(part.export.dir, part.export.name);
        part.exportSnap = snapshot(part.exportPath);
        part.exportCopy = join(part.dir, "taken", part.export.name);
        takeCopy(part.exportPath, part.exportCopy, clone);
      }
    }
    if (failed.length) return result();

    // Its shape, before anything is transcribed; for an export of HyperFrames', its sound too, which is stopped, and its colour, which is
    // said for a person to look at and stops nothing (architecture 8.2).
    progress.step("Checking the files");
    const plan = readJson(join(found.folder, `${stem(record.video.file)}.cut-plan.json`));
    for (const part of news) {
      const wrong = shapeFault(part, part.video.name, part.facts, plan && plan.facts);
      if (wrong) failed.push(wrong);
      if (!part.app) continue;
      const silent = soundFault(part.facts, part.video.name);
      if (silent) failed.push(silent);
      const colour = colourNote(part.facts.colour, part.video.name);
      if (colour) next.push(colour);
    }
    if (failed.length) return result();

    // The transcripts: made again for a video that is new, read back from final/ for one that is not. Word times are read
    // back only when the last finish recorded them for that video, never from a file an earlier cut left there.
    progress.step("Writing the transcripts");
    const finalDir = join(found.folder, "final");
    for (const part of parts) {
      const was = before[part.key];
      const same = !part.kept && was && was.source && was.source.bytes === part.video.bytes && was.source.mtimeMs === part.video.mtimeMs;
      if (part.kept || same) {
        const name = basename(was.file);
        part.name = name;
        part.seconds = was.seconds;
        part.srt = readFileSync(join(finalDir, `${stem(name)}.srt`), "utf8");
        const words = was.words ? readJson(join(found.folder, was.words)) : null;
        part.words = words && Array.isArray(words.words) ? words.words : null;
        part.reused = true;
        continue;
      }
      part.name = part.video.name;
      part.seconds = part.facts.duration;
      const heard = await finalTranscript(part.copy, join(part.dir, "heard"), { run: my.run, tools: my.tools, model: my.model, spellings: record.spellings || [] });
      if (heard.why) {
        failed.push(`No transcript could be made of ${part.name}: ${heard.why}.`);
        continue;
      }
      Object.assign(part, { srt: heard.srt, txt: heard.txt, words: heard.words, wav: heard.wav });
      if (heard.untimed) next.push(`Word times are missing for ${part.name}: ${heard.untimed}.`);
      // A Reel of HyperFrames' made from a suggestion is expected to start with the suggestion's words, which the quick part wrote down;
      // its main video is not checked, which she may start anywhere. A Final Cut part starts as the cut plan says.
      const expected = part.app ? String(part.expected || "") : expectedWords(part, record, plan);
      const opening = captionsOf(heard.srt).map((c) => c.text).join(" ");
      if (expected && !firstWordsMatch(expected, opening)) {
        const first = (captionsOf(heard.srt)[0] || { text: "" }).text;
        next.push(`${capital(part.label)} starts with "${first}", where "${expected}" was expected: check by eye that it is the right video.`);
      }
      const stemmed = join(part.dir, stem(part.name));
      writeFileSync(`${stemmed}.srt`, heard.srt);
      writeFileSync(`${stemmed}.transcript.txt`, heard.txt);
      if (heard.words) writeFileSync(`${stemmed}.words.json`, JSON.stringify({ video: part.name, duration: part.seconds, words: heard.words }, null, 2) + "\n");
    }
    if (failed.length) return result();

    // The parts of a Story, from each new finished Reel of more than a minute. Until a preset's job says which Reels go to
    // Stories (phase 4), every one of more than a minute does.
    progress.step("Cutting the Story parts");
    for (const part of parts.filter((p) => p.reel && !p.reused && p.seconds > STORY_MAX)) {
      const heard = await my.run(my.tools.ffmpeg, pauseArgs(part.wav, part.seconds), { keep: 1000000 });
      const pauses = heard.code === 0 ? pausesOf(heard.stderr) : [];
      part.story = [];
      for (const [k, cut] of storyCuts(part.seconds, { pauses, words: part.words || [], fps: part.facts.fps }).entries()) {
        const out = join(part.dir, `${stem(part.name)}.story-${k + 1}.mp4`);
        const encoded = await my.run(my.tools.ffmpeg, clipArgs({ video: part.copy, start: cut.start, end: cut.end, crop: null, out }));
        if (encoded.code !== 0 || !existsSync(out)) failed.push(`Part ${k + 1} of the Story of ${part.label} could not be cut.`);
        else part.story.push(out);
      }
    }

    // The hand-off, from what each part is now, in the version this Mac's settings say (spec 2026-10-22, section 8).
    // - Version 2 is under the video's first version's id, which a new version keeps, and its revision is above every one
    //   written for that id on this Mac, in any version's final/ or history/ (nextRevision). It is written only when the chain
    //   of the video's versions can be followed to its first: on a gap, nothing is copied and the record is not written. It
    //   has no title, a raw or short video's main video holds the words drawn on its picture, and each Reel the suggestion it
    //   was made from. It holds no Reel suggestions: their times are on the raw video's clock, which a Final Cut finish does not
    //   know (phase V's own finish maps them).
    // - Version 1 is under the episode's own id, one revision more than any before it, in the record or in final/.
    // A video already handed off as version 2 is handed off as version 2 again, whatever the setting says now (writesV2For).
    // Which version, the id, the revision, and a refusal, are handoffTarget's, as every hand-off writer asks them.
    const target = handoffTarget(ctx, { folder: found.folder, record });
    if (target.refusal) {
      failed.push(target.refusal);
      return result();
    }
    const { v2, revision } = target;
    // The main video, to find where a Reel falls in it. A finished video has no main part: its words are its own import's, timed
    // (`<stem>.words.json`, with the episode's spellings, as the words of a Reel are), or, when that file is not there, the captions of the
    // hand-off it is made from; and its length is that hand-off's.
    const main = parts.find((p) => p.key === "main");
    const imported = base ? wordsIn(join(found.folder, `${stem(record.video.file)}.words.json`)) : null;
    const timedMain = base ? Boolean(imported && imported.length) : Boolean(main.words);
    const mainWords = base ? (timedMain ? imported.map((word) => ({ ...word, w: spelled(word.w, record.spellings || []) })) : wordsOfCaptions(onFile.main.srt)) : main.words || wordsOfCaptions(main.srt);
    const mainSeconds = base ? onFile.main.seconds : main.seconds;
    // The Reels of a finished video that are kept stay in its hand-off as it has them (nextHandoff): only those taken now are made here.
    const reels = parts.filter((p) => p.reel && !(base && (p.kept || p.reused))).sort((a, b) => a.reel - b.reel).map((p) => {
      const reel = (record.reels || []).find((r) => r.n === p.reel) || {};
      const title = String(reel.title || "").trim();
      // BRIMM Ops takes a Reel's title for the words in its picture, so one is never made up: the quick part asks for it.
      if (!title) failed.push(`Reel ${p.reel} has no title on screen. Say what it says, and ${base ? 'say "hand off the Reels" again' : "finish again"}.`);
      const timed = Boolean(p.words && timedMain);
      // A Reel of HyperFrames' says the suggestion its project was made from: a number, or null for times she gave. Any other Reel's is the
      // record's (handoff-v2.js fromSuggestionOf).
      const fromSuggestion = p.app ? (Number.isInteger(p.fromSuggestion) ? p.fromSuggestion : null) : fromSuggestionOf({ ...reel, n: p.reel });
      return { n: p.reel, title, file: p.name, seconds: p.seconds, inMain: inMain(p.words || wordsOfCaptions(p.srt), mainWords, p.seconds, mainSeconds, { spacing: timed }), srt: p.srt, fromSuggestion };
    });
    if (failed.length) return result();
    const stamped = { record, revision, made: localStamp(new Date(ctx.now())), madeOn: ctx.machine, commit: writer.commit };
    // A finished video's next revision is the hand-off on file, as it was, with these Reels taken now added to those it holds.
    const given = base ? { ...stamped, ...nextHandoff({ onFile, reels }) } : { ...stamped, main: { file: main.name, seconds: main.seconds, srt: main.srt }, reels };
    // The words drawn on the main picture are the record's titles (`record.main.texts`), which brimm-video drew in Final Cut: the picture
    // of a main video taken from HyperFrames has none of them (the app draws its own, and PR 8 reads them), so none is handed off for it.
    const handoff = v2 ? buildHandoffV2({ ...given, id: target.id, onPicture: base || main.app ? [] : onPictureOf(record) }) : buildHandoff(given);
    const fault = v2 ? handoffFaultV2(handoff) : handoffFault(handoff);
    if (fault) {
      failed.push(`The hand-off could not be written: ${fault}`);
      return result();
    }
    // A number another version of the video gave already, under the same id, is never given again (spec section 8).
    const again = v2 ? numbersTakenWords(record, handoff, target.taken) : "";
    if (again) {
      failed.push(again);
      return result();
    }
    // The hand-off keeps the name it has: the next revision of a finished video's replaces it, by the rule, in final/.
    const handoffName = base ? basename(base.handoff) : `${fileSafe(record.name.text)}.brimm-ops.json`;
    writeFileSync(join(work, handoffName), handoffText(handoff));

    // Nothing is copied when a file taken has changed since: the hand-off would then not describe what is in final/.
    for (const part of parts.filter((p) => !p.reused)) {
      const where = inPlace(part.video);
      if (!unchanged(part.path, part.snap)) failed.push(`${part.video.name} changed${where} while finish was working on it. ${part.app ? handOffAgain : "Say finish again."}`);
      if (part.export && !unchanged(part.exportPath, part.exportSnap)) failed.push(`${part.export.name} changed${where} while finish was working on it. Say finish again.`);
    }
    if (failed.length) return result();

    // Nothing goes into final/ once the episode has changed since finish was asked, as when the other Mac took it over while
    // this ran: the copies would land under its claim, and the record could not be written (the review of PR 21, finding 2).
    const now = readEpisode(found.folder);
    const held = now.record ? heldElsewhere(now.record, ctx.machine) : null;
    if (held) failed.push(`${held.by} has ${record.name.text} open now, so nothing was copied into final/. Finish it there, or take it over and say ${finishAgain} again.`);
    else if (!now.record || now.record.rev !== asked.rev) failed.push(`The episode changed while finish was working, so nothing was copied into final/. ${sayAgain}`);
    if (failed.length) return result();

    // Into final/, by the rule, from what was taken: each new video, its transcripts, its Story parts and its export, and the
    // hand-off last.
    progress.step("Copying into the episode");
    const entries = [];
    const files = {};
    const put = (from, as) => {
      const to = join(finalDir, as);
      mkdirSync(dirname(to), { recursive: true });
      (existsSync(to) ? replaceIn : cloneIn)(from, to, opts);
      const bytes = statSync(from).size;
      entries.push({ from, to, bytes });
      files[`final/${as}`] = bytes;
      made.push(`final/${as}`);
    };
    const taken = [];
    try {
      for (const part of parts.filter((p) => !p.reused)) {
        put(part.copy, part.name);
        if (part.video.where === "From Final Cut") taken.push({ path: part.path, snap: part.snap, name: part.video.name, place: "From Final Cut" });
        // An export taken from Downloads is removed there only if its name is an export's name for the project (architecture 8.1, the
        // originals): the app's own record, which can be written in a project by the app's agent, or her word, may have led to a file
        // with another name, and that is left where it is. An export from another folder, from what the other Mac released, or from the
        // project's renders is never removed.
        // What finish.asked.json says of the place is not taken on trust for a removal: the file must be in this Mac's Downloads folder.
        else if (part.app && part.video.where === "Downloads" && resolve(part.video.dir) === resolve(downloadsFolder(ctx.home)) && isExportOf(part.video.name, part.project)) taken.push({ path: part.path, snap: part.snap, name: part.video.name, place: "Downloads" });
        for (const ending of [".srt", ".transcript.txt", ".words.json"]) {
          const from = join(part.dir, stem(part.name) + ending);
          if (existsSync(from)) put(from, stem(part.name) + ending);
        }
        for (const from of part.story || []) put(from, basename(from));
        if (part.export) {
          if (statSync(part.exportCopy).isDirectory()) for (const inside of filesIn(part.exportCopy)) put(join(part.exportCopy, inside), join(part.export.name, inside));
          else put(part.exportCopy, part.export.name);
          if (part.export.where === "From Final Cut") taken.push({ path: part.exportPath, snap: part.exportSnap, name: part.export.name });
        }
      }
      put(join(work, handoffName), handoffName);
    } catch (e) {
      failed.push(e.message);
      // The record lists what final/ holds now: each copy made so far at its size, and one whose old file replaceIn deleted
      // before its clone failed no more, so that a finish again goes through (the P1 check, T3).
      const files_ = { ...record.files, ...files };
      for (const rel of Object.keys(files_)) if (rel.startsWith("final/") && !existsSync(join(found.folder, rel))) delete files_[rel];
      if (JSON.stringify(files_) !== JSON.stringify(record.files)) {
        try {
          writeEpisode(found.folder, { ...record, files: files_, ...(asked.claimed ? { editing: null } : {}) }, { expectRev: asked.rev, writeText: textWriter({ work: join(work, "record"), ...opts }), writer, home: ctx.home });
          if (asked.claimed) letGoneAlready = true;
          failed.push(`The record lists what final/ holds now. Say ${finishAgain} again.`);
        } catch (w) {
          failed.push(`The record could not be written to list what final/ holds now: ${String(w.message).replace(/\.$/, "")}.`);
        }
      }
      return result();
    }
    const lastCopy = ctx.now();

    // The record: the finish, each part's file, its version and what keeps its edit, the Reels finished, and the files
    // listed. A part made again leaves nothing of an earlier cut listed under its name: Story parts and word times it no
    // longer has stay in final/, and are no longer the record's.
    const finishedParts = { ...before };
    let listed = { ...record.files };
    for (const part of parts.filter((p) => !p.reused)) {
      const own = `final/${stem(part.name)}.`;
      listed = Object.fromEntries(Object.entries(listed).filter(([path]) => !path.startsWith(own) || path in files));
      const words = `final/${stem(part.name)}.words.json`;
      // A part of HyperFrames' says its project, and has neither an export of the edit nor "no hand edits": the project is the edit, and
      // the export is the video (architecture 8.4).
      finishedParts[part.key] = {
        v: versionOf(record, part, part.name), file: `final/${part.name}`, bytes: part.video.bytes, seconds: part.seconds, source: { bytes: part.video.bytes, mtimeMs: part.video.mtimeMs },
        ...(words in files ? { words } : {}), ...(part.story && part.story.length ? { story: part.story.map((f) => `final/${basename(f)}`) } : {}),
        ...(part.app ? { project: part.project } : part.export ? { export: `final/${part.export.name}` } : { noHandEdits: true })
      };
    }
    const finishedReels = new Map(parts.filter((p) => p.reel).map((p) => [p.reel, p]));
    // Each project this finish took an export of is finished in the record (a project kept for an earlier kind is none). A part this finish
    // keeps as the last one made it is not taken from its project now: a Reel the last finish took from Final Cut, left out by --without,
    // stays the Final Cut one in the hand-off, and its project is not finished.
    const projectsDone = new Set(parts.filter((p) => p.app && !p.kept).map((p) => p.key));
    const apps = record.app && Array.isArray(record.app.projects) && projectsDone.size ? { app: { ...record.app, projects: record.app.projects.map((p) => (projectsDone.has(p.key) && p.state !== PROJECT_KEPT ? { ...p, state: "finished" } : p)) } } : {};
    const nextRecord = {
      ...record,
      ...apps,
      finished: { revision, at: localStamp(new Date(ctx.now())), on: ctx.machine, handoff: `final/${handoffName}`, parts: finishedParts },
      reels: (record.reels || []).map((r) => (finishedReels.has(r.n) ? { ...r, status: "finished", final: { file: `final/${finishedReels.get(r.n).name}`, seconds: finishedReels.get(r.n).seconds } } : r)),
      files: { ...listed, ...files },
      ...(record.editing && record.editing.by === ctx.machine ? { editing: null } : {})
    };
    // The record is written by the rule, and its work copy kept, so the late check looks at it as at every other copy.
    // The other Mac may have taken it over while the copies were made: then the record is not written over its claim.
    // When it is not written, final/ holds what this finish copied all the same: the record in force is written again with
    // its list of files as final/ holds them, so that neither Mac is stuck on "not whole", and with no finish, as final/ now
    // mixes this finish's files with the last one's: the next finish makes every part again (the P1 check, T1; round 3, t1-3).
    const NEEDS_JASON = " If the episode then says it is not whole in Dropbox, that needs Jason.";
    const listWhatFinalHolds = () => {
      const newest = readEpisode(found.folder);
      if (!newest.record) return ` The record could not be read to list what final/ holds now.${NEEDS_JASON}`;
      try {
        // The Reels of a finished video are added to a finish that stands: it keeps the finish it has (the hand-off it was made from), and the
        // next one takes the Reels again from their exports.
        writeEpisode(found.folder, { ...newest.record, files: { ...newest.record.files, ...files }, finished: base ? newest.record.finished : null }, { expectRev: newest.record.rev, writeText: textWriter({ work: join(work, "record-listed"), ...opts }), writer, home: ctx.home });
        return base ? " The record lists what final/ holds now, and keeps the hand-off it had: the Reels are taken again from their exports." : " The record lists what final/ holds now, and no finish: the next finish makes every part again, from the Shares on the Mac that makes it.";
      } catch (w) {
        return ` The record could not be written to list what final/ holds now: ${String(w.message).replace(/\.$/, "")}.${NEEDS_JASON}`;
      }
    };
    const before_ = readEpisode(found.folder);
    const heldNow = before_.record ? heldElsewhere(before_.record, ctx.machine) : null;
    if (heldNow) {
      failed.push(`${heldNow.by} took ${record.name.text} over while finish was copying into final/, so the finish is not in the record.${listWhatFinalHolds()} Take it over and say ${finishAgain} again, or finish it there.`);
      return result();
    }
    const recordWriter = textWriter({ work: join(work, "record"), keep: true, ...opts });
    const recordEntries = [];
    let written = true;
    try {
      writeEpisode(found.folder, nextRecord, { expectRev: asked.rev, writeText: (to, text, o) => {
        const entry = recordWriter(to, text, o);
        recordEntries.push(entry);
        return entry;
      }, writer, home: ctx.home });
      recordWritten = true;
    } catch (e) {
      written = false;
      failed.push(`The files are in final/, but the record was not written: ${String(e.message).replace(/\.$/, "")}.${listWhatFinalHolds()} ${sayAgain}`);
    }

    // The hand-off, shown in Finder, for her to drop on the BRIMM Ops page: only when the record says it is the finish. On an
    // open-lock Mac a copy of it is shown (reveal.js), and one that cannot be made is not shown, which is said.
    if (written && !(await revealed({ home: ctx.home, settings: ctx.settings, minimum: ctx.deps.minimum, run: my.run, record: nextRecord, label: shownName(nextRecord), path: join(finalDir, handoffName) }))) next.push(cantOpen(shownName(nextRecord)));

    // The late check, at least 15 minutes after the last copy. Only when it finds every copy whole, and the record says what
    // was finished, are the files this finish took from From Final Cut deleted there; and only those still as they were
    // when taken. One made again since is kept, and named.
    progress.step("Checking the copies");
    await my.wait(Math.max(0, lastCopy + LATE_CHECK_MS - ctx.now()));
    // Once the other Mac has the episode, nothing is copied into it again: what is not whole is said, for that Mac's own
    // finish to put right (the P1 check, T20).
    const late = readEpisode(found.folder);
    const theirs = late.record ? heldElsewhere(late.record, ctx.machine) : null;
    // A record written above this finish's own that no longer says this finish (a spelling that made the hand-off again, a finish of the
    // Reels or of a part on the other Mac) came with files in final/ that are its own, and that differ from this finish's in size because
    // they are newer: none of this finish's is put back over them (plan PR 9, the review's C1). A record above that still says this finish
    // (a claim, a new name) left final/ as this finish made it, and a copy gone from it is put back. One above that cannot be read yet is
    // not known to say it, and is not put back over either.
    const stillMine = Boolean(late.record) && late.record.rev > asked.rev + 1 && Boolean(late.record.finished) && late.record.finished.revision === revision;
    const movedOn = written && laterRecord(found.folder, asked.rev + 1) && !stillMine;
    const problems = movedOn
      ? []
      : theirs
        ? entries.filter((e) => { const s = statSync(e.to, { throwIfNoEntry: false }); return !s || s.size !== e.bytes; }).map((e) => `${basename(e.to)} is not whole in final/ at the late check, and ${theirs.by} has ${record.name.text} open now, so it was not copied in again: say ${finishAgain} again there.`)
        : check(entries, opts);
    // Its record is put back only when it is gone and no later record is there: never over a record the other Mac wrote
    // under its number, or over one written since. Then the episode is read again, and From Final Cut is emptied only
    // when its record still holds this finish.
    let holds = false;
    if (written) {
      const own = recordFile(found.folder, asked.rev + 1);
      const entry = recordEntries.find((e) => e.to === own);
      if (entry && !existsSync(own) && !laterRecord(found.folder, asked.rev + 1)) {
        try {
          cloneIn(entry.from, own, opts);
        } catch (e) {
          problems.push(e.message);
        }
      }
      const now = readEpisode(found.folder);
      // Not when a record above it was not known to say it: its copies were not checked, so nothing is removed that it took.
      holds = Boolean(now.record && now.record.finished && now.record.finished.revision === revision) && !movedOn;
      if (!holds) failed.push(now.record ? `The episode's record no longer holds this finish: the other Mac changed it${movedOn ? " after the copies were made, so nothing in final/ was put back over what it wrote" : ""}. ${sayAgain}` :`The episode's record cannot be read now: ${String(now.why).replace(/\.$/, "")}. ${sayAgain}`);
    }
    if (problems.length) {
      failed.push(...problems);
      if (parts.some((p) => !p.app && !p.reused)) next.push("The files it took from From Final Cut are kept there, because a copy in final/ was not whole at the late check.");
      if (taken.some((file) => file.place === "Downloads")) next.push("The exports it took from Downloads are kept there, because a copy in final/ was not whole at the late check.");
    } else if (written && holds) {
      for (const file of taken) {
        if (unchanged(file.path, file.snap)) rmSync(file.path, { recursive: true, force: true });
        else next.push(`${file.name} changed in ${file.place} after it was taken, so it is kept there.`);
      }
    }

    next.push("To save space on this Mac, make the episode's folder online-only: in Finder, Control-click it and choose Make online-only.");
    if (parts.some((p) => !p.app)) next.push("Final Cut's render files can be freed with File > Delete Generated Library Files.");
    ended = failed.length === 0;
    return result();
  } catch (e) {
    failed.push(`The finish stopped: ${e.message}`);
    return result();
  } finally {
    // A finish that did not write its record lets go a claim its quick part took for it.
    if (!ended && !recordWritten && !letGoneAlready) {
      const gone = letGoClaim(ctx, found);
      if (gone) failed.push(gone);
    }
    progress.end(ended);
    rmSync(work, { recursive: true, force: true });
  }
}

// --- The hand-off of a finished video or an iPhone clip, made from the import's own captions (spec 2026-10-22, section 3) ---

/** The words of a finished video's own record that say its hand-off was made from the import (finishFinished), not from a
    Share of Final Cut: its main part is marked `import`. Such a hand-off is made again from the import's captions, whatever a
    spelling is then, since they are all still there. */
export const madeFromImport = (record) => Boolean(record && record.finished && record.finished.parts && record.finished.parts.main && record.finished.parts.main.import === true);

/** The kind a hand-off made from the import was made as, "finished" or "short video" (its main part keeps it), or "" for a record
    whose hand-off was not made so. A video answered as another kind since is not that hand-off's any more. */
export const importKind = (record) => (madeFromImport(record) ? String(record.finished.parts.main.kind || "") : "");

/** The hand-off on file that the next revision of a finished video's hand-off is made from, for `finish "<episode>" reels` (plan PR 9;
    architecture 8.7): { onFile, base: { handoff, revision } }, the hand-off as it is read and the place and revision it was read at; or
    { coming }, its path in the episode when it is there but not whole on this Mac (`isWhole`), for Dropbox to bring over; or { why }, in
    plain words, when Reels cannot be added to it: the record has no hand-off yet (the spellings card writes the first, and this never
    does), it was not made from the import's captions, it was made as another kind than the video is now, it is not one file directly
    in final/, it is not there at all (nothing for Dropbox to bring), or it cannot be read, is not version 2, is not a finished video's,
    or has no main video or no revision. The video is named as edit.js names it. This only reads. */
export function reelsBase(folder, record, { isWhole = () => true } = {}) {
  const name = shownName(record);
  if (!record.finished) return { why: noHandoffWords(name) };
  if (!madeFromImport(record)) return { why: unusableWords(name) };
  if (importKind(record) !== "finished") return { why: otherKindWords(name) };
  const rel = record.finished.handoff;
  if (typeof rel !== "string" || !/^final\/[^/\\]+\.brimm-ops\.json$/.test(rel)) return { why: unusableWords(name) };
  // A file that is not in the folder at all is not one Dropbox is bringing over: nothing would ever come (the review's I2).
  if (!existsSync(join(folder, rel))) return { why: missingWords(name) };
  if (!isWhole(join(folder, rel))) return { coming: rel };
  const onFile = readJson(join(folder, rel));
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const usable = isObject(onFile) && onFile.version === VERSION_2 && isObject(onFile.video) && onFile.video.kind === "finished" && isObject(onFile.main) && Number.isInteger(onFile.revision) && onFile.revision >= 1;
  return usable ? { onFile, base: { handoff: rel, revision: onFile.revision } } : { why: unusableWords(name) };
}

/** What a file of the hand-off is, in words for a person and never by its file name; `rel` is its path from the episode's folder. */
export function whatIs(rel) {
  if (rel === REELS_FILE) return "the Reel suggestions";
  if (rel.endsWith(".brimm-ops.json")) return "the hand-off";
  if (rel.endsWith(".transcript.txt")) return "the final transcript";
  return rel.startsWith("final/") ? "the final captions" : "the import's captions";
}

/** Some things as they are said in a row: "a", "a and b", "a, b and c". */
const saidList = (things) => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} and ${things[things.length - 1]}`);

/** A finished video's Reel suggestions as the hand-off holds them (spec section 8, "One suggestion shape"): from the candidates
    of reels.json, each a stretch of the video in seconds of its own clock, one stretch, `{ n, start, end, stretches, first,
    last, why, point }`, its first and last words spelled with `spellings`. A candidate the record dropped, and one with no stretch,
    is passed over; one with no first words, last words, reason or point, or whose times are no stretch of a video `seconds`
    long, is left out, and `left` says so in plain words, since the page needs all of those. { list, left }.
    This is not suggestionsOnClock (handoff-v2.js), which maps a raw video's suggestions through its cuts by the words it kept:
    nothing of a finished video is cut, so its clock is the video's own, each suggestion is the one stretch its candidate is
    (already put on whole pictures by the reading), and no word file is needed to give it. */
export function suggestionsFrom({ candidates, dropped = [], seconds, spellings = [] }) {
  const list = [];
  const left = [];
  const length = hundredths(seconds);
  const out = (n, why) => left.push(`Suggestion ${n} is left out of the hand-off: ${why}.`);
  const text = (v) => (typeof v === "string" ? v.trim() : "");
  for (const c of candidates) {
    const ranges = (Array.isArray(c.ranges) ? c.ranges : []).filter((r) => r && Number.isFinite(r.start) && Number.isFinite(r.end));
    if (dropped.includes(c.n) || !ranges.length) continue;
    const start = hundredths(Math.min(...ranges.map((r) => r.start)));
    const end = Math.min(hundredths(Math.max(...ranges.map((r) => r.end))), length);
    const said = [["first words", spelled(text(c.first), spellings)], ["last words", spelled(text(c.last), spellings)], ["reason", text(c.reason)], ["point", text(c.point)]];
    const missing = said.find(([, words]) => !words);
    if (!(start >= 0 && end > start)) out(c.n, "its times are not a stretch of the video");
    else if (missing) out(c.n, `it has no ${missing[0]}`);
    else list.push({ n: c.n, start, end, stretches: [{ start, end }], first: said[0][1], last: said[1][1], why: said[2][1], point: said[3][1] });
  }
  return { list, left };
}

/** The Reels a finished video's hand-off holds, spelled again with the spellings `now` (plan PR 9, the review's I1), from what is kept of each in
    final/: its captions and its word times, which hold the spellings it was made with. A Reel holds the pairs that changed it (its part's
    `spellings`, in `prior.parts`, or, for one no spelling has reached since a finish made it, `before`, the record's before this change); only
    those it does not hold are applied (respelledHeldReel). `standing` says how a file stands, as finishFinished has it. Gives
    - `done`: for each Reel with something to apply, by its number, { held, srt, writes }: the pairs it holds now (as they were when its files
      cannot be read), its new captions or null, and the files to write, [path from the folder, text], its captions and transcript before its
      word times;
    - `kept`: the numbers of the Reels whose captions keep the old spelling: those whose files cannot be read (no part, no word times, a file
      gone, not a words file), and those that hold a spelling since taken back or changed, which cannot be taken out of words that hold it;
    - `coming`: files that are there but not whole, for Dropbox to bring over first; nothing is then to be written.
    This only reads. */
function respellHeldReels({ folder, prior, onFile, before, now, standing }) {
  const meant = (list, heard) => (list.find(([h]) => h === heard) || [])[1];
  const done = new Map();
  const kept = [];
  const coming = [];
  for (const reel of prior && onFile && Array.isArray(onFile.reels) ? onFile.reels : []) {
    const part = prior.parts && prior.parts[`reel ${reel.n}`];
    const held = part && Array.isArray(part.spellings) ? part.spellings : before;
    if (!now.some(([heard]) => meant(held, heard) === undefined) && !held.some(([heard, spelt]) => meant(now, heard) !== spelt)) continue;
    const result = { held, srt: null, writes: [] };
    done.set(reel.n, result);
    const at = part && typeof part.file === "string" ? `final/${basename(part.file, extname(part.file))}` : "";
    const rels = { srt: `${at}.srt`, txt: `${at}.transcript.txt`, words: part && typeof part.words === "string" ? part.words : "" };
    if (!at || !rels.words) {
      kept.push(reel.n);
      continue;
    }
    const files = [rels.srt, rels.txt, rels.words];
    const states = files.map((rel) => standing(rel));
    if (states.includes("wrong")) {
      coming.push(...files.filter((rel, i) => states[i] === "wrong"));
      continue;
    }
    if (states[0] === "gone" || states[2] === "gone") {
      kept.push(reel.n);
      continue;
    }
    let made;
    try {
      made = respelledHeldReel({ srt: readFileSync(join(folder, rels.srt), "utf8"), words: readFileSync(join(folder, rels.words), "utf8") }, { held, now });
    } catch (e) {
      kept.push(reel.n);
      continue;
    }
    result.held = made.held;
    if (made.changed.srt) {
      result.srt = made.srt;
      result.writes.push([rels.srt, made.srt], [rels.txt, made.txt]);
    }
    if (made.changed.words) result.writes.push([rels.words, made.words]);
    if (made.keeps) kept.push(reel.n);
  }
  return { done, kept, coming };
}

/** Write the hand-off of a finished video or an iPhone clip, from the import's own captions, once its spellings are answered
    (edit.js spell … offers), in the shape finishNow writes: the captions and their plain text in final/, the hand-off last, and
    the record with `finished` (revision, handoff, and a `main` part marked `import`, with the kind it was made as), the claim this
    Mac holds let go; then the hand-off is shown in Finder, through the program runner. There is no Final Cut, no render and no
    transcriber. The captions are the import's `<stem>.srt` with the show's names and the episode's spellings; the suggestions
    are those of reels.json.
    `found` is { folder, name, record }, as the commands have it, and `record` the record to write: when it is not given,
    `found.record`; the command gives it with what it changed (its spellings, the answer to the offers). It is written over
    `found.record`, the record on disk, whose rev it is written after.
    When the record already says its hand-off was made so (madeFromImport), it is made again as the next revision, the same file,
    from the import's captions again, so that a spelling dropped or changed is dropped or changed in the final transcripts too.
    The hand-off on file is read for the Reels made here that it holds, and to tell whether the new one comes out as it is, when
    it stays as it is and only the record is written; one that is gone, or cannot be read, is made again whole.
    Every file it hands off or replaces must be here, whole, and the size the record lists (a file the record does not list is
    not held to a size): otherwise it writes nothing and says which are to be brought over.
    Before anything is looked at, cannotFinish refuses a session and a video not yet answered; then handoffTarget says where it
    goes (and whether it is written at all), the hand-off is built and checked (handoffFaultV2), and numbersTakenWords is asked.
    Nothing is written, in final/ or the record, unless all of that is well. Resolves one of:
    - { waits: true }: this Mac does not hand off version 2 yet. Nothing was written.
    - { why }: why it was not written, in plain words, with "Nothing was written." or "Nothing was changed.". When files it had
      put in could not be put back as they were, it says which and to tell Jason.
    - { coming: [path…] }: files, as paths from the episode's folder, that Dropbox has to bring over first (whatIs says what each is).
    - { ok: true, revision, handoff, left, same, shown, kept }: written, as revision `revision`, at `handoff` (a path from the folder); `left`
      says the suggestions that were left out; `same` is true when the hand-off came out as it was and only the record was written; `kept`
      names the Reels whose captions keep the old spelling (respellHeldReels).
    The Reels the hand-off holds (finish "<episode>" reels) are spelled with the record's spellings too, from what is kept of each in final/,
    their files put in by the same rule before the hand-off, and put back as they were with the others (respellHeldReels, plan PR 9, the
    review's I1); `main` is made from the import's captions as before. A hand-off that holds Reels and is gone or cannot be read is not made
    again (they would be left out of the new one): `why`, ending "Ask Jason.". */
export async function finishFinished(ctx, found, { record = found.record } = {}) {
  const who = shownName(record);
  const refused = cannotFinish(record);
  if (refused) return { why: refused };
  const kind = kindOf(record);
  if (kind !== "finished" && kind !== "short video") return { why: `${who} is a raw video: its hand-off is made when it is finished in Final Cut. Nothing was written.` };
  const prior = madeFromImport(record) ? record.finished : null;
  if (prior && importKind(record) !== kind) return { why: `${who}'s hand-off was made as another kind than it is now: it waits for its new reading. Nothing was written.` };
  const target = handoffTarget(ctx, { folder: found.folder, record });
  if (!target.v2) return { waits: true };
  if (target.refusal) return { why: target.refusal };

  const folder = found.folder;
  const listed = (rel) => rel in (record.files || {});
  const stem = basename(record.video.file, extname(record.video.file));
  const captionsRel = `${stem}.srt`;
  /** How a file stands: "gone" when it is not there, "wrong" when it is there but not whole or not the size the record lists,
      "here" otherwise. */
  const standing = (rel) => {
    let size = null;
    try {
      size = statSync(join(folder, rel)).size;
    } catch (e) {
      return "gone";
    }
    return ctx.isWhole(join(folder, rel)) && (!listed(rel) || record.files[rel] === size) ? "here" : "wrong";
  };
  // What it is made from: the import's captions and, for a finished video, the reels.json of the reading; and what it replaces,
  // which is read first, to be put back as it was if the record cannot be written. A file the record lists that is not here is
  // one Dropbox is still bringing; one it does not list was never there, which only the captions cannot be without. The hand-off
  // on file is the exception: gone, it is made again.
  const needed = [captionsRel, ...(kind === "finished" ? [REELS_FILE] : [])];
  const replaced = prior ? [`final/${stem}.srt`, `final/${stem}.transcript.txt`] : [];
  if (standing(captionsRel) === "gone" && !listed(captionsRel)) return { why: `${who} has no captions from the import to hand off. Nothing was written.` };
  const coming = [...needed, ...replaced, ...(prior ? [prior.handoff] : [])].filter((rel) => {
    const state = standing(rel);
    return state === "wrong" || (state === "gone" && listed(rel) && rel !== prior?.handoff);
  });
  if (coming.length) return { coming };
  let imported = "";
  let reels = null;
  let onFile = null;
  try {
    imported = readFileSync(join(folder, captionsRel), "utf8");
    if (kind === "finished" && standing(REELS_FILE) === "here") reels = readReels(readFileSync(join(folder, REELS_FILE), "utf8"));
  } catch (e) {
    return { why: `${who}'s files could not be read (${e.code || "they are not what they should be"}). Nothing was written.` };
  }
  if (reels && reels.why) return { why: `${who}'s list of Reel suggestions cannot be used: ${reels.why.replace(/\.$/, "")}. Nothing was written.` };
  if (prior && standing(prior.handoff) === "here") {
    try {
      const read = JSON.parse(readFileSync(join(folder, prior.handoff), "utf8"));
      if (read !== null && typeof read === "object" && !Array.isArray(read)) onFile = read;
    } catch (e) {
      // It cannot be read as a hand-off: it is made again whole.
    }
  }
  // The Reels a hand-off holds are in it alone (their titles, places and captions): made again whole, without it, it would hold none and the
  // record would forget their parts. So a hand-off that holds Reels, and is gone or cannot be read, is not made again (the review's I2).
  if (prior && !onFile && Object.keys(prior.parts || {}).some((key) => REEL_KEY.test(key))) return { why: lostReelsWords(who) };

  const spellings = Array.isArray(record.spellings) ? record.spellings : [];
  // The Reels the hand-off holds are spelled with them too (the review's I1), or left as they are and said: a Reel's files that are there and
  // not whole are brought over first.
  const reelsNow = respellHeldReels({ folder, prior, onFile, before: Array.isArray(found.record.spellings) ? found.record.spellings : [], now: spellings, standing });
  if (reelsNow.coming.length) return { coming: [...new Set(reelsNow.coming)] };
  const shows = spelledCaptions(imported, []);
  const srt = spelledCaptions(imported, spellings);
  const txt = stampedText(srt);
  // A spelling is held by the captions only once it has changed them.
  const held = spellings.filter((pair) => spelledCaptions(shows, [pair], spelledPairs) !== shows);
  const seconds = record.video.seconds;
  const dropped = (record.reels || []).filter((r) => r.status === "dropped").map((r) => r.n);
  const { list, left } = reels ? suggestionsFrom({ candidates: reels.reels.candidates, dropped, seconds, spellings }) : { list: [], left: [] };
  const writer = { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine };
  const at = localStamp(new Date(ctx.now()));
  const handoff = buildHandoffV2({ record, id: target.id, revision: target.revision, made: at, madeOn: ctx.machine, commit: writer.commit, main: { file: record.video.file, seconds, srt }, onPicture: onPictureOf(record), suggestions: list, reels: onFile && Array.isArray(onFile.reels) ? onFile.reels.map((r) => (reelsNow.done.has(r.n) && reelsNow.done.get(r.n).srt !== null ? { ...r, srt: reelsNow.done.get(r.n).srt } : r)) : [] });
  const fault = handoffFaultV2(handoff);
  if (fault) return { why: `The hand-off could not be written: ${fault.replace(/\.$/, "")}. Nothing was written.` };
  // A number another version of the video gave already, under the same id, is never given again (spec section 8).
  const again = numbersTakenWords(record, handoff, target.taken);
  if (again) return { why: again };

  const gone = undone(found.record, ctx.home);
  if (gone) {
    acceptRev(ctx.home, found.record.id, found.record.rev);
    return { why: `${gone} Nothing was written.` };
  }
  const handoffRel = prior ? prior.handoff : `final/${fileSafe(record.name.text)}.brimm-ops.json`;
  // The Reels the hand-off holds stay in it as they were (above), and the parts of the last finish that took them stay in the record, so
  // that a spelling after `finish "<episode>" reels` does not make the next one forget what it took (plan PR 9).
  const reelParts = prior ? heldReelParts(prior.parts, handoff.reels) : {};
  // A Reel a spelling was tried on holds the pairs that changed it from now on (also when none did, or its files could not be read: it is tried again).
  for (const [n, done] of reelsNow.done) if (reelParts[`reel ${n}`]) reelParts[`reel ${n}`] = { ...reelParts[`reel ${n}`], spellings: done.held };
  const reelWrites = [...reelsNow.done.values()].flatMap((done) => done.writes);
  const finishedNow = (revision, when) => ({ revision, at: when, on: ctx.machine, handoff: handoffRel, parts: { main: { v: 0, file: `final/${record.video.file}`, bytes: record.video.bytes, seconds, spellings: held, noHandEdits: true, import: true, kind }, ...reelParts } });
  const opts = { ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) };
  const work = join(runsFolder(ctx.home), `first-hand-off-${process.pid}-${ctx.now()}`);
  const same = Boolean(onFile) && JSON.stringify({ ...onFile, revision: 0, made: "", madeOn: "", madeBy: "" }) === JSON.stringify({ ...handoff, revision: 0, made: "", madeOn: "", madeBy: "" });
  const release = record.editing && record.editing.by === ctx.machine && !prior ? { editing: null } : {};
  const finalDir = join(folder, "final");
  const madeDir = !existsSync(finalDir);
  /** Each file put in: where, what was there before (null when nothing), and the copy this call put there. */
  const before = [];
  const put = textWriter({ work, ...opts });
  /** Each final file put back as it was, or taken away if this call made it, each on its own, and only while it is still the copy
      this call put in: another Mac's is left as it is. Gives back what could not be put back as it was, by what it is. */
  const putBack = () => {
    const lost = [];
    for (const { to, rel, was, ours } of [...before].reverse()) {
      try {
        const now = existsSync(to) ? readFileSync(to, "utf8") : null;
        if (now === was) continue;
        if (now !== null && now !== ours) lost.push(whatIs(rel));
        else if (was === null) rmSync(to, { force: true });
        else put(to, was, { replace: true });
      } catch (e) {
        lost.push(whatIs(rel));
      }
    }
    if (madeDir) {
      try {
        rmdirSync(finalDir);
      } catch (e) {
        // It is not empty, or not there.
      }
    }
    return lost;
  };
  const files = {};
  try {
    mkdirSync(finalDir, { recursive: true });
    if (!same || reelWrites.length) {
      // The main video's captions, then the Reels' that a spelling reached, and the hand-off last, as finish copies it.
      const ordered = [...(same ? [] : [[`final/${stem}.srt`, srt], [`final/${stem}.transcript.txt`, txt]]), ...reelWrites, ...(same ? [] : [[handoffRel, handoffText(handoff)]])];
      for (const [rel, ours] of ordered) {
        const to = join(folder, rel);
        const there = existsSync(to);
        before.push({ to, rel, was: there ? readFileSync(to, "utf8") : null, ours });
        files[rel] = put(to, ours, { replace: there }).bytes;
      }
    }
    const next = {
      ...record,
      files: { ...record.files, ...files },
      finished: same ? { ...prior, parts: { main: { ...prior.parts.main, spellings: held }, ...reelParts } } : finishedNow(target.revision, at),
      ...release
    };
    writeEpisode(folder, next, { expectRev: found.record.rev, writeText: textWriter({ work: join(work, "record"), ...opts }), writer, home: ctx.home });
  } catch (e) {
    const lost = putBack();
    const why = e.code === "CHANGED" ? "this episode changed on the other Mac: open it again" : String(e.message || e.code || "a file could not be put in").replace(/\.$/, "");
    // Files that could not be put back are what matters then, as the Final Cut path says it: not that nothing was written.
    if (lost.length) return { why: `${capital(why)}. ${capital(saidList([...new Set(lost)]))} could not be put back as it was. Tell Jason: the episode needs him.` };
    return { why: `Nothing was written: ${why}.` };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  // Shown in Finder for her to drop on the BRIMM Ops page, only now that the record says it is the hand-off: on an open-lock Mac a
  // copy of it (reveal.js), and `shown` is false when that copy could not be made.
  let shown = true;
  if (!same) {
    try {
      shown = await revealed({ home: ctx.home, settings: ctx.settings, minimum: ctx.deps.minimum, run: ctx.deps.run || runProgram, record, label: shownName(record), path: join(folder, handoffRel) });
    } catch (e) {
      // The hand-off is in final/ all the same.
    }
  }
  return { ok: true, revision: same ? prior.revision : target.revision, handoff: handoffRel, left, same, shown, kept: reelsNow.kept };
}

// --- A client or group session's own hand-off (spec 2026-10-22, sections 3 and 8) ---

/** Why a session's hand-off is not written under the name it has: it is its video file's (saying nothing of it), it cannot name
    the session's files, or it holds `word`, a name brimm-video can see, as she wrote it. */
const SESSION_NAME_FILES = "This session's name is the name of its video's file: give it another name first. Nothing was written.";
const SESSION_NAME_NO_FILE = "This session's name cannot name its files: give it another name first. Nothing was written.";
const SESSION_NAME_LONG = `This session's name is longer than ${SESSION_NAME_MOST} characters: give it a shorter one first. Nothing was written.`;
const sessionNameHolds = (word) => `This session's name holds "${word}", a name brimm-video can see in it: give it another name first. Nothing was written.`;

/** Write the hand-off of a client or group session, of what she approved of its teachings (edit.js finish, for a session): the
    principles she kept (without their source_context), the recurring principles she kept, and the Reel ideas she kept that are
    to be filmed again, each as she changed it, with the name check run again on it; never a transcript, a caption or a file's
    name. Into final/<the session's name>.brimm-ops.json, and nothing else into final/; the hand-off its last finish wrote under
    another name, before she renamed it, is set aside into history/ by the rule (copied whole and listed there by the record, and
    taken out of final/ once the record is written); then the record says it is finished (the hand-off and its revision), the
    claim this Mac holds is let go, and the hand-off is shown in Finder, through the program runner.
    `found` is { folder, name, record }. Nothing is written unless all of this is well, in this order:
    - it is a session (kind "session"): cannotFinish refuses one for the Final Cut finish, and this is its own;
    - this Mac hands off version 2 (writesV2For), or { waits: true };
    - the name the hand-off holds and names its file by (`name.text`, which buildHandoffV2 writes) is not the video's file's in
      any form (teachings.js isFilesName): shownName hides such a name behind the label, and the hand-off would not;
    - Claude has read its teachings (teachings.js sessionReading), and its teachings file, the files the names it can see are
      read from (seenFrom) and the earlier hand-off it sets aside are whole on this Mac, or { coming: [path…] };
    - every item is decided (sessions.js undecided);
    - no kept item lacks what the page needs, which the name check took out: approvedSession, given the names brimm-video can see
      now (sessionSeen), refuses it; and her own words, the session's name (but its label) and what she changed of each item
      written, hold none of them, read as hers (teachings.js herWordsName);
    - handoffTarget gives it an id and a revision (a session's own revision is not refused for being a session);
    - the hand-off is built (buildHandoffV2), and handoffFaultV2 and numbersTakenWords find nothing wrong with it.
    Resolves { waits }, { coming }, { why } (plain words, each line a reason, with the session named by its name, never a file's),
    or { ok: true, revision, handoff, counts: { principles, recurringPrinciples, reelsToFilm }, dropped: [{ field, why }] }, where
    `dropped` is what the name check took out of what is in the file, now. */
export async function finishSession(ctx, found, { host } = {}) {
  const { record, folder } = found;
  const who = shownName(record);
  if (kindOf(record) !== "session") return { why: `${who} is not a client or group session. Nothing was written.` };
  if (!writesV2For(ctx.settings, folder, record)) return { waits: true };
  // The name the hand-off holds (buildHandoffV2 writes `name.text`) and names its file by is the name checked: never the video's
  // file's, in any form, which shownName would hide behind the label while the hand-off wrote it.
  const written = record.name.text;
  if ((written !== who && !SESSION_LABEL.test(written)) || isFilesName(written, record)) return { why: SESSION_NAME_FILES };
  if (!isTeachingsName(`${fileSafe(written)}.principles.json`)) return { why: SESSION_NAME_NO_FILE };
  if ([...written].length > SESSION_NAME_MOST) return { why: SESSION_NAME_LONG };
  const handoffRel = `final/${fileSafe(written)}.brimm-ops.json`;
  // The hand-off its last finish wrote under another name, as before she renamed it, is set aside into history/ (below).
  const earlier = record.finished && typeof record.finished.handoff === "string" ? record.finished.handoff : "";
  const prior = /^final\/[^/\\]+\.brimm-ops\.json$/.test(earlier) && earlier !== handoffRel && existsSync(join(folder, earlier)) ? earlier : "";
  const whole = (path) => (ctx.isWhole || (() => true))(path);
  const read = readTeachings(folder, record, whole);
  if (read.none) return { why: `${who} has no teachings to hand off yet: Claude has not read it. Nothing was written.` };
  const coming = [...(read.coming ? [read.coming] : []), ...[...seenFrom(record), ...(prior ? [prior] : [])].filter((rel) => !whole(join(folder, rel)))];
  if (coming.length) return { coming };
  if (read.why) return { why: `${who}'s teachings cannot be read (${read.why}). Nothing was written.` };
  const items = itemsOf(read.teachings, record.session);
  const open = undecided(items);
  if (open.length) return { why: open.join("\n") };
  const seen = sessionSeen(folder, record, { host });
  if (seen.why) return { why: `${who}: ${seen.why}. Nothing was written.` };
  const approved = approvedSession(items, seen.names);
  if (approved.why) return { why: approved.why };
  // Her own words, the name she gave it and what she changed of an item, are checked again on what is written, whatever their
  // case (teachings.js herWordsName): the check above is the one for Claude's prose. Its label holds no one's name.
  const inName = SESSION_LABEL.test(written) ? "" : herWordsName(written, seen.hers);
  if (inName) return { why: sessionNameHolds(inName) };
  const edits = (record.session && record.session.edits) || {};
  const writtenItems = { principles: approved.session.principles, recurringPrinciples: approved.session.recurringPrinciples, reelIdeas: approved.session.reelsToFilm };
  const hers = [["principles", "Principle"], ["recurringPrinciples", "Recurring principle"], ["reelIdeas", "Reel idea"]].flatMap(([key, label]) =>
    writtenItems[key].flatMap((item) => Object.keys(((edits[key] || {})[String(item.n)]) || {}).map((field) => [field, herWordsName(item[field], seen.hers)]).filter(([, word]) => word).map(([field, word]) => `${label} ${item.n}'s ${field}, as you changed it, holds "${word}", a name brimm-video can see: say it another way, or drop it.`)));
  if (hers.length) return { why: hers.join("\n") };
  const target = handoffTarget(ctx, { folder, record });
  if (target.refusal) return { why: target.refusal };
  const writer = { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine };
  const at = localStamp(new Date(ctx.now()));
  const handoff = buildHandoffV2({ record, id: target.id, revision: target.revision, made: at, madeOn: ctx.machine, commit: writer.commit, reels: [], session: approved.session });
  const fault = handoffFaultV2(handoff);
  if (fault) return { why: `The hand-off could not be written: ${fault.replace(/\.$/, "")}. Nothing was written.` };
  const again = numbersTakenWords(record, handoff, target.taken);
  if (again) return { why: again };
  const gone = undone(record, ctx.home);
  if (gone) {
    acceptRev(ctx.home, record.id, record.rev);
    return { why: `${gone} Nothing was written.` };
  }

  const opts = { ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) };
  const work = join(runsFolder(ctx.home), `session-hand-off-${process.pid}-${ctx.now()}`);
  const to = join(folder, handoffRel);
  const finalDir = join(folder, "final");
  const madeDir = !existsSync(finalDir);
  const put = textWriter({ work, ...opts });
  const ours = handoffText(handoff);
  // The earlier hand-off is set aside by the rule: copied whole into history/ first, and taken out of final/ only once the
  // record that no longer lists it is written.
  const asideRel = prior ? `history/${at.replace(/:/g, "-")} ${basename(prior)}` : "";
  let aside = null;
  let was = null;
  let wrote = false;
  try {
    mkdirSync(finalDir, { recursive: true });
    const files = { ...record.files };
    if (prior) {
      mkdirSync(join(folder, "history"), { recursive: true });
      const copy = readFileSync(join(folder, prior), "utf8");
      aside = { to: join(folder, asideRel), text: copy };
      files[asideRel] = put(aside.to, copy).bytes;
      delete files[prior];
    }
    const there = existsSync(to);
    was = there ? readFileSync(to, "utf8") : null;
    const bytes = put(to, ours, { replace: there }).bytes;
    wrote = true;
    const next = {
      ...record,
      files: { ...files, [handoffRel]: bytes },
      finished: { revision: target.revision, at, on: ctx.machine, handoff: handoffRel, parts: {} },
      ...(record.editing && record.editing.by === ctx.machine ? { editing: null } : {})
    };
    writeEpisode(folder, next, { expectRev: record.rev, writeText: textWriter({ work: join(work, "record"), ...opts }), writer, home: ctx.home });
  } catch (e) {
    // What this call put in is put back as it was, and only while it is still this call's: another Mac's is left as it is. The
    // copy set aside goes again: the hand-off it is of is still in final/.
    if (aside) {
      try {
        if (existsSync(aside.to) && readFileSync(aside.to, "utf8") === aside.text) rmSync(aside.to, { force: true });
      } catch (p) {
        // A copy left in history/ is one the record does not list: it harms nothing.
      }
    }
    let lost = false;
    if (wrote) {
      try {
        const now = existsSync(to) ? readFileSync(to, "utf8") : null;
        if (now === ours) {
          if (was === null) rmSync(to, { force: true });
          else put(to, was, { replace: true });
        } else if (now !== was) lost = true;
      } catch (p) {
        lost = true;
      }
    }
    if (madeDir) {
      try {
        rmdirSync(finalDir);
      } catch (r) {
        // It is not empty, or not there.
      }
    }
    const why = e.code === "CHANGED" ? "this episode changed on the other Mac: open it again" : String(e.message || e.code || "the hand-off could not be put in").replace(/\.$/, "");
    if (lost) return { why: `${capital(why)}. The hand-off could not be put back as it was. Tell Jason: the episode needs him.` };
    return { why: `Nothing was written: ${why}.` };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  // The earlier hand-off, whole in history/ and listed there by the record, leaves final/.
  if (prior) {
    try {
      rmSync(join(folder, prior), { force: true });
    } catch (e) {
      // It stays in final/ beside the new one, which is the higher revision, as the page takes it.
    }
  }
  // Shown in Finder for her to drop on the BRIMM Ops page, only now that the record says it is the hand-off: on an open-lock Mac a
  // copy of it (reveal.js), and `shown` is false when that copy could not be made.
  let shown = true;
  try {
    shown = await revealed({ home: ctx.home, settings: ctx.settings, minimum: ctx.deps.minimum, run: ctx.deps.run || runProgram, record, label: who, path: to });
  } catch (e) {
    // The hand-off is in final/ all the same.
  }
  const counts = Object.fromEntries(Object.entries(approved.session).map(([key, items_]) => [key, items_.length]));
  return { ok: true, revision: target.revision, handoff: handoffRel, counts, dropped: approved.dropped, shown };
}
