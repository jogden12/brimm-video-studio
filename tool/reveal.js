// What brimm-video opens and shows on this Mac (design 2026-10-26, section 1, "What brimm-video opens and shows"; R12). Every app
// that opens a file, and Finder for every folder it shows, keeps the path in a recent list or its preferences, which a sandboxed
// command can read through macOS's preferences service, and an episode's folder is named from the dropped file, which for a session
// may name a client. So on a Mac whose lock in effect is open, `show` and `which` copy into ~/BRIMM Video Work/shown/<the video's
// id>/, and every Finder reveal (`guide … show`, the withdrawal of a session after all, `finish`) shows a copy there, named by the
// video's label, never a path in an episode's folder; a copy that cannot be made is not shown, and the caller says so. A strict Mac
// opens and reveals as it always did. Every copy is listed by its folder's marker before it is made, and `behind` takes away what
// the markers list (clearShownIn), in the episodes' own shown/ folders and in these.
import { chmodSync, constants as fsConstants, copyFileSync, lstatSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { effectiveLock, workFolder } from "./settings.js";
import { fileSafe } from "./names.js";

/** What is said of the video called `label` when it cannot be opened or shown but by its own file, whose name may be a client's. */
export const cantOpen = (label) => `${label} can't be opened on this Mac without showing its file's name: ask Jason.`;

/** A record's id as it may name a folder: letters, digits and dashes, as the import makes one ("e-20261014-3fa9c1"). */
const PLAIN_ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/** Where copies of the video whose record's id is `id` are put on an open-lock Mac: ~/BRIMM Video Work/shown/<id>/, a name that is
    no file's and no client's. An id that is not a plain name throws: nothing is copied for it. */
export function shownByIdFolder(home, id) {
  if (typeof id !== "string" || !PLAIN_ID.test(id)) throw Object.assign(new Error("its id cannot name a folder"), { code: "EINVAL" });
  return join(workFolder(home), "shown", id);
}

/** Make the folder `dir` of shownByIdFolder, and check it, and the shown/ folder it is in, are folders and not links: a copy is never
    put through a link. Throws when either is not. */
export function madeShownByIdFolder(dir) {
  mkdirSync(dir, { recursive: true });
  for (const at of [join(dir, ".."), dir]) {
    if (!lstatSync(at).isDirectory()) throw Object.assign(new Error("its folder is not one"), { code: "ENOTDIR" });
  }
}

/** The file in a shown/ folder that lists what brimm-video put into it (showCopy, whichCommand, revealed): `behind` takes away those
    files alone, and only from a folder that has it (clearShownIn). */
export const SHOWN_MARKER = ".brimm-shown.json";

/** The names the marker in the shown/ folder `dir` lists, or null when it has none that can be read. Only a plain name in the folder
    counts: never a path, nor the marker itself. */
function shownListed(dir) {
  try {
    const read = JSON.parse(readFileSync(join(dir, SHOWN_MARKER), "utf8"));
    if (read === null || typeof read !== "object" || !Array.isArray(read.files)) return null;
    return read.files.filter((name) => typeof name === "string" && name !== "" && name !== "." && name !== ".." && name !== SHOWN_MARKER && !/[/\\\u0000]/.test(name));
  } catch (e) {
    return null;
  }
}

/** Have the marker in `dir` list `names`, and take it away when there are none. */
function listShown(dir, names) {
  const file = join(dir, SHOWN_MARKER);
  if (!names.length) rmSync(file, { force: true });
  else writeFileSync(file, `${JSON.stringify({ files: [...new Set(names)] })}\n`);
}

/** Add `name` to what the marker in `dir` lists, before the file is put there: a file listed and not there is passed over. */
export const addShown = (dir, name) => listShown(dir, [...(shownListed(dir) || []), name]);

/** Take away from the shown/ folder `dir` the files its marker lists that `only` takes, each on its own: a file or a link, never a
    folder, and nothing inside one; then the marker, once it lists nothing that is left, and the folder, once nothing else is in it.
    A folder that is not one (a link to one included), or has no marker, is left as it is. Gives back the names still listed, or
    null for such a folder. */
export function clearShownIn(dir, only = () => true) {
  const at = lstatSync(dir, { throwIfNoEntry: false });
  if (!at || !at.isDirectory()) return null;
  const listed = shownListed(dir);
  if (listed === null) return null;
  const left = [];
  for (const name of listed) {
    const file = join(dir, name);
    const found = lstatSync(file, { throwIfNoEntry: false });
    if (!found) continue;
    if (found.isDirectory() || !only(name)) {
      left.push(name);
      continue;
    }
    try {
      rmSync(file);
    } catch (e) {
      left.push(name);
    }
  }
  listShown(dir, left);
  if (!left.length) {
    try {
      rmdirSync(dir);
    } catch (e) {
      // Something brimm-video did not put there is in it, and stays.
    }
  }
  return left;
}

/** A name in `dir` for a copy named `base` with its `ending` that nothing there has: "<base><ending>", then "<base> 2<ending>" and on.
    Nothing in shown/ is ever written over, a file brimm-video did not list (an older brimm-video's copy) least of all. */
export function freeShownName(dir, base, ending) {
  for (let n = 1; ; n++) {
    const name = `${base}${n > 1 ? ` ${n}` : ""}${ending}`;
    if (!lstatSync(join(dir, name), { throwIfNoEntry: false })) return name;
  }
}

/** A hand-off's ending, which a copy of one keeps whole. */
const HANDOFF = ".brimm-ops.json";

/** Show the file at `path`, of the video whose record is `record` and which is called `label`, in Finder, through `run` (this Mac's
    program runner). Strict (the lock in effect, from this Mac's `settings` and `minimum`, settings.js effectiveLock): `open -R` of
    the file itself, as always. Open: it is copied into shownByIdFolder, named by the label as `show` and `which` name theirs (a
    hand-off "<label>.brimm-ops.json", anything else "<label><its ending>"; a default label holds a ":" and a label may hold a "/",
    which fileSafe takes out, and a name taken is never written over), listed by the folder's marker first, a video by `clone` (a
    clone takes no room) and anything else as a read-only copy; and that copy is shown. True when it was shown; false when the copy
    could not be made, and nothing was shown: the caller then says cantOpen(label). */
export async function revealed({ home, settings, minimum, run, record, label, path, clone }) {
  if (effectiveLock(settings, minimum) !== "open") {
    await run("/usr/bin/open", ["-R", path]);
    return true;
  }
  let copy = "";
  try {
    const dir = shownByIdFolder(home, record && record.id);
    madeShownByIdFolder(dir);
    const name = freeShownName(dir, fileSafe(label), path.endsWith(HANDOFF) ? HANDOFF : extname(path));
    addShown(dir, name);
    copy = join(dir, name);
    if (clone) clone(path, copy);
    else {
      copyFileSync(path, copy, fsConstants.COPYFILE_EXCL);
      chmodSync(copy, 0o444);
    }
  } catch (e) {
    return false;
  }
  await run("/usr/bin/open", ["-R", copy]);
  return true;
}
