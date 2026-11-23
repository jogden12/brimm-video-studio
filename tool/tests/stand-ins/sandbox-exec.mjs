// A stand-in for macOS's /usr/bin/sandbox-exec (reel-kit-render.js renderReelKit; plan Task 14), for tests: no test runs a real render in a
// real sandbox. It is run as Studio runs sandbox-exec, `sandbox-exec -f <profile> <program> <args…>`: it appends one JSON line to
// SANDBOX_EXEC_LOG (baked into the small script that starts it, as Studio runs the render in an environment of its own) with its
// arguments and the profile's text, then runs the program with its arguments, its output its own, and ends as it ended. Anything but
// `-f <a file>` first prints one line on stderr and ends 65, as sandbox-exec does for a usage it does not take.
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
let profile = null;
try {
  profile = args[0] === "-f" ? readFileSync(args[1], "utf8") : null;
} catch {
  profile = null;
}
if (process.env.SANDBOX_EXEC_LOG) appendFileSync(process.env.SANDBOX_EXEC_LOG, `${JSON.stringify({ args, profile })}\n`);
if (profile === null || args.length < 3) {
  process.stderr.write("usage: sandbox-exec -f profile-file command [args...]\n");
  process.exit(65);
}
const ran = spawnSync(args[2], args.slice(3), { stdio: "inherit" });
process.exit(ran.status ?? 1);
