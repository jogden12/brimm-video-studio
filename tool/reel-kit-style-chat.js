// Her Reel Kit style, changed in her chat (spec 2026-11-23 Reel Kit in Studio, section 3; plan Task 13). The body of `reelkit style …`, which
// reel-kit-commands.js routes here (Ruling R2: subcommand bodies out of edit.js; this file for her style alone, as the worker's files are split
// by what they do). It never imports edit.js or reel-kit-commands.js: what it needs of them comes in `h`.
//
//   reelkit style show                     her pack's main lines and its board staged for the side panel (storyboard-opening.js stagePage,
//                                          kind "style-board"), with the exact publish for her chat; or, while a change is under way, how far
//                                          it has got, and once its board is made, that board staged instead (one page per change).
//   reelkit style change "<what she asked>"
//                                          a copy of her pack kept first (`before <date>`, backupPack), then a working copy of it made on this
//                                          Mac's own disk, `<REEL_KIT_HOME>/style-work/<stamp>/`, outside Dropbox, and the worker's `style` job
//                                          started on it, detached: Reel Kit's own onboarding steps 4 and 5, her words given as data in the
//                                          notes block. A change while one waits for her yes builds on that one. Refused, keeping and copying
//                                          nothing, in a chat that holds a session's words on an open-lock Mac (held.js, app.js chatOf).
//   reelkit style yes                      the change she has seen becomes her pack: checked again (packFault), then put into Dropbox by
//                                          dropbox.js's rule, style.json last, under the Mac's Reel Kit lock, so an edit's syncPack never copies
//                                          her pack while it is being written.
//   reelkit style back ["<copy>"]          her `before …` copies by name, or her pack put back to one (restorePack, which keeps how it was).
//   reelkit style diff                     how her pack differs from the starting style (packDiff), and whether Jason has shipped a new one.
//   reelkit style carry [yes]              once a new starting style is shipped (shippedMoved): what carrying hers onto it would add, and with
//                                          yes, it done (carryPack), under the same lock.
//   reelkit style resume                   a change that stopped (her usage ran out, say), carried on from its step.
//   reelkit --now style change|resume <stamp>
//                                          the detached half, in no help, refused under Claude Code: the worker's runJob on the working copy,
//                                          then packFault on what it made. A change that breaks a brand rule is refused in one line, and
//                                          nothing of it is kept.
//
// A change never alters a video already made: each Reel Kit project has its own style/, copied in by new.py when it was made.
//
// The working copy's folder, `<stamp>/`, is the worker's project (its write root): its studio.json is Studio's, its work/ the worker's status,
// and the copy of her pack is its style/, as a Reel Kit project's is. Reel Kit's style.py and board.py are given that style/ by their own
// arguments (style.py's style.json, board.py's --pack), so REEL_KIT_HOME stays the real one, where they find GSAP, HyperFrames and the tools.
//
// Everything she reads is in her words: never a path or a command for her to type.
import { lstatSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { chatOf } from "./app.js";
import { releaseEpisodeLock, startDetached, takeEpisodeLock } from "./detached.js";
import { HELD_NARROWED } from "./held.js";
import { lockFor } from "./loosened.js";
import { reelKitHome } from "./reel-kit.js";
import { readState, writeState } from "./reel-kit-project.js";
import {
  SHIPPED_PACK, adoptPack, backupPack, backupsOf, carryPack, carryPlan, ensureHerPack, herPack, makeWorkingCopy, packDiff, packFault, packLines,
  packPrint, restorePack, shippedMoved, withHerBoard
} from "./reel-kit-style.js";
import { STYLE_WORK } from "./reel-kit-worker-tools.js";
import { macLock, processStart, runJob, statusOf } from "./reel-kit-worker.js";
import { pageOf, stagePage } from "./storyboard-opening.js";
import { studioFolder } from "./studio.js";

/** The phrase she says to follow a change. */
const FOLLOW = `Say "show my style" to see how it's going.`;

/** What `reelkit style` says, in her words. */
export const STYLE_SAY = Object.freeze({
  kept: (name) => `Your style as it is now is kept as "${name}", so you can go back to it.`,
  builds: "This change builds on the one still waiting for your yes.",
  queued: `Your style change is in the queue. ${FOLLOW}`,
  resuming: `Your style change is in the queue to carry on. ${FOLLOW}`,
  busy: "Your style is being changed already: say it again once its new board is ready.",
  waiting: "Your style change is waiting for its turn: this Mac makes one Reel Kit job at a time.",
  working: (step) => `Your style change is being made, at ${step || "its start"}.`,
  stopped: (step, usage) => (usage
    ? `Your Claude usage ran out, so your style change stopped${step ? ` at ${step}` : ""}. Once it's back, say "carry on with my style" and it picks up from there.`
    : `Your style change stopped${step ? ` at ${step}` : ""} before it was done. Say "carry on with my style" and it picks up from there.`),
  failed: "Your last style change couldn't be made: ask Jason.",
  notKept: (why) => `Your last style change wasn't kept: ${why}`,
  noBoard: "Reel Kit made no new board for it: ask Jason.",
  ready: `The new board of your style is ready for the side panel. Does this look like you? Say "yes" to keep it, or say what to change.`,
  current: "Your Reel Kit style is ready for the side panel.",
  notStaged: "Your style's board couldn't be made ready to show: ask Jason.",
  noWaiting: "There is no new style waiting for your yes. Say what you'd like changed first.",
  notSeen: `Look at the new board first: say "show my style".`,
  changed: "Your Reel Kit style is changed: the next Reel Kit edit uses it. Edits made before keep the style they were made with.",
  partly: (name) => `Your style was only partly changed, and how it was is kept as "${name}": say "go back to ${name}", or ask Jason.`,
  noBackups: "There are no earlier copies of your style yet.",
  backups: "Your earlier styles, newest first:",
  backHow: `Say "go back to" and the name of one to use it.`,
  wentBack: (name, kept) => `Your style is back to "${name}". How it was is kept as "${kept}".`,
  same: "Your style is the same as the starting style.",
  differs: "How your style differs from the starting style:",
  newBase: `Jason has shipped a new starting style since yours was made. Say "carry my style over" to see what that would change.`,
  noNewBase: "Jason hasn't shipped a new starting style since yours was made, so there is nothing to carry over.",
  carryWould: "Carrying your style over to the new starting style would bring in:",
  carryWouldKeep: "It would keep yours where you and Jason both changed it:",
  broughtIn: "Brought in from the new starting style:",
  keptYours: "Kept yours where you and Jason both changed it:",
  carryNothing: "The new starting style changes nothing you haven't changed yourself, so carrying it over only marks your style as made from it.",
  noBase: "Your style was made before Studio kept the starting style it came from, so only what the new one adds can be carried over: Jason's other changes can't be brought in for it.",
  baseUnchecked: "The starting style your style was made from couldn't be checked, so only what the new one adds can be carried over: Jason's other changes can't be brought in for it.",
  herUnread: "Your style in Dropbox can't be read whole just now (Dropbox may still be bringing it over), so the change is still waiting: say yes again in a few minutes.",
  herUnread0: "Your style in Dropbox can't be read whole just now (Dropbox may still be bringing it over), so nothing was changed: say it again in a few minutes.",
  changedWhileCopied: "Your style changed while it was being copied (Dropbox may still be bringing it over), so nothing was changed: say it again in a moment.",
  herChanged: `Your style has changed since this change was made (on your other Mac, or by going back), so it wasn't kept: say what you'd like changed again.`,
  herChangedWhy: "your style had changed since it was made.",
  carryAsk: `Say "yes, carry my style over" to do it.`,
  carried: (kept) => `Your style is carried over to the new starting style. How it was is kept as "${kept}".`,
  macBusy: "Reel Kit is making something on this Mac right now, so your style was left as it was: say it again once that's done.",
  notStarted: "Your style change couldn't be started on this Mac: say it again, or ask Jason.",
  notCopied: "Your style couldn't be copied to change, so nothing was changed: ask Jason.",
  empty: "Say what you'd like changed in your style.",
  tooLong: "That is more than 4,000 characters: say it in fewer words.",
  notStopped: "Your style change hasn't stopped, so there is nothing to carry on."
});

/** The most of her ask: as much as a note on a storyboard. */
const ASK_MOST = 4000;
/** A change's stamp: its folder's name, `YYYYMMDD-HHMMSS` in this Mac's own time, with `-2` and on for a second in one second. */
const STAMP = /^\d{8}-\d{6}(?:-\d{1,3})?$/;
/** The id her own pack's board has in the side panel; a change's is `style-<stamp>`. */
export const HER_BOARD = "style";
/** What a test gives in place of this Mac's own (ctx.deps.reelKit): `shipped`, `chat`, `lockWaitMs`, `dropbox`, `startOf`. */
const kitOf = (ctx) => ctx.deps?.reelKit ?? {};

/** The folder the working copies of her changes are in, on this Mac's own disk, outside Dropbox. */
export const changesDir = (home) => join(reelKitHome(home), STYLE_WORK);
/** The change `stamp`'s folder: the worker's project for it. Throws for a stamp that is not one. */
export function changeDir(home, stamp) {
  if (typeof stamp !== "string" || !STAMP.test(stamp)) throw new Error(`changeDir: ${JSON.stringify(stamp)} is not a change's stamp`);
  return join(changesDir(home), stamp);
}
/** The copy of her pack inside a change's folder. */
export const changePack = (dir) => join(dir, "style");

const two = (n) => String(n).padStart(2, "0");
/** The stamp of the time `ms`, in this Mac's own time. */
const stampOf = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
};
/** A stamp's time and its number in that second (1 for the first). */
const stampParts = (stamp) => {
  const m = /^(\d{8}-\d{6})(?:-(\d{1,3}))?$/.exec(stamp);
  return [m[1], Number(m[2] ?? 1)];
};
/** Stamps in the order they were made. */
const byStamp = (a, b) => {
  const [x, n] = stampParts(a);
  const [y, m] = stampParts(b);
  return x === y ? n - m : x < y ? -1 : 1;
};

/** A new change's folder, made by this run alone (never `recursive` for it): its stamp. */
function newChange(home, ms) {
  mkdirSync(changesDir(home), { recursive: true });
  const base = stampOf(ms);
  for (let n = 1; n < 1000; n++) {
    const stamp = n === 1 ? base : `${base}-${n}`;
    try {
      mkdirSync(join(changesDir(home), stamp));
      return stamp;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  throw new Error("newChange: no stamp is free");
}

/** The changes on this Mac, newest first, each { stamp, dir, state, status } (status the worker's statusOf: a run that died reads stopped). */
function changesOf(ctx) {
  let names;
  try {
    names = readdirSync(changesDir(ctx.home)).filter((name) => STAMP.test(name)).sort(byStamp).reverse();
  } catch {
    return [];
  }
  return names.flatMap((stamp) => {
    const dir = join(changesDir(ctx.home), stamp);
    const state = readState(dir);
    return state && state.job === "style" && typeof state.slug === "string" ? [{ stamp, dir, state, status: statusOf(dir, ctx.alive, kitOf(ctx).startOf ?? processStart) }] : [];
  });
}

const isBusy = (status) => status.state === "queued" || status.state === "working";
/** Whether a change is still under way or waits for her: queued, at work, stopped, or its board made. */
const isPending = (change) => isBusy(change.status) || change.status.state === "stopped" || change.status.state === "storyboard";
/** The newest change still under way or waiting for her, or null: `show`, `yes`, `resume` and the next `change` speak of it. A change that
    built on one waiting for her yes and was then refused leaves that one waiting. */
const pendingChange = (ctx, all = changesOf(ctx)) => all.find(isPending) ?? null;

/** Write a change's studio.json, saying in the log when it can't be: what she reads is said all the same. */
function markChange(ctx, dir, fields) {
  try {
    writeState(dir, { ...(readState(dir) ?? {}), ...fields });
    return true;
  } catch (e) {
    (kitOf(ctx).log ?? (() => {}))(`Reel Kit style: a change's studio.json could not be written: ${e.code || e.message}`);
    return false;
  }
}

/** What her pack's functions are given: this Mac's settings and home, the shipped pack (a test's copy), this checkout's build, dropbox.js's
    options. Nothing they log reaches her chat. */
const packOpts = (ctx) => ({ settings: ctx.settings, home: ctx.home, shipped: kitOf(ctx).shipped ?? SHIPPED_PACK, build: ctx.build, dropbox: kitOf(ctx).dropbox ?? {}, log: () => {} });

const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};
/** A line that answers what she asked: nothing refused. */
const tell = (ctx, line) => {
  ctx.say(line);
  return 0;
};
/** Words `reelkit style` doesn't know: edit.js's help. */
const help = (ctx, h) => {
  ctx.say(h.help);
  return 2;
};

/** Run `write()` holding the Mac's Reel Kit lock (reel-kit-worker.js macLock), the one every worker job holds, so that no edit copies her
    pack (syncPack, in scaffold) while it is written. Waited for a few seconds; held longer, her pack is left as it is, in one line. */
async function underMacLock(ctx, write) {
  const lock = macLock(ctx.home);
  mkdirSync(dirname(lock), { recursive: true });
  const until = Date.now() + (kitOf(ctx).lockWaitMs ?? 3000);
  let took = takeEpisodeLock(lock, "reelkit style", ctx.alive);
  while (!took.taken && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 50));
    took = takeEpisodeLock(lock, "reelkit style", ctx.alive);
  }
  if (!took.taken) return refuse(ctx, STYLE_SAY.macBusy);
  try {
    return await write();
  } finally {
    releaseEpisodeLock(lock, took.text);
  }
}

/** Whether her chat holds a session's words where that matters: on a Mac whose lock in effect is open (loosened.js lockFor), the chat
    that asked, by app.js chatOf (held when it can't be found). A held chat's words may be a session's, and a change sends them into her
    pack, which every later edit reads. */
function chatHolds(ctx) {
  if (lockFor(ctx.settings, ctx.deps) !== "open") return false;
  try {
    return (kitOf(ctx).chat ?? (() => chatOf(ctx.home, ctx.deps?.env || process.env)))().held !== false;
  } catch {
    return true;
  }
}

/** Stage a style board in her folder (storyboard-opening.js stagePage, kind "style-board") and say the publish for her chat: true, or false
    having said nothing. */
function stageBoard(ctx, h, { from, slug, title }) {
  try {
    stagePage(ctx.home, studioFolder(ctx.home), { from, slug, kind: "style-board", title });
  } catch {
    return false;
  }
  const page = pageOf(ctx.home, slug);
  if (!page) return false;
  ctx.say(h.publishLine(page));
  return true;
}

/** `show`: a change under way, or its board once made; otherwise her pack's main lines and its board. */
async function show(ctx, more, h) {
  if (more.length) return help(ctx, h);
  const all = changesOf(ctx);
  const pending = pendingChange(ctx, all);
  // How the newest change ended, when it is not the one still waiting: refused (with why) or failed.
  const newest = all[0];
  if (newest && newest !== pending) {
    if (newest.status.state === "refused" && typeof newest.state.why === "string" && newest.state.why) ctx.say(STYLE_SAY.notKept(newest.state.why));
    if (newest.status.state === "failed") ctx.say(STYLE_SAY.failed);
  }
  if (pending) {
    const { state, step, why } = pending.status;
    if (state === "queued") return tell(ctx, STYLE_SAY.waiting);
    if (state === "working") return tell(ctx, STYLE_SAY.working(step));
    if (state === "stopped") return tell(ctx, STYLE_SAY.stopped(step, why === "usage"));
    if (!stageBoard(ctx, h, { from: join(changePack(pending.dir), "board"), slug: pending.state.slug, title: "Your Reel Kit style, changed" })) return refuse(ctx, STYLE_SAY.notStaged);
    ctx.say(STYLE_SAY.ready);
    return 0;
  }
  const o = packOpts(ctx);
  const ensured = ensureHerPack(o);
  if (ensured.why) return refuse(ctx, ensured.why);
  const fault = packFault(herPack(ctx.settings));
  if (fault) return refuse(ctx, fault);
  for (const line of packLines(herPack(ctx.settings))) ctx.say(line);
  let staged = false;
  try {
    withHerBoard(o, (from) => (staged = stageBoard(ctx, h, { from, slug: HER_BOARD, title: "Your Reel Kit style" })));
  } catch (e) {
    return refuse(ctx, e.message);
  }
  if (!staged) return refuse(ctx, STYLE_SAY.notStaged);
  ctx.say(STYLE_SAY.current);
  if (shippedMoved(o)) ctx.say(STYLE_SAY.newBase);
  return 0;
}

/** `change "<what she asked>"`: a copy of her pack kept, a working copy made, and the worker's style job started on it, detached. */
async function change(ctx, more, h) {
  if (more.length !== 1) return help(ctx, h);
  const [text] = more;
  if (text.trim() === "") return refuse(ctx, STYLE_SAY.empty);
  if (text.length > ASK_MOST) return refuse(ctx, STYLE_SAY.tooLong);
  if (chatHolds(ctx)) return refuse(ctx, HELD_NARROWED);
  const notReady = h.notReady();
  if (notReady) return refuse(ctx, notReady);
  const pending = pendingChange(ctx);
  if (pending && isBusy(pending.status)) return refuse(ctx, STYLE_SAY.busy);
  const o = packOpts(ctx);
  const ensured = ensureHerPack(o);
  if (ensured.why) return refuse(ctx, ensured.why);
  // Her pack is checked before anything is kept or copied: a half-synced pack is never kept as a copy to go back to.
  const fault = packFault(herPack(ctx.settings));
  if (fault) return refuse(ctx, fault);
  const building = pending && pending.status.state === "storyboard" ? pending : null;

  let stamp;
  try {
    stamp = newChange(ctx.home, ctx.now());
  } catch {
    return refuse(ctx, STYLE_SAY.notCopied);
  }
  const dir = changeDir(ctx.home, stamp);
  const leave = (why) => {
    rmSync(dir, { recursive: true, force: true });
    return refuse(ctx, why);
  };
  // Her pack as the copy came from it, looked at before and after the copy, which must be the same (a change built on a waiting one
  // comes from what that one came from): her yes is refused when it is no longer the same.
  const printBefore = building ? building.state.herPrint : packPrint(ctx.settings);
  const why = makeWorkingCopy({ settings: ctx.settings, to: changePack(dir), from: building ? changePack(building.dir) : null });
  if (why) return leave(why);
  kitOf(ctx).copied?.();
  const herPrint = building ? printBefore : packPrint(ctx.settings);
  if (typeof herPrint !== "string" || typeof printBefore !== "string") return leave(STYLE_SAY.herUnread0);
  if (herPrint !== printBefore) return leave(STYLE_SAY.changedWhileCopied);
  let backup;
  try {
    backup = backupPack({ ...o, now: new Date(ctx.now()) });
  } catch (e) {
    return leave(e.message);
  }
  ctx.say(STYLE_SAY.kept(backup));
  const at = new Date(ctx.now()).toISOString();
  // Marked queued by this run first, so that a second ask is refused while the run it starts takes the mark for its own (runJob). A
  // waiting change it builds on is dropped only once this one has its board (styleNow).
  const state = {
    slug: `style-${stamp}`, job: "style", kind: "style", ask: { text, at }, backup, from: building ? building.stamp : "her pack", buildsOn: building ? building.stamp : null,
    herPrint, madeAt: at, state: "queued", step: "style", pid: process.pid, why: "", queuedAt: at
  };
  try {
    writeState(dir, state);
  } catch {
    return leave(STYLE_SAY.notCopied);
  }
  // A stopped change this one does not build on is dropped: this one takes its place.
  if (pending && pending.status.state === "stopped") markChange(ctx, pending.dir, { state: "dropped", droppedFor: stamp });
  const pid = startDetached(ctx, { command: "reelkit", folder: "style", args: ["change", stamp] });
  if (!Number.isInteger(pid)) {
    markChange(ctx, dir, { state: "failed", why: "not started", pid: null });
    return refuse(ctx, STYLE_SAY.notStarted);
  }
  markChange(ctx, dir, { pid });
  if (building) ctx.say(STYLE_SAY.builds);
  ctx.say(STYLE_SAY.queued);
  return 0;
}

/** `yes`: the change she has seen made her pack, under the Mac's Reel Kit lock, once her pack is as it was when the change's copy was made. */
async function yes(ctx, more, h) {
  if (more.length) return help(ctx, h);
  const pending = pendingChange(ctx);
  if (!pending) return refuse(ctx, STYLE_SAY.noWaiting);
  if (isBusy(pending.status)) return refuse(ctx, STYLE_SAY.busy);
  if (pending.status.state === "stopped") return refuse(ctx, STYLE_SAY.stopped(pending.status.step, pending.status.why === "usage"));
  if (!pageOf(ctx.home, pending.state.slug)) return refuse(ctx, STYLE_SAY.notSeen);
  return underMacLock(ctx, async () => {
    const now = pendingChange(ctx);
    if (!now || now.stamp !== pending.stamp || now.status.state !== "storyboard") return refuse(ctx, STYLE_SAY.noWaiting);
    const pack = changePack(now.dir);
    const notKept = (why, line) => {
      rmSync(pack, { recursive: true, force: true });
      markChange(ctx, now.dir, { state: "refused", why });
      return refuse(ctx, line ?? why);
    };
    // Changed meanwhile (on the other Mac, or by going back): this change was made from what is no longer her pack. A pack that can't be
    // read whole just now (Dropbox still bringing it) leaves the change waiting.
    const print = packPrint(ctx.settings);
    if (print === null) return refuse(ctx, STYLE_SAY.herUnread);
    if (print !== now.state.herPrint) return notKept(STYLE_SAY.herChangedWhy, STYLE_SAY.herChanged);
    try {
      adoptPack({ ...packOpts(ctx), from: pack });
    } catch (e) {
      if (e.wrote > 0) {
        markChange(ctx, now.dir, { state: "failed", why: "partly" });
        return refuse(ctx, STYLE_SAY.partly(now.state.backup));
      }
      // A change that breaks a brand rule after all (or is too large) is refused, and nothing of it is kept.
      if (e.keepNothing) return notKept(e.message);
      return refuse(ctx, e.message);
    }
    markChange(ctx, now.dir, { state: "kept", keptAt: new Date(ctx.now()).toISOString() });
    rmSync(pack, { recursive: true, force: true });
    ctx.say(STYLE_SAY.changed);
    return 0;
  });
}

/** `back ["<copy>"]`: her copies by name, or her pack put back to one. */
async function back(ctx, more, h) {
  if (more.length > 1) return help(ctx, h);
  if (!more.length) {
    const names = backupsOf(ctx.settings);
    if (!names.length) {
      ctx.say(STYLE_SAY.noBackups);
      return 0;
    }
    ctx.say(STYLE_SAY.backups);
    for (const name of names) ctx.say(`  ${name}`);
    ctx.say(STYLE_SAY.backHow);
    return 0;
  }
  const [name] = more;
  return underMacLock(ctx, async () => {
    try {
      const kept = restorePack({ ...packOpts(ctx), name, now: new Date(ctx.now()) });
      ctx.say(STYLE_SAY.wentBack(name, kept));
      return 0;
    } catch (e) {
      return refuse(ctx, e.message);
    }
  });
}

/** `diff`: how her pack differs from the starting style, and whether a new one is shipped. */
async function diff(ctx, more, h) {
  if (more.length) return help(ctx, h);
  const o = packOpts(ctx);
  const ensured = ensureHerPack(o);
  if (ensured.why) return refuse(ctx, ensured.why);
  const lines = packDiff(o);
  if (!lines.length) ctx.say(STYLE_SAY.same);
  else {
    ctx.say(STYLE_SAY.differs);
    for (const line of lines) ctx.say(`  ${line}`);
  }
  if (shippedMoved(o)) ctx.say(STYLE_SAY.newBase);
  return 0;
}

/** What a carry brings in and what it keeps of hers, as lines: before her yes (`done` false), what it would do, and after it, what it
    did. A pack with no base, or one whose base couldn't be checked, says first that only what the new base adds can be carried. */
function sayCarry(ctx, { brought, kept, base }, done) {
  if (base === "none") ctx.say(STYLE_SAY.noBase);
  if (base === "unchecked") ctx.say(STYLE_SAY.baseUnchecked);
  if (!brought.length && !kept.length) ctx.say(STYLE_SAY.carryNothing);
  if (brought.length) ctx.say(done ? STYLE_SAY.broughtIn : STYLE_SAY.carryWould);
  for (const line of brought) ctx.say(`  ${line}`);
  if (kept.length) ctx.say(done ? STYLE_SAY.keptYours : STYLE_SAY.carryWouldKeep);
  for (const line of kept) ctx.say(`  ${line}`);
}

/** `carry [yes]`: what carrying her pack onto a new starting style would add, and with yes, it done. */
async function carry(ctx, more, h) {
  const go = more.length === 1 && more[0] === "yes";
  if (more.length && !go) return help(ctx, h);
  const o = packOpts(ctx);
  const ensured = ensureHerPack(o);
  if (ensured.why) return refuse(ctx, ensured.why);
  if (!shippedMoved(o)) {
    ctx.say(STYLE_SAY.noNewBase);
    return 0;
  }
  if (!go) {
    let plan;
    try {
      plan = carryPlan(o);
    } catch (e) {
      return refuse(ctx, e.message);
    }
    sayCarry(ctx, plan, false);
    ctx.say(STYLE_SAY.carryAsk);
    return 0;
  }
  return underMacLock(ctx, async () => {
    let done;
    try {
      done = carryPack({ ...o, now: new Date(ctx.now()) });
    } catch (e) {
      return refuse(ctx, e.message);
    }
    ctx.say(STYLE_SAY.carried(done.backup));
    sayCarry(ctx, { brought: done.brought, kept: done.keptYours, base: done.base }, true);
    return 0;
  });
}

/** `resume`: a change that stopped, carried on from its step, detached. */
async function resume(ctx, more, h) {
  if (more.length) return help(ctx, h);
  const latest = pendingChange(ctx);
  if (!latest || latest.status.state !== "stopped") return refuse(ctx, latest && isBusy(latest.status) ? STYLE_SAY.busy : STYLE_SAY.notStopped);
  const pid = startDetached(ctx, { command: "reelkit", folder: "style", args: ["resume", latest.stamp] });
  if (!Number.isInteger(pid)) return refuse(ctx, STYLE_SAY.notStarted);
  // The run marks it itself as it starts, when this can't.
  markChange(ctx, latest.dir, { state: "queued", pid, why: "", queuedAt: new Date(ctx.now()).toISOString() });
  ctx.say(STYLE_SAY.resuming);
  return 0;
}

const WORDS = Object.freeze({ show, change, yes, back, diff, carry, resume });

/** `reelkit style <word> …`, her chat's half. `h`: `help` (edit.js's HELP), `publishLine(page)` (the line for her chat to publish a staged
    page, as `reelkit storyboard` says it) and `notReady()` ("" when Reel Kit is set up on this Mac, else the line she reads). */
export async function styleCommand(ctx, words, h) {
  const [word, ...more] = words;
  if (!Object.hasOwn(WORDS, word ?? "")) return help(ctx, h);
  return WORDS[word](ctx, more, h);
}

/** What the worker made, looked at once its job has ended at its board: a pack that breaks a brand rule (packFault), or no board, is
    refused, the working copy taken away (nothing of it is kept) and the change marked refused with why. "" when it may be shown. */
function lookAtChange(dir) {
  const pack = changePack(dir);
  let fault = packFault(pack);
  if (!fault) {
    try {
      if (!lstatSync(join(pack, "board", "index.html")).isFile() || !lstatSync(join(pack, "board", "files.json")).isFile()) fault = STYLE_SAY.noBoard;
    } catch {
      fault = STYLE_SAY.noBoard;
    }
  }
  if (!fault) return "";
  rmSync(pack, { recursive: true, force: true });
  writeState(dir, { ...(readState(dir) ?? {}), state: "refused", why: fault });
  return fault;
}

/** `reelkit --now style change|resume <stamp>`, the detached half: the worker's style job (runJob, under the Mac's worker lock) on the
    change's working copy, her ask as the one note on `all`, then what it made looked at (lookAtChange). In no help, and refused under
    Claude Code. `h.jobDeps()` is what runJob is given (reel-kit-commands.js). Resolves 0 when its board is ready for her. */
export async function styleNow(ctx, words, h) {
  const env = ctx.deps?.env || process.env;
  const [job, stamp, ...more] = words;
  if (env.CLAUDECODE === "1" || more.length || !["change", "resume"].includes(job) || typeof stamp !== "string" || !STAMP.test(stamp)) return help(ctx, h);
  const dir = changeDir(ctx.home, stamp);
  const state = readState(dir);
  if (!state || state.job !== "style") return refuse(ctx, `Reel Kit's style change ${stamp} is not on this Mac.`);
  let spec;
  if (job === "change") {
    const ask = state.ask;
    if (!ask || typeof ask.text !== "string" || ask.text.trim() === "") return refuse(ctx, `Reel Kit's style change ${stamp} holds no ask.`);
    spec = { dir, job: "style", notes: [{ beat: "all", text: ask.text, ...(typeof ask.at === "string" ? { at: ask.at } : {}) }] };
  } else spec = { dir, resume: true };
  const ended = await runJob(ctx, spec, h.jobDeps());
  let end = ended.state;
  let why = ended.why;
  if (end === "storyboard") {
    const fault = lookAtChange(dir);
    if (fault) [end, why] = ["refused", fault];
    else {
      // Its board is made: the waiting change it built on is dropped now, and not before, so that one refused leaves it waiting.
      const on = readState(dir)?.buildsOn;
      if (typeof on === "string" && STAMP.test(on) && readState(changeDir(ctx.home, on))?.state === "storyboard") markChange(ctx, changeDir(ctx.home, on), { state: "dropped", droppedFor: stamp });
    }
  }
  ctx.say(`Reel Kit's style change ${stamp} ended ${end}${why ? ` (${why})` : ""}.`);
  return end === "storyboard" ? 0 : 1;
}
