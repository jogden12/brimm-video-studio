// The recordings moved into Original files after the hand-off (Phase 3, the local working folder; L6, design D6). At the hand-off of a video kept on
// a Mac, every recording she dropped for it (a plan's parts, a part that shows a client included) is copied into its own episode's Original files/
// in Dropbox, behind her, by the launch agent. The Mac's copy is deleted only once the copy in Dropbox is whole, the record in force lists it, and
// Dropbox says it is uploaded. A session's recording, or one held beside a session, never moves. Every file made from a recording stays where it
// is. The move and the check are filing.js' pendings of the kind `original`, made by `checkOriginal` under the episode's late-check lock.
// This module and filing.js, finish.js and footage.js import each other: every name is used only inside a function, but `checkOriginal`, a function
// declaration (bound before any module of the cycle runs), which filing.js' CHECKS names at its top level.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { cloneIn, isWhole, makeOnlineOnly, replaceIn, sameBytes, textWriter, uploadedOf } from "./dropbox.js";
import { acceptRev, isFromPlan, isPart, kindOf, lastWritten, readEpisode, recordNumbers, shownName, undone, writeEpisode } from "./episode.js";
import { FOLDER_GONE, LOCK_AGAIN_MS, WAIT_LOOK_FOR_MS, WAIT_LOOK_MS, askAgent, commitOf, dueAt, fileId, judgeEntry, logTo, putOwnRecordBack, ruleOpts, readEveryPending, readPendingAt, recordHolds, removePending, sameFile, settleReading, writePending } from "./filing.js";
import { linksOf, matchedSession } from "./finish.js";
import { partsOf } from "./footage.js";
import { gated, heldName, withShortId } from "./gate.js";
import { releaseEpisodeLock, takeEpisodeLock, lockOf, runningRun } from "./detached.js";
import { episodeFilesFolder, episodeWork, episodesFolder, runsFolder, workFolder } from "./settings.js";
import { workCopyLockOf } from "./workcopy.js";
import { ORIGINALS_FOLDER, keptOnAMac } from "./where.js";

/** The name the move's and the check's lock holds for the episode's own lock, what `status` and a stopped command say it is. */
export const ORIGINALS_COMMAND = "originals";
/** How soon the check looks again at a copy Dropbox has not uploaded yet: every ten minutes, for an hour (WAIT_LOOK_FOR_MS), then once at each run's start. */
export const UPLOAD_LOOK_MS = 10 * 60 * 1000;

/** What a command of hers that meets the move's lock says; the rest of the sentence is how to ask again. */
export const ORIGINALS_RUNNING = "Its recording is being copied into Dropbox.";
/** The notice, posted once, and the guide's line, when the copy in Original files could not be kept whole in Dropbox. */
export const ORIGINALS_PROBLEM = (name) => `The recording of ${name} stays on this Mac: Dropbox didn't keep its copy whole. Ask Jason.`;
/** The guide's and `episodes`' line for a video that became a session after its recording was copied. */
export const ORIGINALS_SESSION = (label) => `The recording of ${label} was copied into Dropbox, in Original files, before it became a session. Dropbox keeps it there and in its history. Jason removes it by hand if he wants.`;

/** Whether a record lists its recording in Original files/ at a whole number of bytes. */
export const listsOriginal = (record) => Boolean(record) && typeof record.video === "object" && record.video !== null && Number.isInteger((record.files || {})[`${ORIGINALS_FOLDER}/${record.video.file}`]);

/** Whether a record's recording has moved into Original files/: it is kept on a Mac and holds `local.original`, or lists the copy. */
export const moved = (record) => keptOnAMac(record) && ((typeof record.local.original === "object" && record.local.original !== null) || listsOriginal(record));

/** Whether the gate holds a recording as a session: a part when the video its import matched is a session not cleared, or it is held beside one (a part is gated as
    a video with no kind always, so only these hold it); any other video when gated, a session, held beside one, or matching one. `links` is finish.js linksOf. */
export function asSession(links, { folder, record }) {
  if (isPart(record)) return matchedSession(links, record, { folder }) || links.sessionsBeside(record, folder).length > 0;
  return gated(record) || kindOf(record) === "session" || links.sessionsBeside(record, folder).length > 0 || matchedSession(links, record, { folder });
}

/** The recordings a video's hand-off owes, as { name, folder, record }: for a video made from a plan, each of its parts (partsOf); for any other, itself. Of those, each
    kept on this Mac (`ctx.machine`) with a recording named, not moved yet, and not held as a session. `ctx` is { root, machine }. */
export function originalsOf(ctx, { folder, record }) {
  const all = isFromPlan(record) ? partsOf(ctx.root, record.id) : [{ name: basename(folder), folder, record }];
  const mine = all.filter((one) => keptOnAMac(one.record) && one.record.local.on === ctx.machine && one.record.video && typeof one.record.video.file === "string" && !moved(one.record));
  if (!mine.length) return [];
  const links = linksOf(ctx.root);
  return mine.filter((one) => !asSession(links, one));
}

const pendingFile = (id) => `original/${id}.json`;

/** The pending that owes the recording of `one`, for the video `of` ({ id, name }) whose hand-off owed it. */
const owedPending = (ctx, one, of) => ({ version: 1, kind: "original", id: one.record.id, name: one.name, folder: one.folder, root: ctx.root, machine: ctx.machine, of, file: one.record.video.file, owed: true, entries: [], work: null, lastCopy: ctx.now() });

/** Owe each recording a video's hand-off owes (originalsOf) that has no pending: a pending written as owed, due at once. With `ask`, the launch agent is asked to run when
    anything was written. A pending already there, or a recording already moved, changes nothing. A write that throws is logged and the next is written. Synchronous. `ctx` is
    { home, root, machine, now, agentRunning, kickstart }. */
export function oweOriginals(ctx, { folder, record }, { ask = true } = {}) {
  const owed = [];
  for (const one of originalsOf(ctx, { folder, record })) {
    if (readPendingAt(ctx.home, pendingFile(one.record.id)) !== null) continue;
    try {
      writePending(ctx.home, owedPending(ctx, one, { id: record.id, name: basename(folder) }));
      owed.push(one.record.id);
    } catch (e) {
      logTo(ctx.home)(`${shownName(one.record)}: its recording could not be noted to go into Original files (${e.code || "an error"}). The launch agent notes it at its next run.`);
    }
  }
  if (ask && owed.length) askAgent(ctx, shownName(record));
  return { owed };
}

/** At a run's start, owe the recording of each handed-off video kept on this Mac that is still in video/, not moved, and owed by no pending: a hand-off writer that stopped
    before it owed, or whose owe could not be written. A part is owed when the video made of its plan has a hand-off. It asks no agent: it is the agent. */
export function oweForgotten({ episode: { root, machine, home }, clock = Date.now, log = () => {} }) {
  const owed = [];
  let names;
  try {
    names = readdirSync(workFolder(home));
  } catch (e) {
    return { owed };
  }
  let links = null;
  for (const name of names) {
    if (name.startsWith(".")) continue;
    try {
      if (!statSync(episodeFilesFolder(home, name), { throwIfNoEntry: false })?.isDirectory()) continue;
      const folder = join(episodesFolder(root), name);
      const read = readEpisode(folder);
      const record = read.record;
      if (!record || read.newer || record.archived || !keptOnAMac(record) || record.local.on !== machine || moved(record) || !record.video || typeof record.video.file !== "string") continue;
      if (!existsSync(join(episodeFilesFolder(home, name), record.video.file))) continue;
      if (readPendingAt(home, pendingFile(record.id)) !== null) continue;
      links ??= linksOf(root);
      let of;
      if (isPart(record)) {
        const video = links.find(record.partOf.id);
        if (!video || !Number.isInteger(video.record.finished && video.record.finished.revision) || asSession(links, { folder, record })) continue;
        of = { id: video.record.id, name: basename(video.folder) };
      } else {
        if (isFromPlan(record) || !Number.isInteger(record.finished && record.finished.revision) || asSession(links, { folder, record })) continue;
        of = { id: record.id, name };
      }
      writePending(home, owedPending({ root, machine, now: clock }, { name, folder, record }, of));
      owed.push(record.id);
      log(`${shownName(record)}: its recording is noted to go into Original files.`);
    } catch (e) {
      log(`an episode's recording could not be noted to go into Original files (${e.code || "an error"}). The launch agent notes it at its next run.`);
    }
  }
  return { owed };
}

const whoOf = (p) => p.label || `an episode (${String(p.id).slice(-6)})`;

/** Make the check of an `original` pending, under the episode's late-check lock (filing.js finishDue), with the pending read again: algorithm M (the move) for one owed, algorithm O
    (the check, and the Mac's copy taken off) for any other. Synchronous; gives nothing; writes or removes its own pending. A throw that is not caught here is finishDue's.
    `deps` are filing.js' check deps: `episode` ({ root, machine, home, checkout }), `log`, `notify`, `clock`, `alive`, `once`, `tools`, and `clone`, `sameDisk`, `isWhole`, `commit` and
    `uploaded` ((path) => true | false | null) when a test gives them. */
export function checkOriginal(p, deps) {
  const home = deps.episode.home;
  const machine = deps.episode.machine;
  const clock = deps.clock;
  const alive = deps.alive;
  const log = deps.log || (() => {});
  const once = deps.once || log;
  const notify = deps.notify || (() => {});
  const whole = deps.isWhole || isWhole;
  const opts = ruleOpts({ ...deps, log });
  const rel = `${ORIGINALS_FOLDER}/${p.file}`;
  const from = join(episodeFilesFolder(home, p.name), p.file);
  const to = join(p.folder, ORIGINALS_FOLDER, p.file);
  const who = whoOf(p);
  let shown = who;
  const code = (e) => e.code || "an error";
  const base = ({ problem: _problem, nextLook: _nextLook, lookUntil: _lookUntil, ...rest }) => rest;
  const putAway = () => {
    try {
      removePending(home, p);
      return true;
    } catch (e) {
      once(`${shown}: its check is made, but it could not be put away (${code(e)}). The next run looks at it again.`);
      return false;
    }
  };
  const wait = (line) => {
    writePending(home, { ...p, nextLook: clock() + WAIT_LOOK_MS, lookUntil: Number.isFinite(p.lookUntil) ? p.lookUntil : clock() + WAIT_LOOK_FOR_MS });
    once(line);
  };
  const putOff = () => {
    writePending(home, { ...p, nextLook: clock() + LOCK_AGAIN_MS });
    once(`${shown}: its recording waits for the run at work on it to end.`);
  };
  const problem = (text) => {
    log(`${shown}: its recording stays on this Mac: ${text}`);
    if (!p.problem) notify(ORIGINALS_PROBLEM(shown));
    const { nextLook: _nextLook, ...rest } = p;
    writePending(home, { ...rest, problem: text });
  };
  const goneAway = () => {
    if (!putAway()) return;
    log(FOLDER_GONE(who));
    notify(FOLDER_GONE(who));
  };
  // 1. The folder, as the checks of final/ have it.
  let list;
  try {
    list = readdirSync(episodesFolder(p.root));
  } catch (e) {
    return wait(`${who}: its check waits: its folder in Episodes cannot be read now. It is looked at again later.`);
  }
  try {
    const folder = list.some((n) => n.normalize("NFC") === basename(p.folder).normalize("NFC")) ? statSync(p.folder, { throwIfNoEntry: false }) : undefined;
    if (!(folder && folder.isDirectory())) return goneAway();
  } catch (e) {
    return wait(`${who}: its check waits: its folder in Episodes cannot be read now. It is looked at again later.`);
  }
  // 2. The record in force.
  const recordLater = `${who}: its check waits: the episode's record cannot be read now. It is looked at again later.`;
  const unreadable = (found) => !found.record || found.newer || (recordNumbers(p.folder)[0] || 0) > found.record.rev;
  let read = readEpisode(p.folder);
  if (unreadable(read)) return wait(recordLater);
  shown = shownName(read.record);
  // 3. The gate, asked before anything else is done (ruling 5).
  const links = linksOf(p.root);
  const held = asSession(links, { folder: p.folder, record: read.record });
  const ours = () => {
    const mine = statSync(from, { throwIfNoEntry: false });
    const copy = statSync(to, { throwIfNoEntry: false });
    // A placeholder is not read, so it is not known to be ours.
    return Boolean(mine && copy && copy.size === mine.size && whole(to) && sameBytes(to, from));
  };
  // A session's recording stays on this Mac. A clone of it this move made and the record never listed is taken away; one that is not known to be ours (a
  // placeholder, or the Mac's copy gone) is left, and the log says it is there, so that Jason removes it by hand if he wants (D6).
  const clearUnlisted = () => {
    if (!existsSync(to) || listsOriginal(read.record)) return;
    // The video is held beside a session here, so it is named as the gate names it (its file's name may be a client's), not by `shown`.
    const as = withShortId(heldName(read.record), read.record);
    if (!ours()) {
      const mine = statSync(from, { throwIfNoEntry: false });
      const copy = statSync(to, { throwIfNoEntry: false });
      const alike = Boolean(mine && copy && copy.size === mine.size);
      log(`${as}: ${alike ? "a copy of its recording" : "a file of its recording's name"} is in Original files in Dropbox, and the record does not list it. Jason removes it by hand if he wants.`);
      return;
    }
    try {
      rmSync(to, { force: true });
    } catch (e) {
      log(`${as}: a copy of its recording in Original files could not be taken away (${code(e)}). Ask Jason.`);
    }
  };
  if (p.owed === true) {
    if (held) {
      clearUnlisted();
      if (putAway()) log(`${withShortId(heldName(read.record), read.record)}: it is held as a session now, so its recording stays on this Mac.`);
      return;
    }
    return move();
  }
  if (held) {
    if (putAway()) log(ORIGINALS_SESSION(heldName(read.record)));
    return;
  }
  return check();

  /** Algorithm M, steps 4-11. */
  function move() {
    // 4. Moved already: a look stopped between its record and its pending.
    const local = read.record.local;
    if (listsOriginal(read.record) && typeof local.original === "object" && local.original !== null) {
      writePending(home, { ...base(p), owed: false, rev: read.record.rev, entries: [{ from, to, bytes: read.record.files[rel] }], macCopy: { size: local.original.bytes, mtimeMs: local.original.mtimeMs }, lastCopy: clock() });
      return;
    }
    // 5. The Mac's copy.
    const fid = fileId(from);
    if (!fid) {
      if (putAway()) log(`${shown}: its recording is no longer on this Mac, so nothing is copied or taken off.`);
      return;
    }
    // 6. The episode's lock, tried once.
    mkdirSync(episodeWork(home, p.name), { recursive: true });
    const took = takeEpisodeLock(lockOf(home, p.name), ORIGINALS_COMMAND, alive);
    if (!took.taken) return putOff();
    try {
      // 7. Earlier writes: a stopped writer's mark is settled before this one writes; a held finish's lost record is put back, and its number never taken.
      const same = (q) => q.id === p.id && q.machine === machine && resolve(String(q.root)) === resolve(String(p.root));
      for (const q of readEveryPending(home).filter((x) => same(x) && x.reading)) {
        if (settleReading(q, { home, log }).later) return wait(`${who}: its check waits: a write stopped while it put its files in, and the episode's record cannot be read now. It is looked at again later.`);
      }
      const finals = () => readEveryPending(home).filter((x) => same(x) && x.kind === "final" && x.rev > read.record.rev && (x.copied === true || recordHolds(x, { isWhole: whole }) === true));
      for (const q of finals()) putOwnRecordBack(q, { isWhole: whole, opts });
      read = readEpisode(p.folder);
      if (unreadable(read)) return wait(recordLater);
      if (finals().length) return wait(recordLater);
      // 8. A change Dropbox undid waits for her command, unless it is this move's own record.
      if (undone(read.record, home)) {
        if (Number.isInteger(p.rev) && lastWritten(home, p.id) === p.rev) acceptRev(home, p.id, read.record.rev);
        else return wait(`${shown}: its recording waits: Dropbox undid this Mac's last change to it, which the next command on it says first. It is looked at again later.`);
      }
      // The gate again, under the lock with a fresh look: a session mark may have come while the earlier writes were settled (ruling 5).
      if (asSession(linksOf(p.root), { folder: p.folder, record: read.record })) {
        clearUnlisted();
        if (putAway()) log(`${withShortId(heldName(read.record), read.record)}: it is held as a session now, so its recording stays on this Mac.`);
        return;
      }
      // 9. The copy.
      if (statSync(to, { throwIfNoEntry: false })) {
        if (!ours()) return problem("Original files in Dropbox holds another file of its name.");
      } else {
        try {
          mkdirSync(dirname(to), { recursive: true });
          cloneIn(from, to, opts);
        } catch (e) {
          return problem(`it could not be copied into Original files (${code(e)}).`);
        }
      }
      // 10. The record, last.
      const next = { ...read.record, files: { ...read.record.files, [rel]: fid.size }, local: { ...read.record.local, original: { file: p.file, bytes: fid.size, mtimeMs: fid.mtimeMs } } };
      const work = join(runsFolder(home), `originals-${process.pid}-${clock()}`);
      let wrote;
      try {
        wrote = writeEpisode(p.folder, next, { expectRev: read.record.rev, writeText: textWriter({ work, ...opts }), writer: { commit: deps.commit || commitOf(deps.episode.checkout), on: machine }, home });
      } catch (e) {
        if (ours()) {
          try {
            rmSync(to, { force: true });
          } catch (err) {
            log(`${shown}: a copy of its recording in Original files could not be taken away (${code(err)}). Ask Jason.`);
          }
        }
        return wait(`${shown}: its copy in Original files could not be listed in its record (${code(e)}), so it is taken away again. It is looked at again later.`);
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
      // 11. The pending, last.
      writePending(home, { ...base(p), owed: false, rev: wrote.rev, entries: [{ from, to, bytes: fid.size }], macCopy: fid, lastCopy: clock() });
      log(`${shown}: its recording is copied into Original files in Dropbox. It leaves this Mac once Dropbox has it uploaded.`);
    } finally {
      releaseEpisodeLock(lockOf(home, p.name), took.text);
    }
  }

  /** Put the copy in Original files back from the recording on this Mac, and start its 15 minutes again. */
  function putBack(what) {
    const e = p.entries[0];
    try {
      mkdirSync(dirname(e.to), { recursive: true });
      if (existsSync(e.to)) replaceIn(e.from, e.to, opts);
      else cloneIn(e.from, e.to, opts);
    } catch (err) {
      return problem(`its copy in Original files could not be put back in Dropbox (${code(err)}).`);
    }
    writePending(home, { ...base(p), lastCopy: clock() });
    log(`${shown}: its copy in Original files was not whole in Dropbox (${what}), so it is put back from the recording on this Mac.`);
  }

  /** Algorithm O, steps 4-9. */
  function check() {
    const e = p.entries[0];
    // 4. Still listed.
    if (read.record.files[rel] !== e.bytes || !(typeof read.record.local.original === "object" && read.record.local.original !== null)) {
      writePending(home, { ...base(p), owed: true, lastCopy: clock() });
      log(`${shown}: the record no longer lists its copy in Original files, so it is listed again.`);
      return;
    }
    // 5. The Mac's copy.
    if (!statSync(e.from, { throwIfNoEntry: false })) {
      if (putAway()) log(`${shown}: its recording is no longer on this Mac, so nothing is copied or taken off.`);
      return;
    }
    const changed = () => {
      if (putAway()) log(`${shown}: its recording on this Mac changed after it was copied into Original files, so it is kept on this Mac.`);
    };
    if (!sameFile(e.from, p.macCopy)) return changed();
    // Table J's rows that only look at the file: a copy not there (J2) or at another size (J3) is put back at once. Dropbox could not say it is uploaded,
    // and no file is a file nothing uploads.
    const stat = statSync(e.to, { throwIfNoEntry: false });
    if (!stat || stat.size !== e.bytes) return putBack(!stat ? "it is not there" : `it is ${stat.size} bytes there, not ${e.bytes}`);
    // 6 and 7. The flag is asked next: a copy Dropbox has not uploaded yet costs no read of the recording. Table J's byte compare comes once it says uploaded.
    const asked = deps.uploaded || ((path) => uploadedOf(path, { swift: (deps.tools && deps.tools.swift) || "" }));
    if (asked(e.to) !== true) {
      writePending(home, { ...base(p), nextLook: clock() + UPLOAD_LOOK_MS, lookUntil: Number.isFinite(p.lookUntil) ? p.lookUntil : clock() + WAIT_LOOK_FOR_MS });
      once(`${shown}: Dropbox has not uploaded its copy in Original files yet, so the recording stays on this Mac. It is looked at again later.`);
      return;
    }
    // The copy in Dropbox, by table J.
    const judged = judgeEntry({ from: e.from, to: e.to, bytes: e.bytes }, p.folder, read.record.files, whole);
    // The record no longer lists it at these bytes (step 4 has met this already): it is listed again, not taken for whole.
    if (judged.left) {
      writePending(home, { ...base(p), owed: true, lastCopy: clock() });
      log(`${shown}: the record no longer lists its copy in Original files, so it is listed again.`);
      return;
    }
    if (judged.put) return putBack(judged.put);
    // 8. No run at work on it.
    const names = [...new Set([p.name, ...(p.of && typeof p.of.name === "string" ? [p.of.name] : [])])];
    if (names.some((n) => runningRun(home, n, alive, workCopyLockOf(home, n)))) return putOff();
    mkdirSync(episodeWork(home, p.name), { recursive: true });
    const took = takeEpisodeLock(lockOf(home, p.name), ORIGINALS_COMMAND, alive);
    if (!took.taken) return putOff();
    let deleted = false;
    try {
      // 9. Under the lock: the gate again with a fresh look (a session mark may have come while the copy was read and the flag asked), and the Mac's copy is deleted if it is still the one that was copied.
      const latest = readEpisode(p.folder);
      if (unreadable(latest)) return wait(recordLater);
      if (asSession(linksOf(p.root), { folder: p.folder, record: latest.record })) {
        if (putAway()) log(ORIGINALS_SESSION(heldName(latest.record)));
        return;
      }
      // The record in force still lists the copy at the move's bytes: if Dropbox lost the move's record meanwhile, nothing is taken off; the copy is owed again.
      const L = latest.record;
      if (L.files[rel] !== e.bytes || !(typeof L.local === "object" && L.local !== null && typeof L.local.original === "object" && L.local.original !== null)) {
        writePending(home, { ...base(p), owed: true, lastCopy: clock() });
        log(`${shown}: the record no longer lists its copy in Original files, so it is listed again.`);
        return;
      }
      if (!sameFile(e.from, p.macCopy)) return changed();
      try {
        rmSync(e.from, { force: true });
      } catch (err) {
        log(`${shown}: its recording could not be taken off this Mac (${code(err)}), so it stays there.`);
        putAway();
        return;
      }
      if (putAway()) log(`${shown}: Dropbox has its copy in Original files uploaded, so the recording is taken off this Mac.`);
      deleted = true;
    } finally {
      releaseEpisodeLock(lockOf(home, p.name), took.text);
    }
    if (!deleted) return;
    // Then Dropbox is asked to free the Mac's disk, with no lock held: its copy is a clone of the one just deleted, sharing its blocks. Never a problem, a notice or a retry.
    let made = null;
    let why = "no answer";
    try {
      made = (deps.onlineOnly || ((path, said) => makeOnlineOnly(path, { swift: (deps.tools && deps.tools.swift) || "", said })))(e.to, (m) => { if (m) why = String(m); });
    } catch (err) {
      why = (err && err.message) || why;
    }
    if (made === true) log(`${shown}: its recording in Original files is made online-only.`);
    else log(`${shown}: its recording in Original files could not be made online-only (${why}); it stays on this Mac's disk until Dropbox frees it.`);
  }
}
