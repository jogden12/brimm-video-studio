// The `reelkit` command of edit.js (spec 2026-11-23 Reel Kit in Studio; plan Task 6 and the tasks after it). edit.js has only its entry in
// COMMANDS and its lines in HELP; its body is here, and this file never imports edit.js. Today it has:
//
//   reelkit install "<download>" [--yes]   a Reel Kit download she dragged into her chat. Without --yes it says, step by step, what setting it
//                                          up would do (reel-kit-install.js installPlan), then that nothing is installed until Jason says yes,
//                                          and writes nothing. With --yes (Jason's yes, in chat) it starts the install detached and returns.
//   reelkit status                         how that install is going: at work and at which step, done with what it did, or why it stopped.
//   reelkit --now install "<download>"     the detached half (in no help): it holds a lock of its own for the whole Mac, so two installs never
//                                          run at once, reads the download again, plans it again and runs it (runInstall), and leaves its
//                                          result for `reelkit status`. Only Studio starts it: under Claude Code it is refused.
//
// And her edits (plan Task 11), each naming an episode, so each goes through the gate (gate.js namesNoEpisode: only `install`, `status`
// alone and `style` name none) and is refused for every record it holds and every session, cleared or not:
//
//   reelkit start "<episode>" main|reel <n> [reel <n> …] --mode <mode>
//                                          an edit of each part, after startWhy for every one (the mode is always asked when missing, and
//                                          nothing starts): one detached job per part, each put in the queue record (the worker's enqueue)
//                                          before this returns, with the pid of the run it started, so that a second ask is refused while
//                                          the first waits. The project is made inside the queued job (scaffold, under the Mac's worker
//                                          lock), and the record's entry (entryOf) is written there, once it is made.
//   reelkit status "<episode>"             each edit's state, its step and the worker's guess of the time left, and Reel Kit's NEEDS in its
//                                          own words, with the edit's from-you/ folder opened in Finder for them.
//   reelkit note "<episode>" <slug> <beat> "<text>"
//                                          her note on a beat (p<digits>) or on all of it, as she said it, at most 4,000 characters, added to
//                                          Reel Kit's own <project>/storyboard/notes.json as { beat, text, at }, written whole.
//   reelkit go "<episode>" <slug>          her approval of the storyboard: the note { beat: "all", text: "go" }, `approved` in studio.json,
//                                          and `finalize` started. Nothing else starts finalize.
//   reelkit revise "<episode>" <slug>      `revise` started with her notes since the last version.
//   reelkit resume "<episode>" <slug>      a stopped job started again from its step.
//   reelkit storyboard "<episode>" <slug> [local]
//                                          (plan Task 12) the edit's newest storyboard staged in her folder (storyboard-opening.js stagePage), and
//                                          for her chat the exact publish to make, to the URL recorded for it once it has one; with `local`,
//                                          Reel Kit's own page (KIT/storyboard/serve.py) on 127.0.0.1:8765, one at a time, opened in her browser.
//                                          The URL the first publish gives is recorded by the hook after it (studio/published.sh), from the
//                                          tool's own result, never from her chat's words.
//   reelkit style show|change "<what she asked>"|yes|back ["<copy>"]|diff|carry [yes]|resume
//                                          (plan Task 13) her style pack, shown, changed by the worker's style job on a working copy, kept on
//                                          her yes, gone back to, compared and carried onto a new starting style: reel-kit-style-chat.js, with
//                                          its detached half `reelkit --now style change|resume <stamp>`. It names no episode (gate.js).
//   reelkit render "<episode>" <slug>      the render of an edit finalize left ready (plan Task 14): reel-kit-render.js renderWhy first (one
//                                          changed in HyperFrames since is hers to export from the app), then detached, marked `rendering`
//                                          with the pid of the run it started before her chat is answered.
//   reelkit app "<episode>" <slug>         (plan Task 17, with Task 18's version line) an edit finalize left ready, or rendered, opened in the
//                                          HyperFrames app on its public/ (app.js openOnly), after the look over the project for Studio's own
//                                          names (the worker's sweepProject: a find opens nothing), with BRIMM's notes for the app's agent
//                                          written there (reel-kit-project.js reelKitNotes) and noted as Studio's (noteOwnFile). Once it
//                                          opened: Studio's mark that it did (the worker's markOpened), the record's entry `opened`, and the
//                                          app's version in studio.json, with one line when it changed since the last one seen (app-version.js).
//                                          From then on the worker never runs it again: further Reel Kit changes are a new version, by `start`;
//                                          `revise` is refused for it, and for any edit changed since finalize, in the render's own line.
//   reelkit --now <folder> start|revise|finalize|resume|render …
//                                          the detached half of each (in no help), which runs the worker's runJob, or the render's
//                                          renderReelKit under the same Mac-wide worker lock. Refused under Claude Code.
//
// Which Mac is which (plan Decision 10): an installed Mac takes only the Reel Kit Studio pins (PIN.fingerprint). A dev Mac (the Mac Studio)
// takes any well-formed download; one of another version than PIN.version is installed beside the one in use, from a pin made from its
// download (newPinOf), which is written to `<work folder>/.toolchain/reel-kit-<version>.pin.json` for Jason's pull request. The version in
// use stays PIN.version until that pin is merged.
//
// Everything she reads is in her words: never a path or a command for her to type. A test gives stand-ins through ctx.deps.reelKit: `pin`
// (the pin of the version in use), `unzip` (readDrop's), `programs`, `fetch`, `run` and `keepAwake`; and for a render, `render` (in place
// of renderReelKit) or renderReelKit's own `sandboxExec` and `trash`.
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { KEPT, NOT_SET_UP as APP_NOT_SET_UP, byReelKit, openOnly } from "./app.js";
import { appVersionLine, noteAppVersion, readAppVersion } from "./app-version.js";
import { localStamp } from "./episode.js";
import { PIN as HF_PIN, cliPath } from "./hyperframes.js";
import { kitDir, reelKitEnv, venvPython } from "./reel-kit.js";
import { studioFolder } from "./studio.js";
import { pageOf, publishInput, stagePage } from "./storyboard-opening.js";
import { styleCommand, styleNow } from "./reel-kit-style-chat.js";
import { MODES, appWhy, changedInApp, entryOf, modeLeans, modeOf as modeNamed, projectFolderOf, readCapped, readState, reelKitNotes, scaffold, slugOf, startWhy, writeState } from "./reel-kit-project.js";
import { JOBS, dequeue, enqueue, markOpened, noteOwnFile, processStart, queuedOf, runJob, statusOf, stoppedLine, sweepProject, wasOpened } from "./reel-kit-worker.js";
import { RENDER_SAY, renderReelKit, renderWhy, renderingBy } from "./reel-kit-render.js";
import { writeWhole as writeFileWhole } from "./reel-kit-worker-own.js";
import { appOf, episodeWork, exportsWords } from "./settings.js";
import { PIN, pinFrom } from "./reel-kit.js";
import { readDrop } from "./reel-kit-drop.js";
import { installPlan, runInstall, takeAwayScratch } from "./reel-kit-install.js";
import { isInstalled } from "./build.js";
import { workFolder } from "./settings.js";
import { releaseEpisodeLock, runningRun, startDetached, takeEpisodeLock } from "./detached.js";
import { caffeinate } from "./filing.js";
import { findPrograms } from "./unedited.js";

/** A version as it is said after "Reel Kit": with its space, or nothing when it isn't known. */
const v = (version) => (version ? ` ${version}` : "");

/** What `reelkit install` and `reelkit status` say, in her words. */
export const INSTALL_SAY = Object.freeze({
  notYet: "Nothing is installed until Jason says yes.",
  notWhole: "I can't tell where that download is on this Mac. Drag it into this chat again.",
  started: (version) => `Started: Reel Kit${v(version)} is being set up on this Mac. Say "how is the Reel Kit setup going?" to follow it.`,
  already: `Reel Kit is being set up on this Mac already. Say "how is the Reel Kit setup going?" to follow it.`,
  atWork: (version, step) => `Reel Kit${v(version)} is being set up on this Mac${step ? `: ${step}, now` : ""}.`,
  starting: (version) => `Reel Kit${v(version)} is starting to be set up on this Mac.`,
  died: (version) => `Setting up Reel Kit${v(version)} stopped before it was done. Drag the download into this chat again.`,
  done: (version) => `Reel Kit${v(version)} is set up on this Mac.`,
  failed: (version) => `Reel Kit${v(version)} wasn't set up.`,
  leftOver: "A few of the old Reel Kit's files couldn't be tidied away: the next setup does it.",
  none: "Reel Kit hasn't been set up from a download on this Mac.",
  beside: (version, inUse) => `Reel Kit ${version} is installed beside ${inUse}. It is used once its pin is merged and its checks pass.`,
});

/** How long a start may wait for its detached half to take the lock before `status` says it stopped. */
const STARTING_MS = 60000;
/** The command the install's lock and result name. */
const INSTALL = "reelkit install";

/** The lock an install holds while it runs: one for the whole Mac, beside the settings in Application Support. */
export const installLockFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "reel-kit-install.lock");
/** The result an install leaves, which `reelkit status` reads. */
export const installResultFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "reel-kit-install.result.json");
/** Where a dev Mac writes the pin of a version it installed beside the one in use, for Jason's pull request. */
export const newPinFile = (home, version) => join(workFolder(home), ".toolchain", `reel-kit-${version}.pin.json`);

/** The pin of a download of another version than the one in use (`pin`), as a dev Mac installs it beside it: the download's version,
    fingerprint and licence name, the files Studio relies on (readDrop checked them), and every other key the pin in use's. Its HyperFrames
    is the pin in use's: npm's integrity for another version is not known here, so a download that renders with another HyperFrames is
    refused by installPlan in one line, and its pin is made by hand. So is one with another GSAP. Throws when what it makes is no pin. */
export function newPinOf(drop, pin = PIN) {
  const made = { ...JSON.parse(JSON.stringify(pin)), version: drop.version, fingerprint: drop.fingerprint, required: [...pin.required], license: basename(drop.license || pin.license) };
  return JSON.parse(JSON.stringify(pinFrom(JSON.stringify(made))));
}

/** Write a file whole: under a name of this run's own, then renamed. */
function writeWhole(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const writing = `${file}.${process.pid}.writing`;
  writeFileSync(writing, text);
  renameSync(writing, file);
}

/** The install's result, or null when there is none or it can't be read. */
function readInstallResult(home) {
  try {
    const result = JSON.parse(readFileSync(installResultFile(home), "utf8"));
    return result && typeof result === "object" && !Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

const writeInstallResult = (home, result) => writeWhole(installResultFile(home), JSON.stringify(result, null, 2) + "\n");

/** The live run that holds the install's lock, or null. */
const installRunning = (ctx) => runningRun(ctx.home, "", ctx.alive, installLockFile(ctx.home));

/** What a test gives in place of this Mac's own. */
const kitOf = (ctx) => ctx.deps?.reelKit ?? {};
/** Which kind of Mac this is, for installPlan. */
const modeOf = (ctx) => (isInstalled(ctx.build) ? "installed" : "dev");

/** The programs an install runs, by absolute path: Studio's node (the one running this), npm beside it, ffmpeg and ffprobe as Studio
    finds them (unedited.js findPrograms), and macOS's own curl, sh, tar and ditto. */
function programsOf(ctx) {
  const given = kitOf(ctx).programs;
  if (given) return given;
  const found = findPrograms();
  return { node: process.execPath, npm: join(dirname(process.execPath), "npm"), ffmpeg: found.ffmpeg, ffprobe: found.ffprobe, curl: "/usr/bin/curl", sh: "/bin/sh", tar: "/usr/bin/tar", unzip: "/usr/bin/ditto" };
}

/** The download at `path` and its plan: { drop, plan }. A download that can't be read is a plan refused in its own words. */
function planFor(ctx, path) {
  const kit = kitOf(ctx);
  const pin = kit.pin ?? PIN;
  const mode = modeOf(ctx);
  let drop;
  try {
    drop = readDrop(path, { home: ctx.home, ...(kit.unzip ? { unzip: kit.unzip } : {}) });
  } catch {
    drop = { ok: false, why: "That download couldn't be read. Drag it into this chat again." };
  }
  let next;
  if (mode === "dev" && drop.ok && drop.version !== pin.version) {
    try {
      next = newPinOf(drop, pin);
    } catch {
      next = undefined;
    }
  }
  return { drop, plan: installPlan({ home: ctx.home, drop, pin, next, mode }), pin };
}

/** `reelkit install "<download>" [--yes]`: what setting the download up would do, or, with --yes, its install started detached. */
export async function installCommand(ctx, words, help) {
  const yes = words.includes("--yes");
  const paths = words.filter((word) => word !== "--yes");
  if (paths.length !== 1 || paths[0] === "" || paths[0].startsWith("--") || words.filter((word) => word === "--yes").length > 1) {
    ctx.say(help);
    return 2;
  }
  const [path] = paths;
  if (!isAbsolute(path)) {
    ctx.say(INSTALL_SAY.notWhole);
    return 1;
  }
  const { drop, plan } = planFor(ctx, path);
  // readDrop leaves what a zip was unpacked into for its caller: the detached half reads the download again.
  takeAwayScratch(ctx.home, drop);
  if (plan.refused) {
    ctx.say(plan.refused);
    return 1;
  }
  if (!yes) {
    for (const step of plan.steps) ctx.say(step.words);
    ctx.say(INSTALL_SAY.notYet);
    return 0;
  }
  if (installRunning(ctx)) {
    ctx.say(INSTALL_SAY.already);
    return 1;
  }
  writeInstallResult(ctx.home, { version: 1, command: INSTALL, state: "starting", kit: drop.version, started: ctx.now() });
  startDetached(ctx, { command: "reelkit", folder: "install", args: [path] });
  ctx.say(INSTALL_SAY.started(drop.version));
  return 0;
}

/** `reelkit --now install "<download>"`, the detached half `reelkit install … --yes` starts: under the install's lock it reads and plans the
    download again, runs the install, and on a dev Mac writes the pin of a version installed beside the one in use. Its result is left for
    `reelkit status`; what it says goes into the log. Resolves 0 when it is installed, 1 when it is not. */
export async function installNow(ctx, words, help) {
  const env = ctx.deps?.env || process.env;
  if (env.CLAUDECODE === "1" || words.length !== 1 || !isAbsolute(words[0])) {
    ctx.say(help);
    return 2;
  }
  const [path] = words;
  const lock = installLockFile(ctx.home);
  mkdirSync(dirname(lock), { recursive: true });
  const took = takeEpisodeLock(lock, INSTALL, ctx.alive);
  if (!took.taken) {
    ctx.say(INSTALL_SAY.already);
    return 1;
  }
  const kit = kitOf(ctx);
  const started = ctx.now();
  try {
    (kit.keepAwake ?? ctx.deps?.keepAwake ?? caffeinate)(process.pid);
    const { drop, plan, pin } = planFor(ctx, path);
    const version = drop.version ?? "";
    const base = { version: 1, command: INSTALL, kit: version, started, pid: process.pid };
    if (plan.refused) {
      takeAwayScratch(ctx.home, drop);
      writeInstallResult(ctx.home, { ...base, state: "failed", ended: ctx.now(), lines: [plan.refused], credit: "", leftOver: [] });
      ctx.say(plan.refused);
      return 1;
    }
    writeInstallResult(ctx.home, { ...base, state: "at work", step: "" });
    const progress = ({ words: step, state }) => {
      if (state !== "running") return;
      try {
        writeInstallResult(ctx.home, { ...base, state: "at work", step });
      } catch {
        // The step is said from the lock alone, then.
      }
    };
    let done;
    try {
      done = await runInstall({ home: ctx.home, drop, plan, programs: programsOf(ctx), ...(kit.fetch ? { fetch: kit.fetch } : {}), ...(kit.run ? { run: kit.run } : {}), progress });
    } catch (e) {
      done = { ok: false, lines: [`Setting up Reel Kit stopped (${e?.code || "an error"}).`], credit: "", leftOver: [] };
    }
    const lines = [...done.lines];
    if (done.ok && plan.beside) {
      writeWhole(newPinFile(ctx.home, version), JSON.stringify(plan.pin, null, 2) + "\n");
      lines.push(INSTALL_SAY.beside(version, pin.version));
    }
    writeInstallResult(ctx.home, { ...base, state: done.ok ? "done" : "failed", ended: ctx.now(), lines, credit: done.credit || "", creditShown: false, leftOver: done.leftOver ?? [] });
    for (const line of lines) ctx.say(line);
    return done.ok ? 0 : 1;
  } finally {
    releaseEpisodeLock(lock, took.text);
  }
}

/** `reelkit status`: the install's state. At work (and at which step), starting, done with its lines (and Reel Kit's credit line, the
    first time it is said), failed with why, or none. Writes nothing but that the credit line was said. */
export async function statusCommand(ctx) {
  const result = readInstallResult(ctx.home);
  const version = typeof result?.kit === "string" ? result.kit : "";
  if (installRunning(ctx)) {
    ctx.say(INSTALL_SAY.atWork(version, result?.state === "at work" && typeof result.step === "string" ? result.step : ""));
    return 0;
  }
  if (!result) {
    ctx.say(INSTALL_SAY.none);
    return 0;
  }
  const lines = Array.isArray(result.lines) ? result.lines.filter((line) => typeof line === "string") : [];
  if (result.state === "starting") {
    ctx.say(Number.isFinite(result.started) && ctx.now() - result.started < STARTING_MS ? INSTALL_SAY.starting(version) : INSTALL_SAY.died(version));
    return 0;
  }
  if (result.state === "done") {
    ctx.say(INSTALL_SAY.done(version));
    for (const line of lines) ctx.say(line);
    if (Array.isArray(result.leftOver) && result.leftOver.length) ctx.say(INSTALL_SAY.leftOver);
    if (typeof result.credit === "string" && result.credit !== "" && !result.creditShown) {
      ctx.say(result.credit);
      try {
        writeInstallResult(ctx.home, { ...result, creditShown: true });
      } catch {
        // Said again next time, then.
      }
    }
    return 0;
  }
  if (result.state === "failed") {
    ctx.say(INSTALL_SAY.failed(version));
    for (const line of lines) ctx.say(line);
    return 0;
  }
  // At work with no live run holding the lock: it died on the way.
  ctx.say(INSTALL_SAY.died(version));
  return 0;
}

// --- Her edits (plan Task 11) ---

/** A part as a sentence starts with it, by its key. */
const partSaid = (key) => (key === "main" ? "The main video" : `Reel ${key.slice(5)}`);
/** Each mode as she says it. */
const MODE_SAID = Object.freeze({ hifi: "hi-fi", lofi: "lo-fi", showcase: "showcase" });
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
/** A list as a sentence says it: "a, b and c". */
const listed = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
/** How an edit is named in what she reads: its part, its mode and its version. */
const editSaid = (key, mode, version) => `${partSaid(key)} (${MODE_SAID[mode] ?? "Reel Kit"}${Number.isInteger(version) ? `, version ${version}` : ""})`;
/** The phrase she says to follow her edits. */
const FOLLOW = `Say "how are the Reel Kit edits going?" to follow them.`;

/** What her edit words say, in her words: never a path, a flag or the name of a command. */
export const EDIT_SAY = Object.freeze({
  notSetUp: "Reel Kit isn't set up on this Mac yet: ask Jason.",
  queued: (key, mode) => `${partSaid(key)} is in the queue for a ${MODE_SAID[mode]} Reel Kit edit.`,
  steps: `This Mac makes one Reel Kit edit at a time. Each goes through ${listed(JOBS.edit)}, then waits for you at its storyboard.`,
  leans: (lean, mode) => (lean === mode ? `${capital(MODE_SAID[lean])} suits this kind of video.` : `This kind of video leans to ${MODE_SAID[lean]}; this is ${MODE_SAID[mode]}, as you said.`),
  follow: FOLLOW,
  none: "This video has no Reel Kit edits yet.",
  waiting: "waiting for its turn.",
  working: (step, left) => `being made, at ${step || "its start"}${left ? `: about ${left} minute${left === 1 ? "" : "s"} left, by Reel Kit's own guess` : ""}.`,
  storyboard: "its storyboard is made.",
  pageGo: `its storyboard is made, and you said go on its page: say "go" to have it built.`,
  ready: "it is built and ready to render.",
  failed: "it couldn't be made: ask Jason.",
  unread: "what it is at can't be read: ask Jason.",
  notHere: "its project isn't on this Mac.",
  didNotStart: (why) => `its Reel Kit edit didn't start. ${why}`,
  dropIt: "Drop it in the folder that just opened.",
  noFolder: "The folder for it couldn't be opened: ask Jason.",
  noSuchEdit: "This video has no such Reel Kit edit.",
  beat: "A note goes on one beat of the storyboard, or on all of it.",
  empty: "That note is empty: say it again.",
  tooLong: "A note can be at most 4,000 characters: say it in two.",
  notesUnread: "Its notes can't be read, so nothing was added: ask Jason.",
  noted: (beat) => (beat === "all" ? "Noted, for the whole video." : `Noted, on beat ${beat}.`),
  afterNote: `When your notes are all in, say "make the changes", or "go" when it's right.`,
  busy: "It is being made right now: say it again once it waits for you.",
  noStoryboard: "It has no storyboard waiting for you.",
  noNotes: "It has no new notes to make changes from: say what to change first.",
  notStopped: "It hasn't stopped, so there is nothing to carry on.",
  approved: (said) => `Approved: ${said} is being built to render. ${FOLLOW}`,
  revising: (said, n) => `${said} is in the queue for its changes, from ${n} note${n === 1 ? "" : "s"}. ${FOLLOW}`,
  resuming: (said) => `${said} is in the queue to carry on. ${FOLLOW}`,
  notWritten: "The record of this edit couldn't be written: ask Jason.",
  noRun: (key) => `${partSaid(key)} couldn't be started on this Mac: say it again, or ask Jason.`,
  noQueue: (key) => `${partSaid(key)} couldn't be put in the queue on this Mac, so it wasn't started: say it again, or ask Jason.`,
  goNote: `Only your go approves it: say "go" when it's right.`,
  rendering: (said) => `${said} is in the queue to render on this Mac. Say "how are the Reel Kit edits going?" to follow it.`,
  renderBusy: `It is in the queue to render already. Say "how are the Reel Kit edits going?" to follow it.`,
  renderNoRun: "Its render couldn't be started on this Mac: say it again, or ask Jason.",
  renderingNow: "it is being rendered, or waiting for its turn to render.",
  rendered: "it is rendered.",
  renderFailed: "it is built, but its last render didn't pass Reel Kit's own checks, so nothing was kept as an export: ask Jason.",
  renderBroke: "it is built, but its last render didn't finish, so nothing was kept as an export: ask Jason.",
  renderUnrecorded: "it is built, and its last render finished, but its record couldn't be written, so nothing was kept as an export: ask Jason.",
  renderOdd: "it is built, but its last render didn't come out as Reel Kit makes one, so nothing was kept as an export: ask Jason.",
  appNotBuilt: `It isn't built yet, so it can't open in HyperFrames: say "go" when its storyboard is right.`,
  appNoCommandLine: "HyperFrames' command line isn't on this Mac yet: ask Jason.",
  appOdd: "Its project isn't as Reel Kit left it, so it wasn't opened in HyperFrames: ask Jason.",
  appFound: "Something in its project wasn't Reel Kit's or Studio's, so it was set aside and nothing was opened: ask Jason.",
  appNotes: "Its notes for HyperFrames couldn't be written, so it wasn't opened: ask Jason.",
  openedNoChange: (name) => `${name} was opened in HyperFrames, so Reel Kit won't change it: further Reel Kit changes go into a new edit of the same part, and this one stays as it is.`
});

/** The most of a note she may say: Reel Kit's own storyboard page (serve.py) takes no more. */
export const NOTE_MOST = 4000;
/** The most of storyboard/notes.json read. */
const NOTES_FILE_MOST = 4 << 20;
/** A beat her note goes on: one beat of the storyboard (p and its number), or all of it. */
const BEAT = /^(?:p\d{1,4}|all)$/;

/** Reel Kit's own notes file in a project: [{ beat, text, at }]. */
export const notesFile = (dir) => join(dir, "storyboard", "notes.json");

/** Her notes in the project `dir`: the list in its notes file ([] when there is none), or null when what is there can't be read whole as
    a list (not a plain file of its size, not JSON, not a list). Notes are data: each is kept as it is. */
export function readNotes(dir) {
  try {
    lstatSync(notesFile(dir));
  } catch (e) {
    return e.code === "ENOENT" ? [] : null;
  }
  const text = readCapped(notesFile(dir), NOTES_FILE_MOST);
  if (text === null) return null;
  try {
    const notes = JSON.parse(text);
    return Array.isArray(notes) ? notes : null;
  } catch {
    return null;
  }
}

/** Add `note` to the project's notes file, whole (a file of its own beside it, then renamed over it), into storyboard/ only when that is a
    folder of the project's own and not a link. "" or the line she reads. */
function addNote(dir, note) {
  const notes = readNotes(dir);
  if (notes === null) return EDIT_SAY.notesUnread;
  const folder = join(dir, "storyboard");
  try {
    try {
      if (!lstatSync(folder).isDirectory()) return EDIT_SAY.notesUnread;
    } catch (e) {
      if (e.code !== "ENOENT") return EDIT_SAY.notesUnread;
      mkdirSync(folder);
    }
    writeFileWhole(notesFile(dir), `${JSON.stringify([...notes, note], null, 2)}\n`);
  } catch {
    return EDIT_SAY.notesUnread;
  }
  return "";
}

/** Whether a note is one of hers on the storyboard, as the worker is given it: { beat, text, at }, each a string, and not her go. */
const isChange = (n) => n !== null && typeof n === "object" && typeof n.beat === "string" && typeof n.text === "string" && (n.at === undefined || typeof n.at === "string") && !(n.beat === "all" && n.text === "go");

/** Whether her notes since the storyboard's last version hold her go: the note Reel Kit's local page writes for "Looks good: render it", the
    same `reelkit go` writes. It approves nothing by itself: only `reelkit go` starts the build. */
function wentAhead(dir) {
  const notes = readNotes(dir);
  if (notes === null) return false;
  const used = readState(dir)?.notesUsed;
  return notes.slice(Number.isInteger(used) && used >= 0 ? used : 0).some((n) => n !== null && typeof n === "object" && n.beat === "all" && n.text === "go");
}

/** The record's Reel Kit edits, each { entry, key, mode, version, slug, dir }: its entry, its slug (slugOf, from the record) and its folder on
    this Mac (null when its name can't make one). Kept for an earlier kind, an edit is none. */
function editsOf(ctx, found, record) {
  const projects = Array.isArray(record.app?.projects) ? record.app.projects : [];
  return projects.filter((p) => byReelKit(p) && p.state !== KEPT).map((entry) => {
    let slug = "";
    let dir = null;
    try {
      slug = slugOf(record, entry.key, entry.version);
    } catch {
      slug = "";
    }
    try {
      dir = projectFolderOf(ctx.home, found.name, entry.name);
    } catch {
      dir = null;
    }
    return { entry, key: entry.key, mode: entry.mode, version: entry.version, slug, dir };
  });
}

/** Where an edit is: the worker's statusOf of its folder, or null. */
const statusFor = (ctx, dir) => (dir === null ? null : statusOf(dir, ctx.alive, kitOf(ctx).startOf ?? processStart));
/** Whether an edit is queued or at work. */
const isBusy = (status) => status !== null && (status.state === "queued" || status.state === "working");

/** What a start whose project was never made leaves for `status`: <episode work>/reel-kit-<part>.start.json, { key, why, at }. */
const startResultFile = (home, folder, key) => join(episodeWork(home, folder), `reel-kit-${key.replace(" ", "-")}.start.json`);
function startResults(home, folder, record) {
  const keys = ["main", ...(Array.isArray(record.reels) ? record.reels : []).filter((r) => Number.isInteger(r?.n)).map((r) => `reel ${r.n}`)];
  return keys.map((key) => {
    try {
      const result = JSON.parse(readCapped(startResultFile(home, folder, key), 64 * 1024) ?? "null");
      return result && result.key === key && typeof result.why === "string" ? result : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}
const clearStart = (home, folder, key) => rmSync(startResultFile(home, folder, key), { force: true });

/** The words a start names its parts by: "main", or "reel" and a number, as keys ("main", "reel 2"), each once; null for any other word. */
function keysOf(words) {
  const keys = [];
  for (let i = 0; i < words.length; i++) {
    let key;
    if (words[i] === "main") key = "main";
    else if (words[i] === "reel" && /^[1-9]\d*$/.test(words[i + 1] ?? "")) key = `reel ${words[++i]}`;
    else return null;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** The words of `start` after its episode: its parts and its mode word (`--mode <word>`, which may be left out: it is asked). */
function startWords(words) {
  const at = words.indexOf("--mode");
  const mode = at < 0 ? undefined : words[at + 1];
  if (at >= 0 && (mode === undefined || words.indexOf("--mode", at + 1) >= 0)) return null;
  const keys = keysOf(at < 0 ? words : [...words.slice(0, at), ...words.slice(at + 2)]);
  return keys && keys.length ? { keys, mode } : null;
}

/** Whether Reel Kit's kit and its Python are on this Mac. */
function kitHere(home) {
  try {
    return lstatSync(join(kitDir(home), "pipeline", "new.py")).isFile() && lstatSync(venvPython(home)).isFile();
  } catch {
    return false;
  }
}

/** Start the detached half `reelkit --now <folder> <args…>`: the pid of the run it started, or undefined. */
const startJob = (ctx, found, args) => startDetached(ctx, { command: "reelkit", folder: found.name, args });

/** Mark the project `dir` queued for `job` by the run `pid` her chat just started, before her chat is answered, so that a second ask is
    refused while it waits: the run takes the mark for its own (runJob). A pid that is not one marks nothing. */
function markQueued(ctx, dir, job, pid, step) {
  if (!Number.isInteger(pid)) return;
  try {
    const state = readState(dir) ?? {};
    writeState(dir, { ...state, state: "queued", job, step: step ?? state.step, pid, why: "", queuedAt: new Date(ctx.now()).toISOString() });
  } catch {
    // The run marks it itself as it starts.
  }
}

/** `reelkit start "<episode>" main|reel <n> [reel <n> …] --mode <mode>`. */
async function startCommand(ctx, words, h) {
  const asked = words.length > 1 && !words[0].startsWith("--") ? startWords(words.slice(1)) : null;
  if (!asked) {
    ctx.say(h.help);
    return 2;
  }
  const got = h.episodeFor(ctx, [words[0]], { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = got;
  const mode = modeNamed(asked.mode);
  const title = typeof record.name?.text === "string" ? record.name.text : "";
  const whys = asked.keys.map((key) => startWhy({ record, key, mode, title, home: ctx.home, folder: found.name, held: Boolean(found.held), alive: ctx.alive, startOf: kitOf(ctx).startOf ?? processStart }));
  const refused = [...new Set(whys.filter(Boolean))];
  if (refused.length) {
    for (const why of refused) ctx.say(why);
    return 1;
  }
  if (!kitHere(ctx.home)) {
    ctx.say(EDIT_SAY.notSetUp);
    return 1;
  }
  // Each part is put in the queue before its run is started (under this run's pid, then the run's own), so that a queue that can't be
  // changed starts nothing, and a run that could not be started is taken out of it again.
  let started = 0;
  for (const key of asked.keys) {
    clearStart(ctx.home, found.name, key);
    const id = randomUUID();
    const entry = { id, episode: record.id, key, version: null, mode, job: "edit", at: new Date(ctx.now()).toISOString(), pid: process.pid };
    try {
      enqueue(ctx.home, entry, ctx.alive);
    } catch {
      ctx.say(EDIT_SAY.noQueue(key));
      continue;
    }
    const pid = startJob(ctx, found, ["start", key, mode, id]);
    if (!Number.isInteger(pid)) {
      try {
        dequeue(ctx.home, id, ctx.alive);
      } catch {
        // Its entry goes with this run, which is not running for long.
      }
      ctx.say(EDIT_SAY.noRun(key));
      continue;
    }
    try {
      enqueue(ctx.home, { ...entry, pid }, ctx.alive);
    } catch {
      // The run takes the entry for its own as it starts (runJob, by its id); until then this run's pid holds it.
    }
    started++;
    ctx.say(EDIT_SAY.queued(key, mode));
  }
  if (!started) return 1;
  const lean = modeLeans(record);
  if (lean) ctx.say(EDIT_SAY.leans(lean, mode));
  ctx.say(EDIT_SAY.steps);
  ctx.say(EDIT_SAY.follow);
  return 0;
}

/** Open an edit's from-you/ folder in Finder, made first when it is not there: whether it opened. Only a folder of the project's own, never
    through a link. */
function openFromYou(ctx, dir) {
  const folder = join(dir, "from-you");
  try {
    if (!lstatSync(dir).isDirectory()) return false;
    try {
      if (!lstatSync(folder).isDirectory()) return false;
    } catch (e) {
      if (e.code !== "ENOENT") return false;
      mkdirSync(folder);
    }
    ctx.openApp("Finder", folder);
    return true;
  } catch {
    return false;
  }
}

/** Whether the edit whose studio.json says `state` is marked rendering by a run that still runs (her chat's mark, or the render's own), by
    its pid and, when recorded, its start (reel-kit-render.js renderingBy). */
const renderingNow = (ctx, state) => renderingBy(state, (pid) => Boolean(ctx.alive?.(pid)), kitOf(ctx).startOf ?? processStart);

/** An edit's line in `status`, by where it is: its state, and for a ready one, why a render would refuse it (renderWhy) or its last
    render's outcome (studio.json `state`, in the project `dir`). */
function stateLine(status, state = null, dir = null) {
  if (status === null) return EDIT_SAY.notHere;
  if (status.state === "queued") return EDIT_SAY.waiting;
  if (status.state === "working") return EDIT_SAY.working(status.step, status.minutesLeft);
  if (status.state === "stopped") return stoppedLine(status);
  if (status.state === "storyboard") return status.pageGo ? EDIT_SAY.pageGo : EDIT_SAY.storyboard;
  if (status.state === "ready") {
    const refused = dir === null ? "" : renderWhy(dir, state);
    if (refused) return refused;
    const last = state?.lastRender;
    if (last?.qa === "failed") return EDIT_SAY.renderFailed;
    if (last?.why === "record") return EDIT_SAY.renderUnrecorded;
    if (last?.why === "odd") return EDIT_SAY.renderOdd;
    return last && typeof last.why === "string" && last.why !== "" ? EDIT_SAY.renderBroke : EDIT_SAY.ready;
  }
  if (status.state === "rendered") return EDIT_SAY.rendered;
  if (status.state === "failed") return EDIT_SAY.failed;
  return EDIT_SAY.unread;
}

/** `reelkit status "<episode>"`: each of its edits, those waiting whose project is not made yet first, then each made one, with Reel
    Kit's NEEDS word for word and its from-you/ folder opened for them. Writes nothing but that folder. */
async function editStatus(ctx, words, h) {
  const got = h.episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = got;
  const waiting = queuedOf(ctx.home, record.id, ctx.alive);
  const edits = editsOf(ctx, found, record);
  const unstarted = startResults(ctx.home, found.name, record).filter((r) => !waiting.some((j) => j.key === r.key));
  if (!waiting.length && !edits.length && !unstarted.length) {
    ctx.say(EDIT_SAY.none);
    return 0;
  }
  for (const job of waiting) ctx.say(`${editSaid(job.key, job.mode)}: ${EDIT_SAY.waiting}`);
  for (const result of unstarted) ctx.say(`${partSaid(result.key)}: ${EDIT_SAY.didNotStart(result.why)}`);
  for (const edit of edits) {
    const status = statusFor(ctx, edit.dir);
    const state = edit.dir === null ? null : readState(edit.dir);
    const shown = status && status.state === "storyboard" ? { ...status, pageGo: wentAhead(edit.dir) } : status;
    ctx.say(`${editSaid(edit.key, edit.mode, edit.version)}: ${renderingNow(ctx, state) ? EDIT_SAY.renderingNow : stateLine(shown, state, edit.dir)}`);
    const needs = (status?.needs ?? []).filter((n) => n && typeof n.text === "string" && typeof n.beat === "string");
    if (!needs.length) continue;
    for (const need of needs) ctx.say(`  ${need.beat}: ${need.text}`);
    ctx.say(openFromYou(ctx, edit.dir) ? EDIT_SAY.dropIt : EDIT_SAY.noFolder);
  }
  return 0;
}

/** The episode and the edit `<episode> <slug>` name: { found, record, edit, status }, or { code }, having said why. */
function editFor(ctx, words, h) {
  const got = h.episodeFor(ctx, [words[0]], { newerEnds: 1 });
  if (!got.found) return { code: got.code };
  const edit = editsOf(ctx, got.found, got.record).find((e) => e.slug !== "" && e.slug === words[1]);
  if (!edit) {
    ctx.say(EDIT_SAY.noSuchEdit);
    return { code: 1 };
  }
  return { found: got.found, record: got.record, edit, status: statusFor(ctx, edit.dir) };
}

/** `reelkit note "<episode>" <slug> <beat> "<text>"`: her note, as she said it, added to Reel Kit's notes file. */
async function noteCommand(ctx, words, h) {
  if (words.length !== 4) {
    ctx.say(h.help);
    return 2;
  }
  const [, , beat, text] = words;
  const got = editFor(ctx, words, h);
  if (got.code !== undefined) return got.code;
  if (got.status === null) return refuse(ctx, EDIT_SAY.notHere);
  if (!BEAT.test(beat)) return refuse(ctx, EDIT_SAY.beat);
  if (text.trim() === "") return refuse(ctx, EDIT_SAY.empty);
  if (text.length > NOTE_MOST) return refuse(ctx, EDIT_SAY.tooLong);
  // Only her go approves an edit (goCommand): a note that says only go is not one.
  if (beat === "all" && text.trim().toLowerCase() === "go") return refuse(ctx, EDIT_SAY.goNote);
  const why = addNote(got.edit.dir, { beat, text, at: new Date(ctx.now()).toISOString() });
  if (why) return refuse(ctx, why);
  ctx.say(EDIT_SAY.noted(beat));
  ctx.say(EDIT_SAY.afterNote);
  return 0;
}

const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};

/** What an edit that is not waiting for her says when she asks of it what only a waiting one does. */
const notWaiting = (status) => (status === null ? EDIT_SAY.notHere : isBusy(status) ? EDIT_SAY.busy : status.state === "stopped" ? stoppedLine(status) : status.state === "failed" ? EDIT_SAY.failed : EDIT_SAY.noStoryboard);

/** `reelkit go "<episode>" <slug>`: her approval of the storyboard waiting for her, and `finalize` started. The only way finalize starts. */
async function goCommand(ctx, words, h) {
  if (words.length !== 2) {
    ctx.say(h.help);
    return 2;
  }
  const got = editFor(ctx, words, h);
  if (got.code !== undefined) return got.code;
  const { found, edit, status } = got;
  if (status?.state !== "storyboard") return refuse(ctx, notWaiting(status));
  const at = new Date(ctx.now()).toISOString();
  const why = addNote(edit.dir, { beat: "all", text: "go", at });
  if (why) return refuse(ctx, why);
  try {
    writeState(edit.dir, { ...(readState(edit.dir) ?? {}), approved: { at } });
  } catch {
    return refuse(ctx, EDIT_SAY.notesUnread);
  }
  const pid = startJob(ctx, found, ["finalize", edit.slug]);
  markQueued(ctx, edit.dir, "finalize", pid, JOBS.finalize[0]);
  ctx.say(EDIT_SAY.approved(editSaid(edit.key, edit.mode, edit.version)));
  return 0;
}

/** `reelkit revise "<episode>" <slug>`: `revise` started with her notes since the last version. */
async function reviseCommand(ctx, words, h) {
  if (words.length !== 2) {
    ctx.say(h.help);
    return 2;
  }
  const got = editFor(ctx, words, h);
  if (got.code !== undefined) return got.code;
  const { found, edit, status } = got;
  // Its render is building from this very edit: a revise now would be taken for the render's, or the render's for it.
  if (renderingNow(ctx, readState(edit.dir))) return refuse(ctx, EDIT_SAY.renderBusy);
  if (status?.state !== "storyboard" && status?.state !== "ready") return refuse(ctx, notWaiting(status));
  const kept = keptInApp(ctx, edit);
  if (kept) return refuse(ctx, kept);
  const notes = readNotes(edit.dir);
  if (notes === null) return refuse(ctx, EDIT_SAY.notesUnread);
  const used = readState(edit.dir)?.notesUsed;
  const since = notes.slice(Number.isInteger(used) && used >= 0 ? used : 0).filter(isChange);
  if (!since.length) return refuse(ctx, EDIT_SAY.noNotes);
  const pid = startJob(ctx, found, ["revise", edit.slug]);
  markQueued(ctx, edit.dir, "revise", pid, JOBS.revise[0]);
  ctx.say(EDIT_SAY.revising(editSaid(edit.key, edit.mode, edit.version), since.length));
  return 0;
}

/** Why Reel Kit may no longer change the edit (plan Task 17), in her words, or "": changed since finalize (in the app, or by anything else),
    in the render's own line (RENDER_SAY.changed); or opened in the HyperFrames app by Studio (the worker's wasOpened), which is the
    app's from then on, changed or not. Either way further Reel Kit changes are a new version of the part (`start`). */
function keptInApp(ctx, edit) {
  const state = readState(edit.dir);
  const name = typeof state?.name === "string" && state.name.trim() !== "" ? state.name : "This edit";
  if (changedInApp(edit.dir, state)) return RENDER_SAY.changed(name);
  return edit.slug !== "" && wasOpened(ctx.home, edit.slug) ? EDIT_SAY.openedNoChange(name) : "";
}

/** `reelkit resume "<episode>" <slug>`: a stopped job started again from its step. */
async function resumeCommand(ctx, words, h) {
  if (words.length !== 2) {
    ctx.say(h.help);
    return 2;
  }
  const got = editFor(ctx, words, h);
  if (got.code !== undefined) return got.code;
  const { found, edit, status } = got;
  if (status === null) return refuse(ctx, EDIT_SAY.notHere);
  if (status.state !== "stopped") return refuse(ctx, isBusy(status) ? EDIT_SAY.busy : EDIT_SAY.notStopped);
  const pid = startJob(ctx, found, ["resume", edit.slug]);
  markQueued(ctx, edit.dir, readState(edit.dir)?.job, pid);
  ctx.say(EDIT_SAY.resuming(editSaid(edit.key, edit.mode, edit.version)));
  return 0;
}

// --- Her storyboard in the side panel (plan Task 12) ---

/** What `reelkit storyboard` says: her lines in her words, and the lines for her chat marked FOR_CLAUDE. */
export const STORYBOARD_SAY = Object.freeze({
  first: (said) => `The storyboard of ${said} is ready for the side panel. Leave a note on any beat there, or say "go" when it's right.`,
  again: (said) => `The storyboard of ${said} goes to its same page in the side panel. Leave a note on any beat there, or say "go" when it's right.`,
  notStaged: "The storyboard couldn't be made ready to show: ask Jason.",
  unread: "The list of storyboards on this Mac couldn't be read: ask Jason.",
  local: "Your storyboard is open on this Mac.",
  localHow: `Leave a note on any beat there, and press "Looks good: render it" when it's right.`,
  localFailed: "Your storyboard couldn't be opened on this Mac: ask Jason.",
});
/** How a line for her chat, not for her, starts. */
export const FOR_CLAUDE = "For Claude: ";

/** The line for her chat that says the exact publish of a staged page (storyboard-opening.js publishInput), after reading its file whole. */
const publishLine = (page) => `${FOR_CLAUDE}publish it with the Artifact tool exactly as this gives it, after reading its file_path whole: ${JSON.stringify(publishInput(page))}`;

/** The page's title: the edit's own title, as studio.json keeps it, with ": storyboard" after it. */
const pageTitle = (state) => (typeof state?.title === "string" && state.title.trim() && state.title.length <= 120 ? `${state.title.trim()}: storyboard` : "Reel Kit storyboard");

/** `reelkit storyboard "<episode>" <slug> [local]`: the edit's newest storyboard staged in her folder (storyboard-opening.js stagePage), and,
    for her chat, the exact publish to make (publishInput); or, with `local`, Reel Kit's own local page started. Only for a storyboard that
    waits for her (or an edit built and ready): never while it is being made. */
async function storyboardCommand(ctx, words, h) {
  const local = words.length === 3 && words[2] === "local";
  if (words.length !== 2 && !local) {
    ctx.say(h.help);
    return 2;
  }
  const got = editFor(ctx, words, h);
  if (got.code !== undefined) return got.code;
  const { record, edit, status } = got;
  if (status?.state !== "storyboard" && status?.state !== "ready") return refuse(ctx, notWaiting(status));
  if (local) return localPage(ctx, edit);
  try {
    stagePage(ctx.home, studioFolder(ctx.home), { from: join(edit.dir, "storyboard"), slug: edit.slug, kind: "storyboard", episode: record.id, title: pageTitle(readState(edit.dir)) });
  } catch {
    return refuse(ctx, STORYBOARD_SAY.notStaged);
  }
  const page = pageOf(ctx.home, edit.slug);
  if (!page) return refuse(ctx, STORYBOARD_SAY.unread);
  ctx.say(publishLine(page));
  ctx.say((page.url ? STORYBOARD_SAY.again : STORYBOARD_SAY.first)(editSaid(edit.key, edit.mode, edit.version)));
  return 0;
}

/** The local page's port, address and record: one at a time on this Mac. */
const LOCAL_PORT = 8765;
const LOCAL_URL = `http://127.0.0.1:${LOCAL_PORT}/`;
const localFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "storyboard-local.json");
const localLog = (home) => join(home, "Library", "Application Support", "BRIMM Video", "storyboard-local.log");

/** Start Reel Kit's own local page (KIT/storyboard/serve.py) for the edit, detached, in Reel Kit's environment, on 127.0.0.1:8765 alone
    (serve.py serves no other address), the one running before it stopped first; open it in her browser once it says it is up. Her notes on
    it land in Reel Kit's notes file, as `reelkit note` writes them. Used wherever a publish isn't possible. */
async function localPage(ctx, edit) {
  const kit = kitOf(ctx);
  const python = venvPython(ctx.home);
  const serve = join(kitDir(ctx.home), "storyboard", "serve.py");
  try {
    if (!lstatSync(python).isFile() || !lstatSync(serve).isFile()) return refuse(ctx, EDIT_SAY.notSetUp);
  } catch {
    return refuse(ctx, EDIT_SAY.notSetUp);
  }
  const startOf = kit.startOf ?? processStart;
  stopLocal(ctx, startOf);
  let pid;
  let out;
  try {
    mkdirSync(dirname(localLog(ctx.home)), { recursive: true });
    out = openSync(localLog(ctx.home), "w", 0o600);
    const env = reelKitEnv({ home: ctx.home, node: process.execPath, base: { HOME: ctx.home, LANG: process.env.LANG } });
    const child = spawn(python, ["-I", serve, edit.dir, "--port", String(LOCAL_PORT)], { detached: true, stdio: ["ignore", out, out], env, cwd: "/" });
    child.on("error", () => {});
    child.unref();
    pid = child.pid;
  } catch {
    pid = undefined;
  } finally {
    if (out !== undefined) closeSync(out);
  }
  if (!Number.isInteger(pid)) return refuse(ctx, STORYBOARD_SAY.localFailed);
  try {
    writeWhole(localFile(ctx.home), `${JSON.stringify({ pid, start: startOf(pid), dir: edit.dir, at: new Date(ctx.now()).toISOString() })}\n`);
  } catch {
    // The page runs; a second start can't stop it, and says so no differently.
  }
  const up = `Storyboard: ${LOCAL_URL}`;
  const until = Date.now() + (kit.serveWaitMs ?? 5000);
  while (Date.now() < until) {
    let text = "";
    try {
      text = readCapped(localLog(ctx.home), 1 << 20) ?? "";
    } catch {
      text = "";
    }
    if (text.split("\n").some((line) => line.startsWith(up))) {
      (kit.open ?? ((url) => spawnSync("/usr/bin/open", [url], { encoding: "utf8", timeout: 10000 })))(LOCAL_URL);
      ctx.say(STORYBOARD_SAY.local);
      ctx.say(STORYBOARD_SAY.localHow);
      return 0;
    }
    if (!ctx.alive(pid)) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  stopLocal(ctx, startOf);
  return refuse(ctx, STORYBOARD_SAY.localFailed);
}

/** Stop the local page this Mac started last, when it is surely that process still (its pid and its start): nothing else is ever stopped. */
function stopLocal(ctx, startOf) {
  let left;
  try {
    left = JSON.parse(readCapped(localFile(ctx.home), 64 * 1024) ?? "null");
  } catch {
    left = null;
  }
  if (!left || !Number.isInteger(left.pid) || typeof left.start !== "string") return;
  if (!ctx.alive(left.pid) || startOf(left.pid) !== left.start) return;
  try {
    process.kill(left.pid, "SIGTERM");
  } catch {
    // Gone already.
  }
}

/** `reelkit render "<episode>" <slug>`: the render of an edit finalize left ready, started detached, after renderWhy (an edit changed in
    HyperFrames since is refused in her words: hers to export from the app). Marked `rendering` with the pid of the run it started, before
    her chat is answered, so that a second ask waits; the run takes the mark for its own. */
async function renderCommand(ctx, words, h) {
  if (words.length !== 2) {
    ctx.say(h.help);
    return 2;
  }
  const got = editFor(ctx, words, h);
  if (got.code !== undefined) return got.code;
  const { found, edit, status } = got;
  if (status === null) return refuse(ctx, EDIT_SAY.notHere);
  const state = readState(edit.dir);
  if (renderingNow(ctx, state)) return refuse(ctx, EDIT_SAY.renderBusy);
  if (isBusy(status)) return refuse(ctx, EDIT_SAY.busy);
  if (status.state === "stopped") return refuse(ctx, stoppedLine(status));
  if (status.state === "failed") return refuse(ctx, EDIT_SAY.failed);
  const why = renderWhy(edit.dir, state);
  if (why) return refuse(ctx, why);
  const pid = startJob(ctx, found, ["render", edit.slug]);
  if (!Number.isInteger(pid)) return refuse(ctx, EDIT_SAY.renderNoRun);
  try {
    const start = (kitOf(ctx).startOf ?? processStart)(pid);
    writeState(edit.dir, { ...(readState(edit.dir) ?? {}), rendering: { pid, ...(typeof start === "string" ? { start } : {}), at: new Date(ctx.now()).toISOString() } });
  } catch {
    // The run marks it itself as it starts.
  }
  ctx.say(EDIT_SAY.rendering(editSaid(edit.key, edit.mode, edit.version)));
  return 0;
}

/** The detached half's `render <slug>`: renderReelKit (or a test's `render`), which waits for the Mac's worker lock and asks renderWhy again
    inside it. */
async function renderNow(ctx, { found, record }, [slug, ...more], h) {
  const edit = more.length ? null : editsOf(ctx, found, record).find((e) => e.slug !== "" && e.slug === slug);
  if (!edit || edit.dir === null) {
    ctx.say(h.help);
    return 2;
  }
  const kit = kitOf(ctx);
  const render = kit.render ?? renderReelKit;
  const given = Object.fromEntries(["sandboxExec", "trash", "run", "startOf", "wait", "every", "limit", "grace", "facts"].filter((k) => kit[k] !== undefined).map((k) => [k, kit[k]]));
  const ended = await render(ctx, { dir: edit.dir, entry: edit.entry }, { alive: ctx.alive, log: (line) => ctx.say(line), ...given });
  ctx.say(`Reel Kit's render of ${slug} ${ended.ok ? "is done" : "made nothing to keep"}.${ended.why ? ` ${ended.why}` : ""}`);
  return ended.ok ? 0 : 1;
}

// --- Her edit in the HyperFrames app (plan Task 17, and Task 18's version line) ---

/** Where the look before an open says what it found, beside the worker's own records: the lines hold paths, so they are never hers. */
const appLogFile = (home, slug) => join(home, "Library", "Application Support", "BRIMM Video", "reel-kit-worker", `${slug}.app.log`);
/** The notes for the app's agent, in the edit's public/. */
const NOTES = Object.freeze(["public/CLAUDE.md", "public/AGENTS.md"]);

/** Whether `public/` is a folder of the project's own, reached by no link: the app is asked for it, and the notes are written in it. */
function ownPublic(dir) {
  try {
    const at = join(dir, "public");
    return lstatSync(at).isDirectory() && realpathSync.native(at) === join(realpathSync.native(dir), "public");
  } catch {
    return false;
  }
}

/** The app's version as this Mac's copies say it (app-version.js readAppVersion, plutil given five seconds each), noted as the last one
    seen (noteAppVersion), once per open: { seen, line }, `line` the one she reads when it changed since the last one seen, or "". A
    version that can't be read or noted says nothing and stops nothing. */
function appVersionNow(ctx) {
  let seen = { version: "", build: "", copies: [] };
  try {
    seen = readAppVersion({ home: ctx.home, ...(kitOf(ctx).plutil ? { run: kitOf(ctx).plutil } : {}) });
  } catch {
    return { seen, line: "" };
  }
  try {
    const noted = noteAppVersion(ctx.home, seen);
    return { seen, line: noted.changed ? appVersionLine({ was: noted.was, now: seen.version, copies: seen.copies }) : "" };
  } catch {
    return { seen, line: "" };
  }
}

/** `reelkit app "<episode>" <slug>`: the edit opened in the HyperFrames app, on its public/, Reel Kit's HyperFrames project. In this order:
    - the episode through the gate (edit.js), then appWhy again: never a session, cleared or not, nor any record the gate holds (Decision
      9: the app transcribes every video it opens, in the cloud);
    - only an edit finalize left ready (after her go), or rendered; one queued, at work, stopped, failed or at its storyboard is refused in
      its own line; changed since in the app, it opens all the same: it is hers to go on with there;
    - a Mac set up for the app (settings.js appOf) with the pinned command line (hyperframes.js cliPath), and a public/ of the project's own;
    - the look over the project for Studio's own names (the worker's sweepProject), immediately before the app is asked: each Studio did
      not note is set aside, its lines in `<slug>.app.log`, and the app is not asked (EDIT_SAY.appFound). The app's own public/.claude/
      is let be once Studio has opened the project (`opened`, the worker's wasOpened), and never before;
    - public/CLAUDE.md and public/AGENTS.md written whole (reelKitNotes), each noted as Studio's (noteOwnFile);
    - the app asked by the pinned command line's `open` (app.js openOnly), which says what came of it, and the buttons line;
    - once it opened: Studio's mark (markOpened, out of the project), where to export when this Mac picked a folder, the app's version
      read and noted once (appVersionNow) with its line when it changed, the version in studio.json (`app`: { version, build, opened }),
      and the record's entry with the time it opened and its state `opened` (from `made`, never back). Resolves 0 when the app opened and
      the record was written, 1 otherwise. */
async function appCommand(ctx, words, h) {
  if (words.length !== 2) {
    ctx.say(h.help);
    return 2;
  }
  const got = editFor(ctx, words, h);
  if (got.code !== undefined) return got.code;
  const { found, record, edit, status } = got;
  const why = appWhy({ record, held: Boolean(found.held) });
  if (why) return refuse(ctx, why);
  if (status === null) return refuse(ctx, EDIT_SAY.notHere);
  if (isBusy(status)) return refuse(ctx, EDIT_SAY.busy);
  if (status.state === "stopped") return refuse(ctx, stoppedLine(status));
  if (status.state === "failed") return refuse(ctx, EDIT_SAY.failed);
  if (status.state !== "ready" && status.state !== "rendered") return refuse(ctx, EDIT_SAY.appNotBuilt);
  if (!appOf(ctx.settings)) return refuse(ctx, APP_NOT_SET_UP);
  const given = ctx.deps?.app ?? {};
  const cli = given.cli ?? cliPath(ctx.home);
  if (!existsSync(cli)) return refuse(ctx, EDIT_SAY.appNoCommandLine);
  if (edit.slug === "" || !ownPublic(edit.dir)) return refuse(ctx, EDIT_SAY.appOdd);

  const lines = [];
  const look = sweepProject(ctx.home, edit.slug, edit.dir, { said: `Before ${edit.slug} was opened in HyperFrames`, log: (line) => lines.push(line), opened: wasOpened(ctx.home, edit.slug) });
  if (lines.length) {
    try {
      mkdirSync(dirname(appLogFile(ctx.home, edit.slug)), { recursive: true });
      appendFileSync(appLogFile(ctx.home, edit.slug), lines.map((line) => `${new Date(ctx.now()).toISOString()} ${line}\n`).join(""));
    } catch {
      // What was set aside is in its place for Jason all the same.
    }
  }
  if (look.planted.length) return refuse(ctx, EDIT_SAY.appFound);

  const state = readState(edit.dir) ?? {};
  try {
    const notes = reelKitNotes({ key: edit.key, name: edit.entry.name, mode: edit.mode, version: edit.version });
    for (const rel of NOTES) {
      writeFileWhole(join(edit.dir, ...rel.split("/")), notes);
      noteOwnFile(ctx.home, edit.slug, edit.dir, rel);
    }
  } catch {
    return refuse(ctx, EDIT_SAY.appNotes);
  }

  const env = ctx.deps?.env || process.env;
  const read = openOnly(ctx, { record, dir: join(edit.dir, "public") }, { cli, env, ...(given.spawn ? { spawn: given.spawn } : {}), ...(given.node ? { node: given.node } : {}), ...(given.chat ? { chat: given.chat } : {}) });
  if (!read.opened) return 1;
  const now = new Date(ctx.now());
  try {
    markOpened(ctx.home, edit.slug, now.toISOString());
  } catch {
    // The record says it opened. Without the mark a later worker run on it fails closed at its first look, which sets aside the app's
    // public/.claude/ as not Studio's, and the next open is refused until that is done.
  }
  const into = exportsWords(ctx.settings, ctx.home);
  if (into) ctx.say(`Export it on This Mac, into ${into}.`);
  const { seen, line } = appVersionNow(ctx);
  if (line) ctx.say(line);
  try {
    const was = readState(edit.dir) ?? state;
    const opened = Array.isArray(was.app?.opened) ? was.app.opened : [];
    writeState(edit.dir, { ...was, app: { version: seen.version, build: seen.build, opened: [...opened, now.toISOString()] } });
  } catch {
    // The version is said and kept as the last one seen; the project's record of it waits for the next open.
  }
  // The record is read again: a job's entry may have been written meanwhile.
  const fresh = h.episodeFor({ ...ctx, say: () => {} }, [found.name], { newerEnds: 1 });
  if (!fresh.found) return refuse(ctx, EDIT_SAY.notWritten);
  const projects = Array.isArray(fresh.record.app?.projects) ? fresh.record.app.projects : [];
  const at = localStamp(now);
  const updated = projects.map((p) => (p === null || typeof p !== "object" || !byReelKit(p) || p.key !== edit.key || p.version !== edit.version ? p : {
    ...p, opened: [...(Array.isArray(p.opened) ? p.opened : []), at], handover: Boolean(p.handover) || read.handedOver, state: p.state === "made" ? "opened" : p.state
  }));
  return (await h.save(ctx, { ...fresh.found, record: fresh.record }, { ...fresh.record, app: { ...fresh.record.app, projects: updated } }, "")) === 0 ? 0 : 1;
}

/** What runJob is given, from a test's stand-ins (ctx.deps.reelKit) where it gives them, and the run's log. */
function jobDeps(ctx, more = {}) {
  const kit = kitOf(ctx);
  const given = Object.fromEntries(["claude", "startOf", "wait", "every", "limit", "grace", "facts", "run", "scaffoldDeps"].filter((k) => kit[k] !== undefined).map((k) => [k, kit[k]]));
  return { alive: ctx.alive, log: (line) => ctx.say(line), ...given, ...more };
}

/** The line her `status` says for a start that never made its project: the run's own words when it said a sentence, else to ask Jason. */
const startWhyOf = (why) => (typeof why === "string" && /[.?!]$/.test(why) ? why : "Ask Jason.");

/** The detached half's `start <key> <mode> <queue id>`: the queued job of a new edit, its project made inside the Mac's worker lock and its
    entry written into the record there (entryOf, with what the record checks a project by: `from` and `workingCopy`). */
async function startNow(ctx, { found, record }, [key, mode, id, ...more], h) {
  if (more.length || !/^(?:main|reel [1-9]\d*)$/.test(String(key)) || !MODES.includes(mode) || typeof id !== "string" || id === "") {
    ctx.say(h.help);
    return 2;
  }
  const reel = key === "main" ? null : (Array.isArray(record.reels) ? record.reels : []).find((r) => r?.n === Number(key.slice(5)));
  const title = key === "main" ? record.name?.text : reel?.title;
  const make = kitOf(ctx).scaffold ?? scaffold;
  const made = async (c, spec, deps) => {
    // Inside the Mac's lock, after however long the job waited: the episode is found again through the gate, and the start judged again
    // on the record as it is now (its own queue entry left out), so that a video corrected to a session, held as one, or given a
    // HyperFrames project of the part while it waited is never copied or made. scaffold is given that record.
    const heard = [];
    const again = h.episodeFor({ ...ctx, say: (line) => heard.push(line) }, [found.name], { newerEnds: 1 });
    if (!again.found) {
      for (const line of heard) ctx.say(line);
      return { why: heard.at(-1) ?? EDIT_SAY.notWritten };
    }
    const reelNow = key === "main" ? null : (Array.isArray(again.record.reels) ? again.record.reels : []).find((r) => r?.n === Number(key.slice(5)));
    const why = startWhy({
      record: again.record, key, mode, title: key === "main" ? again.record.name?.text : reelNow?.title, home: ctx.home, folder: again.found.name,
      held: Boolean(again.found.held), alive: ctx.alive, startOf: kitOf(ctx).startOf ?? processStart, queued: id
    });
    if (why) return { why };
    const done = await make(c, { ...spec, found: again.found, record: again.record, ...(key === "main" ? { title: again.record.name?.text } : { title: reelNow?.title }) }, deps);
    if (!done || typeof done.dir !== "string") return done;
    // The record is read again: another job's entry may have been written while this one waited.
    const fresh = h.episodeFor(ctx, [found.name], { newerEnds: 1 });
    if (!fresh.found) return { why: EDIT_SAY.notWritten };
    const now = fresh.record;
    const entry = entryOf({ key, name: done.name, mode, version: done.version, at: localStamp(new Date(ctx.now())), machine: ctx.machine, fromSuggestion: reel ? reel.n : null, from: done.from, workingCopy: done.workingCopy });
    const app = { toolchain: now.app?.toolchain ?? HF_PIN.version, ...now.app, projects: [...(Array.isArray(now.app?.projects) ? now.app.projects : []), entry] };
    if ((await h.save(ctx, { ...fresh.found, record: now }, { ...now, app }, "")) !== 0) return { why: EDIT_SAY.notWritten };
    clearStart(ctx.home, found.name, key);
    return done;
  };
  const ended = await runJob(ctx, { job: "edit", episode: record.id, key, version: null, mode, queued: id, make: { found, record, key, mode, title } }, jobDeps(ctx, { scaffold: made }));
  if (ended.dir === null) {
    try {
      writeFileWhole(startResultFile(ctx.home, found.name, key), `${JSON.stringify({ key, why: startWhyOf(ended.why), at: new Date(ctx.now()).toISOString() })}\n`);
    } catch {
      // Said in the log alone, then.
    }
  }
  ctx.say(`Reel Kit's edit of ${key} ended ${ended.state}${ended.why ? ` (${ended.why})` : ""}.`);
  return ended.state === "storyboard" ? 0 : 1;
}

/** The detached half's `revise|finalize|resume <slug>`: the job of an edit whose project is made. finalize runs only after her go (her
    approval in studio.json, which `go` writes); a resume of a finalize too. revise takes her notes since the last version. */
async function editNow(ctx, { found, record }, job, [slug, ...more], h) {
  const edit = more.length ? null : editsOf(ctx, found, record).find((e) => e.slug !== "" && e.slug === slug);
  if (!edit || edit.dir === null) {
    ctx.say(h.help);
    return 2;
  }
  // An edit changed since finalize, or opened in the app, is never changed by Reel Kit again: nothing is written or run.
  const kept = keptInApp(ctx, edit);
  if (kept) {
    ctx.say(`Reel Kit's ${job} of ${slug} was not run: ${kept}`);
    return 1;
  }
  const state = readState(edit.dir) ?? {};
  const approved = state.approved !== null && typeof state.approved === "object";
  if ((job === "finalize" || (job === "resume" && state.job === "finalize")) && !approved) {
    ctx.say(`Reel Kit's ${slug} was not finalized: she has not said go.`);
    return 1;
  }
  let spec;
  if (job === "revise") {
    const notes = readNotes(edit.dir) ?? [];
    const used = Number.isInteger(state.notesUsed) && state.notesUsed >= 0 ? state.notesUsed : 0;
    const since = notes.slice(used).filter(isChange).map((n) => ({ beat: n.beat, text: n.text, ...(n.at === undefined ? {} : { at: n.at }) }));
    // Her go was for the storyboard these notes change: the next one waits for hers again.
    writeState(edit.dir, { ...state, notesUsed: notes.length, approved: undefined });
    spec = { dir: edit.dir, job: "revise", notes: since };
  } else spec = job === "resume" ? { dir: edit.dir, resume: true } : { dir: edit.dir, job };
  const ended = await runJob(ctx, spec, jobDeps(ctx));
  ctx.say(`Reel Kit's ${job} of ${slug} ended ${ended.state}${ended.why ? ` (${ended.why})` : ""}.`);
  return ["storyboard", "ready"].includes(ended.state) ? 0 : 1;
}

/** The jobs the detached half runs. */
const NOW_JOBS = Object.freeze(["start", "revise", "finalize", "resume", "render"]);

/** `reelkit --now <folder> <job> …`, the detached half of start, go, revise and resume: in no help, and refused under Claude Code. The
    episode is found by its folder, through the gate, as every detached run's is. */
async function jobNow(ctx, words, h) {
  const env = ctx.deps?.env || process.env;
  const [folder, job, ...rest] = words;
  if (env.CLAUDECODE === "1" || typeof folder !== "string" || folder === "" || !NOW_JOBS.includes(job)) {
    ctx.say(h.help);
    return 2;
  }
  const got = h.episodeFor(ctx, [folder], { newerEnds: 1 });
  if (!got.found) return got.code;
  if (job === "render") return renderNow(ctx, got, rest, h);
  return job === "start" ? startNow(ctx, got, rest, h) : editNow(ctx, got, job, rest, h);
}

/** `reelkit <words…>`: the subcommand its first word names. `help` is edit.js's HELP, said for words it doesn't know. `episodeFor` and
    `save` are edit.js's own (it gives them; this file never imports it): how a command finds the episode it names, through the gate, and
    how a record is written. */
export async function reelkitCommand(ctx, rest = [], { help = "", episodeFor, save } = {}) {
  const [word, ...more] = rest;
  const h = { help, episodeFor, save };
  // Her style names no episode: what reel-kit-style-chat.js needs of this file is given to it.
  const style = { help, publishLine, notReady: () => (kitHere(ctx.home) ? "" : EDIT_SAY.notSetUp), jobDeps: () => jobDeps(ctx) };
  if (word === "style") return styleCommand(ctx, more, style);
  if (word === "--now" && more[0] === "style") return styleNow(ctx, more.slice(1), style);
  if (word === "install") return installCommand(ctx, more, help);
  if (word === "status" && more.length === 0) return statusCommand(ctx);
  if (word === "--now" && more[0] === "install") return installNow(ctx, more.slice(1), help);
  const episodeWords = { start: startCommand, status: editStatus, note: noteCommand, go: goCommand, revise: reviseCommand, resume: resumeCommand, render: renderCommand, storyboard: storyboardCommand, app: appCommand };
  if (typeof episodeFor === "function" && typeof save === "function") {
    if (word === "--now") return jobNow(ctx, more, h);
    if (Object.hasOwn(episodeWords, word) && more.length && !more[0].startsWith("--")) return episodeWords[word](ctx, more, h);
  }
  ctx.say(help);
  return 2;
}
