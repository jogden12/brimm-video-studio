// Building beside, swapping in and undoing, for Reel Kit's install (reel-kit-install.js, reel-kit-stages.js; plan Task 5).
//
// A stage never changes the thing in use in place (gotchas, "Data and records": build beside then swap, never delete then copy). It
// builds under `<target>.new` (fresh), and swapIn sets the thing in use aside under `<target>.old` and renames the new one in, noting
// both in the run's journal. Once the whole install has passed its check, commit takes the set-aside ones away; until then rollBack
// can put every one back, newest first. recover tidies what a run that ended halfway left. Everything it takes away is Studio's own,
// inside the work folder, and a link is taken away itself, never what it leads to.
import { lstatSync, mkdirSync, renameSync, rmSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** What is at a path, without following a link: "folder", "file", "link", "other" or "". */
export function kindOf(path) {
  try {
    const s = lstatSync(path);
    return s.isSymbolicLink() ? "link" : s.isDirectory() ? "folder" : s.isFile() ? "file" : "other";
  } catch {
    return "";
  }
}
export const there = (path) => kindOf(path) !== "";

/** Takes away what Studio made at `path` (a folder whole, a file or a link itself, never what a link leads to), and only inside the
    work folder. */
export function takeAway(ctx, path) {
  const at = resolve(path);
  if (!at.startsWith(`${resolve(ctx.paths.work)}/`)) throw new Error(`takeAway: ${at} is outside the work folder`);
  const kind = kindOf(at);
  if (kind === "folder") rmSync(at, { recursive: true, force: true });
  else if (kind !== "") unlinkSync(at);
}

/** A clean `.new` beside `target` to build in. */
export function fresh(ctx, target, { folder = true } = {}) {
  const made = `${target}.new`;
  takeAway(ctx, made);
  mkdirSync(folder ? made : dirname(made), { recursive: true });
  return made;
}

/** Puts `made` in place of `target`: the thing in use (if any) is set aside under `.old` and the journal remembers it, for the
    runner to take away once the install has passed its check, or to put back when it has not. */
export function swapIn(ctx, made, target) {
  const aside = `${target}.old`;
  takeAway(ctx, aside);
  const had = there(target);
  if (had) renameSync(target, aside);
  try {
    renameSync(made, target);
  } catch (e) {
    if (had) renameSync(aside, target);
    throw e;
  }
  ctx.journal.push({ target, aside: had ? aside : null });
}

/** Undoes the journal, newest first: what was swapped in is taken away and what was set aside goes back. True when all of it went back. */
export function rollBack(ctx) {
  let whole = true;
  for (const { target, aside } of ctx.journal.splice(0).reverse()) {
    try {
      takeAway(ctx, target);
      if (aside) renameSync(aside, target);
    } catch {
      whole = false;
    }
  }
  return whole;
}

/** Takes away what the journal set aside: the install is whole. */
export function commit(ctx) {
  for (const { aside } of ctx.journal.splice(0)) if (aside) takeAway(ctx, aside);
}

/** Before a run: a `.old` whose target is missing (a run that ended halfway through a swap) is put back, any other `.old` and every
    `.new` are taken away. */
export function recover(ctx, target) {
  const aside = `${target}.old`;
  if (there(aside) && !there(target)) renameSync(aside, target);
  takeAway(ctx, aside);
  takeAway(ctx, `${target}.new`);
}
