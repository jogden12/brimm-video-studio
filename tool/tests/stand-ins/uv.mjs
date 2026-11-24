// A stand-in for uv, for tests of Reel Kit's install (reel-kit-install.js; plan Task 5): no test runs the real uv. It makes the
// folders a real uv would, and nothing else:
//   - `python install <version>` puts a Python into UV_PYTHON_INSTALL_DIR, at cpython-<version>-macos-aarch64-none/bin/python3.12
//     (a small /bin/sh script that writes each run to the log) with python3 a link beside it;
//   - `python find <version>` prints where that Python is, or ends 2 when there is none;
//   - `venv [--relocatable] --python <python> <folder>` makes <folder>/bin/python (the same small script),
//     <folder>/lib/python3.12/site-packages/ and a pyvenv.cfg naming the Python's folder (and `relocatable = true`);
//   - `pip install --python <python> --require-hashes --no-deps -r <lock>` writes installed.txt (the lock's path) into that
//     environment's site-packages. A pip install without --require-hashes, --no-deps or a lock that is there ends 2.
// Anything else ends 2.
//
// It is run in the install's own environment, which carries no variable of a test's, so the test bakes the log's path into the
// small script that runs it (UV_STAND_IN_LOG=<log> exec node uv.mjs "$@"). Each run is a JSON line of the log: its arguments and
// the uv and Reel Kit variables it was given. A file uv-stand-in.json beside the log, `{ "fail": "<the first words>" }`, makes the
// run whose arguments begin with those words print a line on stderr and end 1.
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const log = process.env.UV_STAND_IN_LOG;
if (!log) {
  console.error("uv stand-in: no UV_STAND_IN_LOG");
  process.exit(2);
}
const SEEN = ["UV_OFFLINE", "UV_PYTHON_INSTALL_DIR", "UV_PYTHON_PREFERENCE", "UV_PYTHON_DOWNLOADS", "UV_PYTHON_INSTALL_BIN", "UV_NO_CONFIG", "UV_CACHE_DIR", "PIP_NO_INDEX", "HF_HUB_OFFLINE", "REEL_KIT_HOME"];
const env = Object.fromEntries(SEEN.filter((name) => name in process.env).map((name) => [name, process.env[name]]));
appendFileSync(log, `${JSON.stringify({ args, env })}\n`);

let scenario = {};
try {
  scenario = JSON.parse(readFileSync(join(dirname(log), "uv-stand-in.json"), "utf8"));
} catch {
  // No scenario: every run does what it says.
}
if (typeof scenario.fail === "string" && args.join(" ").startsWith(scenario.fail)) {
  console.error(`uv stand-in: ${scenario.fail} failed, as the test asked`);
  process.exit(1);
}

const quote = (text) => `'${String(text).replace(/'/g, "'\\''")}'`;
/** A Python as uv would leave one: here a script that writes each run to the log and ends 0. */
const python = (path) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\necho "python $*" >> ${quote(log)}\n`);
  chmodSync(path, 0o755);
};
const after = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};
const slug = (version) => `cpython-${version}-macos-aarch64-none`;

if (args[0] === "python" && (args[1] === "install" || args[1] === "find")) {
  const dir = process.env.UV_PYTHON_INSTALL_DIR;
  const version = args[2];
  if (!dir || !/^3\.12\.\d+$/.test(version ?? "")) process.exit(2);
  const bin = join(dir, slug(version), "bin");
  if (args[1] === "install") {
    python(join(bin, "python3.12"));
    symlinkSync("python3.12", join(bin, "python3"));
    process.exit(0);
  }
  if (!existsSync(join(bin, "python3.12"))) process.exit(2);
  console.log(join(bin, "python3.12"));
  process.exit(0);
}

if (args[0] === "venv") {
  const folder = args.at(-1);
  const base = after("--python");
  if (!base || !existsSync(base) || !folder || folder.startsWith("-")) process.exit(2);
  mkdirSync(join(folder, "lib", "python3.12", "site-packages"), { recursive: true });
  python(join(folder, "bin", "python"));
  writeFileSync(join(folder, "pyvenv.cfg"), `home = ${dirname(base)}\n${args.includes("--relocatable") ? "relocatable = true\n" : ""}`);
  process.exit(0);
}

if (args[0] === "pip" && args[1] === "install") {
  const target = after("--python");
  const lock = after("-r");
  if (!args.includes("--require-hashes") || !args.includes("--no-deps")) process.exit(2);
  if (!target || !existsSync(target) || !lock || !existsSync(lock)) process.exit(2);
  writeFileSync(join(dirname(dirname(target)), "lib", "python3.12", "site-packages", "installed.txt"), `${lock}\n`);
  process.exit(0);
}

console.error(`uv stand-in: ${args.join(" ")} is not something it answers`);
process.exit(2);
