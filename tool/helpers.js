// Where Studio's helpers are. Xcode's command line tools are not on an installed Mac, so the helpers are compiled ahead of
// time: each is tool/<name>.swift, built as brimm-<name> and put in node's own folder, beside the node that runs Studio.
// That folder is the only place looked in; no setting or environment variable names another. On a Mac that has Xcode's
// command line tools (dev mode), where findPrograms has found swift, a helper with no compiled copy is run by swift from
// its .swift file instead. Every caller starts `program` with `[...args, ...its own arguments]`, never through a shell.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The helpers, by name: each is tool/<name>.swift, compiled as brimm-<name>. */
export const HELPERS = ["faces", "progress", "uploaded", "online-only", "read-through"];

/** The folder of the node that runs Studio: in the app, where its programs and compiled helpers are. */
export const ownBin = () => dirname(process.execPath);

const known = (name) => {
  if (!HELPERS.includes(name)) throw new Error(`There is no helper named ${name}.`);
};

/** The absolute path of tool/<name>.swift. */
export function helperSource(name) {
  known(name);
  return join(dirname(fileURLToPath(import.meta.url)), `${name}.swift`);
}

/** brimm-<name> in `bin`, when it is there. */
export function compiledHelper(name, { bin = ownBin(), exists = existsSync } = {}) {
  known(name);
  const program = join(bin, `brimm-${name}`);
  return exists(program) ? { program, args: [] } : null;
}

/** The compiled helper, else swift with the helper's source when `swift` is given, else none. */
export function helperCommand(name, { swift = "", bin = ownBin(), exists = existsSync } = {}) {
  const compiled = compiledHelper(name, { bin, exists });
  if (compiled) return compiled;
  return swift ? { program: swift, args: [helperSource(name)] } : null;
}

/** Whether Xcode's command line tools are on this Mac. xcode-select says where they are, and ends badly when they are nowhere. */
export const hasXcodeTools = () => spawnSync("/usr/bin/xcode-select", ["-p"], { stdio: "ignore" }).status === 0;
