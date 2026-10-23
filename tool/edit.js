#!/usr/bin/env node
// The command line for episodes, which a Claude Code session on this Mac runs for the person editing: it lists the episodes and
// what is waiting, opens one, shows its main timeline in Final Cut Pro through a copy of its own on this Mac, says what is
// running, and imports a video again. Each command is a function of a context, `ctx`, that holds this Mac's settings and the
// ways of doing things a test gives stand-ins for. Every file it puts into Dropbox goes by the rule (dropbox.js), and every
// change to an episode is a new record (episode.js). Long work is started detached and returns at once (detached.js).
//
//   node edit.js episodes                 the episodes, the videos waiting in the drop folders, the imports, and this
//                                         Mac's libraries
//   node edit.js open "<episode>"         check its files are here, bring over those that are not, and show what is
//                                         decided for it
//   node edit.js push "<episode>" [main] [--no-hand-edits | --hand-edits]
//                                         show the main timeline in Final Cut Pro, as a new version, in this Mac's
//                                         library for the episode
//   node edit.js status ["<words>"]       what is running on this Mac, the imports, and what detached runs left
//   node edit.js retry "<video>"          import again a video in this Mac's drop folder whose import failed or stopped
//   node edit.js name, title, reel pick|drop, push … reel <n>
//                                         the episode's name, its title, its Reels, and a Reel shown in Final Cut Pro
//   node edit.js finish "<episode>"       gather what Final Cut Shared and exported, ask what it must, and then, detached,
//                                         transcribe again, copy into final/ and write the hand-off for BRIMM Ops
//
// It never posts, sends or publishes anything.
import { spawnSync } from "node:child_process";
import { promises as dns } from "node:dns";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stamp } from "./shared/text.js";
import { readEpisode, filesProblems, undone, writeEpisode, localStamp, acceptRev, shown as shownAt, claimed, heldElsewhere, heldText, released, conflictedCopies, conflictedOf, conflictedBy, recordFile, kindOf as kindOfRecord } from "./episode.js";
import { readSettings, episodesFolder, workFolder, episodeWork, pushedFolder, libraryFor, runsFolder, dropFolder, fromFinalCutFolder } from "./settings.js";
import { progressFolder, reporter } from "./progress.js";
import { startDetached, runDetached, runningCommand, readResult } from "./detached.js";
import { cloneIn, isWhole, readThrough, replaceIn, textWriter, LATE_CHECK_MS } from "./dropbox.js";
import { localMedia, retitle, withImportOptions, mediaIn } from "./portable.js";
import { eventName, projectName, timelineFile } from "./names.js";
import { REELS_FILE, readReels, reelsText } from "./reels.js";
import { readStatuses, importState, removeStatus } from "./importing.js";
import { heldBy, commitOf, episodeHolding, readSeen, seenKey, readPendings, dueAt } from "./filing.js";
import { reelTimeline } from "./reel.js";
import { partsOf, lookFor, unkeptParts, kindOf } from "./parts.js";
import { finishNow, expectedWords, letGoClaim, cannotFinish, handoffTarget } from "./finish.js";
import { timelineFor, clockFor, piecesOf, askedOf } from "./timeline.js";
import { momentOf, cutNear, clockText, timelineAt, wordsAt, secondsOf, rawAt, lengthOf, FRAME_SLACK } from "./clock.js";
import { pictureNameFault, pictureSize } from "./pictures.js";
import { spellingFault, withSpelling, respelledPart, respelledHandoff, respelledHandoffV2 } from "./spelling.js";
import { handoffText, handoffFault } from "./handoff.js";
import { handoffFaultV2 } from "./handoff-v2.js";
import { presetOf } from "./layers.js";
import { JOBS, CAPTION_STYLES, LOOKS, defaultPreset, presetFault, nameOf, idOf } from "./styles.js";
import { cutSpan, cutPhrases, keptRanges } from "./recut.js";
import { REEL_FRAME } from "./reels.js";
import { findPrograms, askAgain, askBlocked, clockAt, keptList } from "./unedited.js";
import { isMedia } from "./lib.js";
import { studioFiles, studioFolder } from "./studio.js";
import { isRunning, lastLine, runProgram } from "./run.js";

const HELP = `The command line for episodes on this Mac. Claude runs it for the person editing.

  node edit.js episodes                 the episodes, the videos waiting in the drop folders, the imports, and this
                                        Mac's libraries
  node edit.js open "<episode>" [--take-over]
                                        check its files are here, bring over those that are not, claim it for this
                                        Mac, and show what is decided for it. Another Mac's claim refuses it, unless
                                        it is taken over
  node edit.js push "<episode>" [main] [--no-hand-edits | --hand-edits] [--without-other-macs-changes]
                                        show the main timeline in Final Cut Pro, as a new version, in this Mac's
                                        library for the episode. Shown before, it asks first whether it was changed in
                                        Final Cut: --no-hand-edits says it was not, --hand-edits that it was. Shown last
                                        on the other Mac, it goes by what that Mac said when it handed the episode over;
                                        --without-other-macs-changes goes ahead from that version as brimm-video made it
  node edit.js status ["<words>"]       what is running on this Mac, the imports, and what detached runs left
  node edit.js retry "<video>"          import again a video in this Mac's drop folder whose import failed or stopped
  node edit.js name "<episode>" "<name>"
                                        give the episode its name. Nothing is renamed
  node edit.js title "<episode>" [--words "<words>"] [--approve] [--change]
                                        show its title, or set it and approve it. An approved title changes only with
                                        --change, since BRIMM Ops may already have it
  node edit.js title "<episode>" reel <n> [--words "<words>"]
                                        show or set the title on screen of a Reel: the words in its picture
  node edit.js reel pick|drop "<episode>" <n>…
                                        pick Reels to finish, or drop them
  node edit.js reels "<episode>" [--no-play]
                                        list the Reel candidates, and play their previews in QuickTime Player
  node edit.js ask "<episode>"          ask Claude again for Reel candidates, detached. Picked Reels stay as they are
  node edit.js push "<episode>" reel <n> [--no-hand-edits | --hand-edits]
                                        show a picked Reel in Final Cut Pro, upright
  node edit.js finish "<episode>" [--yes] [--take "<part>=<file | this Mac | the other Mac>"] [--no-hand-edits "<part>"]
                     [--without "reel <n>"]
                                        find what Final Cut Shared and exported of each part, and ask what it must. With
                                        --yes and nothing left to ask, it transcribes the finished videos again, copies them
                                        into final/ and writes the hand-off for BRIMM Ops, detached
  node edit.js show "<episode>" transcript|notes|plan
                                        print its transcript, Claude's notes or its cut plan, whole
  node edit.js behind                   whether Jason has a newer brimm-video than this Mac's
  node edit.js resolve "<episode>" [--keep A|B]
                                        show the two sides of a conflicted copy Dropbox kept, and keep the one picked:
                                        the other is set aside in the episode's history/
  node edit.js release "<episode>" [--no-hand-edits | --hand-edits-stay]
                                        hand the episode over to the other Mac: copy this Mac's Shares and exports of it
                                        into its folder, and let it go. When this Mac pushed a part last, it asks first
                                        whether it was changed in Final Cut since: --no-hand-edits says it was not,
                                        --hand-edits-stay that the changes stay in this Mac's library
  node edit.js captions "<episode>" reel <n> on|off
                                        a Reel's running captions, in its caption style; its title on screen stays
  node edit.js spell "<episode>" [add "<as heard>" "<as spelled>" | drop "<as heard>"]
                                        the episode's spellings, which every timeline's captions take; after a finish,
                                        the final transcripts too, and the hand-off is made again
  node edit.js logo "<episode>" on|off [--picture "<name>"]
                                        the logo on the main video, top right; its picture is named once, from the
                                        Pictures folder
  node edit.js text "<episode>" add lower-third [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>]
                     --line "<name>" [--line "<role>"] [--no-hand-edits]
                                        a name over a role, at a time on the timeline or the words said there; "drop
                                        <id>" takes one off, and with neither, the list
  node edit.js graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>")
                     [--for <seconds>] [--place full|corner|lower] [--no-hand-edits]
                                        a picture from the Pictures folder over the timeline; "drop <id>" takes one off,
                                        "ideas" lists Claude's, and with neither, the list
  node edit.js preset "<episode>" [main | reel <n>] [--job "<job>"] [--captions "<style>"] [--look "<look>"]
                                        the timeline's job, caption style and look; with none, what it has and what
                                        there is
  node edit.js cut "<episode>" remove [main | reel <n>] (--words "<words>" | --at <time> --to <time>) [--no-hand-edits]
  node edit.js cut "<episode>" keep [main | reel <n>] (--words "<words>" | --at <time>) [--no-hand-edits]
                                        take whole phrases out, at a pause, as read on the timeline; or keep what was
                                        cut, by its words or at the join nearest a time on the timeline`;

/** The context every command is given: this Mac's settings and what it finds from them, and the ways of doing things,
    each the Mac's own unless a test gives another. {why} when this Mac has no settings for episodes. */
export function contextFor(deps = {}) {
  const home = deps.home || process.env.HOME || homedir();
  const got = deps.settings ? { settings: deps.settings } : readSettings(home);
  if (!got.settings) return { why: "This Mac is not set up for episodes yet. Jason runs install.sh --machine on it." };
  const { settings } = got;
  return {
    settings,
    machine: settings.machine,
    root: settings.root,
    episodes: episodesFolder(settings.root),
    home,
    say: deps.say || ((line) => process.stdout.write(`${line}\n`)),
    now: deps.now || Date.now,
    statfs: deps.statfs || statfsSync,
    stat: deps.stat || ((path) => statSync(path, { throwIfNoEntry: false })),
    alive: deps.alive || isRunning,
    isWhole: deps.isWhole || ((path) => isWhole(path)),
    start: deps.start || startProgram,
    openApp: deps.openApp || openApp,
    kickstart: deps.kickstart || kickstart,
    agentRunning: deps.agentRunning || agentRunning,
    readPlist: deps.readPlist || readPlist,
    deps
  };
}

/** The episodes' folders in Episodes, newest first by their names, which start with the day. */
function folders(ctx) {
  try {
    return readdirSync(ctx.episodes).filter((name) => !name.startsWith(".")).sort().reverse();
  } catch (e) {
    return [];
  }
}

/** A name as it is compared with what a person said: whatever its case, and however its accents are written. */
const plainly = (text) => String(text || "").normalize("NFC").toLowerCase();

/** Some things as they are said in a row: "a", "a and b", "a, b and c". */
const listed = (things) => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} and ${things[things.length - 1]}`);

/** An episode whose record a newer brimm-video wrote, as it is named: by its short id alone, "an episode a newer brimm-video
    wrote (3fa9c1)". Never by its folder, whose name may be a client's: that record may be a session or a video not yet
    answered, and this brimm-video cannot read the label a newer one names it by. */
const newerName = (record) => `an episode a newer brimm-video wrote (${record.id.slice(-6)})`;

/** What a command says of an episode a newer brimm-video wrote, and does nothing more with it. */
const newerWords = (record) => `That is ${newerName(record)}. Jason has a newer brimm-video. Ask him to update this Mac.`;

/** The episode a person names, by what they `said`: its folder's name, its id or short id, or words that are all in its folder's
    name or its own name. Gives back { folder, name, read }, where `read` is what readEpisode gave, or { why } when no episode
    fits or more than one does. An episode with a conflicted copy is found by its own name and id as well, since `name` never
    renames its folder: by the newest whole record past the copies, and by each conflicted copy of a record, since the Mac
    whose change became the copy knows the episode by the name it gave there. Its `read` still says it is conflicted, so
    every command but `resolve` refuses it. In the lists of episodes it says, one a newer brimm-video wrote is named by its
    short id alone (newerName). */
export function findEpisode(ctx, said) {
  // An import that has not finished has no whole record, and is not an episode yet.
  const all = folders(ctx).map((name) => ({ name, folder: join(ctx.episodes, name), read: readEpisode(join(ctx.episodes, name)) })).filter((e) => e.read.code !== "NONE");
  // The records a name or an id is matched against, and only that: for a conflicted episode, the one resolve would read and
  // the records' conflicted copies, as they are, which may not be whole.
  const copiesOf = (e) => conflictedCopies(e.folder).filter((c) => /^record\/\d{4}\.json$/.test(conflictedOf(c))).map((c) => recordAt(join(e.folder, c)));
  const records = new Map(all.map((e) => {
    const read = e.read.record ? [e.read.record] : e.read.code === "CONFLICTED" ? [readEpisode(e.folder, { pastCopies: true }).record, ...copiesOf(e)] : [];
    return [e, read.filter((r) => r !== null && typeof r === "object" && !Array.isArray(r))];
  }));
  const known = (e) => records.get(e);
  const nameOf = (r) => (r.name && typeof r.name.text === "string" ? r.name.text : "");
  const words = plainly(said).split(/\s+/).filter(Boolean);
  const exact = all.filter((e) => plainly(e.name) === plainly(said));
  const byId = all.filter((e) => known(e).some((r) => typeof r.id === "string" && (r.id === said || r.id.slice(-6) === said)));
  const byWords = all.filter((e) => words.length && words.every((w) => plainly(e.name).includes(w) || known(e).some((r) => plainly(nameOf(r)).includes(w))));
  const fits = exact.length ? exact : byId.length ? byId : byWords;
  const shownAs = (e) => (e.read.newer ? newerName(e.read.record) : e.name);
  if (fits.length === 1) return fits[0];
  if (fits.length > 1) return { why: `More than one episode fits "${said}": ${listed(fits.map(shownAs))}. Say which.` };
  return { why: all.length ? `No episode fits "${said}". The episodes are: ${listed(all.map(shownAs))}.` : "There are no episodes yet." };
}

/** A size in bytes as a person reads it: "3.0 MB", "300 GB". */
export function sizeText(bytes) {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return u === 0 ? `${n} bytes` : `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[u]}`;
}

/** A stretch of time as a person reads it: "25 minutes", "2 hours", "3 days". */
export function ageText(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

/** The size of the files in a folder, at any depth, without following a link: a Final Cut library holds .fcpcache, a link
    to itself, and links to media kept elsewhere, and neither is counted. */
function folderSize(folder) {
  let sum = 0;
  const walk = (dir) => {
    let names = [];
    try {
      names = readdirSync(dir);
    } catch (e) {
      return;
    }
    for (const name of names) {
      let found;
      try {
        found = lstatSync(join(dir, name));
      } catch (e) {
        continue;
      }
      if (found.isDirectory()) walk(join(dir, name));
      else if (found.isFile()) sum += found.size;
    }
  };
  walk(folder);
  return sum;
}

/** A line for each import in Episodes/.importing/, from its status: running, stopped, failed, or with a problem found by its
    late check. Only those whose video `fits`, when it is given. A video that is held in the drop folder, not imported, is no
    import: the list of the videos waiting says why it waits. */
function importLines(ctx, fits = () => true) {
  return readStatuses(ctx.root, ctx.now()).filter((s) => s.status && fits(s.status.video) && importState(s.status, ctx.now()) !== "held").map(({ status }) => {
    const state = importState(status, ctx.now());
    if (state === "failed") return `  ${status.video}: its import failed on ${status.machine}: ${status.failed}`;
    if (state === "problem") return `  ${status.video}: copied in on ${status.machine}, but the late check found a problem: ${status.problem}`;
    if (state === "stopped") return `  ${status.video}: stopped on ${status.machine} at ${status.step}, ${ageText(ctx.now() - Date.parse(status.at))} ago`;
    return `  ${status.video}: being imported on ${status.machine}, at ${status.step}`;
  });
}

/** `episodes`: each episode, newest first, with what a person needs to pick one up; the videos waiting in each drop folder,
    and for how long; the imports in Episodes/.importing; and this Mac's libraries, with the free space on its disk. An
    archived episode is left out, and one a newer brimm-video wrote is named by its short id alone (newerName). */
export async function episodes(ctx) {
  const { say } = ctx;
  const shown = folders(ctx).map((name) => ({ name, folder: join(ctx.episodes, name), read: readEpisode(join(ctx.episodes, name)) }))
    .filter((e) => e.read.code !== "NONE" && !(e.read.record && e.read.record.archived));
  if (!shown.length) say("No episodes yet.");
  else {
    say("Episodes, newest first:");
    for (const { name, folder, read } of shown) {
      const r = read.record;
      if (!r) {
        say(`  ${name}`);
        say(`    Not right: ${read.why}.`);
        continue;
      }
      if (read.newer) {
        say(`  ${capital(newerName(r))}: Jason updates this Mac before it is changed here.`);
        continue;
      }
      const kind = r.kind === "short video" ? "a short video" : "an episode";
      say(`  ${r.name.text}${r.name.placeholder ? " (a placeholder name)" : ""}: ${kind} of ${stamp(r.video.seconds)}, in ${name}, id ${r.id.slice(-6)}`);
      if (r.editing) say(`    Editing: ${r.editing.by}, since ${shownAt(r.editing.since)}`);
      if (r.title) say(`    Title: ${r.title.text}${r.title.approved ? "" : " (recommended)"}`);
      const pushed = r.main && Array.isArray(r.main.pushed) ? r.main.pushed : [];
      if (pushed.length) say(`    Shown in Final Cut: v${pushed[pushed.length - 1].v}, on ${pushed[pushed.length - 1].on}`);
      if (r.finished) say(`    Finished: revision ${r.finished.revision}, on ${r.finished.on}`);
      for (const problem of filesProblems(folder, r)) say(`    Not right: ${problem}`);
    }
  }
  // The videos in each Mac's drop folder.
  const drops = join(ctx.root, "Unedited Video");
  const waiting = [];
  let macs = [];
  try {
    macs = readdirSync(drops).filter((n) => !n.startsWith(".")).sort((a, b) => (a === ctx.machine ? -1 : b === ctx.machine ? 1 : a.localeCompare(b)));
  } catch (e) {
    // There are no drop folders yet.
  }
  for (const mac of macs) {
    let names = [];
    try {
      names = readdirSync(join(drops, mac)).filter(isMedia).sort();
    } catch (e) {
      continue;
    }
    for (const video of names) {
      const found = ctx.stat(join(drops, mac, video));
      if (!found) continue;
      const held = heldBy({ root: ctx.root, video, bytes: found.size, now: ctx.now() });
      // How long it has waited is from when this Mac's import first saw it (seen.json): the file's own dates are kept by a copy,
      // and macOS moves its birth time back with them. When this Mac has not seen it, as in the other Mac's drop folder, from
      // its ctime, when it came into the folder, which a tag or a preview set since then makes later.
      const noted = readSeen(ctx.home)[seenKey(video, found)];
      const came = noted && Number.isFinite(noted.at) ? noted.at : found.ctimeMs;
      waiting.push(`  ${video}, in ${mac}'s, for ${ageText(ctx.now() - came)}${held ? `: ${held}` : ""}`);
    }
  }
  if (waiting.length) {
    say("Waiting in the drop folders:");
    for (const line of waiting) say(line);
  }
  // The imports, from their status files.
  const imports = importLines(ctx);
  if (imports.length) {
    say("Imports:");
    for (const line of imports) say(line);
  }
  // This Mac's libraries, and the space left for them.
  say("On this Mac:");
  let work = [];
  try {
    work = readdirSync(workFolder(ctx.home)).filter((n) => !n.startsWith(".")).sort();
  } catch (e) {
    // There is no BRIMM Video Work yet.
  }
  for (const name of work) {
    const library = join(workFolder(ctx.home), name, `${name}.fcpbundle`);
    if (statSync(library, { throwIfNoEntry: false })) say(`  ${name}.fcpbundle: ${sizeText(folderSize(library))}`);
  }
  try {
    const disk = ctx.statfs(ctx.home);
    say(`  Free on the disk: ${sizeText(Number(disk.bavail) * Number(disk.bsize))}`);
  } catch (e) {
    say("  Free on the disk: it could not be read.");
  }
  return 0;
}

/** Start a program detached from this one, and do not wait for it: what it prints goes into the tool's log. */
function startProgram(cmd, args) {
  import("./detached.js").then(({ spawnDetached }) => spawnDetached(cmd, args));
}

/** The episode a command is asked about, by what the person said, with its record: { found, record }, or { code } when the
    command is to end, having said why. A record of a newer layout is shown as such and goes no further. */
function episodeFor(ctx, rest, { newerEnds = 0 } = {}) {
  const said = rest.join(" ").trim();
  if (!said) {
    ctx.say(HELP);
    return { code: 2 };
  }
  const found = findEpisode(ctx, said);
  if (found.why) {
    ctx.say(found.why);
    return { code: 1 };
  }
  const { read } = found;
  if (!read.record) {
    ctx.say(`${found.name}: ${read.why}.`);
    return { code: 1 };
  }
  if (read.newer) {
    ctx.say(newerWords(read.record));
    return { code: newerEnds };
  }
  return { found, record: read.record };
}

/** Say once on this Mac, at the first open or push of an episode that completes, how to keep the episode on this Mac: Dropbox
    offers no command for it. A marker in this Mac's folder for the episode says it was said. */
function offlineStep(ctx, found) {
  const said = join(episodeWork(ctx.home, found.name), "offline-step-said");
  if (existsSync(said)) return;
  ctx.say(`So that Dropbox keeps this episode on this Mac, Control-click its folder in Finder and choose Make available offline: ${found.folder}`);
  try {
    mkdirSync(episodeWork(ctx.home, found.name), { recursive: true });
    writeFileSync(said, "");
  } catch (e) {
    // It is said again the next time.
  }
}

/** Her yes to taking an episode over from another Mac, kept in this Mac's folder for the episode: the claim she said it of,
    { by, since }. A take-over keeps it; a plain open that refuses, which has her asked again, lets it go, since she may say no
    this time. "How far is it?" says to take it over again only while it is kept (nextOf). */
const yesFile = (home, folder) => join(episodeWork(home, folder), "take-over.yes.json");

/** Keep her yes to taking over the claim `held`. When it cannot be kept, "how far is it?" says to open the episode, and she is
    asked again, which is the safe way to go wrong. */
function keepYes(ctx, folder, held) {
  try {
    mkdirSync(episodeWork(ctx.home, folder), { recursive: true });
    writeFileSync(yesFile(ctx.home, folder), JSON.stringify({ by: held.by, since: held.since }) + "\n");
  } catch (e) {
    // She is asked again instead.
  }
}

/** Let her yes go: she is being asked again. */
function forgetYes(ctx, folder) {
  try {
    rmSync(yesFile(ctx.home, folder), { force: true });
  } catch (e) {
    // It stays, then. The skill still asks her again in any later conversation.
  }
}

/** Her yes, { by, since }, or null when none is kept or it cannot be read. */
function yesOf(ctx, folder) {
  try {
    return JSON.parse(readFileSync(yesFile(ctx.home, folder), "utf8"));
  } catch (e) {
    return null;
  }
}

/** The episode's files that are not whole on this Mac yet, as Dropbox brings them over: by the record's list. */
const notHere = (ctx, found, record) => Object.keys(record.files).filter((rel) => !ctx.isWhole(join(found.folder, rel)));

/** How long `open` waits after writing its claim before it reads the record again: Dropbox shows no sign of having taken a
    change across, so a fixed 20 seconds, in which the other Mac's claim made at the same time comes across too. */
export const CLAIM_WAIT_MS = 20000;

/** Whether this Mac seems to be online: Dropbox's own address is looked up, for at most 3 seconds. */
async function online() {
  const looked = dns.lookup("www.dropbox.com").then(() => true, () => false);
  return Promise.race([looked, new Promise((done) => setTimeout(() => done(false), 3000).unref())]);
}

/** Why a command that writes the record or pushes must not change the episode now, because another Mac has it open (spec
    section 1, "Picking an episode up"): "" when nobody does, or this Mac does. */
function claimHeld(ctx, record) {
  return heldText(record, ctx.machine);
}

/** The files the other Mac handed over that are not here yet: by the record's `released` list, each the record still lists
    at that size and not here at it, or not whole. A file changed since the release is the record's to judge (filesProblems,
    notHere), and is not waited for here: the list would otherwise hold open for ever. None when this Mac let it go last. */
function stillArriving(ctx, found, record) {
  const released = record.released;
  if (!released || !released.by || released.by === ctx.machine) return [];
  return Object.entries(released.files || {}).filter(([rel, bytes]) => {
    if (record.files[rel] !== bytes) return false;
    const here = ctx.stat(join(found.folder, rel));
    return !here || here.size !== bytes || !ctx.isWhole(join(found.folder, rel));
  }).map(([rel]) => rel);
}

/** The record claimed for the Mac `machine` at `at`. An answer about hand edits given for a part this Mac pushed last counts
    no more: its Final Cut may change that version again before it hands the episode over, when it is asked again. A take-over
    drops every answer: it carries none (ruling 7). */
function claimFor(record, machine, at, { takeOver = false } = {}) {
  const answers = record.released && record.released.answers;
  if (!answers) return claimed(record, machine, at);
  return claimed(takeOver ? { ...record, released: { ...record.released, answers: {} } } : withoutOwnAnswers(record, machine), machine, at);
}

/** The record with the answers dropped that were given for parts the Mac `machine` pushed last: its Final Cut may change those
    versions again. A claim drops them, and so does a push made with no claim (ruling 3), since it is that Mac at work on the
    episode again. */
function withoutOwnAnswers(record, machine) {
  const answers = record.released && record.released.answers;
  if (!answers) return record;
  const mine = new Set(newestPushes(record).filter((p) => p.last && p.last.on === machine).map((p) => p.key));
  return { ...record, released: { ...record.released, answers: Object.fromEntries(Object.entries(answers).filter(([key]) => !mine.has(key))) } };
}

/** `open "<episode>" [--take-over]`: check its files against its record, and that each is whole on this Mac, claim it for this
    Mac, and show what is decided for it. In order:
    - a change Dropbox undid is said, and the record as it is now taken as this Mac's;
    - another Mac's claim refuses it at once, unless it is taken over (`--take-over`): nothing is looked at or brought over
      first, since on the Mac that is not editing an episode its files are online-only, and bringing them, raw video and all,
      would be for nothing until it is taken over. The refusal lets go of any yes she gave before to taking it over, since she
      is asked again; a take-over keeps her yes (keepYes);
    - files the other Mac handed over that are still on their way: a detached run brings them over (`bring`), and nothing is
      claimed until they are here (not on a take-over, which goes by the record's own list);
    - a file of the record missing or short refuses it; files not whole on this Mac yet are brought over, as above, and on a
      take-over what it says next is to take it over again, so that she is asked only once; so does the bring's result, but
      only when every file came, and only while the claim she said to take over stands and her yes is kept (nextOf);
    - the claim: the record is written with this Mac editing it, and after CLAIM_WAIT_MS it is read again: when Dropbox took
      the claim away, this Mac says so and stops; when the other Mac claimed it meanwhile, or both Macs wrote the same record
      and Dropbox kept a conflicted copy, this Mac stops, and it is theirs or for a person to sort out;
    - a warning when this Mac seems offline, since the other Mac then cannot see the claim.
    At the first open on this Mac it says how to keep the episode on this Mac. */
export async function open(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found } = got;
  let { record } = got;
  const { say } = ctx;
  const gone = undone(record, ctx.home);
  if (gone) {
    say(gone);
    acceptRev(ctx.home, record.id, record.rev);
  }
  const name = record.name.text;
  // Who has it is said before any file is looked at: the files of an episode another Mac has are not whole here, and a Mac
  // that handed it over and opened it again still has its `released` list in the record, which is not still arriving.
  const held = heldElsewhere(record, ctx.machine);
  if (held && !flags["take-over"]) {
    // She is asked again whether to take it over, and may say no this time: a yes she gave before counts no more.
    forgetYes(ctx, found.name);
    say(`${held.by} has ${name} open, since ${shownAt(held.since)}. Say "take it over" to open it here; anything not handed over stays on ${held.by}.`);
    return 1;
  }
  if (held) keepYes(ctx, found.name, held);
  // The files the other Mac handed over are in the record's list too, so they are waited for before the list is checked. A
  // take-over does not wait: it goes by the record's own list. A take-over of a record nobody else has open is a plain open.
  const arriving = held ? [] : stillArriving(ctx, found, record);
  if (arriving.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: arriving });
    say(`Still arriving from ${record.released.by}: ${arriving.length} file${arriving.length === 1 ? "" : "s"}. Dropbox is bringing them over; say "open ${name}" again when it is done.`);
    return 0;
  }
  const problems = filesProblems(found.folder, record);
  if (problems.length) {
    say(`${found.name} is not whole in Dropbox:`);
    for (const problem of problems) say(`  ${problem}`);
    say(`It is not opened. Say "what's waiting?" to see the episodes.`);
    return 1;
  }
  // Past the refusal, another Mac's claim means this is a take-over. What is said next is then to take it over again, by this
  // open and by the bring it starts: a plain open would refuse, and she would be asked a second time.
  const sayNext = held ? `Say "take it over" again` : `Say "open ${name}" again`;
  const coming = notHere(ctx, found, record);
  if (coming.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: held ? ["--take-over"] : [] });
    say(`Dropbox is bringing ${coming.length} file${coming.length === 1 ? "" : "s"} of ${name} over to this Mac. ${sayNext} when it is done; "how far is it?" shows how far it has got.`);
    return 0;
  }
  if (!record.editing || record.editing.by !== ctx.machine) {
    const took = held ? `Taken over from ${held.by}, who had it since ${shownAt(held.since)}.` : "";
    if ((await save(ctx, { ...found, record }, claimFor(record, ctx.machine, localStamp(new Date(ctx.now())), { takeOver: Boolean(held) }), took)) !== 0) return 1;
    await (ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))))(CLAIM_WAIT_MS);
    const again = readEpisode(found.folder);
    if (!again.record) {
      say(`${found.name}: ${again.why}.`);
      return 1;
    }
    // The record read again is older than the claim this Mac wrote, or has nobody editing it: Dropbox took the claim away.
    // That is said, not that the other Mac opened it: a claim of theirs in a record older than this Mac's is the one this Mac
    // took over, not a new one. The record as it is now is taken as this Mac's, so the next open goes through. What is said
    // next goes by that record: to take it over again only while it still has the claim she said to take over, and otherwise
    // to open it, which waits for anything handed over meanwhile, or refuses a new claim, and she is asked.
    const undid = undone(again.record, ctx.home);
    if (undid || !again.record.editing) {
      const still = heldElsewhere(again.record, ctx.machine);
      const same = held && still && still.by === held.by && still.since === held.since;
      say(`Dropbox undid this Mac's claim on ${name}. ${same ? `Say "take it over" again` : `Say "open ${name}" again`}.`);
      if (undid) acceptRev(ctx.home, again.record.id, again.record.rev);
      return 1;
    }
    if (again.record.editing.by !== ctx.machine) {
      say(`${again.record.editing.by} opened ${name} at the same time, and it is theirs. Say "take it over" if they are done with it.`);
      return 1;
    }
    record = again.record;
    if (!(await (ctx.deps.online || online)())) say("This Mac seems to be offline: the other Mac will not see that you have it until this one is back online.");
  }
  const kind = record.kind === "short video" ? "a short video" : "an episode";
  say(`${name}${record.name.placeholder ? " (a placeholder name)" : ""}: ${kind} of ${stamp(record.video.seconds)}, in ${found.name}`);
  if (record.name.placeholder) say("The name is a placeholder: say what to call it.");
  say(record.title ? `Title: ${record.title.text}${record.title.approved ? "" : " (recommended by Claude)"}` : "No title yet.");
  const stem = basename(record.video.file, extname(record.video.file));
  const notes = join(found.folder, `${stem}.edit-notes.txt`);
  if (existsSync(notes)) {
    say("Claude's notes, the first lines:");
    for (const line of readFileSync(notes, "utf8").split("\n").filter((l) => l.trim()).slice(0, 12)) say(`  ${line}`);
  }
  const candidates = record.reels.filter((reel) => reel.status !== "dropped");
  if (candidates.length) {
    say("Reel candidates:");
    for (const reel of candidates) say(`  ${reel.n}. "${reel.title}", ${stamp(reel.to - reel.from)}.${reel.why ? ` ${reel.why}` : ""}`);
  }
  const pushed = record.main.pushed;
  say(pushed.length ? `Shown in Final Cut: v${pushed[pushed.length - 1].v}, on ${pushed[pushed.length - 1].on}.` : "Not shown in Final Cut yet.");
  offlineStep(ctx, found);
  say('Say "show it in Final Cut" to see the main video there.');
  return 0;
}

/** Open a file in an app on this Mac, as a double-click would: Final Cut Pro, here, and a timeline handed to it. Throws,
    saying why in open's words, when the app could not be opened. `run` is how a program is run, for a test to give
    another. */
export function openApp(app, file, run = spawnSync) {
  const ran = run("/usr/bin/open", ["-a", app, file], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(`${app} could not be opened (${lastLine(ran.stderr)})`);
}

/** The launch agent that imports this Mac's drop folder. */
const AGENT = "com.thebrimm.unedited";

/** The keys a property list holds, as { key: true }, or null when it is not there or cannot be read. It is read as XML, since
    a library's Settings.plist holds bookmark data that JSON cannot carry. Nothing here writes it. Kept for later: a
    library's backups stay on Final Cut's default, by the lead's ruling of 2026-10-14 (phase 0, B4), since a library whose
    backups were set to BRIMM Video Work/Backups wrote none there in two hours, so nothing reads it now. */
export function readPlist(file) {
  if (!existsSync(file)) return null;
  const ran = spawnSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", file], { encoding: "utf8" });
  if (ran.status !== 0) return null;
  return Object.fromEntries([...ran.stdout.matchAll(/<key>([^<]*)<\/key>/g)].map((m) => [m[1], true]));
}

/** Whether the launch agent's run is at work now: launchctl names its process while it runs. */
function agentRunning() {
  const ran = spawnSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${AGENT}`], { encoding: "utf8" });
  return ran.status === 0 && /^\s*pid = \d+/m.test(ran.stdout);
}

/** Ask the launch agent to look in this Mac's drop folder now, as it does when something lands there: with its own
    arguments, its own environment and its own lock. When it is running already, nothing more is started, and its run
    looks again within a minute. Throws, saying why in launchctl's words, when it could not be asked. */
function kickstart() {
  const ran = spawnSync("/bin/launchctl", ["kickstart", `gui/${process.getuid()}/${AGENT}`], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(lastLine(ran.stderr));
}

/** The options the rule for writing into Dropbox is given: the clone and the check of one disk a test gives. */
const ruleOpts = (ctx) => ({ ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) });

/** Show a part of an episode in Final Cut Pro, as a new version: the main timeline, "main", or a Reel, { reel: n } (phase 2).
    `found` is { folder, name, record }; `xml` is the timeline to show, as it is kept in the episode's folder: its media named
    by paths from edit/, and no library. In order:
    - it refuses a file of the episode not whole on this Mac, and a change Dropbox undid;
    - the guard: a part shown before is shown again only when the person says it was not changed in Final Cut since
      (`noHandEdits`). A yes (`handEdits`) stops it: until brimm-video can read Final Cut's exports (phase 5), it cannot build
      on hand edits, and a new version would leave them behind;
    - the new version's project is named by projectName, in the episode's one event (eventName). Phase 0 (A4): a new project
      in that event asks nothing; a project of a name the library holds asks to replace it even with suppress warnings, and
      Keep Both renames it, so a name is never handed over twice (the version, below);
    - the timeline is kept in the episode's edit/ by the rule, the record lists the push and the file, and only then is a copy
      written on this Mac's own disk, with this Mac's paths, its library for the episode, copy assets 0 and suppress warnings
      1, and handed to Final Cut.
    Resolves 0 when Final Cut was asked to open it, and 1 when it refused, having said why. */
export async function pushPart(ctx, found, { part, xml, told = [], noHandEdits = false, handEdits = false, withoutOther = false }) {
  const { say } = ctx;
  const { record } = found;
  const held = claimHeld(ctx, record);
  if (held) return refuse(ctx, held);
  const target = part === "main" ? record.main : record.reels.find((reel) => reel.n === part.reel);
  if (!target) {
    say(`${record.name.text} has no Reel ${part.reel}.`);
    return 1;
  }
  // A push Dropbox took away is said once, and the record as it is now is taken as this Mac's: the push said again then goes
  // through, as a version of its own (below).
  const gone = undone(record, ctx.home);
  if (gone) {
    say(gone);
    acceptRev(ctx.home, record.id, record.rev);
    return 1;
  }
  const problems = filesProblems(found.folder, record);
  if (problems.length) {
    say(`${found.name} is not whole in Dropbox:`);
    for (const problem of problems) say(`  ${problem}`);
    return 1;
  }
  const guard = guardOf(ctx, found, part, { noHandEdits, handEdits, withoutOther });
  if (guard.why) return refuse(ctx, guard.why);
  const { last, answer } = guard;
  const pushed = Array.isArray(target.pushed) ? target.pushed : [];
  const v = last + 1;
  const project = projectName({ name: record.name.text, part, v, id: record.id });
  const file = timelineFile({ part, v, machine: ctx.machine });
  const kept = join(found.folder, file);
  const stored = retitle(xml, { event: eventName(found.name), project });
  // The copy handed to Final Cut names this Mac's paths: each medium must be in the episode's folder, and here, whole.
  const local = localMedia(stored, { from: kept, episode: found.folder });
  if (local.outside.length) {
    say(`${local.outside[0]} is outside the episode's folder. Copy it into its media folder first.`);
    return 1;
  }
  const media = [...local.xml.matchAll(/src="file:\/\/([^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
  const coming = [...new Set(media)].filter((path) => !ctx.isWhole(path));
  if (coming.length) {
    say(`Dropbox is still bringing ${coming.map((path) => basename(path)).join(", ")} over to this Mac. Say "open ${record.name.text}" first.`);
    return 1;
  }
  const work = join(runsFolder(ctx.home), `push-${process.pid}-${ctx.now()}`);
  try {
    const opts = ruleOpts(ctx);
    mkdirSync(join(found.folder, "edit"), { recursive: true });
    // A timeline of this Mac's of this version that the record does not list was left by a push whose record was never
    // written: it is no one's, and a new one is put in its place. One the record lists is never written over.
    const entry = textWriter({ work, ...opts })(kept, stored, { replace: !(file in record.files) && existsSync(kept) });
    // What the session had asked for, so that a finish can tell when more was asked for since this version (askedOf).
    const push = { v, at: localStamp(new Date(ctx.now())), on: ctx.machine, file, project, asked: askedOf(record, part), ...(answer ? { answer } : {}) };
    const next = part === "main"
      ? { ...record, main: { ...record.main, pushed: [...pushed, push] } }
      : { ...record, reels: record.reels.map((reel) => (reel === target ? { ...reel, pushed: [...pushed, push] } : reel)) };
    const writer = { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine };
    try {
      // This Mac at work on the episode again: answers it gave about parts it pushed last count no more (the P1 check, T15).
      writeEpisode(found.folder, withoutOwnAnswers({ ...next, libraries: { ...record.libraries, [ctx.machine]: `${found.name}.fcpbundle` }, files: { ...record.files, [file]: entry.bytes } }, ctx.machine), { expectRev: record.rev, writeText: textWriter({ work, ...opts }), writer, home: ctx.home });
    } catch (e) {
      say(e.code === "CHANGED" ? "This episode changed on the other Mac: open it again." : `${String(e.message).replace(/\.$/, "")}.`);
      return 1;
    }
    const copy = join(pushedFolder(ctx.home, found.name), basename(file));
    mkdirSync(pushedFolder(ctx.home, found.name), { recursive: true });
    writeFileSync(copy, withImportOptions(local.xml, { library: libraryFor(ctx.home, found.name) }));
    ctx.openApp("Final Cut Pro", copy);
    say(`Shown in Final Cut as "${project}", in the library ${found.name}.fcpbundle in BRIMM Video Work.`);
    // How the timeline was built, said once it is shown (phase 4): what stood in, and what a rule changed.
    for (const line of told) say(line);
    offlineStep(ctx, found);
    return 0;
  } catch (e) {
    say(`It could not be shown in Final Cut: ${String(e.message).replace(/\.$/, "")}.`);
    return 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The guard, for a part shown in Final Cut before (spec section 4, "the guard"): asked before it is shown again, and before
    a command reads a time or quoted words on it (phase 4). { last, answer }: the version it was last shown as on either
    Mac (0 when never), and what goes in the record of a push; or { why } it cannot go on. A yes to the guard (`handEdits`)
    always stops it. When the other Mac showed it last, only that Mac's answer, carried in the record when it handed the
    episode over, says whether it was changed there; `withoutOther` goes on from that version as brimm-video made it.
    `doing` is what "no changes" lets happen, in the question asked. */
function guardOf(ctx, found, part, { noHandEdits = false, handEdits = false, withoutOther = false } = {}, doing = "to show it again") {
  const { record } = found;
  const target = part === "main" ? record.main : record.reels.find((reel) => reel.n === part.reel);
  const pushed = Array.isArray(target.pushed) ? target.pushed : [];
  // The version is one more than any the record lists and any this Mac has handed Final Cut, whose copies are kept in
  // pushed/: a push whose record Dropbox took away has used up its version, and its project's name is never handed over twice.
  const kind = part === "main" ? "main" : `reel-${part.reel}`;
  let handed = [];
  try {
    handed = readdirSync(pushedFolder(ctx.home, found.name)).map((n) => new RegExp(`^${kind}\\.v(\\d+)\\.`).exec(n)).filter(Boolean).map((m) => Number(m[1]));
  } catch (e) {
    // Nothing has been handed to Final Cut on this Mac yet.
  }
  const last = Math.max(0, ...pushed.map((p) => p.v), ...handed);
  // The newest push, when another Mac made it: what was done to it there is in that Mac's library, and only that Mac's answer,
  // carried in the record when it handed the episode over, says whether it was changed (spec section 4).
  const top = pushed.reduce((best, p) => (!best || p.v > best.v ? p : best), null);
  const other = top && top.v === last && top.on !== ctx.machine ? top.on : "";
  // A yes to the guard always stops it, whatever else is said with it.
  if (last && handEdits) return { why: `Your changes stay in v${last} in Final Cut. This version of brimm-video cannot build on them yet. Until it can: ask for brimm-video's changes first and make trims by hand last, or finish that timeline by hand in v${last}.` };
  if (other) {
    const key = part === "main" ? "main" : `reel ${part.reel}`;
    const named = part === "main" ? "the main video" : `reel ${part.reel}`;
    const carried = record.released && record.released.answers && record.released.answers[key];
    const said = carried && carried.v === last ? carried.said : "";
    // Her own "no changes" is about her own Final Cut, and never lifts this.
    if (said === "no changes") return { last, answer: `${other} said no changes since v${last}` };
    if (withoutOther) return { last, answer: `without ${other}'s changes since v${last}` };
    if (said) return { why: `The changes to v${last} of ${named} stay on ${other}, in its Final Cut library: ${other} said so when it handed this over. Finish that part on ${other}, or start again from v${last} without them (say "go ahead without ${other}'s changes").` };
    return { why: `v${last} of ${named} was shown on ${other}, and ${other} has not said whether it was changed there. Ask whoever used it on ${other}. If it was not changed, or to start again from v${last} without those changes, say "go ahead without ${other}'s changes".` };
  }
  if (last && !noHandEdits) return { why: `Did you change v${last} of ${record.name.text} in Final Cut since it was shown? Say "no changes" ${doing}. If you did change it, say so.` };
  return { last, answer: last ? `no hand edits since v${last}` : null };
}

/** `push "<episode>" [main | reel <n>] [--no-hand-edits | --hand-edits]`: show the main timeline in Final Cut Pro as a new
    version (pushPart): the import's own, edit/main.v0.fcpxml. A picked Reel is pushed by pushReel. */
export async function push(ctx, rest) {
  const flags = new Set(rest.filter((word) => word.startsWith("--")));
  const words = rest.filter((word) => !word.startsWith("--"));
  if (words.length >= 2 && words[words.length - 2] === "reel" && /^\d+$/.test(words[words.length - 1])) {
    const n = Number(words.pop());
    words.pop();
    const got = episodeFor(ctx, words, { newerEnds: 1 });
    if (!got.found) return got.code;
    if (claimHeld(ctx, got.record)) return refuse(ctx, claimHeld(ctx, got.record));
    return pushReel(ctx, { ...got.found, record: got.record }, n, { noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits"), withoutOther: flags.has("--without-other-macs-changes") });
  }
  if (words[words.length - 1] === "main") words.pop();
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = got;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  // The timeline as the session leaves it: the import's own until something is laid over it (phase 4).
  const made = await timelineFor({ ...found, record }, "main", ctx);
  if (made.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: made.bring });
    return refuse(ctx, `Dropbox is still bringing ${made.coming} over to this Mac. Say "open ${record.name.text}" first.`);
  }
  if (made.why) return refuse(ctx, made.why);
  return pushPart(ctx, { ...found, record }, { part: "main", xml: made.xml, told: made.told, noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits"), withoutOther: flags.has("--without-other-macs-changes") });
}

/** `bring --now "<episode folder>" [--take-over]`, the detached run `open` starts: each file of the episode that is not whole
    on this Mac is read to its end, so that Dropbox brings it over, and the result says which are whole now, and what to say
    next: to open it, or, when a file did not come, why, and to open it to try again. The bring of a take-over (`--take-over`)
    that brought every file also keeps whose claim it was for, and that what to say next, while that claim stands and her yes
    to it is kept, is to take it over again: `status` says so only then (see nextOf). */
export async function bring(ctx, rest) {
  // Given files after the folder (a Reel's clip, from push reel), only those are brought over.
  const [now, folder, ...after] = rest;
  const takeOver = after.includes("--take-over");
  const only = after.filter((word) => word !== "--take-over");
  if (now !== "--now" || !folder) {
    ctx.say(HELP);
    return 2;
  }
  const found = findEpisode(ctx, folder);
  if (!found.read || !found.read.record) {
    ctx.say(found.why || `${folder}: ${found.read.why}.`);
    return 1;
  }
  const { record } = found.read;
  const name = record.name.text;
  // The claim she said to take over, as the record has it when the bring starts: none when nobody else has it by then.
  const taking = takeOver ? heldElsewhere(record, ctx.machine) : null;
  const result = await runDetached({ home: ctx.home, folder: found.name, command: "bring", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, async () => {
    const wanted = () => (only.length ? only.filter((rel) => !ctx.isWhole(join(found.folder, rel))) : notHere(ctx, found, record));
    const coming = wanted();
    const read = ctx.deps.readAll || readThrough;
    const failed = [];
    for (const rel of coming) {
      try {
        await read(join(found.folder, rel));
      } catch (e) {
        failed.push(`${rel} could not be read (${e.code || e.message})`);
      }
    }
    const still = wanted();
    const made = coming.filter((rel) => !still.includes(rel));
    for (const rel of still) if (!failed.some((f) => f.startsWith(`${rel} `))) failed.push(`${rel} is still not whole`);
    const next = failed.length ? `Some files of ${name} are not here yet. Say "open ${name}" to try again.` : `Every file of ${name} is here. Say "open ${name}".`;
    // A bring that failed says why, and to open it, take-over or not: it would most likely fail again the same way (a full
    // disk, Dropbox paused, the Mac offline), and a take-over is run again without asking her only to finish what she said
    // yes to, never to try again what failed.
    if (!taking || failed.length) return { ok: !failed.length, made, failed, next };
    return { ok: true, made, failed, next, takeOver: { by: taking.by, since: taking.since, next: `Every file of ${name} is here. Say "take it over" again.` } };
  });
  if (result.taking) {
    ctx.say(`Another run is taking over the lock of ${found.name}; try again in a few seconds.`);
    return 1;
  }
  if (result.running) {
    ctx.say(`${result.running} is running for ${found.name} already.`);
    return 1;
  }
  return result.ok ? 0 : 1;
}

/** What a detached run's result `r`, for the episode in `folder`, says to say next. The bring of a take-over says to take it
    over again only while the claim she said to take over is still the record's, the same Mac since the same time, and her
    yes to it is still kept (yesOf): the skill then takes it over without asking her again. Once this Mac has it, or that Mac
    has let it go or opened it again since, or she has been asked again since, it says to open it, as any bring does: an open
    goes through, or, when another Mac has it, refuses, and she is asked. A record that cannot be read says to open it too. */
function nextOf(ctx, folder, r) {
  if (!r.takeOver) return r.next;
  const { record } = readEpisode(join(ctx.episodes, folder));
  const held = record && heldElsewhere(record, ctx.machine);
  const yes = yesOf(ctx, folder);
  const same = (claim) => Boolean(claim) && claim.by === r.takeOver.by && claim.since === r.takeOver.since;
  return same(held) && same(yes) ? r.takeOver.next : r.next;
}

/** `status ["<words>"]`: what is running on this Mac (each run's step, from the progress panel's files), the imports in
    Episodes/.importing/, and for each episode on this Mac the detached run at work on it and what each one left, with what to
    say next (nextOf). With words, only what they fit. */
export async function status(ctx, rest) {
  const { say } = ctx;
  const words = plainly(rest.join(" ")).split(/\s+/).filter(Boolean);
  const fits = (text) => words.every((w) => plainly(text).includes(w));
  const lines = [];
  const running = [];
  let progress = [];
  try {
    progress = readdirSync(progressFolder(ctx.home)).filter((n) => /^\d+\.json$/.test(n)).sort();
  } catch (e) {
    // Nothing has run on this Mac yet.
  }
  for (const name of progress) {
    try {
      const run = JSON.parse(readFileSync(join(progressFolder(ctx.home), name), "utf8"));
      if (ctx.alive(run.pid) && fits(run.video)) running.push(`  ${run.video}: ${run.detail}`);
    } catch (e) {
      // A run is writing it.
    }
  }
  if (running.length) lines.push("Running on this Mac:", ...running);
  const imports = importLines(ctx, fits);
  if (imports.length) lines.push("Imports:", ...imports);
  let local = [];
  try {
    // An episode is found by its folder's name, or by its own name as findEpisode finds it.
    const named = words.length ? findEpisode(ctx, rest.join(" ")) : {};
    local = readdirSync(workFolder(ctx.home)).filter((n) => !n.startsWith(".") && (fits(n) || n === named.name)).sort();
  } catch (e) {
    // There is no BRIMM Video Work yet.
  }
  for (const folder of local) {
    const command = runningCommand(ctx.home, folder, ctx.alive);
    if (command) lines.push(`${folder}: ${command} is running.`);
    let results = [];
    try {
      results = readdirSync(episodeWork(ctx.home, folder)).filter((n) => n.endsWith(".result.json")).sort();
    } catch (e) {
      continue;
    }
    for (const file of results) {
      const r = readResult(ctx.home, folder, file.replace(/\.result\.json$/, ""));
      if (!r || r.command === command) continue;
      const done = r.failed.length ? ` Not done: ${r.failed.join(" ").replace(/([^.])$/, "$1.")}` : "";
      const next = nextOf(ctx, folder, r);
      lines.push(`${folder}: ${r.command} ended ${ageText(ctx.now() - r.ended)} ago.${r.made.length ? ` Made: ${r.made.join(", ")}.` : ""}${done}${next ? ` ${next}` : ""}`);
    }
  }
  for (const line of lines.length ? lines : ["Nothing is running, and nothing is waiting."]) say(line);
  return 0;
}

/** retry of a video an episode holds already (`held` says which, in episodeHolding's words). It is not imported again. But
    when its import stopped on this Mac before its late check, that check holds the episode for ask and --from-plan on both
    Macs (unedited.js importHolds), and is made only at the import's next run: so the launch agent is asked to look, which
    makes it. When this Mac owes no late check of it, a stopped status of this Mac's own for it can never be cleared by a late
    check, and is taken away. Otherwise it is refused, as before. */
function lateCheckOwed(ctx, video, held) {
  const { say } = ctx;
  const owed = readPendings(ctx.home).find((p) => p.video === video && p.machine === ctx.machine && resolve(p.root) === resolve(ctx.root));
  const stopped = readStatuses(ctx.root, ctx.now()).filter((s) => s.status && s.status.video === video && s.status.machine === ctx.machine && importState(s.status, ctx.now()) === "stopped");
  const name = owed ? owed.name : (/already imported as (.*?)\. It stays/.exec(held) || [])[1] || "an episode";
  if (!owed && !stopped.length) {
    say(`${video} is ${held}`);
    return 1;
  }
  if (!owed) {
    for (const { status } of stopped) removeStatus(ctx.root, video, ctx.machine, status.import || "");
    say(`${video} is imported, as ${name}. Its import stopped on this Mac, and has no late check left to make here, so the status that held the episode is taken away.`);
    return 0;
  }
  const problem = owed.problem ? String(owed.problem).replace(/\.$/, "") : "";
  const due = dueAt(owed);
  const later = due > ctx.now() ? `when it is due, at ${clockAt(due)}` : "";
  // A run at work makes a due check within a minute, but makes a check that found a problem only once, at its start.
  if (ctx.agentRunning()) {
    if (problem) {
      say(`${video} is imported, as ${name}, and its late check found a problem: ${problem}. The import at work now does not make it again: once the problem is put right and the panel shows that import has ended, say "try it again" again.`);
      return 1;
    }
    say(`${video} is imported, as ${name}, and its late check is still to be made on this Mac: the import at work now makes it ${later ? `${later}, ` : ""}once it has finished any video it is importing. The panel shows how far it is.`);
    return 0;
  }
  try {
    ctx.kickstart();
  } catch (e) {
    say(`The launch agent ${AGENT} could not be asked to look (${String(e.message).replace(/\.$/, "")}). Jason runs install.sh --machine on this Mac.`);
    return 1;
  }
  if (problem) say(`${video} is imported, as ${name}, and its late check found a problem before (${problem}): the Mac's import of its drop folder is asked to make it again now. The panel shows how far it is.`);
  else say(`${video} is imported, as ${name}, and its late check is still to be made on this Mac: the Mac's import of its drop folder is asked to make it ${later || "now"}. The panel shows how far it is.`);
  return 0;
}

/** `retry "<video>"`: import again a video in this Mac's drop folder whose import failed or stopped. It is found by its
    file's name or its name without the ending, whatever their case. Refused when an episode holds it already (but see
    lateCheckOwed), and while its import is running. Its status files from this Mac are taken away, and the launch agent is asked to look (kickstart). */
export async function retry(ctx, rest) {
  const { say } = ctx;
  const said = rest.join(" ").trim();
  if (!said) {
    say(HELP);
    return 2;
  }
  const drop = dropFolder(ctx.root, ctx.machine);
  let videos = [];
  try {
    videos = readdirSync(drop).filter(isMedia).sort();
  } catch (e) {
    // The drop folder is not there, or cannot be read: it holds nothing that can be imported.
  }
  const video = videos.find((v) => plainly(v) === plainly(said) || plainly(basename(v, extname(v))) === plainly(said));
  if (!video) {
    say(`No video in this Mac's drop folder fits "${said}". ${videos.length ? `It holds: ${listed(videos)}.` : "It is empty."}`);
    return 1;
  }
  const bytes = statSync(join(drop, video)).size;
  const held = episodeHolding({ root: ctx.root, video, bytes });
  if (held) return lateCheckOwed(ctx, video, held);
  // Of this Mac's imports of the video, the ones to take again are those that failed, stopped, or found a problem at their
  // late check. One running now is left alone, and when it is the only one, nothing is done.
  const mine = readStatuses(ctx.root, ctx.now()).filter((s) => s.status && s.status.video === video && s.status.machine === ctx.machine);
  // A video the import holds in the folder on purpose, a Zoom download, is held again however often it is tried: its status
  // says why, and what to do. The status of a held video that is another file now is of no use, and is taken away below.
  const left = mine.find((s) => importState(s.status, ctx.now()) === "held" && s.status.bytes === bytes);
  if (left) {
    say(`${video} is held: ${left.status.held}`);
    return 1;
  }
  const again = mine.filter((s) => importState(s.status, ctx.now()) !== "running");
  const running = mine.find((s) => importState(s.status, ctx.now()) === "running");
  if (!again.length && running) {
    say(`${video} is being imported now, at ${running.status.step}. The panel shows how far it is.`);
    return 1;
  }
  for (const { status } of again) removeStatus(ctx.root, video, ctx.machine, status.import || "");
  const how = (status) => {
    const state = importState(status, ctx.now());
    if (state === "failed") return `which failed: ${String(status.failed).replace(/\.$/, "")}`;
    if (state === "problem") return "whose late check found a problem";
    if (state === "held") return "which was held, as another file";
    return `which stopped at ${status.step}`;
  };
  const items = again.map(({ status }) => `${status.import || "one with no id"}, ${how(status)}`);
  const which = items.length > 1 ? ` (its imports ${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]})` : "";
  // A run of the launch agent at work now takes the video when it next looks: it looks again each minute while it waits for
  // a late check, and once more before it ends. Asking the agent to start would do nothing while it runs.
  if (ctx.agentRunning()) {
    say(`${video} is imported again${which} by the import at work now, when it next looks in the drop folder: within a minute while it waits for a late check, or once it has finished the video it is on. The panel shows how far it is.`);
    return 0;
  }
  // The launch agent is asked to look, and no run of its own is started here: the agent's run has its arguments, such as
  // --rules-only, its environment and its lock.
  try {
    ctx.kickstart();
  } catch (e) {
    say(`The launch agent ${AGENT} could not be asked to look (${String(e.message).replace(/\.$/, "")}). Jason runs install.sh --machine on this Mac.`);
    return 1;
  }
  say(`${video} is imported again${which}: the Mac's import of its drop folder is asked to look. The panel shows how far it is.`);
  return 0;
}

/** A command's words, and its flags: each `--name`, with the word after it as its value when `valued` names it. A flag given
    more than once keeps each of its values. */
function flagsOf(rest, valued = []) {
  const words = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const word = rest[i];
    if (!word.startsWith("--")) words.push(word);
    else if (valued.includes(word.slice(2))) {
      flags[word.slice(2)] = [...(flags[word.slice(2)] || []), rest[i + 1] ?? ""];
      i += 1;
    } else flags[word.slice(2)] = true;
  }
  return { words, flags };
}

/** Who writes a record from this Mac: this checkout's commit, for information only, and the Mac. */
const writerOf = (ctx) => ({ commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine });

/** Write the episode's next record, `record`, and say `done`. When the other Mac wrote meanwhile, or Dropbox holds a conflicted
    copy, nothing is written and the person is told why. Resolves 0 when written, 1 when not. */
async function save(ctx, found, record, done) {
  // A change Dropbox took away is said, as 1a's commands say it, and never written over in silence.
  const gone = undone(found.record, ctx.home);
  if (gone) {
    ctx.say(`${gone} Nothing was written.`);
    acceptRev(ctx.home, found.record.id, found.record.rev);
    return 1;
  }
  const work = join(runsFolder(ctx.home), `record-${process.pid}-${ctx.now()}`);
  try {
    writeEpisode(found.folder, record, { expectRev: found.record.rev, writeText: textWriter({ work, ...ruleOpts(ctx) }), writer: writerOf(ctx), home: ctx.home });
  } catch (e) {
    ctx.say(e.code === "CHANGED" ? "Nothing was written: this episode changed on the other Mac: open it again." : `Nothing was written: ${String(e.message).replace(/\.$/, "")}.`);
    return 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (done) ctx.say(done);
  return 0;
}
const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};
const oneLine = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

/** Record the episode's name as it is given (spec section 1, "The episode's name"). Nothing is renamed: the folder keeps its
    name, and a project keeps the name it was pushed with. */
export async function nameEpisode(ctx, found, words) {
  if (claimHeld(ctx, found.record)) return refuse(ctx, claimHeld(ctx, found.record));
  const text = oneLine(words);
  if (!text) return refuse(ctx, "Say the name to give the episode.");
  return save(ctx, found, { ...found.record, name: { text, placeholder: false } }, `It is called "${text}" now. Nothing was renamed.`);
}

/** How many words a title on screen may have, when a person gives it. */
const TITLE_MOST = 12;

/** Show the episode's title, or set and approve it (spec section 4, `title`). Claude's recommended title is approved as it is,
    or a person's words take its place. An approved title is locked: changing it needs `change`, because BRIMM Ops may already
    have it. */
export async function titleEpisode(ctx, found, { words, approve = false, change = false, reel } = {}) {
  if (reel) return reelTitle(ctx, found, reel, words);
  const now = found.record.title;
  if (words == null && !approve) {
    ctx.say(now ? `The title is "${now.text}", ${now.from === "claude" ? "recommended by Claude" : "given by a person"}, ${now.approved ? "approved" : "not yet approved"}.` : "There is no title yet. Say the words to put on screen.");
    return 0;
  }
  if (claimHeld(ctx, found.record)) return refuse(ctx, claimHeld(ctx, found.record));
  if (now && now.approved && !change) return refuse(ctx, `The title "${now.text}" is approved already. To change it, say to change it (--change): BRIMM Ops may already have it.`);
  if (words != null && /[\r\n]/.test(words)) return refuse(ctx, "A title is one line.");
  const text = words == null ? (now ? now.text : "") : oneLine(words);
  if (!text) return refuse(ctx, "There is no title to approve. Say the words to put on screen.");
  const count = text.split(" ").length;
  if (count > TITLE_MOST) return refuse(ctx, `A title is at most ${TITLE_MOST} words, and that is ${count}.`);
  const title = { text, from: words == null ? now.from : "person", approved: approve };
  const changed = change && now && now.approved && now.text !== text ? " BRIMM Ops may already have the old title, so change it there too." : "";
  return save(ctx, found, { ...found.record, title }, `The title is "${text}", ${approve ? "approved" : "not yet approved"}.${changed}`);
}

/** Show or set a Reel's title on screen: the words in its picture, which the hand-off gives BRIMM Ops. A Reel's title is
    Claude's hook until a person says otherwise. */
async function reelTitle(ctx, found, n, words) {
  const reels = (found.record.reels || []).map((r) => ({ ...r }));
  const reel = reels.find((r) => r.n === n);
  if (!reel) return refuse(ctx, `There is no Reel ${n}.`);
  if (words == null) {
    ctx.say(reel.title ? `Reel ${n}'s title on screen is "${reel.title}".` : `Reel ${n} has no title on screen. Say what it says.`);
    return 0;
  }
  if (claimHeld(ctx, found.record)) return refuse(ctx, claimHeld(ctx, found.record));
  if (/[\r\n]/.test(words)) return refuse(ctx, "A title is one line.");
  const text = oneLine(words);
  if (!text) return refuse(ctx, `Say what Reel ${n}'s title on screen says.`);
  const count = text.split(" ").length;
  if (count > TITLE_MOST) return refuse(ctx, `A title is at most ${TITLE_MOST} words, and that is ${count}.`);
  reel.title = text;
  return save(ctx, found, { ...found.record, reels }, `Reel ${n}'s title on screen is "${text}".`);
}

/** Mark Reels picked or dropped, by their numbers. A record only: phase 3 also writes a picked Reel's project here. */
async function markReels(ctx, found, ns, status) {
  const { record } = found;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  if (!ns.length) return refuse(ctx, "Say which Reels, by their numbers.");
  const reels = (record.reels || []).map((reel) => ({ ...reel }));
  for (const n of ns) {
    const reel = reels.find((r) => r.n === n);
    if (!reel) return refuse(ctx, `There is no Reel ${n}. The Reels are ${reels.map((r) => r.n).join(", ") || "none"}.`);
    if (reel.status === "finished") return refuse(ctx, `Reel ${n} is finished: it is in the hand-off already.`);
    reel.status = status;
  }
  // A Reel picked in an episode with Reel candidates (phase 3) has its upright project written now, as edit/reel-<n>.v0.fcpxml,
  // by the rule, in the same record as its pick (design, section 3). A candidate with nothing to show is not picked. One whose
  // project cannot be written yet is picked all the same. A project already written and listed is kept as it is, and one
  // written now is taken away again when the record cannot be written, so no project is left that no record lists.
  const files = {};
  const written = new Set();
  const fresh = [];
  const later = [];
  const listing = existsSync(join(found.folder, REELS_FILE)) ? readReels(readFileSync(join(found.folder, REELS_FILE), "utf8")) : null;
  // Only a Reel whose project is still to be made from the list needs it: not one whose project is written and listed, nor a
  // clip the import cut before phase 3.
  const needList = ns.filter((n) => {
    const v0 = timelineFile({ part: { reel: n }, v: 0 });
    const reel = reels.find((r) => r.n === n);
    const clipped = (Array.isArray(reel.files) ? reel.files : []).some((f) => /\.reel-\d+\.mp4$/i.test(f));
    return !clipped && !(record.files && v0 in record.files && existsSync(join(found.folder, v0)));
  });
  if (status === "picked" && !listing && needList.length && record.files && REELS_FILE in record.files) return refuse(ctx, `${REELS_FILE} is missing from this episode, though its record lists it, so no Reel is picked: its project could not be made. ${keptOrWait(ctx, found, record)}`);
  if (status === "picked" && listing) {
    for (const n of ns) {
      const candidate = listing.reels ? listing.reels.candidates.find((c) => c.n === n) : null;
      if (candidate && !candidate.ranges.length) return refuse(ctx, `Reel ${n} has nothing to show: ${String(candidate.failed || "it has no stretch").replace(/\.$/, "")}.`);
    }
    // A change Dropbox took away is said before anything is written, as save says it.
    const gone = undone(found.record, ctx.home);
    if (gone) {
      ctx.say(`${gone} Nothing was written.`);
      acceptRev(ctx.home, found.record.id, found.record.rev);
      return 1;
    }
    const work = join(runsFolder(ctx.home), `pick-${process.pid}-${ctx.now()}`);
    try {
      for (const n of ns) {
        const file = timelineFile({ part: { reel: n }, v: 0 });
        const at = join(found.folder, file);
        if (file in record.files && existsSync(at)) {
          written.add(n);
          continue;
        }
        const made = await reelTimeline(found, reels.find((r) => r.n === n), ctx);
        if (!made.xml) {
          later.push(made.coming ? `Reel ${n}'s project is written when it is shown: Dropbox is still bringing ${made.coming} over to this Mac.` : `Reel ${n}'s project could not be written: ${String(made.why).replace(/\.$/, "")}.`);
          continue;
        }
        mkdirSync(join(found.folder, "edit"), { recursive: true });
        const entry = textWriter({ work, ...ruleOpts(ctx) })(at, made.xml, { replace: existsSync(at) });
        files[file] = entry.bytes;
        written.add(n);
        fresh.push(at);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  const said = ns.map((n) => (status === "picked" ? `Reel ${n} is picked.${written.has(n) ? " Its upright Final Cut project is written." : ""} Say "show reel ${n} in Final Cut" to have it pushed.` : `Reel ${n} is dropped.`));
  const saved = await save(ctx, found, { ...record, reels, files: { ...record.files, ...files } }, [...said, ...later].join(" "));
  if (saved !== 0) for (const at of fresh) rmSync(at, { force: true });
  return saved;
}
export const pickReels = (ctx, found, ns) => markReels(ctx, found, ns, "picked");
export const dropReels = (ctx, found, ns) => markReels(ctx, found, ns, "dropped");

/** Show a picked Reel in Final Cut Pro: its timeline (reelTimeline: the project written at its pick, its own project, or for an
    episode imported before phase 3 the clip the import cut), through the push every part shares, with its guard. */
export async function pushReel(ctx, found, n, { noHandEdits = false, handEdits = false, withoutOther = false } = {}) {
  const { record } = found;
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  const reel = (record.reels || []).find((r) => r.n === n);
  if (!reel) return refuse(ctx, `There is no Reel ${n}.`);
  if (reel.status !== "picked" && reel.status !== "finished") return refuse(ctx, `Reel ${n} is not picked. Pick it first.`);
  const made = await timelineFor(found, { reel: n }, ctx);
  if (made.coming) {
    // As open does: a detached run reads the Reel's own files to their end, so that Dropbox brings them over.
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: made.bring || (reel.files || []).filter((f) => f in found.record.files) });
    return refuse(ctx, `Dropbox is bringing ${made.coming} over to this Mac. Say "show reel ${n} in Final Cut" again when it is done.`);
  }
  if (made.why) return refuse(ctx, made.why);
  return pushPart(ctx, found, { part: { reel: n }, xml: made.xml, told: made.told, noHandEdits, handEdits, withoutOther });
}

/** The files of one folder, each {name, bytes, mtimeMs}: none when the folder is not there. An export bundle is a folder,
    and is as new as the later of its own time and its Info.fcpxml's: saving over a bundle of the same name may leave the
    folder's time as it was (phase 0, A5). */
function listing(dir) {
  try {
    return readdirSync(dir).map((file) => {
      const found = statSync(join(dir, file));
      if (!found.isDirectory()) return { name: file, bytes: found.size, mtimeMs: found.mtimeMs };
      const info = statSync(join(dir, file, "Info.fcpxml"), { throwIfNoEntry: false });
      return { name: file, bytes: 1, mtimeMs: Math.max(found.mtimeMs, info ? info.mtimeMs : 0) };
    });
  } catch (e) {
    return [];
  }
}
const capital = (text) => text[0].toUpperCase() + text.slice(1);

/** finish, the quick part (spec section 5, steps 1 and 2): find what Final Cut Shared and exported of each part, say what each
    is taken for, and ask what it must. With `answers.yes` and nothing left to ask, it writes what it was told in
    finish.asked.json, on this Mac's own disk, starts the detached part (finishNow) and returns at once. */
export async function finishEpisode(ctx, found, answers = {}) {
  const { record } = found;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  // A client or group session, and a video not yet answered, are not finished here, in either version of the hand-off: refused at
  // once, before any folder is looked in, so that no part line, no "Looked in" line and no file name is printed, and before any
  // claim is written.
  const notYet = cannotFinish(record);
  if (notYet) return refuse(ctx, notYet);
  // Where its hand-off goes (finish.js handoffTarget, which every hand-off writer asks), and why it cannot be written, if it
  // cannot: under version 2, a gap in the chain of its versions, or a version of it, earlier or later, that is a session not
  // cleared. That is refused at once too, as the detached part refuses it before anything is copied, and before any claim.
  const target = handoffTarget(ctx, { folder: found.folder, record });
  if (target.refusal) return refuse(ctx, target.refusal);
  const stops = [];
  const gone = undone(record, ctx.home);
  if (gone) {
    acceptRev(ctx.home, record.id, record.rev);
    stops.push(gone);
  }
  // What the hand-off needs, in the version it will be written in (spec 2026-10-22, section 8): the one this Mac's settings say,
  // or version 2 when the hand-off on file is version 2 already (writesV2For). Version 1 needs a name, and an approved title for
  // all but a short video. Version 2 has no title, and needs a name only for a raw video (a finished video's name is its file's).
  const { v2 } = target;
  if (record.name && record.name.placeholder && (!v2 || kindOfRecord(record) === "raw")) stops.push(`Give the episode its name first: it is still called "${record.name.text}", from the video's file name.`);
  if (!v2 && record.kind !== "short video" && !(record.title && record.title.approved)) stops.push("Approve a title first.");
  const problems = filesProblems(found.folder, record);
  if (problems.length) stops.push(`${found.name} is not whole in Dropbox: ${problems.join(" ")}`);
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) stops.push(`${running} is running for this episode. Say "how far is it?"`);
  const here = fromFinalCutFolder(ctx.home);
  mkdirSync(here, { recursive: true });
  const released = join(found.folder, "edit", "from-final-cut");
  const looked = lookFor(partsOf(record), { fromFinalCut: { dir: here, files: listing(here) }, released: { dir: released, files: listing(released) }, finished: record.finished }, answers);
  const noHandEdits = answers.noHandEdits || [];
  // A finished Reel's title is the words in its picture, which BRIMM Ops is told: one that has none is asked for, never made up.
  const plan = (() => {
    try {
      return JSON.parse(readFileSync(join(found.folder, `${basename(record.video.file, extname(record.video.file))}.cut-plan.json`), "utf8"));
    } catch (e) {
      return null;
    }
  })();
  // A part whose Share is of a version shown before the session asked for more would finish without it: it is shown again
  // first. A version pushed before pushes kept what was asked for cannot be told, and is taken as it is.
  for (const part of looked.parts.filter((p) => p.video)) {
    const timeline = part.reel ? { reel: part.reel } : "main";
    const target = part.reel ? (record.reels || []).find((r) => r.n === part.reel) : record.main;
    const shown = ((target && target.pushed) || []).find((p) => p.project === part.video.name.replace(/\.[^.]*$/, ""));
    if (shown && shown.asked && shown.asked !== askedOf(record, timeline)) looked.asks.push(`${capital(part.label)} has changes asked for since v${shown.v} was shown in Final Cut: say "show it in Final Cut", Share it again, and then finish.`);
  }
  for (const part of looked.parts.filter((p) => p.reel)) {
    const reel = (record.reels || []).find((r) => r.n === part.reel);
    if (reel && String(reel.title || "").trim()) continue;
    const opening = expectedWords(part, record, plan);
    looked.asks.push(`Reel ${part.reel} has no title on screen. Say what it says${opening ? `: it starts "${opening}"` : ""}.`);
  }
  for (const part of looked.parts) {
    if (part.kept) ctx.say(`${capital(part.label)}: kept as the last finish made it.`);
    else ctx.say(`${capital(part.label)}: ${part.video.name}, from ${part.video.where}${part.export ? `, with its export ${part.export.name}` : noHandEdits.includes(part.key) ? ", with no hand edits" : ""}.`);
  }
  for (const line of [...looked.stops, ...stops, ...looked.asks]) ctx.say(line);
  if (looked.stops.length || stops.length) {
    ctx.say(looked.looked);
    return 1;
  }
  if (looked.asks.length || !answers.yes) {
    if (!looked.asks.length) ctx.say('Say "yes, finish it" to start.');
    return 0;
  }
  // The finish holds the episode while it runs: an episode nobody has open is claimed for this Mac first, so the other Mac's
  // open is refused until the finish lets it go (the review of PR 21, finding 2).
  let rev = record.rev;
  if (!record.editing) {
    if ((await save(ctx, found, claimFor(record, ctx.machine, localStamp(new Date(ctx.now()))), "")) !== 0) return 1;
    const again = readEpisode(found.folder);
    if (!again.record) return refuse(ctx, `${found.name}: ${again.why}.`);
    rev = again.record.rev;
  }
  const asked = { version: 1, at: localStamp(new Date(ctx.now())), rev, ...(rev !== record.rev ? { claimed: true } : {}), parts: looked.parts.map((p) => ({ key: p.key, label: p.label, ...(p.reel ? { reel: p.reel } : {}), projects: p.projects, video: p.video, export: p.export, kept: p.kept, noHandEdits: noHandEdits.includes(p.key) })) };
  const work = episodeWork(ctx.home, found.name);
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "finish.asked.json"), JSON.stringify(asked, null, 2) + "\n");
  startDetached(ctx, { command: "finish", folder: found.name });
  ctx.say("Started. The panel shows how far it is.");
  return 0;
}

/** `finish "<episode>" [--yes] [--take "<part>=<file | this Mac | the other Mac>"]… [--no-hand-edits "<part>"]…
    [--without "reel <n>"]…`, and the
    detached part it starts, `finish --now "<episode folder>"`, which runs finishNow holding the episode's lock. */
async function finish(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["take", "no-hand-edits", "without"]);
  if (flags.now) {
    const found = findEpisode(ctx, words.join(" "));
    if (!found.read || !found.read.record) {
      const why = found.why || `${words.join(" ")}: ${found.read.why}.`;
      ctx.say(why);
      // The episode is there but its record cannot be read (a conflicted copy, say): the finish leaves a result that says
      // why, so that status shows it and not "nothing is running" (the P1 check, T6).
      if (found.read) await runDetached({ home: ctx.home, folder: found.name, command: "finish", alive: ctx.alive, keepAwake: () => {} }, async () => ({ ok: false, failed: [why] }));
      return 1;
    }
    // The progress panel shows the finish as it shows an import (phase P).
    const progress = ctx.deps.progress || reporter({ folder: progressFolder(ctx.home), swift: findPrograms().swift });
    const result = await runDetached({ home: ctx.home, folder: found.name, command: "finish", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, () => finishNow(ctx, { folder: found.folder, name: found.name, record: found.read.record }, { progress }));
    if (result.taking || result.running) {
      ctx.say(result.taking ? `Another run is taking over ${found.name}'s lock. Say finish again in a moment.` : `${result.running} is running for ${found.name} already.`);
      // The finish never ran: a claim its quick part took for it is let go (the P1 check, T17).
      const gone = letGoClaim(ctx, { folder: found.folder, name: found.name });
      if (gone) ctx.say(gone);
      return 1;
    }
    return result.ok ? 0 : 1;
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const take = Object.fromEntries((flags.take || []).map((given) => [given.slice(0, given.indexOf("=")).trim(), given.slice(given.indexOf("=") + 1).trim()]).filter(([part]) => part));
  return finishEpisode(ctx, { ...got.found, record: got.record }, { yes: Boolean(flags.yes), take, noHandEdits: flags["no-hand-edits"] || [], without: flags.without || [] });
}

/** Is a program running on this Mac, by its name, as pgrep finds it? */
const programRunning = async (name) => spawnSync("/usr/bin/pgrep", ["-x", name], { stdio: "ignore" }).status === 0;
/** The size of a library, as a person reads it. */
const librarySize = (folder) => sizeText(folderSize(folder));

/** Delete an episode's Final Cut library on this Mac, to free space (spec section 5, step 9). Only when the episode is
    finished; each part's edit is kept in an export copied into final/, or the part had no hand edits; every medium those
    exports name is inside the episode's folder; and Final Cut Pro is not running. Without `yes` it says what it would delete
    and how large it is. It deletes only inside this Mac's work folder for the episode. Render files alone are freed in
    Final Cut, with File > Delete Generated Library Files. */
export async function freeLibrary(ctx, found, { yes = false } = {}) {
  const { record } = found;
  const { finished } = record;
  if (!finished) return refuse(ctx, "It is not finished yet, so its library holds work kept nowhere else.");
  const work = resolve(episodeWork(ctx.home, found.name));
  const library = resolve(libraryFor(ctx.home, found.name));
  if (!library.startsWith(`${work}/`) || !work.startsWith(`${resolve(workFolder(ctx.home))}/`)) return refuse(ctx, "Its library is not in this Mac's work folder for the episode, so it is left alone.");
  const unkept = unkeptParts(record, ctx.machine);
  if (unkept.length) return refuse(ctx, `The hand work of ${listed(unkept)} is kept only in the library: finish it with its export, or say it had no hand edits, first.`);
  for (const [key, p] of Object.entries(finished.parts || {}).filter(([, part]) => part.export)) {
    const at = join(found.folder, p.export);
    const xml = existsSync(join(at, "Info.fcpxml")) ? join(at, "Info.fcpxml") : at;
    let media = [];
    try {
      media = mediaIn(readFileSync(xml, "utf8"), xml);
    } catch (e) {
      return refuse(ctx, `The export of ${key}, ${p.export}, cannot be read, so its library is kept.`);
    }
    const outside = media.filter((path) => !path.normalize("NFC").includes(`/Episodes/${found.name}/`.normalize("NFC")));
    if (outside.length) return refuse(ctx, `The export of ${key} uses media outside the episode folder (${outside[0]}). Copy it into media/ first.`);
  }
  if (await (ctx.deps.running || programRunning)("Final Cut Pro")) return refuse(ctx, "Quit Final Cut Pro first.");
  if (!existsSync(library)) return refuse(ctx, "There is no library of it on this Mac.");
  const size = librarySize(library);
  if (!yes) {
    ctx.say(`This deletes ${library}, ${size}. Its edits are kept in final/. Say yes to delete it.`);
    return 0;
  }
  rmSync(library, { recursive: true, force: true });
  // The record stops naming a library on this Mac, so the next push makes a new one and names it there.
  const { [ctx.machine]: gone, ...libraries } = record.libraries || {};
  return save(ctx, found, { ...record, libraries }, `Deleted its Final Cut library on this Mac, ${size}.`);
}

/** The newest push of each part of an episode, by its key ("main", "reel 2"): { key, label, last }, where `last` is the push
    with the highest version, or null when the part was never pushed. */
function newestPushes(record) {
  const all = [{ key: "main", label: "the main video", pushed: record.main && record.main.pushed }, ...(record.reels || []).map((r) => ({ key: `reel ${r.n}`, label: `Reel ${r.n}`, pushed: r.pushed }))];
  return all.map(({ key, label, pushed }) => ({ key, label, last: (Array.isArray(pushed) ? pushed : []).reduce((best, p) => (!best || p.v > best.v ? p : best), null) }));
}

/** A name without its ending, composed, as the project names recorded at each push are. */
const projectOf = (name) => basename(name, extname(name)).normalize("NFC");

/** Every file in a folder, at any depth, as paths from it, but for those Dropbox never syncs: a name starting with a dot, as
    Finder's .DS_Store, or Icon\r. Listed, the other Mac would wait for them for ever. */
const filesUnder = (dir) => readdirSync(dir, { recursive: true })
  .filter((rel) => !String(rel).split("/").some((part) => part.startsWith(".") || part === "Icon\r") && statSync(join(dir, rel)).isFile()).sort();

/** Hand an episode this Mac has open over to the other Mac (spec section 1, "Picking an episode up"). In order:
    - only the Mac that has it open hands it over;
    - when this Mac made the newest push of any part, it asks whether it was changed in Final Cut since, and goes on only
      with an answer: `answer` is "no changes" or "changes stay";
    - finish's rule, here: each such part's newest whole Share in this Mac's From Final Cut must have an export no older
      than it (or none, when nothing changed), since on the other Mac every copied export looks newer than its Share;
    - each Share whole (the same size across a few seconds) and the newest export of each of those parts' projects is
      copied into edit/from-final-cut/ by the rule, the Shares first; a Share still being written is left out and named.
      Nothing of a part the other Mac pushed last is copied: it is not this Mac's to check, nor to hand over;
    - the record is let go, with the files it lists now (its own and the copies) and the answers, each earlier answer
      carried on while its version is still the part's newest. A copy made here at an earlier hand-over that Dropbox has
      taken away, and that this release has not made again, is listed no more, and named.
    Resolves 0 when it was handed over, and 1 when it refused, having said why. */
export async function releaseEpisode(ctx, found, { answer = "" } = {}) {
  const { record } = found;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  const name = record.name.text;
  const newest = newestPushes(record);
  const mine = newest.filter((p) => p.last && p.last.on === ctx.machine);
  // An episode nobody has open may be changed without opening it, so one this Mac pushed last is handed over as well.
  if (record.editing ? record.editing.by !== ctx.machine : !mine.length) return refuse(ctx, `This Mac does not have ${name} open, so there is nothing to hand over.`);
  // A finish still running would go on writing into the episode after the hand-over (the review of PR 21, findings 4 and 7).
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running && running !== "bring") return refuse(ctx, `${running} is running for ${name}. Say "how far is it?", and hand it over when it is done. Nothing was handed over.`);
  // The Shares and exports of the episode in this Mac's From Final Cut, by the project names recorded at its pushes, of the
  // parts this Mac pushed last alone: those are the ones checked below. A part the other Mac pushed last is not this Mac's to
  // hand over, and an older Share and export of it copied from here would look newer there than that Mac's own.
  const here = fromFinalCutFolder(ctx.home);
  const projects = new Map(newest.flatMap((p) => {
    const part = p.key === "main" ? record.main : (record.reels || []).find((r) => `reel ${r.n}` === p.key);
    return (part.pushed || []).filter((q) => q.project).map((q) => [q.project.normalize("NFC"), { key: p.key, v: q.v }]);
  }));
  // This Mac's Shares and exports of the episode, of every part: a copy of one in edit/from-final-cut/ was made here.
  const own = listing(here).filter((f) => kindOf(f.name) && projects.has(projectOf(f.name)));
  const mineKeys = new Set(mine.map((p) => p.key));
  const ours = own.filter((f) => mineKeys.has(projects.get(projectOf(f.name)).key));
  const videos = ours.filter((f) => kindOf(f.name) === "video");
  // Of one project's exports, the newest alone is checked and copied: an older one copied too would look newest on the other
  // Mac, where a bundle's folder is made new.
  const exports = [...ours.filter((f) => kindOf(f.name) === "export").reduce((best, f) => {
    const was = best.get(projectOf(f.name));
    if (!was || f.mtimeMs > was.mtimeMs) best.set(projectOf(f.name), f);
    return best;
  }, new Map()).values()];
  // The other Mac waits for the files the record lists: one missing here would be waited for there for ever. A copy of
  // this Mac's own Shares and newest exports, which this release makes again from From Final Cut, is left out of that check
  // (the P1 check, T2). So is a copy made here at an earlier hand-over that Dropbox has taken away: one this release does
  // not make again, of a part the other Mac pushed last, of an older export, or of a Share still being written, is listed no
  // more when it is handed over. Kept in the list, it would be waited for on the other Mac for ever, and every check of the
  // files on either Mac would stop at it (the review of the plan, P1 and P7; PR 21's W15). Any other copy is checked as any
  // other file.
  const remade = new Set([...videos, ...exports].flatMap((f) => {
    const from = join(here, f.name);
    return statSync(from).isDirectory() ? filesUnder(from).map((rel) => `edit/from-final-cut/${f.name}/${rel}`) : [`edit/from-final-cut/${f.name}`];
  }));
  const at = (rel) => join(found.folder, rel);
  const ownNames = new Set(own.map((f) => f.name));
  /** The name in From Final Cut that a copy in edit/from-final-cut/ was made from: its Share's, or its export bundle's. */
  const copiedFrom = (rel) => (rel.startsWith("edit/from-final-cut/") ? rel.slice("edit/from-final-cut/".length).split("/")[0] : "");
  const goneCopy = (rel) => ownNames.has(copiedFrom(rel)) && !existsSync(at(rel));
  const broken = filesProblems(found.folder, { ...record, files: Object.fromEntries(Object.entries(record.files).filter(([rel]) => !remade.has(rel) && !goneCopy(rel))) });
  if (broken.length) return refuse(ctx, `${found.name} is not whole in Dropbox: ${broken.join(" ")}. Nothing was handed over.`);
  if (mine.length && !answer) return refuse(ctx, `Did you change anything in Final Cut since it was last shown (${listed(mine.map((p) => `${p.key} v${p.last.v}`))})? Say "no changes" to hand it over, or "hand it over anyway" if your changes should stay on this Mac.`);
  // A Share is whole when it reads whole and its size holds across a few seconds: Final Cut may still be writing it.
  let notYet = [];
  if (videos.length) {
    const before = new Map(videos.map((f) => [f.name, f.bytes]));
    await (ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))))(5000);
    notYet = videos.filter((f) => {
      const now = ctx.stat(join(here, f.name));
      return !now || now.size !== before.get(f.name) || !ctx.isWhole(join(here, f.name));
    }).map((f) => f.name);
  }
  const whole = videos.filter((f) => !notYet.includes(f.name));
  for (const part of mine) {
    const shares = whole.filter((f) => projects.get(projectOf(f.name)).key === part.key);
    if (!shares.length) continue;
    const video = shares.reduce((best, f) => {
      const v = projects.get(projectOf(f.name)).v;
      const bv = best ? projects.get(projectOf(best.name)).v : -1;
      return !best || v > bv || (v === bv && f.mtimeMs > best.mtimeMs) ? f : best;
    }, null);
    const project = projectOf(video.name);
    const exported = exports.filter((f) => projectOf(f.name) === project).reduce((best, f) => (!best || f.mtimeMs > best.mtimeMs ? f : best), null);
    const label = capital(part.label);
    const tail = " Then hand it over again. Nothing was handed over.";
    if (exported && exported.mtimeMs < video.mtimeMs) return refuse(ctx, `${label}'s export is older than its Shared video. Once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "${project}", and save it into From Final Cut.${tail}`);
    if (!exported && answer !== "no changes") return refuse(ctx, `${label} was never exported. If you changed it by hand in Final Cut, then once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "${project}", and save it into From Final Cut. If you made no hand edits since it was shown, say so.${tail}`);
  }
  // The copies, by the rule: each file of each Share and export (a bundle file by file), the Shares first. A copy already
  // there at the size the record lists, and no older than what it copies, is kept as it is: cp -c keeps a file's time, so
  // only a Share or an export made again is copied again. Its time may be put to the whole second, as Dropbox keeps it, so
  // a copy up to 2 seconds older still counts (the P1 check, T13). New copies are made first, and copies made again last.
  const wanted = [...whole, ...exports].flatMap((f) => {
    const from = join(here, f.name);
    return statSync(from).isDirectory() ? filesUnder(from).map((rel) => ({ name: f.name, from: join(from, rel), rel: `edit/from-final-cut/${f.name}/${rel}` })) : [{ name: f.name, from, rel: `edit/from-final-cut/${f.name}` }];
  });
  const kept = (c) => {
    const there = ctx.stat(at(c.rel));
    const source = statSync(c.from);
    return Boolean(there) && there.size === source.size && record.files[c.rel] === source.size && there.mtimeMs > source.mtimeMs - 2000;
  };
  const fresh = wanted.filter((c) => !existsSync(at(c.rel)));
  const again = wanted.filter((c) => existsSync(at(c.rel)) && !kept(c));
  const copies = {};
  const copied = [];
  for (const c of [...fresh, ...again]) {
    try {
      mkdirSync(dirname(at(c.rel)), { recursive: true });
      (existsSync(at(c.rel)) ? replaceIn : cloneIn)(c.from, at(c.rel), ruleOpts(ctx));
    } catch (e) {
      const why = String(e.message).replace(/ Nothing was copied\.$/, "").replace(/\.$/, "");
      // The record lists what is there now: each copy made so far at its size, and a copy whose old one replaceIn deleted
      // before its clone failed no more, so that neither Mac waits for a file that is gone and a release again goes through
      // (the P1 check, T7 and T14).
      const gone = c.rel in record.files && !existsSync(at(c.rel));
      const files = { ...record.files, ...copies };
      if (gone) delete files[c.rel];
      const changed = JSON.stringify(files) !== JSON.stringify(record.files);
      const saved = changed ? (await save(ctx, found, { ...record, files }, "")) === 0 : true;
      const listedNote = gone ? (saved ? `, and its old copy is gone, so the record lists it no more` : `, and its old copy is gone; the record could not be written to say so`) : "";
      return refuse(ctx, `${gone ? `${c.rel} could not be copied again${listedNote}` : `${name} could not be handed over`}: ${why}. Nothing was handed over: say hand it over again.`);
    }
    copies[c.rel] = statSync(at(c.rel)).size;
    if (!copied.includes(c.name)) copied.push(c.name);
  }
  // Each earlier answer is carried on while its version is still that part's newest; this Mac's own answers come after.
  const answers = {};
  for (const [key, a] of Object.entries((record.released && record.released.answers) || {})) {
    const part = newest.find((p) => p.key === key);
    if (part && part.last && a && part.last.v === a.v) answers[key] = a;
  }
  for (const part of mine) answers[part.key] = { v: part.last.v, said: answer === "no changes" ? "no changes" : `changes stay on ${ctx.machine}` };
  // The copies made here that are still gone, now that this release has made its own, are listed no more (see above).
  const unlisted = Object.keys(record.files).filter(goneCopy);
  const files = Object.fromEntries(Object.entries({ ...record.files, ...copies }).filter(([rel]) => !unlisted.includes(rel)));
  const later = notYet.length ? ` Not copied yet, still being written: ${listed(notYet)}.` : "";
  const lost = unlisted.length ? ` Gone from Dropbox, so no longer listed for the other Mac: ${listed([...new Set(unlisted.map(copiedFrom))])}.` : "";
  return save(ctx, found, released({ ...record, files }, files, { at: localStamp(new Date(ctx.now())), by: ctx.machine, answers }), `${name} is handed over. Copied for the other Mac: ${copied.length ? listed(copied) : "nothing"}.${later}${lost} Keep this Mac open and online until Dropbox shows the folder is up to date.`);
}

/** What `show` prints, by the word for it: the file's ending after the video's own name, and what it is called. */
const SHOWN = { transcript: [".transcript.txt", "transcript"], notes: [".edit-notes.txt", "notes from Claude"], plan: [".cut-plan.txt", "cut plan"] };

/** `show "<episode>" transcript|notes|plan`: print the episode's transcript, Claude's notes or the cut plan, whole. Her session
    reads an episode's files only through this (spec section 4), and it takes no path. A file not whole on this Mac yet is
    brought over by a detached run, as open does. */
async function show(ctx, rest) {
  const words = rest.slice();
  const kind = words.pop();
  if (!SHOWN[kind] || !words.length) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, words);
  if (!got.found) return got.code;
  const { found, record } = got;
  const [ending, what] = SHOWN[kind];
  const file = `${basename(record.video.file, extname(record.video.file))}${ending}`;
  const path = join(found.folder, file);
  if (!existsSync(path)) return refuse(ctx, `${record.name.text} has no ${what} yet.`);
  if (!ctx.isWhole(path)) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: [file] });
    return refuse(ctx, "Dropbox is still bringing it over; say it again when it is done.");
  }
  ctx.say(readFileSync(path, "utf8").replace(/\n$/, ""));
  return 0;
}

/** How long `behind` gives git, each time: well inside the two minutes the Code tab gives a command. */
const BEHIND_MS = 20000;

/** `behind`: whether this Mac's checkout of brimm-video is behind main on GitHub, by git, in this Mac's checkout: it fetches
    main, and counts the changes there that this checkout has not. On her laptop git reaches GitHub with the deploy key. It
    changes nothing in the checkout, and always ends with 0: a check that could not be made is said. */
async function behind(ctx) {
  const run = ctx.deps.run || runProgram;
  const git = (...args) => run("/usr/bin/git", ["-C", ctx.settings.checkout, ...args], { limit: BEHIND_MS, out: 100 });
  const could = "Could not check for a newer brimm-video. Is this Mac offline?";
  // Her folder is looked at whatever git answers: that needs no network.
  const stale = studioStale(ctx);
  const folderLine = () => {
    if (stale) ctx.say(`Her folder for Claude is out of date: an older brimm-video wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node ${stale.node}, then start a new session in her Claude folder)`);
    return 0;
  };
  const fetched = await git("fetch", "-q", "origin", "main");
  if (fetched.code !== 0 || fetched.outOfTime) {
    ctx.say(could);
    return folderLine();
  }
  const counted = await git("rev-list", "--count", "HEAD..origin/main");
  const n = Number(String(counted.stdout || "").trim());
  if (counted.code !== 0 || counted.outOfTime || !/^\d+$/.test(String(counted.stdout || "").trim())) ctx.say(could);
  else if (n === 0) ctx.say("This Mac has the newest brimm-video.");
  else ctx.say(`Jason has a newer brimm-video (${n} change${n === 1 ? "" : "s"}). Ask him to update this Mac when it suits.`);
  return folderLine();
}

/** Whether her folder for Claude (studio.js), when this Mac has one, is not what this checkout would write now, as after a
    git pull, which never rewrites it: {node}, the node its settings name (or Homebrew's, when they cannot be read), for the
    command that writes it again; or null when it is as this checkout writes it, or there is none. */
function studioStale(ctx) {
  let folder;
  try {
    folder = realpathSync.native(studioFolder(ctx.home));
  } catch (e) {
    return null;
  }
  const read = (name) => {
    try {
      return readFileSync(join(folder, name), "utf8");
    } catch (e) {
      return null;
    }
  };
  let node = "/opt/homebrew/bin/node";
  try {
    node = JSON.parse(read(".claude/settings.json")).hooks.PreToolUse[0].hooks[0].args[1] || node;
  } catch (e) {
    // Settings that cannot be read are out of date too, and Homebrew's node is the one the installer finds.
  }
  const want = studioFiles({ checkout: ctx.settings.checkout, node, folder });
  return Object.entries(want).every(([name, text]) => read(name) === text) ? null : { node };
}

/** How two sides of a record differ, in what a person reads of it: each [what, A's, B's] where they differ, the sizes of the
    files each lists and of the files each handed over among them, so that two sides that differ only there do not read the
    same. */
function recordDifferences(a, b) {
  const who = (r) => (r.editing ? r.editing.by : "nobody");
  const title = (r) => (r.title ? `"${r.title.text}"${r.title.approved ? ", approved" : ", not approved"}` : "none");
  const shownIn = (pushed) => (Array.isArray(pushed) && pushed.length ? `shown ${pushed.map((p) => `v${p.v} on ${p.on}`).join(", ")}` : "not shown");
  const reel = (r, n) => {
    const it = (r.reels || []).find((x) => x.n === n);
    return it ? `${it.status}, ${shownIn(it.pushed)}` : "not there";
  };
  const finished = (r) => (r.finished ? `revision ${r.finished.revision}, on ${r.finished.on}` : "not finished");
  const ns = [...new Set([...(a.reels || []), ...(b.reels || [])].map((x) => x.n))].sort((x, y) => x - y);
  const sizes = (what, x, y) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])].sort()
    .map((key) => [`${what} ${key}`, key in (x || {}) ? `${x[key]} bytes` : "not listed", key in (y || {}) ? `${y[key]} bytes` : "not listed"]);
  const handed = (r) => (r.released ? `by ${r.released.by || "a Mac it does not name"}` : "not handed over");
  // Every other field, as it is, by where it is in the record: the main video's and each Reel's own (their layers, phase
  // 4's, among them) and the record's others. A field added later is compared too, so no change of one side's is hidden.
  const as = (v) => (v === undefined || v === null || (Array.isArray(v) && !v.length) ? "none" : JSON.stringify(v));
  const fields = (x, y, skip) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])].filter((k) => !skip.includes(k)).sort();
  const reelOf = (r, n) => (r.reels || []).find((x) => x.n === n);
  const others = [
    ...fields(a, b, ["version", "rev", "writer", "editing", "name", "title", "reels", "main", "finished", "released", "files"]).map((k) => [`${k[0].toUpperCase()}${k.slice(1)}`, as(a[k]), as(b[k])]),
    ...fields(a.main, b.main, ["pushed"]).map((k) => [`The main video's ${k}`, as(a.main && a.main[k]), as(b.main && b.main[k])]),
    ...ns.flatMap((n) => fields(reelOf(a, n), reelOf(b, n), ["n", "status", "pushed"]).map((k) => [`Reel ${n}'s ${k}`, as((reelOf(a, n) || {})[k]), as((reelOf(b, n) || {})[k])]))
  ];
  const rows = [
    ["Who has it open", who(a), who(b)],
    ["Name", `"${a.name && a.name.text}"`, `"${b.name && b.name.text}"`],
    ["Title", title(a), title(b)],
    ...ns.map((n) => [`Reel ${n}`, reel(a, n), reel(b, n)]),
    ["The main video", shownIn(a.main && a.main.pushed), shownIn(b.main && b.main.pushed)],
    ["Finished", finished(a), finished(b)],
    ["Handed over", handed(a), handed(b)],
    ...others,
    ...sizes("File", a.files, b.files),
    ...sizes("Handed-over file", a.released && a.released.files, b.released && b.released.files)
  ].filter(([, x, y]) => x !== y);
  // Two sides are never said to hold the same unless they do, but for their rev and who wrote them.
  return rows.length || sameRecord(a, b) ? rows : [["The rest of the record", "as A holds it", "as B holds it"]];
}

/** A record file read as it is, or null when it is not there or cannot be read. */
function recordAt(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return null;
  }
}

/** Whether two records hold the same, but for their rev and who wrote them: a record a keep wrote holds its side so. */
const sameRecord = (a, b) => Boolean(a && b) && JSON.stringify({ ...a, rev: 0, writer: null }) === JSON.stringify({ ...b, rev: 0, writer: null });

/** `resolve "<episode>" [--keep A|B]`: sort out the conflicted copies Dropbox kept in an episode, one at
    a time, the records' first. A is what the episode holds (for a record, the record in force), and B the copy. Without
    --keep it shows how the two differ, and which Mac each came from, and notes on this Mac what it showed: --keep acts on
    that alone, and shows again when anything of it changed since, as when the other Mac sorted it out meanwhile. A record's
    copy is kept only when it has the record in force's number: a copy above it waits for Dropbox, and one below it, with
    records written since, needs Jason, since keeping either side could lose a change: he sorts it out with Claude on the
    Mac Studio. With --keep, in order:
    1. every file the step replaces or deletes is set aside in history/ by the rule, and must be whole there;
    2. the record is written, past the copies still there: the side kept as the next record, or, for another file, the next
       record with the kept side's size wherever it lists the file. Every keep writes a record, so that two Macs keeping
       opposite sides at once collide in Dropbox as a conflict of the record, which is shown, and never merge quietly;
    3. only then is anything replaced or deleted. When B cannot be put in A's place, A is put back from history/ and the
       record back as it was, or it says plainly where each side is.
    It is not refused while another Mac has the episode: a conflict must be sortable at any time. */
async function resolveConflict(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["keep"]);
  const keep = flags.keep ? String(flags.keep[flags.keep.length - 1]).toUpperCase() : "";
  // --over-later-records is taken out for now: it wrote sizes that did not match the files (round 2, C).
  if (!words.length || (flags.keep && keep !== "A" && keep !== "B") || "over-later-records" in flags) {
    ctx.say(HELP);
    return 2;
  }
  // findEpisode, not episodeFor, which refuses an episode with a conflicted copy: findEpisode finds it by its folder, or by its
  // own name or id as the newest whole record past the copies gives them, or as a record's conflicted copy gives them.
  const found = findEpisode(ctx, words.join(" "));
  if (found.why) return refuse(ctx, found.why);
  try {
    return await resolveIn(ctx, found, keep);
  } catch (e) {
    return refuse(ctx, `It could not be sorted out: ${plainWhy(e)}. ${NEEDS_JASON}`);
  }
}

/** What resolve says when keeping either side here could lose a change. */
const NEEDS_JASON = "A conflict needs Jason: tell him the episode's name.";

/** An error's words for a person: the copy rule's own "Nothing was copied." and the closing full stop taken off. */
const plainWhy = (e) => String(e && e.message ? e.message : e).replace(/ Nothing was copied\.$/, "").replace(/\.$/, "");

async function resolveIn(ctx, found, keep) {
  const read = readEpisode(found.folder, { pastCopies: true });
  if (!read.record) return refuse(ctx, `${found.name}: ${read.why}.`);
  const { record } = read;
  const name = record.name.text;
  const shownFile = join(episodeWork(ctx.home, found.name), "resolve.shown.json");
  const pin = (() => {
    try {
      return JSON.parse(readFileSync(shownFile, "utf8"));
    } catch (e) {
      return null;
    }
  })();
  const copies = conflictedCopies(found.folder);
  const ordered = [...copies.filter((c) => c.startsWith("record/")), ...copies.filter((c) => !c.startsWith("record/"))];
  if (!ordered.length) {
    rmSync(shownFile, { force: true });
    if (keep && pin) return refuse(ctx, `The version shown was sorted out meanwhile, on this Mac or the other, so nothing was kept here. There is no conflict in ${name} now: say "open ${name}" to see it as it is.`);
    ctx.say(`There is no conflict in ${name}.`);
    return 0;
  }
  const copy = ordered[0];
  const at = (rel) => join(found.folder, rel);
  const isRecord = copy.startsWith("record/");
  let of = conflictedOf(copy);
  // A Case Conflict's copy names its file in another case: the record's own name for it is the one kept.
  if (!isRecord && !(of in record.files)) of = Object.keys(record.files).find((key) => key.toLowerCase() === of.toLowerCase()) || of;
  // The Mac the copy came from, by Dropbox's words in its name, or "" when they name none.
  const fromMac = conflictedBy(copy);
  const here = (rel) => ctx.stat(at(rel));
  // Why neither side can be kept now: "" when one can.
  let blocked = "";
  let later = [];
  let copyRecord = null;
  if (here(copy) && here(copy).isDirectory()) blocked = `Dropbox kept a copy of a folder, ${copy}, which resolve cannot sort out. ${NEEDS_JASON}`;
  else if (isRecord) {
    copyRecord = recordAt(at(copy));
    const n = Number((/^record\/(\d{4})/.exec(copy) || [])[1] || 0);
    if (!n) blocked = `The copy ${copy} is not a record of this episode. ${NEEDS_JASON}`;
    else if (n > record.rev) blocked = `Dropbox is still bringing ${of} over to this Mac; say "sort out the conflict" again when it is done. If it is still not here later, ${NEEDS_JASON[0].toLowerCase()}${NEEDS_JASON.slice(1)}`;
    else if (n < record.rev) {
      later = Array.from({ length: record.rev - n }, (_, i) => n + 1 + i).map((k) => ({ k, on: ((recordAt(recordFile(found.folder, k)) || {}).writer || {}).on || "a Mac it does not name" }));
      // A keep whose record was written, and whose copy could not be deleted, left its side in force already.
      if (!sameRecord(record, copyRecord)) blocked = `Records were written after it: ${listed(later.map((r) => `record ${r.k}, on ${r.on}`))}. Keeping either side here could lose a change. ${NEEDS_JASON}`;
    }
  }
  const aStat = !isRecord ? here(of) : null;
  const bStat = here(copy);
  const now = { copy, rev: record.rev, aBytes: aStat ? aStat.size : null, aTime: aStat ? aStat.mtimeMs : null, bBytes: bStat ? bStat.size : null, bTime: bStat ? bStat.mtimeMs : null };
  const show = () => {
    ctx.say(`Dropbox kept two versions of ${of} in ${name}:`);
    if (isRecord) {
      const on = (r) => (r && r.writer && r.writer.on) || "a Mac it does not name";
      ctx.say(`A: the record in force (record ${record.rev}, written on ${on(record)})`);
      if (later.length) ctx.say(`   (record ${later[0].k - 1}, whose number the copy has, was written on ${on(recordAt(at(of)))})`);
      ctx.say(copyRecord ? `B: the copy written on ${on(copyRecord)}` : "B: the copy cannot be read, so it cannot be kept");
      if (copyRecord && sameRecord(record, copyRecord)) ctx.say("B is in force already: a keep wrote it, and its copy was not deleted then.");
      else if (copyRecord) {
        const differ = recordDifferences(record, copyRecord);
        ctx.say(differ.length ? "They differ in:" : "They hold the same.");
        for (const [what, x, y] of differ) ctx.say(`  ${what}: A: ${x}; B: ${y}`);
      }
    } else {
      const side = (s) => (s ? `${sizeText(s.size)}${s.size >= 1024 ? ` (${s.size} bytes)` : ""}, written ${shownAt(localStamp(new Date(s.mtimeMs)))}` : "not there");
      ctx.say(`A: ${of}, ${side(aStat)}${fromMac ? `, the version Dropbox kept under the file's own name` : ""}`);
      ctx.say(`B: the copy${fromMac ? ` from ${fromMac}` : ""}, ${side(bStat)}`);
      if (of in record.files) {
        const listedBytes = record.files[of];
        ctx.say(`The record in force lists ${aStat && listedBytes === aStat.size ? "A's size" : bStat && listedBytes === bStat.size ? "B's size" : `${listedBytes} bytes, neither side's size,`} for it.`);
      }
    }
    if (blocked) ctx.say(blocked);
    else {
      const more = ordered.length - 1;
      ctx.say(`Say which to keep: A or B.${more ? ` ${more} more conflicted cop${more === 1 ? "y" : "ies"} after this one.` : ""}`);
    }
    // What was shown is noted only when a side can be kept from it.
    if (!blocked) {
      mkdirSync(dirname(shownFile), { recursive: true });
      writeFileSync(shownFile, JSON.stringify(now) + "\n");
    } else rmSync(shownFile, { force: true });
  };
  if (!keep) {
    show();
    return 0;
  }
  // --keep acts on what was shown last on this Mac: when the copy, A or the record in force changed since, as when the other
  // Mac sorted it out meanwhile, it shows again and keeps nothing.
  if (!pin || JSON.stringify(pin) !== JSON.stringify(now)) {
    ctx.say(pin && pin.copy !== copy && !existsSync(at(pin.copy)) ? "The version shown was sorted out meanwhile, on this Mac or the other, so nothing was kept. Here is what is left to sort out:" : "That is not the version shown last, so nothing was kept. Here is the one to sort out now:");
    show();
    return 1;
  }
  if (blocked) return refuse(ctx, blocked);
  if (isRecord && keep === "B" && !copyRecord) return refuse(ctx, "The copy cannot be read, so it cannot be kept. Keep A.");
  const aHere = existsSync(at(of));
  if (!isRecord && keep === "A" && !aHere) return refuse(ctx, `A, ${of}, is not there, so it cannot be kept. Say B, or ask Jason.`);
  // 1. Set aside, by the rule, every file this step replaces or deletes, and see each is whole there. A record copy kept as B,
  // or one in force already, sets the record of its number aside too; a record file itself is never deleted.
  const stamp = localStamp(new Date(ctx.now())).replace(/:/g, "-");
  const asideOf = (rel) => join(found.folder, "history", `${stamp} ${basename(rel)}`);
  for (const rel of keep === "A" ? [copy] : [...(aHere ? [of] : []), copy]) {
    try {
      mkdirSync(join(found.folder, "history"), { recursive: true });
      cloneIn(at(rel), asideOf(rel), ruleOpts(ctx));
    } catch (e) {
      return refuse(ctx, `${rel} could not be set aside in history/ (${basename(plainWhy(e).split(": ").pop())}). Nothing was deleted. Say "sort out the conflict" again in a minute, or ask Jason.`);
    }
  }
  // 2. The record, written past the copies still there. Every keep writes one.
  const work = join(runsFolder(ctx.home), `resolve-${process.pid}-${ctx.now()}`);
  const write = (next, expectRev) => {
    try {
      return writeEpisode(found.folder, next, { expectRev, writeText: textWriter({ work, ...ruleOpts(ctx) }), writer: writerOf(ctx), home: ctx.home, pastCopies: true });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  };
  /** The record `r` with `bytes` as the file's size wherever it lists it, or with the file as `from` lists it. */
  const sizedLike = (r, from) => {
    const files = { ...r.files };
    if (of in from.files) files[of] = from.files[of];
    else delete files[of];
    let released = r.released;
    if (released && released.files) {
      const handed = { ...released.files };
      if (from.released && from.released.files && of in from.released.files) handed[of] = from.released.files[of];
      else delete handed[of];
      released = { ...released, files: handed };
    }
    return { ...r, files, ...(released ? { released } : {}) };
  };
  const sized = (r, bytes) => {
    const lists = of in r.files;
    const handed = r.released && r.released.files && of in r.released.files;
    return { ...r, files: lists ? { ...r.files, [of]: bytes } : r.files, ...(handed ? { released: { ...r.released, files: { ...r.released.files, [of]: bytes } } } : {}) };
  };
  const bBytes = statSync(at(copy)).size;
  const aBytes = aHere ? statSync(at(of)).size : null;
  const keptBytes = keep === "A" ? aBytes : bBytes;
  const inForce = isRecord && copyRecord && sameRecord(record, copyRecord);
  const next = isRecord ? (keep === "B" ? copyRecord : record) : sized(record, keptBytes);
  let written = null;
  if (!inForce) {
    try {
      written = write(next, record.rev);
    } catch (e) {
      return refuse(ctx, `Nothing was written, and nothing deleted: ${plainWhy(e)}. Say "sort out the conflict" again to see it as it is now.`);
    }
  }
  // 3. Only then is anything replaced or deleted. When B cannot be put in A's place, A comes back from history/, and the
  // record back to what it listed for the file; and when that cannot be done, it says where each side is.
  if (keep === "B" && !isRecord) {
    try {
      replaceIn(at(copy), at(of), ruleOpts(ctx));
    } catch (e) {
      const why = plainWhy(e);
      let back = !aHere || existsSync(at(of));
      if (!back) {
        try {
          cloneIn(asideOf(of), at(of), ruleOpts(ctx));
          back = true;
        } catch (put) {
          back = false;
        }
      }
      let recordNote = "";
      try {
        write(sizedLike(written || record, record), (written || record).rev);
      } catch (w) {
        recordNote = ` The record could not be set back (${plainWhy(w)}): it lists B's size for ${of}.`;
      }
      if (back) return refuse(ctx, `B could not be put in place of ${of}: ${why}. ${aHere ? "A is back as it was" : "A was not there"}, and nothing was deleted.${recordNote}`);
      return refuse(ctx, `B could not be put in place of ${of}: ${why}, and A could not be put back either. A is whole in history/${basename(asideOf(of))}, and B is still the copy, ${copy}.${recordNote} Say "sort out the conflict" again in a minute, or ask Jason.`);
    }
  }
  rmSync(shownFile, { force: true });
  // After every keep, the files are checked against the record now in force: a file out of step is named, and never left for
  // both Macs to refuse in silence (round 2, D: W1, W8).
  const outOfStep = () => {
    const inForceNow = readEpisode(found.folder, { pastCopies: true }).record;
    const problems = inForceNow ? filesProblems(found.folder, inForceNow) : [];
    if (!problems.length) return "";
    // resolve again would say there is no conflict: open is what says again whether a file is not whole (the final check).
    return `\nThe files are not as the record now lists them: ${problems.join("; ")}. Once Dropbox has finished, say "open" again; if it still says a file is not whole, ${NEEDS_JASON[0].toLowerCase()}${NEEDS_JASON.slice(1)}`;
  };
  try {
    rmSync(at(copy), { force: true });
  } catch (e) {
    ctx.say(`Kept ${keep} of ${of}: the record is written, but the copy could not be deleted yet (${e.code || plainWhy(e)}). Say "sort out the conflict" again to finish.${outOfStep()}`);
    return 1;
  }
  // A side kept of a file the record's finish names, when the record had listed the other side's size for it: the finish
  // was made from the other side's version, so it is said, and the way to make it again from this one.
  const listedBytes = !isRecord ? record.files[of] : undefined;
  const finishedFrom = record.finished && JSON.stringify(record.finished).includes(JSON.stringify(of).slice(1, -1));
  const caveat = finishedFrom && listedBytes !== undefined && listedBytes !== keptBytes ? ` The record's finish (revision ${record.finished.revision}, on ${record.finished.on}) was made from the other side's version of it: say "finish the episode" again to make the hand-off from this one.` : "";
  const step = outOfStep();
  ctx.say(`Kept ${keep} of ${of}. The other is set aside in history/.${caveat}${step}`);
  return step ? 1 : 0;
}

/** `release "<episode>" [--no-hand-edits | --hand-edits-stay]`. */
async function release(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  if (flags["no-hand-edits"] && flags["hand-edits-stay"]) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  return releaseEpisode(ctx, { ...got.found, record: got.record }, { answer: flags["no-hand-edits"] ? "no changes" : flags["hand-edits-stay"] ? "changes stay" : "" });
}

/** `free "<episode>" library`: held back from this version (the lead's ruling, 2026-10-14). Deleting a library by command
    needs the record of every version handed to Final Cut on this Mac, which phase 5 brings. freeLibrary and unkeptParts
    stay, with their tests, for then; nothing on the command line reaches them. */
async function free(ctx) {
  ctx.say("Deleting an episode's Final Cut library by command comes in a later version. To free space now, use Final Cut's File > Delete Generated Library Files.");
  return 1;
}

/** `name "<episode>" "<name>"`. */
async function name(ctx, rest) {
  const [said, ...words] = rest;
  const got = episodeFor(ctx, said ? [said] : [], { newerEnds: 1 });
  if (!got.found) return got.code;
  return nameEpisode(ctx, { ...got.found, record: got.record }, words.join(" "));
}

/** `title "<episode>" [reel <n>] [--words "<words>"] [--approve] [--change]`: the episode's title, or a Reel's. */
async function title(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["words"]);
  let reel = 0;
  if (words.length >= 2 && words[words.length - 2] === "reel" && /^\d+$/.test(words[words.length - 1])) {
    reel = Number(words.pop());
    words.pop();
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  return titleEpisode(ctx, { ...got.found, record: got.record }, { words: flags.words ? flags.words.join(" ") : undefined, approve: Boolean(flags.approve), change: Boolean(flags.change), ...(reel ? { reel } : {}) });
}

/** `reel pick|drop "<episode>" <n>…`. */
async function reel(ctx, rest) {
  const [what, said, ...numbers] = rest;
  if ((what !== "pick" && what !== "drop") || !said) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, [said], { newerEnds: 1 });
  if (!got.found) return got.code;
  const ns = numbers.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return (what === "pick" ? pickReels : dropReels)(ctx, { ...got.found, record: got.record }, ns);
}

/** `reels "<episode>" [--no-play]`: the list of the episode's Reel candidates (reels.json, phase 3), and each preview that is
    whole on this Mac opened in QuickTime Player, for the person to watch. A preview Dropbox is still bringing over is named
    and brought, as open brings files. With --no-play the list alone. */
async function reels(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = { found: got.found, record: got.record };
  const at = join(found.folder, REELS_FILE);
  if (!existsSync(at) && record.files && REELS_FILE in record.files) return refuse(ctx, `${REELS_FILE} is missing from this episode, though its record lists it, so its Reel candidates cannot be shown. ${keptOrWait(ctx, found, record)}`);
  if (!existsSync(at)) {
    const ns = (record.reels || []).map((r) => `Reel ${r.n}`);
    return refuse(ctx, `This episode has no list of Reel candidates (reels.json).${ns.length ? ` Its Reels are the clips the import cut: ${listed(ns)}.` : ""}`);
  }
  const read = readReels(readFileSync(at, "utf8"));
  if (read.why) return refuse(ctx, `Its list of Reel candidates cannot be read: ${read.why.replace(/\.$/, "")}.`);
  // A list at another size than the record lists is not the one it lists: not shown as the candidates.
  const listedSize = record.files ? record.files[REELS_FILE] : undefined;
  const thereSize = statSync(at).size;
  if (Number.isInteger(listedSize) && thereSize !== listedSize) return refuse(ctx, `${REELS_FILE} in this episode is not the one its record lists (it is ${thereSize} bytes, and the record lists ${listedSize}), so its candidates are not shown. ${keptOrWait(ctx, found, record)}`);
  // Whether Claude can be asked again is said as this Mac finds it now, in the words ask would refuse with (PR 19's review).
  // While a file is still coming, ask can be asked: it brings it.
  const blocked = askRefusal(ctx, found, record);
  // A listing changes nothing, so a refusal's "Nothing was changed." is not said here.
  ctx.say(reelsText(read.reels, record, blocked.bring ? "" : (blocked.why || "").replace(/ Nothing was changed\.$/, "")));
  if (flags["no-play"]) return 0;
  const previews = read.reels.candidates.filter((c) => c.preview).map((c) => c.preview);
  const coming = previews.filter((rel) => !ctx.isWhole(join(found.folder, rel)));
  if (coming.length) {
    ctx.say(`Dropbox is still bringing ${coming.join(", ")} over to this Mac. Say "show me the Reels" again when it is done.`);
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: coming });
  }
  for (const rel of previews.filter((p) => !coming.includes(p))) ctx.openApp("QuickTime Player", join(found.folder, rel));
  return 0;
}

/** Why `ask` would refuse the episode `found`, whose record is `record`, on this Mac now: {why}, with `bring` when files are
    still to be brought, or {} when it would start. In this order: a short video, the other Mac having it open (claimHeld), a
    command at work on the episode, no Claude Code on this Mac, and askBlocked. */
function askRefusal(ctx, found, record) {
  if (record.kind === "short video") return { why: "A short video gets no Reels." };
  if (claimHeld(ctx, record)) return { why: claimHeld(ctx, record) };
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running === "ask") return { why: 'Claude is being asked already. Say "how far is it?" to see how far it has got.' };
  if (running) return { why: `${running} is running for ${found.name} already. Say it again when it has finished.` };
  if (!(ctx.deps.tools || findPrograms()).claude) return { why: "Claude Code is not installed on this Mac, so Claude cannot be asked." };
  return askBlocked({ folder: found.folder, record, root: ctx.root, home: ctx.home, machine: ctx.machine, now: ctx.now(), whole: ctx.isWhole });
}

/** What to do about a reels.json the record lists that is gone: put back the copy this Mac kept of it (keptList), or wait for
    Dropbox to bring it. */
const keptOrWait = (ctx, found, record) => {
  const kept = keptList({ folder: found.folder, record, home: ctx.home });
  return kept ? `The one its record lists is kept at ${kept}: ask Jason to put it back.` : "Say this again once Dropbox has it back.";
};

/** `ask "<episode>"`: Claude asked again for the episode's Reel candidates, detached (`ask --now "<episode folder>"`, which
    askAgain does, in unedited.js), since it can take minutes. It refuses a short video, a Mac without Claude Code, an
    episode whose import went by the rules alone, and an episode another command is at work on; and what askBlocked says.
    Both parts refuse an episode a newer brimm-video wrote, by its short id alone. */
async function ask(ctx, rest) {
  if (rest[0] === "--now") {
    const found = findEpisode(ctx, rest[1] || "");
    if (!found.read || !found.read.record) {
      ctx.say(found.why || `${rest[1]}: ${found.read.why}.`);
      return 1;
    }
    // A record a newer brimm-video wrote may be a session or a video not yet answered, whose fields this one cannot read: it is
    // named by its short id alone, nothing is asked of Claude, and nothing is written, not even the result of a run.
    if (found.read.newer) {
      ctx.say(newerWords(found.read.record));
      return 1;
    }
    const deps = {
      run: ctx.deps.run || runProgram, tools: ctx.deps.tools || findPrograms(), home: ctx.home, settings: ctx.settings, now: ctx.now,
      log: (line) => ctx.say(line), wait: ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))), isWhole: ctx.isWhole,
      ...ruleOpts(ctx), ...(ctx.deps.commit ? { commit: ctx.deps.commit } : {}), ...(ctx.deps.runGuarded ? { runGuarded: ctx.deps.runGuarded } : {})
    };
    const result = await runDetached({ home: ctx.home, folder: found.name, command: "ask", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, () => askAgain({ folder: found.folder, record: found.read.record }, deps));
    if (result.taking || result.running) {
      ctx.say(result.running ? `${result.running} is running for ${found.name} already.` : `Another run is taking over the lock of ${found.name}; try again in a few seconds.`);
      return 1;
    }
    return result.ok ? 0 : 1;
  }
  const got = episodeFor(ctx, rest, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = { found: got.found, record: got.record };
  const blocked = askRefusal(ctx, found, record);
  if (blocked.bring) startDetached(ctx, { command: "bring", folder: found.name, args: blocked.bring });
  if (blocked.why) return refuse(ctx, blocked.why);
  startDetached(ctx, { command: "ask", folder: found.name });
  ctx.say(`Started: Claude is asked for Reel candidates again. Say "how far is it?" to see how far it has got.`);
  return 0;
}

/** The timeline a command names after the episode: "main", the default, or "reel <n>", in any case; and the words left. */
function partFrom(words) {
  const at = words.findIndex((w, i) => String(w).toLowerCase() === "reel" && /^\d+$/.test(words[i + 1] || ""));
  if (at !== -1) return { part: { reel: Number(words[at + 1]) }, words: [...words.slice(0, at), ...words.slice(at + 2)] };
  return { part: "main", words: words.filter((w) => String(w).toLowerCase() !== "main") };
}
const partLabel = (part) => (part === "main" ? "the main video" : `Reel ${part.reel}`);
/** The record with one part's own entry changed. */
const withPart = (record, part, change) => (part === "main" ? { ...record, main: change(record.main) } : { ...record, reels: record.reels.map((r) => (r.n === part.reel ? change(r) : r)) });
/** The next id of a layer: its letter and one more than the highest of the part's. */
const nextId = (items, letter) => `${letter}${1 + Math.max(0, ...(items || []).map((x) => Number(String(x.id).slice(1)) || 0))}`;
/** Seconds as a person reads a length: "4 seconds", "1.5 seconds". */
const lengthText = (seconds) => `${Math.round(seconds * 10) / 10} second${seconds === 1 ? "" : "s"}`;
const SHOW_IT = 'Say "show it in Final Cut" to see it.';

/** What every command on a timeline's layers does first (phase 4): the episode, from its first word, and the timeline it
    names, a Reel picked. One that `writes` is refused while another Mac has the episode, while a detached run is at work on
    it (a finish's late check would put its own copies back), on a timeline changed by hand and taken in (phase 5), and on a
    Reel the import cut as a clip, before Reels had projects of their own, which nothing is laid over. Gives
    { found, part, target, words } or { code }. */
function layerStart(ctx, words, { writes = true } = {}) {
  const [said, ...rest] = words;
  const got = episodeFor(ctx, said === undefined ? [] : [said], { newerEnds: 1 });
  if (!got.found) return { code: got.code };
  const found = { ...got.found, record: got.record };
  const { part, words: left } = partFrom(rest);
  // Each command takes its own words first: what is left is not understood, and is never taken for the main video.
  if (left.length) return { code: refuse(ctx, `"${left.join(" ")}" is not understood there: name the timeline last, as main or reel 2.`) };
  const target = part === "main" ? got.record.main : (got.record.reels || []).find((r) => r.n === part.reel);
  if (!target) return { code: refuse(ctx, `There is no Reel ${part.reel}.`) };
  if (part !== "main" && target.status !== "picked" && target.status !== "finished") return { code: refuse(ctx, `Reel ${part.reel} is not picked. Pick it first.`) };
  if (!writes) return { found, part, target, words: left };
  if (claimHeld(ctx, got.record)) return { code: refuse(ctx, claimHeld(ctx, got.record)) };
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running && running !== "bring") return { code: refuse(ctx, `${running} is running for this episode. Say "how far is it?", and try again when it is done.`) };
  if (target.base) return { code: refuse(ctx, "This timeline was changed by hand in Final Cut and taken in. brimm-video does not change a hand-edited timeline yet: make this change by hand in Final Cut.") };
  if (part !== "main" && piecesOf(found, part, ctx).old) return { code: refuse(ctx, `Reel ${part.reel} was cut as a clip before Reels had projects of their own, so brimm-video cannot change it: make this change by hand in Final Cut.`) };
  return { found, part, target, words: left };
}

/** The moment a command is given on a timeline, in seconds of the raw video: { at, for, on } or { code }. With `--at` a time,
    or `--at-words` quoted words, read on the newest version shown (clock.js), after the guard: a timeline shown before is
    read only when she says it was not changed in Final Cut since (`--no-hand-edits`). */
function momentFrom(ctx, found, part, flags, { needed = true } = {}) {
  const time = flags.at && flags.at[flags.at.length - 1];
  const quoted = flags["at-words"] && flags["at-words"][flags["at-words"].length - 1];
  if (!time && !quoted) return needed ? { code: refuse(ctx, "Say when: a time on the timeline (--at 0:03), or the words said there (--at-words \"three numbers\").") } : { none: true };
  const got = timelineRead(ctx, found, part, flags);
  if (got.code !== undefined) return got;
  const { read } = got;
  const moment = momentOf({ ...(quoted ? { quoted } : { time }), on: read.on, clock: read.clock, ranges: read.pieces, words: read.words });
  if (moment.why) return { code: refuse(ctx, moment.why) };
  return { ...moment, on: read.on, clock: read.clock, read };
}

/** The timeline she names, as she watched it, read for a time or words she gives: { read } (clockFor) or { code }. After the
    guard: a timeline shown before is read only when she says it was not changed in Final Cut since. */
function timelineRead(ctx, found, part, flags) {
  const guard = guardOf(ctx, found, part, { noHandEdits: Boolean(flags["no-hand-edits"]), handEdits: Boolean(flags["hand-edits"]), withoutOther: Boolean(flags["without-other-macs-changes"]) }, "to go on");
  if (guard.why) return { code: refuse(ctx, guard.why) };
  const read = clockFor(found, part, ctx);
  if (read.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: read.bring });
    return { code: refuse(ctx, `Dropbox is still bringing ${read.coming} over to this Mac. Say it again when it is done.`) };
  }
  if (read.why) return { code: refuse(ctx, read.why) };
  return { read };
}

/** How long a layer shows: `--for` seconds, else the quoted words' length, else `fallback`. { seconds } or { code }. */
function lengthFrom(ctx, flags, moment, fallback) {
  if (!flags.for) return { seconds: moment.for ? Math.max(moment.for, 1) : fallback };
  const seconds = Number(flags.for[flags.for.length - 1]);
  if (!(seconds > 0 && seconds <= 600)) return { code: refuse(ctx, "Say how long it shows in seconds, from 1 to 600 (--for 6).") };
  return { seconds };
}

/** A picture from her Pictures folder, by its name only, copied into the episode's media/ by the rule (spec section 4):
    { picture: "media/<name>", size, bytes, copied } or { code }. A link is refused: only a file of her own in the folder
    is taken. One already in media/ of that name is used when it is the same picture, byte for byte, and refused when it is
    another: nothing in Dropbox is written over. `copied` says this call put it there, so a command whose record cannot be
    written takes it out again. */
function pictureFrom(ctx, found, name) {
  const fault = pictureNameFault(name);
  if (fault) return { code: refuse(ctx, fault) };
  const from = join(studioFolder(ctx.home), "Pictures", name);
  let seen;
  try {
    seen = lstatSync(from);
  } catch (e) {
    return { code: refuse(ctx, `There is no picture called "${name}" in the Pictures folder (BRIMM Video Studio, Pictures). Put it there first.`) };
  }
  if (!seen.isFile()) return { code: refuse(ctx, `"${name}" in the Pictures folder is not a picture file of its own. Put the picture itself there.`) };
  const size = pictureSize(readFileSync(from));
  if (!size) return { code: refuse(ctx, `"${name}" cannot be read as a PNG or a JPEG picture.`) };
  const picture = `media/${name}`;
  const to = join(found.folder, picture);
  if (existsSync(to)) {
    if (!ctx.isWhole(to)) return { code: refuse(ctx, `Dropbox is still bringing ${picture} over to this Mac. Say it again when it is done.`) };
    if (!readFileSync(to).equals(readFileSync(from))) return { code: refuse(ctx, `Another picture called "${name}" is in this episode already. Give yours another name in the Pictures folder.`) };
    return { picture, size, bytes: seen.size, copied: false };
  }
  try {
    mkdirSync(join(found.folder, "media"), { recursive: true });
    cloneIn(from, to, ruleOpts(ctx));
  } catch (e) {
    return { code: refuse(ctx, `"${name}" could not be copied into the episode: ${String(e.message).replace(/\.$/, "")}.`) };
  }
  return { picture, size, bytes: seen.size, copied: true };
}

/** Save the record, and take a picture this command copied into media/ out again when the record cannot be written: the
    record never leaves a picture in the episode that it does not list. */
async function saveWithPicture(ctx, found, record, done, got) {
  const code = await save(ctx, found, record, done);
  if (code !== 0 && got && got.copied) rmSync(join(found.folder, got.picture), { force: true });
  return code;
}

/** How long past a finish's late check final/ is still taken as its: the check itself takes a while, and two Macs' clocks
    may differ a little. */
const LATE_MARGIN_MS = 2 * 60 * 1000;
/** A moment `ms` after a stamp of the record's, as the clock of the Mac that wrote it reads it, to the minute: "2026-10-20
    15:17". */
function shownAfter(stamp, ms) {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(String(stamp));
  const offset = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60000 : 0;
  return new Date(Date.parse(stamp) + ms + offset).toISOString().slice(0, 16).replace("T", " ");
}

/** The record with its spellings, `spellings`; and after a finish (spec section 4, "spell applies to every timeline and to
    the final transcripts") the final transcripts with each spelling they do not hold yet, and the hand-off made again as its
    next revision, each file put in by the rule, and only when its words change. Each finished part's transcripts hold the
    spellings that changed them: its `spellings`, or, for a part no spelling has reached since a finish made it, the record's
    own. Only the others are applied to it, so none is applied twice, and a spelling taken back or changed leaves the part as
    it is, which is said: a finish again makes a part's transcripts again only once it is Shared again. Before reading them
    it checks they are here, whole (her folder may be online-only after a hand-off): if not, it starts bringing them over and
    stops. (`spell` has refused already while a finish runs, whose late check would put its own copies back.) When the record
    cannot be written, each final file is put back as it was, each on its own; one that cannot be is named, and she is told
    the episode needs Jason. Resolves the save's code. */
async function saveSpellings(ctx, found, spellings, done) {
  const record = { ...found.record, spellings };
  const finished = record.finished;
  if (!finished) return save(ctx, found, record, done);
  const meantOf = (list, heard) => (list.find(([h]) => h === heard) || [])[1];
  const parts = Object.entries(finished.parts || {}).map(([key, part]) => {
    const held = part.spellings || found.record.spellings || [];
    return { key, part, held, stem: `final/${basename(part.file, extname(part.file))}`, toApply: spellings.filter(([h]) => meantOf(held, h) === undefined) };
  });
  // Every part's own list is kept from now on, so a part a finish reuses keeps it, and one it makes again starts afresh.
  const withHeld = (held) => ({ ...finished, parts: Object.fromEntries(parts.map((p) => [p.key, { ...p.part, spellings: held[p.key] || p.held }])) });
  const kept = [...new Set(parts.flatMap((p) => p.held.filter(([h, m]) => meantOf(spellings, h) !== m).map(([h, m]) => `"${h}" as "${m}"`)))];
  const keptNote = kept.length ? ` The final transcripts keep ${listed(kept)} until each part is shown in Final Cut, Shared and finished again.` : "";
  if (!parts.some((p) => p.toApply.length)) return save(ctx, found, { ...record, finished: withHeld({}) }, `${done}${keptNote}`);
  const finals = [...parts.flatMap((p) => [`${p.stem}.srt`, `${p.stem}.transcript.txt`, ...(p.part.words ? [p.part.words] : [])]), finished.handoff];
  const gone = finals.find((rel) => !existsSync(join(found.folder, rel)));
  if (gone) return refuse(ctx, `${gone} is not in the episode's folder, so the final transcripts cannot be spelled again. Nothing was changed. Say finish again.`);
  const coming = finals.filter((rel) => !ctx.isWhole(join(found.folder, rel)));
  if (coming.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: coming });
    return refuse(ctx, "Dropbox is bringing the final transcripts over to this Mac. Say it again when it is done. Nothing was changed.");
  }
  const work = join(runsFolder(ctx.home), `spell-${process.pid}-${ctx.now()}`);
  mkdirSync(work, { recursive: true });
  const put = textWriter({ work, ...ruleOpts(ctx) });
  const before = [];
  /** Each final file put back as it was, each on its own: the ones that could not be. */
  const putBack = () => before.filter(([rel, text]) => {
    try {
      put(join(found.folder, rel), text, { replace: true });
      return false;
    } catch (e) {
      return true;
    }
  }).map(([rel]) => rel);
  try {
    const srts = {};
    const writes = [];
    const held = {};
    // The pairs each part's captions are spelled with now, by its key.
    const spelledWith = {};
    for (const p of parts) {
      const was = { srt: readFileSync(join(found.folder, `${p.stem}.srt`), "utf8"), words: p.part.words ? readFileSync(join(found.folder, p.part.words), "utf8") : null };
      const sameWords = (made) => !made.words || JSON.stringify(JSON.parse(made.words).words) === JSON.stringify(JSON.parse(was.words).words);
      // A spelling is held by a part only once it has changed it: one whose word the part does not have is not.
      const changing = p.toApply.filter((pair) => {
        const made = respelledPart(was, [pair]);
        return made.srt !== was.srt || !sameWords(made);
      });
      held[p.key] = [...p.held, ...changing];
      spelledWith[p.key] = changing;
      const made = respelledPart(was, changing);
      srts[p.key] = made.srt;
      if (made.srt !== was.srt) writes.push([`${p.stem}.srt`, made.srt], [`${p.stem}.transcript.txt`, made.txt]);
      if (!sameWords(made)) writes.push([p.part.words, made.words]);
    }
    const toApply = [...new Map(parts.flatMap((p) => p.toApply).map(([h, m]) => [h, [h, m]])).values()];
    if (!writes.length) return save(ctx, found, { ...record, finished: withHeld(held) }, `${done} The final transcripts do not have ${listed(toApply.map(([h]) => `"${h}"`))}, so they are as they were.${keptNote}`);
    // The hand-off is made again as version 2 once this Mac's settings say so, and when it is version 2 already: version 1 is
    // never written over it (spec 2026-10-22, section 8; finish.js writesV2For, which a finish asks too). Version 2 is under the
    // video's first version's id, above every revision written for that id on this Mac (finish.js nextRevision), and only when
    // the chain of the video's versions can be followed to its first: on a gap nothing is written, the spelling included.
    // Version 1 is under the episode's own id, and a revision is never used twice, even one a finish left in final/ without
    // writing its record (finish.js lastRevision). Which version, the id, the revision and a refusal are finish.js
    // handoffTarget's, as every hand-off writer asks them.
    const onFile = JSON.parse(readFileSync(join(found.folder, finished.handoff), "utf8"));
    const target = handoffTarget(ctx, { folder: found.folder, record });
    if (target.refusal) return refuse(ctx, target.refusal);
    const { v2, revision } = target;
    const at = localStamp(new Date(ctx.now()));
    const given = { record, srts, revision, made: at, madeOn: ctx.machine, commit: writerOf(ctx).commit };
    const handoff = v2 ? respelledHandoffV2(onFile, { ...given, id: target.id, spellings: spelledWith.main || [] }) : respelledHandoff(onFile, given);
    const fault = v2 ? handoffFaultV2(handoff) : handoffFault(handoff);
    if (fault) return refuse(ctx, `The hand-off could not be made again (${fault.replace(/\.$/, "")}). Nothing was changed.`);
    writes.push([finished.handoff, handoffText(handoff)]);
    // Nothing is put into final/ that the record could not then take: a change Dropbox took away is said first, as save says
    // it, and a finish on the other Mac whose late check of final/ is still to come would put its own copies back over these.
    const gone = undone(found.record, ctx.home);
    if (gone) {
      ctx.say(`${gone} Nothing was written.`);
      acceptRev(ctx.home, found.record.id, found.record.rev);
      return 1;
    }
    const checked = finished.on !== ctx.machine ? Date.parse(finished.at) + LATE_CHECK_MS + LATE_MARGIN_MS : 0;
    if (checked > ctx.now()) return refuse(ctx, `The finish on ${finished.on} is still checking its copies in final/, until ${shownAfter(finished.at, LATE_CHECK_MS + LATE_MARGIN_MS)}. Say it again after that. Nothing was changed.`);
    const files = {};
    for (const [rel, text] of writes) {
      before.push([rel, readFileSync(join(found.folder, rel), "utf8")]);
      files[rel] = put(join(found.folder, rel), text, { replace: true }).bytes;
    }
    // A finished part may have captions drawn into its picture (whether it has is not known here), which keep the old spelling
    // until it is finished again: a full episode's main video has none.
    const drawn = parts.filter((p) => p.key !== "main" || presetOf(record, "main").job !== "full-episode").map((p) => (p.key === "main" ? "the main video" : capital(p.key)));
    const still = drawn.length ? ` If ${listed(drawn)} ${drawn.length === 1 ? "shows" : "show"} captions on screen, they keep the old spelling until ${drawn.length === 1 ? "it is" : "each is"} shown in Final Cut, Shared and finished again.` : "";
    const code = await save(ctx, found, { ...record, files: { ...record.files, ...files }, finished: { ...withHeld(held), revision, at, on: ctx.machine } }, `${done} The final transcripts are spelled so too, and the hand-off is made again as revision ${revision}: drop it on the BRIMM Ops page again.${still}${keptNote}`);
    if (code !== 0) {
      const lost = putBack();
      if (lost.length) ctx.say(`${listed(lost)} could not be put back as it was. Tell Jason: the episode needs him.`);
    }
    return code;
  } catch (e) {
    const lost = putBack();
    return refuse(ctx, `The final transcripts could not be spelled again (${e.code || "a file could not be read or put in"}). ${lost.length ? `${listed(lost)} could not be put back as it was. Tell Jason: the episode needs him.` : "Nothing was changed."}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** `spell "<episode>" [add "<as heard>" "<as spelled>" | drop "<as heard>"]`: the episode's own spellings, which every
    timeline's captions and the final transcripts take. */
async function spell(ctx, rest) {
  const [said, verb, heard, meant] = rest;
  const got = episodeFor(ctx, said === undefined ? [] : [said], { newerEnds: 1 });
  if (!got.found) return got.code;
  const found = { ...got.found, record: got.record };
  const spellings = got.record.spellings || [];
  if (verb === undefined) {
    ctx.say(spellings.length ? `The spellings: ${spellings.map(([h, m]) => `"${h}" as "${m}"`).join(", ")}.` : "There are no spellings for this episode yet.");
    return 0;
  }
  if (claimHeld(ctx, got.record)) return refuse(ctx, claimHeld(ctx, got.record));
  // A finish's late check would put its own copies of final/ back, and its record would be refused after a change here.
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running && running !== "bring") return refuse(ctx, `${running} is running for this episode. Say "how far is it?", and try again when it is done.`);
  if (verb === "drop") {
    if (!spellings.some(([h]) => h === heard)) return refuse(ctx, `There is no spelling of "${heard}".`);
    return saveSpellings(ctx, found, spellings.filter(([h]) => h !== heard), `"${heard}" is as the transcriber writes it again. ${SHOW_IT}`);
  }
  if (verb !== "add") {
    ctx.say(HELP);
    return 2;
  }
  const fault = spellingFault(heard, meant);
  if (fault) return refuse(ctx, fault);
  return saveSpellings(ctx, found, withSpelling(spellings, heard.trim(), meant.trim()), `"${heard.trim()}" is spelled "${meant.trim()}" now, in every timeline's captions. ${SHOW_IT}`);
}

/** `logo "<episode>" on|off [--picture "<name>"]`: the logo on the main video, top right (spec section 4). Its picture is
    named once, from the Pictures folder, and the episode keeps it. A Reel's logo comes with the brand templates (spec
    section 3). */
async function logo(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["picture"]);
  const [said, verb, ...more] = words;
  if (partFrom(more).part !== "main") return refuse(ctx, "A Reel's logo comes with the brand templates, later. The logo is on the main video.");
  const start = layerStart(ctx, [said, ...more]);
  if (start.code !== undefined) return start.code;
  const { found, part } = start;
  if (verb !== "on" && verb !== "off") {
    ctx.say(HELP);
    return 2;
  }
  let record = found.record;
  let picked = null;
  if (verb === "on") {
    const named = flags.picture && flags.picture[flags.picture.length - 1];
    if (named) {
      const got = pictureFrom(ctx, found, named);
      if (got.code !== undefined) return got.code;
      picked = got;
      record = { ...record, brand: { ...(record.brand || {}), logo: got.picture }, files: { ...record.files, [got.picture]: got.bytes } };
    } else if (!(record.brand && record.brand.logo)) return refuse(ctx, 'Say which picture in the Pictures folder is the logo (--picture "<name>").');
  }
  return saveWithPicture(ctx, found, withPart(record, part, (t) => ({ ...t, logo: verb === "on" })), `The logo is ${verb} on ${partLabel(part)}. ${SHOW_IT}`, picked);
}

/** `captions "<episode>" reel <n> on|off`: a Reel's running captions, drawn in its preset's caption style. The main video's
    follow its preset alone. */
async function captions(ctx, rest) {
  const [said, ...more] = rest;
  const verb = more[more.length - 1];
  const start = layerStart(ctx, [said, ...more.slice(0, -1)]);
  if (start.code !== undefined) return start.code;
  const { found, part } = start;
  if (verb !== "on" && verb !== "off") {
    ctx.say(HELP);
    return 2;
  }
  if (part === "main") return refuse(ctx, "The main video's captions follow its caption style: say which (preset --captions).");
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, captions: verb === "on" })), `Captions are ${verb} on Reel ${part.reel}. ${SHOW_IT}`);
}

/** `text "<episode>" add lower-third [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>] --line "<name>"
    [--line "<role>"]`, `text "<episode>" drop <id> [main | reel <n>]`, and with neither, the list: a name over a role on a
    timeline, from the moment given, for the seconds given (4 unless said). */
async function text(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["at", "at-words", "for", "line"]);
  const [said, verb, kindOrId, ...more] = words;
  const start = layerStart(ctx, [said, ...(verb === "add" || verb === "drop" ? more : [verb, kindOrId, ...more].filter((w) => w !== undefined))], { writes: verb === "add" || verb === "drop" });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const texts = target.texts || [];
  if (verb === undefined || (verb !== "add" && verb !== "drop")) {
    ctx.say(texts.length ? texts.map((t) => `${t.id}: "${t.lines.join('", "')}" at ${t.at} s of the recording, for ${lengthText(t.for)}`).join("\n") : `There are no texts on ${partLabel(part)}.`);
    return 0;
  }
  if (verb === "drop") {
    if (!texts.some((t) => t.id === kindOrId)) return refuse(ctx, `There is no text ${kindOrId} on ${partLabel(part)}.`);
    return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, texts: texts.filter((x) => x.id !== kindOrId) })), `Text ${kindOrId} is taken off ${partLabel(part)}. ${SHOW_IT}`);
  }
  if (kindOrId !== "lower-third") return refuse(ctx, "The kind of text there is so far is a lower third: a name over a role (add lower-third).");
  const lines = (flags.line || []).map((l) => oneLine(l)).filter(Boolean);
  if (!lines.length || lines.length > 2) return refuse(ctx, 'Say the name, and the role under it if there is one (--line "Sallie Ogden" --line "Founder, The BRIMM").');
  const moment = momentFrom(ctx, found, part, flags);
  if (moment.code !== undefined) return moment.code;
  const length = lengthFrom(ctx, flags, {}, 4);
  if (length.code !== undefined) return length.code;
  const id = nextId(texts, "t");
  const layer = { id, kind: "lower-third", at: moment.at, for: length.seconds, lines };
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, texts: [...texts, layer] })), `Name title ${id} on ${moment.on} at ${clockText(timelineAt(moment.clock, moment.at) ?? 0)}, for ${lengthText(length.seconds)}: "${lines.join('", "')}". ${SHOW_IT}`);
}

/** `graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>]
    [--place full|corner|lower]`, `graphic "<episode>" drop <id> [main | reel <n>]`, `graphic "<episode>" ideas
    [main | reel <n>]`, and with none, the list: a picture from her Pictures folder over a timeline (spec section 4). */
async function graphic(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["at", "at-words", "for", "place"]);
  const [said, verb, nameOrId, ...more] = words;
  const takes = verb === "add" || verb === "drop";
  const start = layerStart(ctx, [said, ...(takes ? more : [verb === "ideas" ? undefined : verb, nameOrId, ...more].filter((w) => w !== undefined))], { writes: takes });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const graphics = target.graphics || [];
  if (verb === "ideas") {
    const read = clockFor(found, part, ctx);
    if (read.why || read.coming) return refuse(ctx, read.why || `Dropbox is still bringing ${read.coming} over to this Mac.`);
    const ideas = ((read.plan.claude && read.plan.claude.graphics) || []).map((idea) => ({ idea: idea.idea, phrase: read.plan.phrases.find((p) => p.id === idea.id) }))
      .filter(({ phrase }) => phrase && read.pieces.some((r) => phrase.end > r.start && phrase.start < r.end));
    ctx.say(ideas.length ? ideas.map(({ idea, phrase }) => `${idea}: at ${clockText(timelineAt(read.clock, Math.max(phrase.start, read.pieces.find((r) => phrase.end > r.start && phrase.start < r.end).start)) ?? 0)} on ${read.on}, "${phrase.text}"`).join("\n") : `Claude gave no ideas for graphics on what ${partLabel(part)} keeps.`);
    return 0;
  }
  if (!takes) {
    ctx.say(graphics.length ? graphics.map((g) => `${g.id}: ${g.picture.replace(/^media\//, "")}, ${g.place}, at ${g.at} s of the recording, for ${lengthText(g.for)}`).join("\n") : `There are no graphics on ${partLabel(part)}.`);
    return 0;
  }
  if (verb === "drop") {
    if (!graphics.some((g) => g.id === nameOrId)) return refuse(ctx, `There is no graphic ${nameOrId} on ${partLabel(part)}.`);
    return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, graphics: graphics.filter((g) => g.id !== nameOrId) })), `Graphic ${nameOrId} is taken off ${partLabel(part)}. ${SHOW_IT}`);
  }
  const place = flags.place ? flags.place[flags.place.length - 1] : "full";
  if (!["full", "corner", "lower"].includes(place)) return refuse(ctx, `"${place}" is not a place. Say full, corner or lower.`);
  const moment = momentFrom(ctx, found, part, flags);
  if (moment.code !== undefined) return moment.code;
  const length = lengthFrom(ctx, flags, moment, 4);
  if (length.code !== undefined) return length.code;
  const got = pictureFrom(ctx, found, nameOrId);
  if (got.code !== undefined) return got.code;
  const id = nextId(graphics, "g");
  const layer = { id, picture: got.picture, at: moment.at, for: length.seconds, place };
  // A picture shown full in another shape than the frame loses its edges: how much of it shows is said.
  const frame = part === "main" ? { width: moment.read.plan.facts.width, height: moment.read.plan.facts.height } : REEL_FRAME;
  const shown = Math.min(got.size.width / got.size.height / (frame.width / frame.height), (frame.width / frame.height) / (got.size.width / got.size.height));
  const cropped = place === "full" && shown < 0.67 ? ` The picture is another shape than the frame, so only about ${Math.round(shown * 100)}% of it shows: say --place lower to show it whole.` : "";
  const record = { ...found.record, files: { ...found.record.files, [got.picture]: got.bytes } };
  return saveWithPicture(ctx, found, withPart(record, part, (t) => ({ ...t, graphics: [...graphics, layer] })), `Graphic ${id}, ${nameOrId}, ${place}, on ${moment.on} at ${clockText(timelineAt(moment.clock, moment.at) ?? 0)}, for ${lengthText(length.seconds)}.${cropped} ${SHOW_IT}`, got);
}

/** `preset "<episode>" [main | reel <n>] [--job "<job>"] [--captions "<style>"] [--look "<look>"]`: the timeline's job,
    caption style and look, each from its list (styles.js); with none of them, what it has and what there is. */
async function preset(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["job", "captions", "look"]);
  const start = layerStart(ctx, words, { writes: ["job", "captions", "look"].some((k) => flags[k]) });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const now = target.preset || defaultPreset(found.record.kind, part);
  // The record keeps each by its id ("full-episode"), as the spec's record does; a person names it either way.
  const given = Object.fromEntries(["job", "captions", "look"].filter((k) => flags[k]).map((k) => [k, idOf(flags[k][flags[k].length - 1])]));
  const describe = (p) => `${partLabel(part)[0].toUpperCase()}${partLabel(part).slice(1)} is a ${nameOf(p.job)}, with ${nameOf(p.captions)} captions and the ${nameOf(p.look)} look.`;
  if (!Object.keys(given).length) {
    ctx.say(`${describe(now)}${target.preset ? "" : " (Its default.)"}`);
    ctx.say(`Jobs: ${Object.keys(JOBS).map(nameOf).join(", ")}. Caption styles: ${Object.keys(CAPTION_STYLES).map(nameOf).join(", ")}. Looks: ${Object.keys(LOOKS).join(", ")}.`);
    return 0;
  }
  // A new job brings its own caption style and look, unless they are given too.
  const next = given.job && given.job !== now.job ? { job: given.job, captions: (JOBS[given.job] || {}).captions, look: (JOBS[given.job] || {}).look, ...given } : { ...now, ...given };
  const fault = presetFault(next);
  if (fault) return refuse(ctx, fault);
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, preset: next })), `${describe(next)} ${SHOW_IT}`);
}

/** `cut "<episode>" remove [main | reel <n>] (--words "<words>" | --at <time> --to <time>)` and `cut "<episode>" keep
    [main | reel <n>] (--words "<words>" | --at <time>)`: whole phrases taken out of a timeline, or kept that were cut, always
    at a pause (recut.js). A time is read on the timeline she names, as she watched it (spec section 4, "Times a person
    gives"): what is taken out runs from --at to --to on it, and what is kept is what was cut at the join nearest --at
    ("keep the Hormozi story at 12:30"). Words to keep are found in what is cut. A cut that would keep nothing is refused. A
    cut on the main video does not reach a Reel over the same words, and is said so. */
async function cut(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["words", "at", "to"]);
  const [said, verb, ...more] = words;
  const start = layerStart(ctx, [said, ...more]);
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  if (verb !== "keep" && verb !== "remove") {
    ctx.say(HELP);
    return 2;
  }
  const last = (k) => (flags[k] ? flags[k][flags[k].length - 1] : undefined);
  let from;
  let to;
  let read;
  const cuts = target.cuts || [];
  if (verb === "remove") {
    if (!flags.words && !flags.at) return refuse(ctx, 'Say what to take out: the words (--words "know your costs"), or where it starts and ends on the timeline (--at 0:04 --to 0:09).');
    if (!flags.words && !last("to")) return refuse(ctx, "Say where the cut ends too (--to 0:12).");
    const first = momentFrom(ctx, found, part, { ...flags, ...(flags.words ? { "at-words": flags.words } : {}) });
    if (first.code !== undefined) return first.code;
    read = first.read;
    from = first.at;
    to = first.to ?? first.at;
    if (!flags.words) {
      const end = momentOf({ time: last("to"), on: first.on, clock: first.clock, ranges: read.pieces, words: read.words, end: true });
      if (end.why) return refuse(ctx, end.why);
      if (!(end.at > from)) return refuse(ctx, `A cut ends after it starts: ${last("to")} is not after ${last("at")} on ${first.on}.`);
      to = end.at;
    }
  } else if (flags.words) {
    read = clockFor(found, part, ctx);
    if (read.why || read.coming) return refuse(ctx, read.why || `Dropbox is still bringing ${read.coming} over to this Mac.`);
    let places = wordsAt(read.words, [{ start: 0, end: read.plan.facts.duration }], last("words")).filter((p) => !read.pieces.some((r) => p.start < r.end && p.end > r.start));
    // On a Reel, only what is cut within its stretch counts: the same words said elsewhere in the recording are not meant.
    if (read.span) {
      const within = places.filter((p) => p.start >= read.span.from && p.end <= read.span.to);
      if (!within.length && places.length) return refuse(ctx, `That is outside Reel ${part.reel}'s stretch of the recording, ${clockText(read.span.from)} to ${clockText(read.span.to)}.`);
      places = within;
    }
    if (places.length !== 1) return refuse(ctx, places.length ? `"${last("words")}" is said ${places.length} times in what is cut. Say the time on ${read.on} where it was cut instead (--at 0:07).` : `"${last("words")}" is not in what is cut from ${partLabel(part)}.`);
    [from, to] = [places[0].start, places[0].end];
  } else {
    if (!flags.at) return refuse(ctx, 'Say what to keep: the words that were cut (--words "very important"), or the time on the timeline where they were cut (--at 12:30).');
    const got = timelineRead(ctx, found, part, flags);
    if (got.code !== undefined) return got.code;
    read = got.read;
    const t = secondsOf(last("at"));
    const raw = t === null || t > lengthOf(read.clock) + 1 ? null : rawAt(read.clock, Math.min(t, lengthOf(read.clock)));
    // A pushed file's clip starts on a frame, a little before its kept piece: a time on that frame is on the piece.
    if (raw !== null && !read.pieces.some((r) => raw >= r.start - FRAME_SLACK && raw <= r.end + 0.0005)) {
      // A time on what was kept when she watched it, and is cut now: the cut she asked for that took it out, the newest. A cut
      // takes the breath kept beside its phrases with it, so it is the one without which that time would be kept again.
      const tookOut = (c) => keptRanges({ plan: read.plan, cuts: cuts.filter((x) => x !== c), span: read.span }).some((r) => raw >= r.start - FRAME_SLACK && raw <= r.end + 0.0005);
      const since = [...cuts].reverse().find((c) => !c.keep && ((raw >= c.from && raw <= c.to) || tookOut(c)));
      if (!since) return refuse(ctx, momentOf({ time: last("at"), on: read.on, clock: read.clock, ranges: read.pieces, words: read.words }).why);
      [from, to] = [since.from, since.to];
    } else {
      // Otherwise the cut nearest it, by what is said there now: words cut, or kept again since.
      const now = cutPhrases(read.plan.phrases, cuts);
      const said = (c) => {
        const there = now.filter((p) => (p.start + p.end) / 2 > c.from && (p.start + p.end) / 2 < c.to);
        return { cut: there.filter((p) => !p.keep).map((p) => p.text).join(" "), kept: there.filter((p) => p.keep).map((p) => p.text).join(" ") };
      };
      const near = cutNear({ time: last("at"), on: read.on, clock: read.clock, edges: part === "main" ? { from: 0, to: read.plan.facts.duration } : read.span, said });
      if (near.why) return refuse(ctx, near.why);
      [from, to] = [near.cut.from, near.cut.to];
    }
  }
  if (read.span && (from < read.span.from || to > read.span.to)) return refuse(ctx, `That is outside Reel ${part.reel}'s stretch of the recording, ${clockText(read.span.from)} to ${clockText(read.span.to)}.`);
  const whole = cutSpan(read.plan.phrases, from, to);
  if (whole.why) return refuse(ctx, whole.why);
  const what = read.plan.phrases.filter((p) => whole.phrases.includes(p.id)).map((p) => p.text).join(" ");
  if (verb === "keep" && cutPhrases(read.plan.phrases, cuts).filter((p) => whole.phrases.includes(p.id)).every((p) => p.keep)) return refuse(ctx, `"${what}" is kept on ${partLabel(part)} already.`);
  const next = [...cuts, { id: nextId(cuts, "c"), keep: verb === "keep", from: whole.from, to: whole.to }];
  // A timeline that keeps nothing cannot be shown, and every time on it would be refused after: such a cut is refused.
  if (!keptRanges({ plan: read.plan, cuts: next, span: read.span }).length) return refuse(ctx, `That would take out all of ${partLabel(part)}. Say a shorter stretch.`);
  const reach = part === "main" ? " A cut on the main video does not reach a Reel over the same words." : "";
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, cuts: next })), `${verb === "keep" ? "Kept in" : "Taken out of"} ${partLabel(part)}: "${what}" (${clockText(whole.from)} to ${clockText(whole.to)} of the recording, whole phrases, at a pause).${reach} ${SHOW_IT}`);
}

/** The commands, by the word a person's request is run with. */
const COMMANDS = { episodes: (ctx) => episodes(ctx), open, push, bring, status, retry, name, title, reel, reels, ask, finish, release, show, behind: (ctx) => behind(ctx), resolve: resolveConflict, free, spell, logo, captions, text, graphic, preset, cut };
/** The commands' names. Sallie's skill runs only these (tests/studio.test.js). */
export const COMMAND_NAMES = Object.keys(COMMANDS);

/** What `node edit.js` does. Resolves 0 when it did what it was asked, 1 when it refused or something failed, and 2 when it
    was asked wrongly or this Mac is not set up. */
export async function editMain(argv, deps = {}) {
  const say = deps.say || ((line) => process.stdout.write(`${line}\n`));
  const [command, ...rest] = argv;
  if (command === "--help" || command === "-h") {
    say(HELP);
    return 0;
  }
  const ctx = contextFor({ ...deps, say });
  if (ctx.why) {
    say(ctx.why);
    return 2;
  }
  const run = COMMANDS[command];
  if (!run) {
    say(HELP);
    return 2;
  }
  return run(ctx, rest);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  editMain(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

