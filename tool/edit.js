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
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stamp } from "./shared/text.js";
import { readEpisode, filesProblems, undone, writeEpisode, localStamp, acceptRev } from "./episode.js";
import { readSettings, episodesFolder, workFolder, episodeWork, pushedFolder, libraryFor, runsFolder, dropFolder, fromFinalCutFolder } from "./settings.js";
import { progressFolder, reporter } from "./progress.js";
import { startDetached, runDetached, runningCommand, readResult } from "./detached.js";
import { isWhole, readThrough, textWriter } from "./dropbox.js";
import { localMedia, retitle, withImportOptions, mediaIn } from "./portable.js";
import { eventName, projectName, timelineFile } from "./names.js";
import { readStatuses, importState, removeStatus } from "./importing.js";
import { heldBy, commitOf, episodeHolding, readSeen, seenKey } from "./filing.js";
import { reelTimeline } from "./reel.js";
import { partsOf, lookFor, unkeptParts } from "./parts.js";
import { finishNow, expectedWords } from "./finish.js";
import { findPrograms } from "./unedited.js";
import { isMedia } from "./lib.js";
import { isRunning, lastLine } from "./run.js";

const HELP = `The command line for episodes on this Mac. Claude runs it for the person editing.

  node edit.js episodes                 the episodes, the videos waiting in the drop folders, the imports, and this
                                        Mac's libraries
  node edit.js open "<episode>"         check its files are here, bring over those that are not, and show what is
                                        decided for it
  node edit.js push "<episode>" [main] [--no-hand-edits | --hand-edits]
                                        show the main timeline in Final Cut Pro, as a new version, in this Mac's
                                        library for the episode. Shown before, it asks first whether it was changed in
                                        Final Cut: --no-hand-edits says it was not, --hand-edits that it was
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
  node edit.js push "<episode>" reel <n> [--no-hand-edits | --hand-edits]
                                        show a picked Reel in Final Cut Pro, upright
  node edit.js finish "<episode>" [--yes] [--take "<part>=<file | this Mac | the other Mac>"] [--no-hand-edits "<part>"]
                     [--without "reel <n>"]
                                        find what Final Cut Shared and exported of each part, and ask what it must. With
                                        --yes and nothing left to ask, it transcribes the finished videos again, copies them
                                        into final/ and writes the hand-off for BRIMM Ops, detached`;

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

/** The episode a person names, by what they `said`: its folder's name, its id or short id, or words that are all in its folder's
    name or its own name. Gives back { folder, name, read }, where `read` is what readEpisode gave, or { why } when no episode
    fits or more than one does. An episode with a conflicted copy, whose record cannot be read, is found by its folder. */
export function findEpisode(ctx, said) {
  // An import that has not finished has no whole record, and is not an episode yet.
  const all = folders(ctx).map((name) => ({ name, folder: join(ctx.episodes, name), read: readEpisode(join(ctx.episodes, name)) })).filter((e) => e.read.code !== "NONE");
  const words = plainly(said).split(/\s+/).filter(Boolean);
  const exact = all.filter((e) => plainly(e.name) === plainly(said));
  const byId = all.filter((e) => e.read.record && (e.read.record.id === said || e.read.record.id.slice(-6) === said));
  const byWords = all.filter((e) => words.length && words.every((w) => plainly(e.name).includes(w) || (e.read.record && plainly(e.read.record.name && e.read.record.name.text).includes(w))));
  const fits = exact.length ? exact : byId.length ? byId : byWords;
  if (fits.length === 1) return fits[0];
  if (fits.length > 1) return { why: `More than one episode fits "${said}": ${listed(fits.map((e) => e.name))}. Say which.` };
  return { why: all.length ? `No episode fits "${said}". The episodes are: ${listed(all.map((e) => e.name))}.` : "There are no episodes yet." };
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
    late check. Only those whose video `fits`, when it is given. */
function importLines(ctx, fits = () => true) {
  return readStatuses(ctx.root, ctx.now()).filter((s) => s.status && fits(s.status.video)).map(({ status }) => {
    const state = importState(status, ctx.now());
    if (state === "failed") return `  ${status.video}: its import failed on ${status.machine}: ${status.failed}`;
    if (state === "problem") return `  ${status.video}: copied in on ${status.machine}, but the late check found a problem: ${status.problem}`;
    if (state === "stopped") return `  ${status.video}: stopped on ${status.machine} at ${status.step}, ${ageText(ctx.now() - Date.parse(status.at))} ago`;
    return `  ${status.video}: being imported on ${status.machine}, at ${status.step}`;
  });
}

/** `episodes`: each episode, newest first, with what a person needs to pick one up; the videos waiting in each drop folder,
    and for how long; the imports in Episodes/.importing; and this Mac's libraries, with the free space on its disk. An
    archived episode is left out. */
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
        say(`  ${name}`);
        say("    Written by a newer brimm-video: Jason updates this Mac before it is changed here.");
        continue;
      }
      const kind = r.kind === "short video" ? "a short video" : "an episode";
      say(`  ${r.name.text}${r.name.placeholder ? " (a placeholder name)" : ""}: ${kind} of ${stamp(r.video.seconds)}, in ${name}, id ${r.id.slice(-6)}`);
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
    ctx.say(`${found.name} was last written by a newer brimm-video. Jason has a newer brimm-video. Ask him to update this Mac.`);
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

/** The episode's files that are not whole on this Mac yet, as Dropbox brings them over: by the record's list. */
const notHere = (ctx, found, record) => Object.keys(record.files).filter((rel) => !ctx.isWhole(join(found.folder, rel)));

/** `open "<episode>"`: check its files against its record, and that each is whole on this Mac, and show what is decided for
    it. When some are not whole yet, a detached run brings them over (`bring`), and it returns at once. At the first open on
    this Mac it says how to keep the episode on this Mac. Nothing is written into the episode: the claim comes with the
    laptop (phase 1b). */
export async function open(ctx, rest) {
  const got = episodeFor(ctx, rest);
  if (!got.found) return got.code;
  const { found, record } = got;
  const { say } = ctx;
  const gone = undone(record, ctx.home);
  if (gone) say(gone);
  const problems = filesProblems(found.folder, record);
  if (problems.length) {
    say(`${found.name} is not whole in Dropbox:`);
    for (const problem of problems) say(`  ${problem}`);
    say(`It is not opened. Say "what's waiting?" to see the episodes.`);
    return 1;
  }
  const name = record.name.text;
  const coming = notHere(ctx, found, record);
  if (coming.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name });
    say(`Dropbox is bringing ${coming.length} file${coming.length === 1 ? "" : "s"} of ${name} over to this Mac. Say "open ${name}" again when it is done; "how far is it?" shows how far it has got.`);
    return 0;
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
export async function pushPart(ctx, found, { part, xml, noHandEdits = false, handEdits = false }) {
  const { say } = ctx;
  const { record } = found;
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
  // A yes to the guard always stops the push, whatever else is said with it.
  if (last && (handEdits || !noHandEdits)) {
    say(handEdits
      ? `Your changes stay in v${last} in Final Cut. This version of brimm-video cannot build on them yet. Until it can: ask for brimm-video's changes first and make trims by hand last, or finish that timeline by hand in v${last}.`
      : `Did you change v${last} of ${record.name.text} in Final Cut since it was shown? Say "no changes" to show it again. If you did change it, say so.`);
    return 1;
  }
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
    const push = { v, at: localStamp(new Date(ctx.now())), on: ctx.machine, file, project, ...(last ? { answer: `no hand edits since v${last}` } : {}) };
    const next = part === "main"
      ? { ...record, main: { ...record.main, pushed: [...pushed, push] } }
      : { ...record, reels: record.reels.map((reel) => (reel === target ? { ...reel, pushed: [...pushed, push] } : reel)) };
    const writer = { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine };
    try {
      writeEpisode(found.folder, { ...next, libraries: { ...record.libraries, [ctx.machine]: `${found.name}.fcpbundle` }, files: { ...record.files, [file]: entry.bytes } }, { expectRev: record.rev, writeText: textWriter({ work, ...opts }), writer, home: ctx.home });
    } catch (e) {
      say(e.code === "CHANGED" ? "This episode changed on the other Mac: open it again." : `${String(e.message).replace(/\.$/, "")}.`);
      return 1;
    }
    const copy = join(pushedFolder(ctx.home, found.name), basename(file));
    mkdirSync(pushedFolder(ctx.home, found.name), { recursive: true });
    writeFileSync(copy, withImportOptions(local.xml, { library: libraryFor(ctx.home, found.name) }));
    ctx.openApp("Final Cut Pro", copy);
    say(`Shown in Final Cut as "${project}", in the library ${found.name}.fcpbundle in BRIMM Video Work.`);
    offlineStep(ctx, found);
    return 0;
  } catch (e) {
    say(`It could not be shown in Final Cut: ${String(e.message).replace(/\.$/, "")}.`);
    return 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
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
    return pushReel(ctx, { ...got.found, record: got.record }, n, { noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits") });
  }
  if (words[words.length - 1] === "main") words.pop();
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = got;
  const source = join(found.folder, timelineFile({ part: "main", v: 0 }));
  if (!ctx.isWhole(source)) {
    ctx.say(`Dropbox is still bringing edit/main.v0.fcpxml over to this Mac. Say "open ${record.name.text}" first.`);
    return 1;
  }
  return pushPart(ctx, { ...found, record }, { part: "main", xml: readFileSync(source, "utf8"), noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits") });
}

/** `bring --now "<episode folder>"`, the detached run `open` starts: each file of the episode that is not whole on this Mac
    is read to its end, so that Dropbox brings it over, and the result says which are whole now. */
export async function bring(ctx, rest) {
  // Given files after the folder (a Reel's clip, from push reel), only those are brought over.
  const [now, folder, ...only] = rest;
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
    return { ok: !failed.length, made, failed, next: failed.length ? `Some files of ${name} are not here yet. Say "open ${name}" to try again.` : `Every file of ${name} is here. Say "open ${name}".` };
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

/** `status ["<words>"]`: what is running on this Mac (each run's step, from the progress panel's files), the imports in
    Episodes/.importing/, and for each episode on this Mac the detached run at work on it and what each one left. With words,
    only what they fit. */
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
      lines.push(`${folder}: ${r.command} ended ${ageText(ctx.now() - r.ended)} ago.${r.made.length ? ` Made: ${r.made.join(", ")}.` : ""}${done}${r.next ? ` ${r.next}` : ""}`);
    }
  }
  for (const line of lines.length ? lines : ["Nothing is running, and nothing is waiting."]) say(line);
  return 0;
}

/** `retry "<video>"`: import again a video in this Mac's drop folder whose import failed or stopped. It is found by its
    file's name or its name without the ending, whatever their case. Refused when an episode holds it already, and while its
    import is running. Its status files from this Mac are taken away, and the launch agent is asked to look (kickstart). */
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
  const held = episodeHolding({ root: ctx.root, video, bytes: statSync(join(drop, video)).size });
  if (held) {
    say(`${video} is ${held}`);
    return 1;
  }
  // Of this Mac's imports of the video, the ones to take again are those that failed, stopped, or found a problem at their
  // late check. One running now is left alone, and when it is the only one, nothing is done.
  const mine = readStatuses(ctx.root, ctx.now()).filter((s) => s.status && s.status.video === video && s.status.machine === ctx.machine);
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
  ctx.say(done);
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
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  if (!ns.length) return refuse(ctx, "Say which Reels, by their numbers.");
  const reels = (record.reels || []).map((reel) => ({ ...reel }));
  for (const n of ns) {
    const reel = reels.find((r) => r.n === n);
    if (!reel) return refuse(ctx, `There is no Reel ${n}. The Reels are ${reels.map((r) => r.n).join(", ") || "none"}.`);
    if (reel.status === "finished") return refuse(ctx, `Reel ${n} is finished: it is in the hand-off already.`);
    reel.status = status;
  }
  const said = ns.map((n) => (status === "picked" ? `Reel ${n} is picked. Say "show reel ${n} in Final Cut" to have it pushed.` : `Reel ${n} is dropped.`));
  return save(ctx, found, { ...record, reels }, said.join(" "));
}
export const pickReels = (ctx, found, ns) => markReels(ctx, found, ns, "picked");
export const dropReels = (ctx, found, ns) => markReels(ctx, found, ns, "dropped");

/** Show a picked Reel in Final Cut Pro (spec section 7, phase 2): its timeline (reelTimeline: until phase 3, the clip the
    import cut, upright, with its captions), through the push every part shares, with its guard. */
export async function pushReel(ctx, found, n, { noHandEdits = false, handEdits = false } = {}) {
  const { record } = found;
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  const reel = (record.reels || []).find((r) => r.n === n);
  if (!reel) return refuse(ctx, `There is no Reel ${n}.`);
  if (reel.status !== "picked" && reel.status !== "finished") return refuse(ctx, `Reel ${n} is not picked. Pick it first.`);
  const made = await reelTimeline(found, reel, ctx);
  if (made.coming) {
    // As open does: a detached run reads the Reel's own files to their end, so that Dropbox brings them over.
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: (reel.files || []).filter((f) => f in found.record.files) });
    return refuse(ctx, `Dropbox is bringing ${made.coming} over to this Mac. Say "show reel ${n} in Final Cut" again when it is done.`);
  }
  if (made.why) return refuse(ctx, made.why);
  return pushPart(ctx, found, { part: { reel: n }, xml: made.xml, noHandEdits, handEdits });
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
  const stops = [];
  const gone = undone(record, ctx.home);
  if (gone) {
    acceptRev(ctx.home, record.id, record.rev);
    stops.push(gone);
  }
  if (record.name && record.name.placeholder) stops.push(`Give the episode its name first: it is still called "${record.name.text}", from the video's file name.`);
  if (record.kind !== "short video" && !(record.title && record.title.approved)) stops.push("Approve a title first.");
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
  const asked = { version: 1, at: localStamp(new Date(ctx.now())), rev: record.rev, parts: looked.parts.map((p) => ({ key: p.key, label: p.label, ...(p.reel ? { reel: p.reel } : {}), projects: p.projects, video: p.video, export: p.export, kept: p.kept, noHandEdits: noHandEdits.includes(p.key) })) };
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
      ctx.say(found.why || `${words.join(" ")}: ${found.read.why}.`);
      return 1;
    }
    // The progress panel shows the finish as it shows an import (phase P).
    const progress = ctx.deps.progress || reporter({ folder: progressFolder(ctx.home), swift: findPrograms().swift });
    const result = await runDetached({ home: ctx.home, folder: found.name, command: "finish", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, () => finishNow(ctx, { folder: found.folder, name: found.name, record: found.read.record }, { progress }));
    if (result.taking) {
      ctx.say(`Another run is taking over ${found.name}'s lock. Say finish again in a moment.`);
      return 1;
    }
    if (result.running) {
      ctx.say(`${result.running} is running for ${found.name} already.`);
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
  // The record stops naming a library on this Mac, so the next push names the Backups step for the new one.
  const { [ctx.machine]: gone, ...libraries } = record.libraries || {};
  return save(ctx, found, { ...record, libraries }, `Deleted its Final Cut library on this Mac, ${size}.`);
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

/** The commands, by the word a person's request is run with. */
const COMMANDS = { episodes: (ctx) => episodes(ctx), open, push, bring, status, retry, name, title, reel, finish, free };

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

