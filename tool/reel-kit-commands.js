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
// Which Mac is which (plan Decision 10): an installed Mac takes only the Reel Kit Studio pins (PIN.fingerprint). A dev Mac (the Mac Studio)
// takes any well-formed download; one of another version than PIN.version is installed beside the one in use, from a pin made from its
// download (newPinOf), which is written to `<work folder>/.toolchain/reel-kit-<version>.pin.json` for Jason's pull request. The version in
// use stays PIN.version until that pin is merged.
//
// Everything she reads is in her words: never a path or a command for her to type. A test gives stand-ins through ctx.deps.reelKit: `pin`
// (the pin of the version in use), `unzip` (readDrop's), `programs`, `fetch`, `run` and `keepAwake`.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
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

/** `reelkit <words…>`: the subcommand its first word names. `help` is edit.js's HELP, said for words it doesn't know. */
export async function reelkitCommand(ctx, rest = [], { help = "" } = {}) {
  const [word, ...more] = rest;
  if (word === "install") return installCommand(ctx, more, help);
  if (word === "status" && more.length === 0) return statusCommand(ctx);
  if (word === "--now" && more[0] === "install") return installNow(ctx, more.slice(1), help);
  ctx.say(help);
  return 2;
}
