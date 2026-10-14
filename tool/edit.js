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
//
// It never posts, sends or publishes anything.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stamp } from "./shared/text.js";
import { readEpisode, filesProblems, undone, writeEpisode, localStamp } from "./episode.js";
import { readSettings, episodesFolder, workFolder, episodeWork, pushedFolder, libraryFor, runsFolder } from "./settings.js";
import { isWhole, textWriter } from "./dropbox.js";
import { localMedia, retitle, withImportOptions } from "./portable.js";
import { projectName, timelineFile } from "./names.js";
import { readStatuses, importState } from "./importing.js";
import { heldBy, commitOf } from "./filing.js";
import { isMedia } from "./lib.js";
import { isRunning } from "./run.js";

const HELP = `The command line for episodes on this Mac. Claude runs it for the person editing.

  node edit.js episodes                 the episodes, the videos waiting in the drop folders, the imports, and this
                                        Mac's libraries
  node edit.js open "<episode>"         check its files are here, bring over those that are not, and show what is
                                        decided for it
  node edit.js push "<episode>" [main] [--no-hand-edits | --hand-edits]
                                        show the main timeline in Final Cut Pro, as a new version, in this Mac's
                                        library for the episode. Shown before, it asks first whether it was changed in
                                        Final Cut: --no-hand-edits says it was not, --hand-edits that it was`;

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
    alive: deps.alive || isRunning,
    isWhole: deps.isWhole || ((path) => isWhole(path)),
    start: deps.start || startProgram,
    openApp: deps.openApp || openApp,
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
  const all = folders(ctx).map((name) => ({ name, folder: join(ctx.episodes, name), read: readEpisode(join(ctx.episodes, name)) }));
  const words = plainly(said).split(/\s+/).filter(Boolean);
  const exact = all.filter((e) => e.name === said);
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

/** The size of everything in a folder, at any depth. */
function folderSize(folder) {
  let sum = 0;
  for (const name of readdirSync(folder, { recursive: true })) {
    const found = statSync(join(folder, name), { throwIfNoEntry: false });
    if (found && found.isFile()) sum += found.size;
  }
  return sum;
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
      const kind = r.kind === "short video" ? "a short video" : "an episode";
      say(`  ${r.name.text}${r.name.placeholder ? " (a placeholder name)" : ""}: ${kind} of ${stamp(r.video.seconds)}, in ${name}`);
      if (r.title) say(`    Title: ${r.title.text}${r.title.approved ? "" : " (recommended)"}`);
      const pushed = r.main && Array.isArray(r.main.pushed) ? r.main.pushed : [];
      if (pushed.length) say(`    Shown in Final Cut: v${pushed[pushed.length - 1].v}, on ${pushed[pushed.length - 1].on}`);
      if (r.finished) say(`    Finished: revision ${r.finished.revision}, on ${r.finished.on}`);
      if (read.newer) say("    Written by a newer brimm-video: Jason updates this Mac before it is changed here.");
      else for (const problem of filesProblems(folder, r)) say(`    Not right: ${problem}`);
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
      const found = statSync(join(drops, mac, video), { throwIfNoEntry: false });
      if (!found) continue;
      const held = heldBy({ root: ctx.root, video, bytes: found.size, now: ctx.now() });
      waiting.push(`  ${video}, in ${mac}'s, for ${ageText(ctx.now() - found.mtimeMs)}${held ? `: ${held}` : ""}`);
    }
  }
  if (waiting.length) {
    say("Waiting in the drop folders:");
    for (const line of waiting) say(line);
  }
  // The imports, from their status files.
  const imports = readStatuses(ctx.root, ctx.now()).filter((s) => s.status);
  if (imports.length) {
    say("Imports:");
    for (const { status } of imports) {
      const state = importState(status, ctx.now());
      if (state === "failed") say(`  ${status.video}: its import failed on ${status.machine}: ${status.failed}`);
      else if (state === "problem") say(`  ${status.video}: copied in on ${status.machine}, but the late check found a problem: ${status.problem}`);
      else if (state === "stopped") say(`  ${status.video}: stopped on ${status.machine} at ${status.step}, ${ageText(ctx.now() - Date.parse(status.at))} ago`);
      else say(`  ${status.video}: being imported on ${status.machine}, at ${status.step}`);
    }
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
function episodeFor(ctx, rest) {
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
    return { code: 0 };
  }
  return { found, record: read.record };
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
    ctx.start(process.execPath, [join(ctx.settings.checkout, "tool", "edit.js"), "bring", "--now", found.name]);
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
  // The first open on this Mac makes its folder for the episode, in BRIMM Video Work, and says how to keep the episode here.
  const work = episodeWork(ctx.home, found.name);
  if (!existsSync(work)) {
    mkdirSync(work, { recursive: true });
    say(`So that Dropbox keeps this episode on this Mac, Control-click its folder in Finder and choose Make available offline: ${found.folder}`);
  }
  say('Say "show it in Final Cut" to see the main video there.');
  return 0;
}

/** Open a file in an app on this Mac, as a double-click would: Final Cut Pro, here, and a timeline handed to it. */
function openApp(app, file) {
  spawnSync("/usr/bin/open", ["-a", app, file], { stdio: "ignore" });
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
    - the new version's project is named by projectName, and is in an event of its own of that name, since phase 0 has not
      yet settled whether Final Cut asks "replace or keep both" of a second push;
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
  const gone = undone(record, ctx.home);
  if (gone) {
    say(gone);
    return 1;
  }
  const problems = filesProblems(found.folder, record);
  if (problems.length) {
    say(`${found.name} is not whole in Dropbox:`);
    for (const problem of problems) say(`  ${problem}`);
    return 1;
  }
  const pushed = Array.isArray(target.pushed) ? target.pushed : [];
  const last = pushed.reduce((most, p) => Math.max(most, p.v), 0);
  if (last && !noHandEdits) {
    say(handEdits
      ? `Your changes stay in v${last} in Final Cut. This version of brimm-video cannot build on them yet. Until it can: ask for brimm-video's changes first and make trims by hand last, or finish that timeline by hand in v${last}.`
      : `Did you change v${last} of ${record.name.text} in Final Cut since it was shown? Say "no changes" to show it again. If you did change it, say so.`);
    return 1;
  }
  const v = last + 1;
  const project = projectName({ name: record.name.text, part, v, id: record.id });
  const file = timelineFile({ part, v, machine: ctx.machine });
  const kept = join(found.folder, file);
  const stored = retitle(xml, { event: project, project });
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
    const first = !(record.libraries && record.libraries[ctx.machine]);
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
    if (first) say("Once, for this library: in Final Cut, choose File > Library Properties, click Modify Settings beside Storage Locations, and set Backups to BRIMM Video Work/Backups.");
    return 0;
  } catch (e) {
    say(`It could not be shown in Final Cut: ${String(e.message).replace(/\.$/, "")}.`);
    return 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** `push "<episode>" [main] [--no-hand-edits | --hand-edits]`: show the main timeline in Final Cut Pro as a new version
    (pushPart). In phase 1a the main timeline is the import's own, edit/main.v0.fcpxml. A Reel is pushed from phase 2. */
export async function push(ctx, rest) {
  const flags = new Set(rest.filter((word) => word.startsWith("--")));
  const words = rest.filter((word) => !word.startsWith("--"));
  if (words.length >= 2 && words[words.length - 2] === "reel" && /^\d+$/.test(words[words.length - 1])) {
    ctx.say("Reels are pushed from a later version.");
    return 1;
  }
  if (words[words.length - 1] === "main") words.pop();
  const got = episodeFor(ctx, words);
  if (!got.found) return got.code;
  const { found, record } = got;
  const source = join(found.folder, timelineFile({ part: "main", v: 0 }));
  if (!ctx.isWhole(source)) {
    ctx.say(`Dropbox is still bringing edit/main.v0.fcpxml over to this Mac. Say "open ${record.name.text}" first.`);
    return 1;
  }
  return pushPart(ctx, { ...found, record }, { part: "main", xml: readFileSync(source, "utf8"), noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits") });
}

/** The commands, by the word a person's request is run with. */
const COMMANDS = { episodes: (ctx) => episodes(ctx), open, push };

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

