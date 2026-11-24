// A Reel Kit edit's own record and what its composition is (spec 2026-11-23 Reel Kit in Studio; plan Decisions 5 and 6), split from
// reel-kit-project.js (which re-exports all of it) so that exports.js can judge a Reel Kit render by its edit with no import cycle
// (plan Task 15, fix round 1): it imports only reel-kit.js and node.
//   - stateFile, readCapped, readState: studio.json, Studio's own, read the safe way (reel-kit-project.js writeState writes it);
//   - compositionFingerprint: what the edit is as Reel Kit built it (Decision 6).
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { ODD_INSIDE, entryKind, filesUnder, foldName, manifestFingerprint } from "./reel-kit.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The project's status file, Studio's own (Decision 5): what the edit is, and how far it has got. */
export const stateFile = (dir) => join(dir, "studio.json");
/** The most of studio.json read: it is a few lines, and anything larger is not Studio's. */
const STATE_MOST = 1 << 20;
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;

/** The text of a plain file at `path` of at most `most` bytes, read the safe way: no link followed, no pipe waited on, looked at once it
    is open. null for anything else, or a file that cannot be read whole now. */
export function readCapped(path, most) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.size > most) return null;
    const buffer = Buffer.alloc(opened.size);
    let got = 0;
    while (got < buffer.length) {
      const read = readSync(fd, buffer, got, buffer.length - got, got);
      if (read === 0) break;
      got += read;
    }
    return got === buffer.length ? buffer.toString("utf8") : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** What the project in `dir` says of itself (its studio.json), or null when there is none, or what is there is not a plain file of its
    size holding an object. */
export function readState(dir) {
  const text = readCapped(stateFile(dir), STATE_MOST);
  if (text === null) return null;
  try {
    const state = JSON.parse(text);
    return isObject(state) ? state : null;
  } catch {
    return null;
  }
}

// --- The composition's fingerprint (Decision 6) ---

/** The folders of a project that, with its edit.py, are the composition Reel Kit renders. */
const COMPOSITION = Object.freeze(["fx", "cards", "public"]);
/** What is left out of public/, at its top, by name as the Mac's disk folds it: HyperFrames' snapshots and renders, the app's own
    folder (its transcripts and history), the notes for its agent and its agent's own settings (`.claude/`, where it writes its
    settings.local.json once the app has the project open: plan Task 17, Review Focus 3). None of them is the composition. */
const NOT_COMPOSITION = Object.freeze(["snapshots", "renders", ".hyperframes", "CLAUDE.md", "AGENTS.md", ".claude"]);

/** The fingerprint of the composition in the project `dir`, "sha256-<hex>": the SHA-256 of the sorted manifest of `(path, sha256)`
    (reel-kit.js manifestFingerprint, as a dropped Reel Kit's is made) of its edit.py, and every file under fx/, cards/ and public/,
    leaving out public/'s snapshots/, renders/, .hyperframes/, CLAUDE.md, AGENTS.md and .claude/ (in any spelling the disk takes for them), and
    `.DS_Store` and `._*` anywhere. A link anywhere it looks (edit.py itself, one of the three folders, or inside them), or anything
    that is neither a file nor a folder, throws (the error's `code` reel-kit.js LINK_INSIDE or ODD_INSIDE): no fingerprint is made of
    what a link leads to, so a caller fails closed. A folder that is not there is left out, as is an edit.py that is not. */
export function compositionFingerprint(dir) {
  const files = [];
  const odd = (rel) => Object.assign(new Error(`${rel} is not what a composition holds there`), { code: ODD_INSIDE });
  const edit = join(dir, "edit.py");
  const editKind = entryKind(edit, "edit.py");
  if (editKind === "folder") throw odd("edit.py");
  if (editKind === "file") files.push({ path: edit, rel: "edit.py" });
  const notComposition = new Set(NOT_COMPOSITION.map(foldName));
  for (const top of COMPOSITION) {
    const at = join(dir, top);
    const kind = entryKind(at, top);
    if (kind === "none") continue;
    if (kind !== "folder") throw odd(top);
    const skip = top === "public" ? (rel) => rel.split("/").length === 2 && notComposition.has(foldName(rel.slice("public/".length))) : () => false;
    files.push(...filesUnder(at, { under: top, skip }));
  }
  return manifestFingerprint(files);
}
