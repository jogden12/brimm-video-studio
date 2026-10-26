// Chats that hold a session's words (design 2026-10-26, section 5; R7, R9, R27, R29): a chat that has been shown a session's words
// keeps today's lock, so that nothing a page or a file steers it to do can carry those words out. edit.js marks such a chat before
// it prints anything drawn from a session's words (markChat): the time, the chat's id (CLAUDE_CODE_SESSION_ID) and the `claude`
// process above it, tied when CLAUDE_PID is that process. The guard then holds (chatHeld) a chat whose id is a mark's, whose claude
// is a mark's, or whose transcript began at or before an untied mark or a session after all (noteAfterAll), a fork of a held
// chat, whose transcript holds that chat's message uuids (scan.js), and a fork made after a compaction, whose transcript begins with
// the compaction's lines, from a chat it cannot tell: held for good, its uuids not kept, since they are mostly the lines of the
// chat it was forked from, which they would then hold too. Everything is kept in Application Support (held/), on this Mac's
// own disk, which the sandbox cannot reach, each file made new; and the check fails closed: a marks folder, a mark or a note that
// cannot be read, an id that is not a chat's, or a transcript that cannot be read while any mark or note exists, holds the chat.
//
// On an open-lock Mac, the words themselves never go into command output (which every chat of her folder may read): edit.js writes
// them into a file of the chat's own (writeWords), in BRIMM Video Words/<the chat's id>/, which only that chat's Read reaches (the
// guard's carve-out), and takes such files away a day later (clearOldWords).
import { linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { chainUp, claudeAbove } from "./chain.js";
import { SESSION_ID, heldFolder, scanTranscript, uuidsFile, uuidsOf } from "./scan.js";

export const HELD_REFUSED = "This chat holds a session's words, so it can only run brimm-video now. Start a new chat for anything else.";
export const HELD_NARROWED = "This chat holds a session's words, so it can't do that here. Start a new chat for it.";

/** Where a session's words are handed over to the chat that asked for them, a folder for each chat's id, in Application Support. */
export const wordsFolder = (home) => join(home, "Library", "Application Support", "BRIMM Video Words");

/** A record's id, and the names of the files the held folder keeps. */
const RECORD_ID = /^e-\d{8}-[0-9a-f]{6}$/;
const MARK = /^mark-\d+-[0-9a-f]{6}\.json$/;
const NOTE = /^after-all-(e-\d{8}-[0-9a-f]{6})-(owed|[1-9]\d*)-(\d+)\.json$/;
/** How long a chat's words file is kept. */
const DAY = 24 * 3600 * 1000;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isTime = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isRevision = (r) => r === "owed" || (Number.isInteger(r) && r >= 1);
const isChat = (id) => typeof id === "string" && SESSION_ID.test(id);

/** Write `value` as JSON into the held folder as `name`, made new: whole under a name of its own first, then linked to `name`, which
    fails as `wx` would when `name` is there; mode 600. Throws when it cannot, EEXIST among the reasons. */
function writeNew(home, name, value) {
  const folder = heldFolder(home);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const temporary = join(folder, `.${name}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(value)}\n`, { flag: "wx", mode: 0o600 });
  try {
    linkSync(temporary, join(folder, name));
  } finally {
    rmSync(temporary, { force: true });
  }
}

const markName = (ms) => `mark-${ms}-${randomBytes(3).toString("hex")}.json`;

/** Mark the chat edit.js runs in as one shown a session's words, at `now`: its id (`env.CLAUDE_CODE_SESSION_ID`) and the `claude`
    process above `pid` in the process table `table` (chain.js), tied when the id is a chat's, a claude is found and `env.CLAUDE_PID`
    is that claude. A mark that is not tied holds every chat begun before it. Throws when it cannot write the mark. */
export function markChat({ home, env = {}, table, pid, now = Date.now() }) {
  const ms = Number(now);
  const session = typeof env.CLAUDE_CODE_SESSION_ID === "string" && env.CLAUDE_CODE_SESSION_ID ? env.CLAUDE_CODE_SESSION_ID : null;
  const above = table instanceof Map ? claudeAbove(chainUp(table, pid)) : null;
  const claude = above ? { pid: above.pid, start: above.start } : null;
  const tied = Boolean(isChat(session) && claude && String(claude.pid) === env.CLAUDE_PID);
  writeNew(home, markName(ms), { at: new Date(ms).toISOString(), session, claude, tied });
  return { tied };
}

/** The mark settings.js studio writes when it first writes the open lock (R7): tied to no chat, so that every chat begun before it,
    which may have been shown a session's words before chats were marked, is held for good. Throws when it cannot write it. */
export function untiedMark({ home, now = Date.now() }) {
  const ms = Number(now);
  writeNew(home, markName(ms), { at: new Date(ms).toISOString(), session: null, claude: null, tied: false });
}

/** Note that the video `id` was found a session after all, its record's `revision` (session.emptyRevision) seen at `at` (R9): every
    chat begun at or before then is held. Each note is a file of its own, so two runs at once lose none; one already there is kept.
    Nothing is written for an id or a revision that is not a record's own shape. */
export function noteAfterAll({ home, id, revision, at }) {
  if (typeof id !== "string" || !RECORD_ID.test(id) || !isRevision(revision) || !isTime(at)) return;
  try {
    writeNew(home, `after-all-${id}-${revision}-${Date.parse(at)}.json`, { id, revision, at });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
}

/** The held folder's names, [] when there is none, or null when it cannot be read. */
function heldNames(home) {
  try {
    return readdirSync(heldFolder(home));
  } catch (e) {
    return e.code === "ENOENT" ? [] : null;
  }
}

/** A mark as markChat or untiedMark wrote it, or null when it cannot be read or is not one. */
function readMark(home, name) {
  if (!MARK.test(name)) return null;
  try {
    const m = JSON.parse(readFileSync(join(heldFolder(home), name), "utf8"));
    const claudeWhole = isObject(m) && (m.claude === null || (isObject(m.claude) && Number.isInteger(m.claude.pid) && typeof m.claude.start === "string"));
    return claudeWhole && isTime(m.at) && (m.session === null || typeof m.session === "string") && typeof m.tied === "boolean" ? m : null;
  } catch (e) {
    return null;
  }
}

/** A session after all's note as noteAfterAll wrote it, { id, revision, at }, or null when it cannot be read or is not one. */
function readNote(home, name) {
  const named = NOTE.exec(name);
  if (!named) return null;
  try {
    const n = JSON.parse(readFileSync(join(heldFolder(home), name), "utf8"));
    return isObject(n) && n.id === named[1] && String(n.revision) === named[2] && isTime(n.at) ? n : null;
  } catch (e) {
    return null;
  }
}

/** Whether a session after all of the video `id`, at its record's `revision`, is noted already. */
export function afterAllNoted(home, id, revision) {
  if (typeof id !== "string" || !RECORD_ID.test(id) || !isRevision(revision)) return false;
  return (heldNames(home) || []).some((name) => name.startsWith(`after-all-${id}-${revision}-`) && NOTE.test(name));
}

/** The latest time each video was noted a session after all, by its id. A note that cannot be read is left out here; the held check
    holds every chat for it. */
export function afterAllTimes(home) {
  const times = new Map();
  for (const name of heldNames(home) || []) {
    const note = name.startsWith("after-all-") ? readNote(home, name) : null;
    if (note && (!times.has(note.id) || Date.parse(note.at) > Date.parse(times.get(note.id)))) times.set(note.id, note.at);
  }
  return times;
}

/** What the held folder says: the marks, the times that hold every chat begun at or before them (an untied mark's, a session after
    all's), and the held chats whose uuids are kept, by id; or null when the folder, a mark or a note cannot be read. */
function heldState(home) {
  const names = heldNames(home);
  if (!names) return null;
  const marks = [];
  const times = [];
  for (const name of names) {
    if (name.startsWith("mark-")) {
      const mark = readMark(home, name);
      if (!mark) return null;
      marks.push(mark);
      if (!mark.tied) times.push(mark.at);
    } else if (name.startsWith("after-all-")) {
      const note = readNote(home, name);
      if (!note) return null;
      times.push(note.at);
    }
  }
  const kept = names.map((name) => /^(.+)\.uuids\.json$/.exec(name)).filter((found) => found && isChat(found[1])).map((found) => found[1]);
  return { marks, times, uuids: names.some((name) => name.endsWith(".uuids.json")), kept };
}

/** The uuids kept for a held chat, { uuids, compactions }, or null when none are kept, or they cannot be read. */
function keptUuids(file) {
  try {
    const kept = JSON.parse(readFileSync(file, "utf8"));
    return isObject(kept) && Array.isArray(kept.uuids) ? { uuids: kept.uuids, compactions: Number.isSafeInteger(kept.compactions) ? kept.compactions : 0 } : null;
  } catch (e) {
    return null;
  }
}

/** Keep the message uuids of the held chat `sessionId`, from its transcript so far, so that a fork of it is held (scan.js): when
    none are kept yet, and again, all of them with those kept before, when the transcript has been compacted more times
    (`compactions`, from its scan) than when they were kept, since a fork made after carries only the lines from there on. A
    transcript with no uuid yet keeps nothing, and the next call tries again; so does one that cannot be read. */
function keepUuids(home, sessionId, transcriptPath, compactions = 0) {
  const file = uuidsFile(home, sessionId);
  if (!file || typeof transcriptPath !== "string") return;
  const kept = keptUuids(file);
  if (kept && kept.uuids.length && compactions <= kept.compactions) return;
  const uuids = uuidsOf(transcriptPath);
  if (!uuids || !uuids.length) return;
  const all = kept ? [...kept.uuids, ...uuids.filter((uuid) => !kept.uuids.includes(uuid))] : uuids;
  const value = { uuids: all, compactions: Math.max(compactions, kept ? kept.compactions : 0) };
  try {
    if (!kept) {
      writeNew(home, `${sessionId}.uuids.json`, value);
      return;
    }
    const temporary = join(heldFolder(home), `.${sessionId}.uuids.json.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
    try {
      writeFileSync(temporary, `${JSON.stringify(value)}\n`, { flag: "wx", mode: 0o600 });
      renameSync(temporary, file);
    } finally {
      rmSync(temporary, { force: true });
    }
  } catch (e) {
    // Another call kept them first, or the folder cannot be written: the next call tries again.
  }
}

/** Where the guard notes that her folder kept the open lock's shape while the lock in effect was strict (studio.js guardDecision
    then answers, and edit.js prints a session's words into command output, which chats with the open lock may read). */
const strictSeenFile = (home) => join(heldFolder(home), "strict-seen.json");

/** Note, once, that her folder kept the open shape under the strict lock, at `now`. One that cannot be written is left: the next
    call tries again. */
export function noteStrictSeen(home, now = Date.now()) {
  try {
    writeNew(home, "strict-seen.json", { at: new Date(Number(now)).toISOString() });
  } catch (e) {
    // There already, or not writable now.
  }
}

/** Whether her folder was seen with the open shape under the strict lock since settings.js studio last wrote the open lock; a held
    folder that cannot be looked in counts as seen. */
export function strictSeen(home) {
  try {
    lstatSync(strictSeenFile(home));
    return true;
  } catch (e) {
    return e.code !== "ENOENT";
  }
}

/** Take the note away, once settings.js studio has marked the chats of that time and taken away their command output. */
export const clearStrictSeen = (home) => rmSync(strictSeenFile(home), { force: true });

/** Whether the chat `sessionId`, whose transcript is `transcriptPath` and whose claude process is `claude` ({ pid, start }, null for
    none, or "unknown" when the claude above could not be found),
    holds a session's words: a mark's id is its id; a mark's claude is its claude; an untied mark's or a session after all's time is
    at or after its transcript's start (the least timestamp of any line; none at all, while such a time exists, holds it); or its
    transcript holds a held chat's message uuid (a fork), or begins with a compaction's (a fork made after one). When it holds a chat
    it keeps that chat's uuids, and it keeps those of each marked or held chat whose transcript lies beside this one, again after
    each compaction, so that a fork made before that chat is asked again is held too. A fork made after a compaction it holds
    without keeping its uuids: they are mostly the lines of the chat it was forked from, which they would hold for good, and its
    own transcript always begins so, which holds it at each call.
    It fails closed: an id that is not a chat's, a held folder, a mark or a note that cannot be read, or a transcript that cannot be
    read while any mark or note exists, holds the chat; with none, it lets the chat go without reading its transcript. */
export function chatHeld({ home, sessionId, transcriptPath, claude = null }) {
  if (!isChat(sessionId)) return true;
  const state = heldState(home);
  if (!state) return true;
  const { marks, times } = state;
  const hold = (scan = scanTranscript({ home, sessionId, transcriptPath })) => {
    keepUuids(home, sessionId, transcriptPath, scan.compactions);
    return true;
  };
  if (marks.some((mark) => mark.session === sessionId)) return hold();
  if (isObject(claude) && marks.some((mark) => mark.claude && mark.claude.pid === claude.pid && mark.claude.start === claude.start)) return hold();
  // A claude that cannot be found may be a mark's: held for this call, and not kept, since it is not known.
  if (claude === "unknown" && marks.some((mark) => mark.claude)) return true;
  if (!marks.length && !times.length && !state.uuids) return false;
  // The uuids of each marked chat, and of each held chat, whose transcript lies beside this one, kept again when it has been compacted
  // since: a fork made after its compaction may come before its own next call.
  if (typeof transcriptPath === "string") {
    const others = new Set([...marks.map((mark) => mark.session).filter(isChat), ...state.kept]);
    others.delete(sessionId);
    for (const other of others) {
      const beside = join(dirname(transcriptPath), `${other}.jsonl`);
      const look = scanTranscript({ home, sessionId: other, transcriptPath: beside });
      if (!look.unread) keepUuids(home, other, beside, look.compactions);
    }
  }
  const scan = scanTranscript({ home, sessionId, transcriptPath });
  if (scan.unread) return true;
  if (scan.forked) return hold(scan);
  if (scan.compactedFirst) return true;
  if (times.length && (scan.start === null || times.some((at) => Date.parse(at) >= Date.parse(scan.start)))) return hold(scan);
  return false;
}

/** A label as part of a file's name: each `/`, `:`, `\` and control character a space, leading dots and spaces dropped, 80
    characters at most, and "video" when nothing is left. */
export function safeName(text) {
  const plain = String(text ?? "").replace(/[/:\\\p{Cc}]/gu, " ").replace(/^[.\s]+/u, "");
  const short = [...plain].slice(0, 80).join("");
  return short === "" ? "video" : short;
}

const two = (n) => String(n).padStart(2, "0");

/** Hand a session's words, `text`, over to the chat `sessionId` in a file of its own: `<label> <what> <YYYY-MM-DD HHMMSS>.txt` in
    BRIMM Video Words/<sessionId>/ (made mode 700), made new (wx) and mode 600, ` 2`, ` 3`… added when the name is taken. Gives its
    path. Throws, writing nothing, for an id that is not a chat's, or a folder that is not directly inside the words folder. */
export function writeWords({ home, sessionId, label, what, text, now = Date.now() }) {
  if (!isChat(sessionId)) throw new Error("the chat's id is not one");
  const words = wordsFolder(home);
  const folder = join(words, sessionId);
  if (dirname(resolve(folder)) !== resolve(words)) throw new Error("the chat's folder is not in the words folder");
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (!lstatSync(folder).isDirectory()) throw new Error("the chat's folder is not a folder");
  const d = new Date(Number(now));
  const base = `${safeName(label)} ${safeName(what)} ${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
  for (let n = 1; n <= 1000; n += 1) {
    const file = join(folder, n === 1 ? `${base}.txt` : `${base} ${n}.txt`);
    try {
      writeFileSync(file, String(text), { flag: "wx", mode: 0o600 });
      return file;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  throw new Error("no free name for the words file");
}

/** Take away the words files a day old or older, and then each chat's folder left empty. */
export function clearOldWords(home, now = Date.now()) {
  const words = wordsFolder(home);
  let chats;
  try {
    chats = readdirSync(words);
  } catch (e) {
    return;
  }
  for (const chat of chats) {
    const folder = join(words, chat);
    try {
      if (!lstatSync(folder).isDirectory()) continue;
      for (const name of readdirSync(folder)) {
        const file = join(folder, name);
        const st = lstatSync(file);
        if (!st.isDirectory() && Number(now) - st.mtimeMs >= DAY) rmSync(file, { force: true });
      }
      if (readdirSync(folder).length === 0) rmdirSync(folder);
    } catch (e) {
      // A folder or file that cannot be looked at is left for the next time.
    }
  }
}
