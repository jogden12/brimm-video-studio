// Opening a Reel of an episode in the HyperFrames app (architecture 2026-10-27: 4.1 step 10, 4.3, 5.1, 5.2, 5.6, 5.7 and 7.1; plan PR 5).
//
// A Reel is made by Studio only (Jason's ruling of 2026-10-28). The app, asked for a Reel, makes it as a project of its own in
// ~/.hyperframes-studio/, outside BRIMM Video Work, with a copy of the whole recording in its assets (A0), and Studio could not find
// its export for the hand-off. So the project notes tell the app's agent never to make one (project.js), and when she asks it for a
// Reel it tells her to say "Open Reel 2 in HyperFrames" in her chat, which runs `app "<episode>" reel 2`, and this module makes it.
//
// edit.js finds the episode, asks the gate, refuses a short video, a Mac not set up, a Reel the record does not list and a Reel
// project of another Mac that has no snapshot listed in the record (reelWhy, projectOnAnotherMac, projectSnapshot), claims the episode
// for this Mac as `open` does, and then gives it to openReelInApp, which does the rest, in this order:
//   - a Reel project whose folder is not on this Mac, and that the record lists a snapshot of (snapshot.js; plan PR 11), is rebuilt from
//     it, whichever Mac made it, as app.js rebuilds the main project (rebuildHere); a Reel project here whose marker says it is older than
//     the newest snapshot is set aside and rebuilt in its place, as the main project is (olderMarked, rebuildHere with `older`; plan PR 18),
//     with HyperFrames quit and its video kept for the new project when it passes the check every working copy does; one with no marker,
//     older by the times of its files, is neither opened nor set aside (olderHere);
//   - a Reel project made before, whose folder is on this Mac, is opened again, and nothing is made or started. If the recording has
//     changed since it was made she is told, and the project is opened as it was (4.8). Unless its video is not in it (a hand took it,
//     or it was just rebuilt, which leaves the video out): putReelVideoBack puts the Reel's video back as app.js putVideoBack does the
//     main video's, from a copy of the Reel made again by the detached run, which it asks for and she is told to say it again;
//   - a folder at the Reel project's name that the record does not list, as a run whose record was not written leaves, is taken as the
//     project it is and recorded: nothing is made or started for it, and neither the words nor the Reel's video are needed;
//   - otherwise the episode's words must be on this Mac, and Claude's reading must be over, since the Reel is one of its suggestions
//     (reels.json): while it is at work nothing is made, and nothing is asked for either, for which stretch it is depends on the
//     reading. The suggestion must still be in the list;
//   - the Reel's video is a stretch of the recording as filed, from the suggestion's first moment to its last, made as the working
//     copy is, with its chain and its checks (workcopy.js reelCopyKey, makeWorkCopy), by the detached run `workcopy --reel <n>` that
//     has the working copy's lock. When it is not there it is asked for and she is told to say it again when it is done; this does
//     not wait for it (a command has two minutes in the Code tab). While a run is at work on the episode, whichever video it makes,
//     she is told a video is being made and to say it again, and the project is not written under a run that is still looking for
//     the faces in the video it has put in place. It is cut from the recording and not from the working copy
//     because the working copy is moved into the main project, which the app may hold open, and a finished video has none. Beside
//     it the run keeps the faces it found in it, if it found any;
//   - the project is written (project.js, kind "reel") with the Reel's video moved in, as the main project's is: the Reel's words,
//     placed by the cut plan's phrases as the main project's are and then chosen and put on the Reel's own clock, no cut or Reel
//     suggestions (the plan cuts nothing of a Reel), and the face positions only when the finder found some;
//   - the app is opened on it (app.js openProjectInApp), and one record write holds the project (`key` "reel <n>", `fromSuggestion` <n>)
//     and the Reel marked picked, which is what `reel pick` did and what parts.js and the hand-off read.
// A project that was made is kept, whether or not the app opened.
//
// What it says goes into her chat, so it holds no path, no flag and no name of a command. What it touches beyond the episode's own
// files is given to it (`deps`), so that no test runs the command line, the app or `claude`.
import { existsSync, readFileSync, renameSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { clockText } from "./clock.js";
import { runningCommand } from "./detached.js";
import { localStamp } from "./episode.js";
import { cliPath } from "./hyperframes.js";
import { projectFiles, projectName, writeProject } from "./project.js";
import { REELS_FILE, readReels, reelEntries } from "./reels.js";
import { episodeWork } from "./settings.js";
import { snapshotOf } from "./snapshot.js";
import {
  changedSince, copyFits, copyIn, factsIn, fromOf, guidanceOf, jsonIn, keptFits, logosIn, moveIn, noRecording, noWords, notPutBack, notTheSame, notWhole, nothingAt, olderHere, olderMarked, olderThanSnapshot,
  openProjectInApp, plainName, quitWords, rebuildHere, recordingChanged, statOf, videoBack, videoGoneAndChanged, videoIn, videoKept, wordsIn
} from "./app.js";
import { reelCopyKey, reelCopyPaths, requestWorkCopy, workCopyLockOf } from "./workcopy.js";

/** The kinds of video a Reel's video is made for (architecture 4.3): a raw video, and a video finished by her editor. A short video
    has no Reels, and a session reaches the app only as a clip of its own. */
export const REEL_COPY_KINDS = ["raw", "finished"];

/** What she says to open a Reel of an episode in the app, which is what she is told to say again when its files or its video are not
    here yet: the phrase of architecture 6.3, with the episode named, since her chat may be working on more than one. */
export const openReelWords = (n, name) => `open Reel ${n} of ${name} in HyperFrames`;

/** What `title` says of a Reel nobody has made yet, on a Mac set up for the app: how to make it. */
export const notMadeYet = (n, name) => `Reel ${n} isn't made yet. Say "${openReelWords(n, name)}" to make it.`;

/** What `reels` ends with on a Mac set up for the app, for the suggestions `numbers` she has not dropped (in the order of the list): how
    to make one, in place of the line that sends her to OpusClip, which is for a Mac that cannot. */
export const makeOneWords = (numbers, name) => (numbers.length === 1
  ? `To make it, say "${openReelWords(numbers[0], name)}".`
  : `To make one, say "${openReelWords(numbers[0], name)}", with the number of the one you want.`);

const beingMade = (n, name) => `The video for Reel ${n} is being made. Say "${openReelWords(n, name)}" again when it is done; "how far is it?" shows how far it has got.`;
/** What is said while a video is being made already, and Reel `n`'s is not started: one run at a time makes a video for an episode,
    whichever video it is (workcopy.js requestWorkCopy), and the lock that says so does not say which. It may be this Reel's own, a
    second `app` made while it works or while it looks for the faces in the video it has put in place, or the main video's, or
    another Reel's; so it is not said that Reel `n`'s is being made, nor that another is, but that a video is. */
const busyWith = (n, name) => `A video for HyperFrames is being made already, and they are made one at a time. Say "${openReelWords(n, name)}" again when it is done; "how far is it?" shows how far it has got.`;
const stillReading = (n, name) => `Claude is still reading it. Say "${openReelWords(n, name)}" again when it has finished; "how far is it?" shows how far it has got.`;
const reelMade = ({ start, end }, n) => `Reel ${n} is made: the recording from ${clockText(start)} to ${clockText(end)}.`;
const unreadable = (name) => `The Reel suggestions of ${name} cannot be read. Ask Jason.`;
/** What is said when Reel `n` is not among the suggestions `numbers`, as markReels says it. */
const noSuchReel = (n, numbers) => `There is no Reel ${n}. The Reels are ${numbers.join(", ") || "none"}.`;

/** What she asked of `app`, from its words (flags taken out): `reel` and a whole number after the episode's words, in any case, is
    { episode, n }, the words that name the episode and the Reel's number; a last word `reel` with no number after it is { episode,
    n: null }; anything else is none, and she asked for the main video. */
export function reelAsked(words) {
  if (!Array.isArray(words) || words.length < 2) return null;
  const last = words[words.length - 1];
  const before = words[words.length - 2];
  if (/^reel$/i.test(before) && /^\d+$/.test(last)) return { episode: words.slice(0, -2), n: Number(last) };
  if (/^reel$/i.test(last)) return { episode: words.slice(0, -1), n: null };
  return null;
}

/** Whether the record lists a project for Reel `n`: one `app … reel <n>` made (state whatever it is). */
export const madeInApp = (record, n) => (record.app?.projects ?? []).some((p) => p.key === `reel ${n}`);

/** Why `app … reel <n>` may not go on for this episode, from the record alone, in her words, or "" when it may. It is asked before
    anything is claimed or brought, so that a Reel that is not there claims nothing:
    - a Reel the record lists a project for is opened whatever else is said (it is made already), and so is any Reel while Claude's
      reading is at work on this Mac, since the Reels are its work: what the record lists may be the last reading's;
    - a Reel the record does not list is "There is no Reel 9. The Reels are 2, 3.";
    - a finished Reel is "Reel 2 is finished: it is in the hand-off already.", as `reel` says it of one: it is not made again. */
export function reelWhy(ctx, found, record, n) {
  if (madeInApp(record, n)) return "";
  if (runningCommand(ctx.home, found.name, ctx.alive) === "read") return "";
  const reels = Array.isArray(record.reels) ? record.reels : [];
  const reel = reels.find((r) => r.n === n);
  if (!reel) return noSuchReel(n, reels.map((r) => r.n));
  return reel.status === "finished" ? `Reel ${n} is finished: it is in the hand-off already.` : "";
}

/** The suggestion for Reel `n` in the list in the episode's folder `folder` (reels.json): { candidate }, or why not: { gone,
    numbers } when the list does not have the Reel (`numbers` are the ones it has), { nothing } with the reason when the suggestion
    has no stretch to show, or { unreadable } when the list is not there, is not a list or is one a newer brimm-video wrote. */
function suggestion(folder, n) {
  let read;
  try {
    read = readReels(readFileSync(join(folder, REELS_FILE), "utf8"));
  } catch {
    return { unreadable: true };
  }
  if (read.why) return { unreadable: true };
  const candidate = read.reels.candidates.find((c) => c.n === n);
  if (!candidate) return { gone: true, numbers: read.reels.candidates.map((c) => c.n) };
  if (!(candidate.ranges.length > 0 && candidate.end > candidate.start)) return { nothing: String(candidate.failed || "it has no stretch").replace(/\.$/, "") };
  return { candidate };
}

/** Where Reel `n` is in the recording, read from the list of suggestions in the episode's folder `folder` (reels.json): { stretch:
    { n, start, end } }, from the suggestion's first moment to its last, whatever lies between (the stretches the plan keeps are
    separate, and what it cuts between them is the app's to cut). Or why not, as suggestion has it. */
export function reelStretch(folder, n) {
  const found = suggestion(folder, n);
  return found.candidate ? { stretch: { n, start: found.candidate.start, end: found.candidate.end } } : found;
}

/** The record's entry for a Reel project that is made and has never been opened. */
const madeEntry = (ctx, { n, name, at, from, workingCopy }) => ({ key: `reel ${n}`, name, madeAt: at, on: ctx.machine, from, workingCopy, opened: [], handover: false, fromSuggestion: n, state: "made" });

/** A folder at the Reel project's name that the record does not list, taken as the project it is: a run that made the project and
    could not write the record leaves one, and the next run finds it here instead of making it again. Gives { project }, the record's
    entry for it (state "made", never opened, made now, from the recording as it is), or { code } 1 when part of it cannot be read (a
    line says so, and nothing is opened), or null when there is no such folder. Nothing is asked for and nothing is written, so
    neither the words nor the Reel's video are needed: what the video is comes from the project's own facts and the video in it. */
function adoptReel(ctx, { found, record, n, at, dir }) {
  if (!existsSync(dir)) return null;
  const workingCopy = copyIn(dir);
  if (!workingCopy) {
    ctx.say(notWhole(`Reel ${n} of ${record.name.text}`));
    return { code: 1 };
  }
  return { project: madeEntry(ctx, { n, name: basename(dir), at, from: fromOf(record, statSync(join(found.folder, record.video.file))), workingCopy }) };
}

/** Make a Reel's project, if it can be made now: { project, stretch, candidate }, the record's entry for it (state "made", never
    opened), the stretch it was cut from and the suggestion it is, or { code }, when nothing was made and a line said why: the exit
    code to end with.
    - Without the episode's words there is nothing to start from (1).
    - While Claude's reading is at work (`read` holds the episode's lock) nothing is made or asked for (0): she is told to say it again.
    - The Reel must still be in the list of suggestions, with a stretch to show (1, in words).
    - Without the Reel's video, it is asked for, and she is told to say it again when it is done (0). When a run is at work on the
      episode already, whichever video it makes (workcopy.js requestWorkCopy: one at a time, one lock), nothing is asked for, and
      she is told a video is being made and to say it again when it is done (busyWith). The video is looked for by the key of the
      stretch the suggestion has now, so a copy made for another stretch of the Reel is none.
    - With the video in place and a run still at work (the lock is held), she is told the same and nothing is made: the run looks for
      the faces in the video it has put in place, and a project written now would move the video out from under the finder.
    The project is written whole or not at all (project.js writeProject), and a folder at its name that is there already is never
    written over: it throws. adoptReel takes such a folder first, so what is left to throw is one that appeared between the two. */
function makeReel(ctx, { found, record, n, at, dir }, { cli, guidance }) {
  const { home } = ctx;
  const name = record.name.text;
  const stem = basename(record.video.file, extname(record.video.file));
  const words = wordsIn(join(found.folder, `${stem}.words.json`));
  if (!words) {
    ctx.say(noWords(name));
    return { code: 1 };
  }
  if (runningCommand(home, found.name, ctx.alive) === "read") {
    ctx.say(stillReading(n, name));
    return { code: 0 };
  }
  const listed = suggestion(found.folder, n);
  if (!listed.candidate) {
    ctx.say(listed.gone ? noSuchReel(n, listed.numbers) : listed.nothing ? `Reel ${n} has nothing to show: ${listed.nothing}.` : unreadable(name));
    return { code: 1 };
  }
  const asked = { n, start: listed.candidate.start, end: listed.candidate.end };
  const raw = statSync(join(found.folder, record.video.file));
  const copy = reelCopyPaths(home, found.name, n, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, asked));
  if (!(existsSync(copy.video) && existsSync(copy.facts))) {
    // Asked for once: when a run is at work already, whichever video it makes, nothing is started, and she is not told that it is.
    const requested = requestWorkCopy(ctx, { folder: found.name, reel: n });
    ctx.say(requested.started ? beingMade(n, name) : busyWith(n, name));
    return { code: 0 };
  }
  // The video is in place, but the run that put it there may be at work still: it looks for the faces in it, and a project written
  // now would move the video out from under the finder, and the faces it finds would be beside a video that is gone. The lock is the
  // run's whole life, so she is told to say it again when it has ended (a lock left by a run that died is none).
  if (runningCommand(home, found.name, ctx.alive, workCopyLockOf(home, found.name))) {
    ctx.say(busyWith(n, name));
    return { code: 0 };
  }
  const facts = JSON.parse(readFileSync(copy.facts, "utf8"));
  // What was cut is what the copy's facts say (its end held to the video's); the suggestion's stretch is what it was asked to cut.
  const stretch = facts.stretch ?? asked;
  // The cut plan places the words' starts, as it does the main video's (project.js saidWords); it cuts nothing of the Reel, and with
  // none the words are only moved inside their time.
  writeProject(dir, projectFiles({
    kind: "reel", part: { reel: n }, id: record.id, name, spellings: record.spellings, logos: logosIn(ctx.settings.root), facts, words, stretch,
    plan: jsonIn(join(found.folder, `${stem}.cut-plan.json`)), faces: factsIn(copy.faces), video: copy.video, cli, guidance: readFileSync(guidance, "utf8"), createdAt: at
  }));
  const project = madeEntry(ctx, { n, name: basename(dir), at, from: fromOf(record, raw), workingCopy: { bytes: facts.bytes, seconds: facts.seconds, fps: facts.fps } });
  return { project, stretch, candidate: listed.candidate };
}

/** Put the video back into a Reel's project whose video is not in it (plan PR 11): `free` could take it, a hand took it, or the project was
    just rebuilt from the other Mac's snapshot, which leaves the video out. The same as app.js putVideoBack does for the main video, with the
    Reel's own copy (workcopy.js reelCopyPaths): { workingCopy }, what the record keeps of the copy put in, or { code }, when nothing was put
    back and a line said why.
    - A recording that is not in the episode, or that has changed since the project was made, cannot be made into that video again (1).
    - While Claude's reading is at work nothing is asked for, since the Reel's stretch is the reading's (0); the suggestion must still be in
      the list, with a stretch to show (1).
    - Without the Reel's video, it is asked for, and she is told to say it again when it is done (0); when a run is at work on the episode,
      whichever video it makes, she is told a video is being made already (0). With the video in place and the run still looking for the
      faces in it, the same: moving it would take it from under the finder.
    - The copy must be the width, height and length the project was made at (to a second), as its own brimm/facts.json says, start where it says
      the Reel starts (`reel.offset`, to half a second: a suggestion that has moved is another video), and be as large as its own facts say; or
      it is left where it is (1). The project's other files are never touched. All of that is app.js copyFits, the check of every working copy.
    - Then it is renamed into media/recording.mp4, on the same disk. `rename` is how a file is moved: a test gives another.
    - `kept` is the video of the Reel's older project that was just set aside (plan PR 18), when there was one: where no copy is made, it
      stands for the copy if it passes the same check (app.js keptFits), is moved into the project and she is told it was kept; otherwise it
      stays where it is and the copy is asked for as above. */
function putReelVideoBack(ctx, { found, record, n, project, dir, kept = null }, { rename }) {
  const { home } = ctx;
  const name = record.name.text;
  const of = `Reel ${n} of ${name}`;
  const raw = statOf(join(found.folder, record.video.file));
  if (raw === undefined) {
    ctx.say(noRecording(name));
    return { code: 1 };
  }
  if (changedSince(project, { found, record })) {
    ctx.say(videoGoneAndChanged(name));
    return { code: 1 };
  }
  if (runningCommand(home, found.name, ctx.alive) === "read") {
    ctx.say(stillReading(n, name));
    return { code: 0 };
  }
  const listed = suggestion(found.folder, n);
  if (!listed.candidate) {
    ctx.say(listed.gone ? noSuchReel(n, listed.numbers) : listed.nothing ? `Reel ${n} has nothing to show: ${listed.nothing}.` : unreadable(name));
    return { code: 1 };
  }
  const copy = reelCopyPaths(home, found.name, n, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, { n, start: listed.candidate.start, end: listed.candidate.end }));
  const was = factsIn(join(dir, "brimm", "facts.json"));
  const made = factsIn(copy.facts);
  // Where the Reel starts in the recording, to half a second: a suggestion that has moved is another video.
  const starts = Number.isFinite(was?.reel?.offset) ? Number.isFinite(made?.stretch?.start) && Math.abs(made.stretch.start - was.reel.offset) <= 0.5 : true;
  if (!(existsSync(copy.video) && existsSync(copy.facts))) {
    const keeps = keptFits(ctx, { found, kept, copy, was, made, starts });
    if (keeps.workingCopy && moveIn(kept, videoIn(dir), rename)) {
      ctx.say(videoKept(of));
      return { workingCopy: keeps.workingCopy };
    }
    const requested = requestWorkCopy(ctx, { folder: found.name, reel: n });
    ctx.say(requested.started ? beingMade(n, name) : busyWith(n, name));
    return { code: 0 };
  }
  if (runningCommand(home, found.name, ctx.alive, workCopyLockOf(home, found.name))) {
    ctx.say(busyWith(n, name));
    return { code: 0 };
  }
  const fits = copyFits({ was, made, size: statOf(copy.video)?.size, starts });
  if (fits.no) {
    ctx.say({ project: notWhole, copy: notPutBack, other: notTheSame }[fits.no](of));
    return { code: 1 };
  }
  if (!moveIn(copy.video, videoIn(dir), rename)) {
    ctx.say(notPutBack(of));
    return { code: 1 };
  }
  ctx.say(videoBack(of));
  return { workingCopy: fits.workingCopy };
}

/** The record with Reel `n` marked picked, which is what `reel pick` did and what parts.js and the hand-off read: a Reel the list
    holds is picked unless it is finished (a finished Reel's project is opened, and it stays in the hand-off), and one it does not
    hold is added from `candidate`, the suggestion, when the project was made from one. */
const picked = (n, candidate) => (next) => {
  const reels = Array.isArray(next.reels) ? next.reels : [];
  if (!reels.some((r) => r.n === n)) return candidate ? { ...next, reels: [...reels, { ...reelEntries([candidate])[0], status: "picked" }] } : next;
  return { ...next, reels: reels.map((r) => (r.n === n && r.status !== "finished" ? { ...r, status: "picked" } : r)) };
};

/** Open Reel `n` of the episode in the HyperFrames app, making its project first when it has none, and resolve the exit code: 0 when
    the app opened on the project, or when the Reel's video is being made, or Claude is still reading, and she has been told to say
    it again; 1 when the app did not open, or the words are not on this Mac, or the Reel is not there to make, or a project folder of
    this Mac cannot be read, or the record could not be written. It runs once edit.js has gated the episode and claimed it. A project
    that is made stays, whether or not the app opened.
    `ctx` is what edit.js gives a command, { home, machine, now, alive, say, start, settings }. `found` is { name, folder }, and
    `record` the episode's record. `deps` are as openInApp's: `save(next)`, which writes the next record and resolves 0 when it has
    (checked first, so that nothing is made without one), `cli`, `node`, `guidance`, `spawn`, `env`, `chat` and `running`.
    The Reel's project in the record's `app` whose folder is on this Mac is opened again, with one more time it was opened, and
    nothing is made or started. A Reel project the record has whose folder is not here is replaced, when this Mac made it: by the
    folder at the project's name when one is there that the record does not know (adoptReel), and otherwise by a new project
    (makeReel). One that another Mac made is not replaced: edit.js refuses it before the claim (projectOnAnotherMac).
    When it makes the project it says first what the Reel is: "Reel 2 is made: the recording from 0:13 to 0:21." Then the app's
    words, and the line about the buttons, as for the main video's project. The record that is saved holds the project in
    `app.projects`, with `fromSuggestion` the Reel's number, and the Reel's entry in `reels` marked picked. */
export async function openReelInApp(ctx, { found, record, n }, deps = {}) {
  const { save } = deps;
  if (typeof save !== "function") throw new Error("openReelInApp: no save was given, so the record could not be written");
  const { home } = ctx;
  const cli = deps.cli ?? cliPath(home);
  const at = localStamp(new Date(ctx.now()));
  const work = episodeWork(home, found.name);
  const key = `reel ${n}`;
  const projects = record.app?.projects ?? [];
  const earlier = projects.find((p) => p.key === key);

  let project = earlier && plainName(earlier.name) && existsSync(join(work, earlier.name)) ? earlier : null;
  let candidate = null;
  let restored = null;
  // A Reel project whose folder is not on this Mac, and that the record lists a snapshot of, is rebuilt from it (plan PR 11), whichever Mac
  // made it. It is then here without its video, which is put back below, as a project `free` took the video from is.
  let rebuilt = false;
  // The video of an older Reel project that was set aside (below), where it is now, for putReelVideoBack to keep if it can.
  let kept = null;
  if (!project && earlier && plainName(earlier.name)) {
    const snapshot = snapshotOf(record.files, earlier.name);
    if (snapshot) {
      const built = rebuildHere(ctx, { found, record, snapshot, dir: join(work, earlier.name), name: `Reel ${n} of ${record.name.text}` }, { cli, fs: deps.fs });
      if (built.code !== undefined) return built.code;
      project = earlier;
      rebuilt = true;
    }
  }
  // A Reel project here whose marker says it is older than the newest snapshot, because the other Mac worked on it since, is set aside and
  // rebuilt from the newest snapshot in its place, as the main project is (plan PR 18; app.js openInApp): HyperFrames must be quit, which
  // edit.js asked before the claim and is asked again here. A project with no marker is not set aside: it is refused below.
  if (project && !rebuilt && olderMarked(found, { record, project, dir: join(work, project.name) })) {
    const quit = await quitWords(deps.running);
    if (quit) {
      ctx.say(quit);
      return 1;
    }
    const built = rebuildHere(ctx, { found, record, snapshot: snapshotOf(record.files, project.name), dir: join(work, project.name), name: `Reel ${n} of ${record.name.text}`, older: true }, { cli, fs: deps.fs });
    if (built.code !== undefined) return built.code;
    rebuilt = true;
    kept = videoIn(built.aside);
  }
  if (project) {
    const folder = join(work, project.name);
    // A project here that is older than the newest snapshot, and has no marker to say so, is not opened: the other Mac worked on it since,
    // by the times of its files, which are not a word to set a folder aside on.
    if (!rebuilt && olderHere(found, { record, project, dir: folder })) {
      ctx.say(olderThanSnapshot(`Reel ${n} of ${record.name.text}`));
      return 1;
    }
    if (nothingAt(videoIn(folder))) {
      const back = putReelVideoBack(ctx, { found, record, n, project, dir: folder, kept }, { rename: deps.rename ?? renameSync });
      if (back.code !== undefined) return back.code;
      restored = back.workingCopy;
    } else if (changedSince(project, { found, record })) {
      // The project is opened as it was whatever the recording is now: a project that may be open in the app is never changed (4.8).
      ctx.say(recordingChanged(record.name.text));
    }
  } else {
    const dir = join(work, projectName({ name: record.name.text, part: { reel: n }, id: record.id }));
    const taken = adoptReel(ctx, { found, record, n, at, dir }) ?? makeReel(ctx, { found, record, n, at, dir }, { cli, guidance: deps.guidance ?? guidanceOf(home) });
    if (taken.code !== undefined) return taken.code;
    ({ project, candidate = null } = taken);
    if (taken.stretch) ctx.say(reelMade(taken.stretch, n));
  }
  return openProjectInApp(ctx, { record, project, dir: join(work, project.name), projects, keeps: (p) => p.key !== key, at, also: picked(n, candidate), restored }, { save, cli, spawn: deps.spawn, env: deps.env, node: deps.node, chat: deps.chat });
}
