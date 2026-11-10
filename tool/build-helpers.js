// Compiles Studio's five helpers with swiftc into a folder, as brimm-<name>: node tool/build-helpers.js <folder>.
// The app's build runs this, then puts the folder's files beside node. It signs nothing, because the build signs inside-out
// itself, and it writes nothing but the helpers.
import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { HELPERS, helperSource } from "./helpers.js";
import { isMain } from "./is-main.js";
import { lastLine } from "./run.js";

/** Compiles each helper into `folder`. Returns the exit code; says what it did to `out` and `err`. */
export function buildHelpers(args, { out = (s) => process.stdout.write(s), err = (s) => process.stderr.write(s) } = {}) {
  if (args.length !== 1) {
    err("Give it the folder to put the helpers in: node tool/build-helpers.js <folder>\n");
    return 2;
  }
  const folder = args[0];
  mkdirSync(folder, { recursive: true });
  for (const name of HELPERS) {
    const target = join(folder, `brimm-${name}`);
    const r = spawnSync("swiftc", ["-O", "-target", "arm64-apple-macos13.0", "-o", target, helperSource(name)], { encoding: "utf8" });
    if (r.error?.code === "ENOENT") {
      err("swiftc is not on this Mac: it comes with Xcode's command line tools. Nothing more was compiled.\n");
      return 1;
    }
    if (r.error || r.status !== 0) {
      rmSync(target, { force: true });
      err(`brimm-${name} could not be compiled (${lastLine(r.error ? r.error.message : r.stderr)}). Nothing more was compiled.\n`);
      return 1;
    }
    out(`Compiled brimm-${name}.\n`);
  }
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = buildHelpers(process.argv.slice(2));
