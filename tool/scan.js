// A chat's transcript, read a little at a time (design 2026-10-26, section 1, "Modes", and section 5; R27). The lock check reads from
// it the folders added to the chat while it ran (the `additionalWorkingDirectories` of its latest environment snapshot, C30), and the
// held check its start, the least `timestamp` of any of its lines (a transcript's first line often has none, and a fork's copied
// lines keep the parent's times). A transcript grows while the chat runs and can be large, so each look reads only the bytes added
// since the last, up to the last complete line: a line still being written waits for its newline, and one that does not parse is
// skipped. What a look found, and how far it read, is kept in a scan file of the chat's own in Application Support
// (held/scan-<id>.json), written whole under another name and then renamed; a scan file that cannot be read, or is not JSON, is taken
// as none. The scan starts again from 0 when the transcript is smaller than the offset kept, or is another file (its inode).
// A chat's id is put into the scan file's name only when it is one (SESSION_ID).
import { closeSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";

/** A chat's id as Claude Code gives one: the only shape that is ever put into a file's or folder's name. */
export const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Where brimm-video keeps what it knows of chats (marks, sessions after all, scan files), in Application Support, on this Mac's own
    disk, out of the sandbox's reach. */
export const heldFolder = (home) => join(home, "Library", "Application Support", "BRIMM Video", "held");

/** How much of a transcript is read at once. */
const CHUNK = 1 << 20;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The scan file of the chat `sessionId`, or null when the id is not one. */
function scanFile(home, sessionId) {
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return null;
  const file = join(heldFolder(home), `scan-${sessionId}.json`);
  return dirname(file) === heldFolder(home) ? file : null;
}

/** What the scan file `file` keeps, or null: it is not there, cannot be read, or is not what a scan writes. */
function kept(file) {
  try {
    const s = JSON.parse(readFileSync(file, "utf8"));
    return isObject(s) && Number.isSafeInteger(s.ino) && Number.isSafeInteger(s.offset) && s.offset >= 0 ? s : null;
  } catch (e) {
    return null;
  }
}

/** Write the scan file `file` whole: under a name of its own first, made new (wx), then renamed. One that cannot be written is left
    for the next look, which then reads from where the last kept one ends. */
function keep(file, state) {
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(temporary, JSON.stringify(state), { flag: "wx", mode: 0o600 });
    renameSync(temporary, file);
  } catch (e) {
    rmSync(temporary, { force: true });
  }
}

/** The earlier of two timestamps, either of which may be null. */
const earlier = (a, b) => (a === null ? b : b === null ? a : Date.parse(b) < Date.parse(a) ? b : a);

/** What a look at the transcript `transcriptPath` of the chat `sessionId` finds, in `home`: { start, added, unread }. `start` is the
    least timestamp of any complete line so far, or null while none has one; `added` is the additionalWorkingDirectories of the latest
    line whose attachment is an environment snapshot, or null while there is none; `unread` is true when the transcript cannot be read,
    or the id is not a chat's id (and then nothing is read or written). */
export function scanTranscript({ home, sessionId, transcriptPath }) {
  const none = { start: null, added: null, unread: true };
  const file = scanFile(home, sessionId);
  if (!file || typeof transcriptPath !== "string" || !transcriptPath) return none;
  let fd;
  try {
    fd = openSync(transcriptPath, "r");
  } catch (e) {
    return none;
  }
  try {
    const { ino, size } = fstatSync(fd);
    const was = kept(file);
    const state = was && was.ino === ino && was.offset <= size ? { ...was } : { ino, offset: 0, start: null, added: null };
    let at = state.offset;
    let carry = Buffer.alloc(0);
    while (at < size) {
      const chunk = Buffer.alloc(Math.min(CHUNK, size - at));
      const read = readSync(fd, chunk, 0, chunk.length, at);
      if (read <= 0) break;
      at += read;
      const text = Buffer.concat([carry, chunk.subarray(0, read)]);
      const end = text.lastIndexOf(10);
      if (end < 0) {
        carry = text;
        continue;
      }
      carry = text.subarray(end + 1);
      for (const line of text.subarray(0, end).toString("utf8").split("\n")) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch (e) {
          continue;
        }
        if (!isObject(entry)) continue;
        if (typeof entry.timestamp === "string" && !Number.isNaN(Date.parse(entry.timestamp))) state.start = earlier(state.start, entry.timestamp);
        if (isObject(entry.attachment) && entry.attachment.type === "environment") {
          const dirs = isObject(entry.attachment.snapshot) ? entry.attachment.snapshot.additionalWorkingDirectories : undefined;
          // Folders it cannot read as a list are taken as one folder added, which is not the app's own.
          state.added = Array.isArray(dirs) ? dirs.map((dir) => (typeof dir === "string" ? dir : "")) : dirs === undefined ? [] : [""];
        }
      }
    }
    state.offset = at - carry.length;
    state.size = size;
    keep(file, state);
    return { start: state.start, added: state.added, unread: false };
  } catch (e) {
    return none;
  } finally {
    closeSync(fd);
  }
}
