// studio-check, the tests' way into the app's Swift (Phase 6, Task 4). It is not a test: the studio-app test files import it. It compiles
// tool/studio-app's Foundation-only sources with Check/main.swift once, into a binary named by a hash of those sources, and runs it.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hasXcodeTools } from "../helpers.js";

const STUDIO_APP = fileURLToPath(new URL("../studio-app/", import.meta.url));

/** The Sources files studio-check is made from, in this order, when they are there. The app's own main.swift is never one of them. */
const SOURCE_NAMES = ["Core.swift", "State.swift", "Flow.swift", "Agent.swift", "EngineClient.swift", "GuidePDF.swift", "Mover.swift", "Uninstall.swift"];

/** False, or why the tests that ask studio-check are skipped. swiftc is never run to find out whether it is there. */
export const noChecker =
  process.platform !== "darwin" ? "studio-check is compiled with swiftc, on a Mac" : !hasXcodeTools() ? "this Mac has no Command Line Tools, so studio-check cannot be compiled" : false;

/** The one module cache every test compile uses: a cold cache adds about 24 seconds to a compile. */
export const MODULES = join(tmpdir(), "brimm-studio-modules");

/** The sources studio-check is compiled from: those of SOURCE_NAMES that are there, and Check/main.swift. */
export const CHECK_SOURCES = [
  ...SOURCE_NAMES.map((name) => join(STUDIO_APP, "Sources", name)).filter((path) => existsSync(path)),
  join(STUDIO_APP, "Check", "main.swift")
];

/** The longest a compile may take, in milliseconds. */
const COMPILE_LIMIT = 180000;

let made = null;
let failed = null;

/** The path of studio-check, compiled on first use. A compile that fails throws with swiftc's last lines, then and at every later call. */
export function checkerPath() {
  if (made) return made;
  if (failed) throw failed;
  const hash = createHash("sha256");
  for (const path of CHECK_SOURCES) {
    hash.update(path.slice(STUDIO_APP.length));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  const binary = join(tmpdir(), `brimm-studio-check-${hash.digest("hex").slice(0, 16)}`);
  if (!existsSync(binary)) {
    mkdirSync(MODULES, { recursive: true });
    // It is made under a name of its own and renamed, so that test files running at the same time never run a half-written binary.
    const temp = `${binary}.${process.pid}.${Date.now()}.tmp`;
    const flags = ["-O", "-swift-version", "5", "-target", "arm64-apple-macos13.0", "-module-cache-path", MODULES, "-o", temp];
    const ran = spawnSync("/usr/bin/swiftc", [...flags, ...CHECK_SOURCES], { encoding: "utf8", timeout: COMPILE_LIMIT });
    if (ran.status !== 0) {
      rmSync(temp, { force: true });
      const said = `${ran.stderr ?? ""}${ran.error ? `\n${ran.error.message}` : ""}`.trim().split("\n").slice(-20).join("\n");
      failed = new Error(`studio-check did not compile (status ${ran.status}):\n${said}`);
      throw failed;
    }
    renameSync(temp, binary);
  }
  made = binary;
  return made;
}

/**
 * Runs studio-check with `command` and `args`. `env`, when given, is the whole environment. `json` is the parsed stdout when the status
 * is 0; a status-0 run whose stdout is not JSON throws an error that names the command and shows what it printed.
 */
export function check(command, args = [], { input, env, timeout = 60000 } = {}) {
  const ran = spawnSync(checkerPath(), [command, ...args], { input, env: env ?? process.env, encoding: "utf8", timeout });
  let json;
  if (ran.status === 0) {
    try {
      json = JSON.parse(ran.stdout);
    } catch {
      throw new Error(`studio-check ${[command, ...args].join(" ")} ended with 0, and printed what is not JSON:\n${ran.stdout.slice(0, 2000)}`);
    }
  }
  return { status: ran.status, stdout: ran.stdout, stderr: ran.stderr, json };
}
