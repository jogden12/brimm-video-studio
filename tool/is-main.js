// Tells an entry point whether it is the script Node was started with. It compares the two files (device and inode)
// rather than their paths, because Node names the main module by its real path while argv[1] keeps the spelling it
// was given: a symlinked folder, /var against /private/var, and the /System/Volumes/Data firmlink are each one file.
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** True when `metaUrl` (the caller's import.meta.url) is the same file as `argv1`, the script Node was started with. */
export function isMain(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  const here = fileURLToPath(metaUrl);
  const given = resolve(argv1);
  try {
    const a = statSync(given);
    const b = statSync(here);
    return a.dev === b.dev && a.ino === b.ino;
  } catch {
    return given === here;
  }
}
