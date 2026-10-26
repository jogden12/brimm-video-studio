// Her note on this Mac, for the guide (spec 2026-10-25): the BRIMM Ops steps she has done for each hand-off, by the hand-off's id,
// and when she said each video was finished, by its record's id. It is kept in Application Support, beside the settings, and is
// this Mac's alone. It is in a file of its own so that settings.js is not changed. guide.js says what the note means; this file
// only reads and writes it.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { OPS } from "./guide.js";

/** Where this Mac keeps her note for the guide. */
export const guideFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "guide.json");

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isTime = (v) => typeof v === "string" && Number.isFinite(Date.parse(v));
/** A record's id, or a hand-off's, as newId makes it. */
const isId = (v) => /^e-\d{8}-[0-9a-f]{6}$/.test(v);
/** Every step a note may hold, of any kind of hand-off, the withdrawal among them. */
const STEPS = Object.values(OPS).flat();
/** Her note on one hand-off (Note): what it is kept as, a step the BRIMM Ops page has, the revision she took, and when. */
const isNote = (n) =>
  isObject(n) && ["episode", "short video", "session"].includes(n.kind) && STEPS.includes(n.step) && Number.isInteger(n.revision) && n.revision >= 1 && isTime(n.at);

/** The entries of `v` whose key is an id and whose value passes `each`; none when `v` is not an object. */
const kept = (v, each) => (isObject(v) ? Object.fromEntries(Object.entries(v).filter(([id, x]) => isId(id) && each(x))) : {});

/** Her notes on this Mac (Notes), as guide.json has them. A file that is missing, cannot be read, or is not version 1 of the note
    reads as no note at all, and an entry not shaped as one is left out: the guide then starts that video's steps at the first, and
    she says "I've done that" to move on. */
export function readGuideNotes(home) {
  let notes = null;
  try {
    notes = JSON.parse(readFileSync(guideFile(home), "utf8"));
  } catch (e) {
    // There is none yet, or it cannot be read, and it reads as no note.
  }
  if (!isObject(notes) || notes.version !== 1) return { version: 1, handoffs: {}, finished: {} };
  return { version: 1, handoffs: kept(notes.handoffs, isNote), finished: kept(notes.finished, isTime) };
}

/** Write her notes, whole, under another name and then renamed, which is safe on this Mac's own disk. Unlike written.json, a note
    that cannot be written is not let go: what is half-written is removed, and the error is thrown again, with its code, for
    edit.js to tell her. */
export function writeGuideNotes(home, notes) {
  const file = guideFile(home);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.writing`, JSON.stringify(notes, null, 2) + "\n");
    renameSync(`${file}.writing`, file);
  } catch (e) {
    rmSync(`${file}.writing`, { force: true });
    throw e;
  }
}
