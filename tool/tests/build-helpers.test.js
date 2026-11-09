// build-helpers.js compiles the five helpers with swiftc. No test runs the real swiftc: a stand-in /bin/sh script is the
// only swiftc on the PATH the child process gets, and the environment is built from scratch.
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELPERS, helperSource } from "../helpers.js";

const BUILD = join(dirname(fileURLToPath(import.meta.url)), "..", "build-helpers.js");

// Writes its arguments to $SWIFTC_LOG, one to a line, then a line "--". Fails for the source in $FAIL_FOR.
const STAND_IN = `#!/bin/sh
for a in "$@"; do printf '%s\\n' "$a" >> "$SWIFTC_LOG"; done
printf -- '--\\n' >> "$SWIFTC_LOG"
for last; do :; done
if [ -n "$FAIL_FOR" ] && [ "$last" = "$FAIL_FOR" ]; then echo "error: nope" >&2; exit 1; fi
while [ "$1" != "-o" ]; do shift; done
printf compiled > "$2"
`;

let w;
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "build-helpers-"));
  const stand = join(dir, "stand-in");
  const empty = join(dir, "empty");
  mkdirSync(stand);
  mkdirSync(empty);
  writeFileSync(join(stand, "swiftc"), STAND_IN, { mode: 0o755 });
  chmodSync(join(stand, "swiftc"), 0o755);
  const log = join(dir, "swiftc.log");
  w = {
    dir,
    empty,
    run: (args, extra = {}, path = stand) =>
      spawnSync(process.execPath, [BUILD, ...args], { encoding: "utf8", env: { PATH: path, HOME: dir, SWIFTC_LOG: log, ...extra } }),
    calls: () => {
      let text = "";
      try { text = readFileSync(log, "utf8"); } catch { return []; }
      return text.split("--\n").filter(Boolean).map((c) => c.split("\n").filter(Boolean));
    },
  };
});
afterEach(() => rmSync(w.dir, { recursive: true, force: true }));

describe("build-helpers.js", () => {
  it("compiles each helper with swiftc, in order, for Apple silicon on macOS 13, as brimm-<name> in the folder it is given", () => {
    const out = join(w.dir, "Sallie's helpers", "bin");
    const r = w.run([out]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(w.calls(), HELPERS.map((n) => ["-O", "-target", "arm64-apple-macos13.0", "-o", join(out, `brimm-${n}`), helperSource(n)]));
    assert.deepEqual(readdirSync(out).sort(), HELPERS.map((n) => `brimm-${n}`).sort());
    assert.equal(r.stdout, HELPERS.map((n) => `Compiled brimm-${n}.\n`).join(""));
  });

  it("stops at the first helper swiftc cannot compile, says which in swiftc's words, ends with 1, and leaves no file of that name", () => {
    const out = join(w.dir, "bin");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "brimm-progress"), "an older build");
    const r = w.run([out], { FAIL_FOR: helperSource("progress") });
    assert.deepEqual([r.status, r.stderr], [1, "brimm-progress could not be compiled (error: nope). Nothing more was compiled.\n"]);
    assert.deepEqual(w.calls().map((c) => c.at(-1)), [helperSource("faces"), helperSource("progress")]);
    assert.deepEqual(readdirSync(out), ["brimm-faces"]);
  });

  it("says so, and ends with 1, on a Mac with no swiftc", () => {
    const r = w.run([join(w.dir, "bin")], {}, w.empty);
    assert.deepEqual([r.status, r.stderr], [1, "swiftc is not on this Mac: it comes with Xcode's command line tools. Nothing more was compiled.\n"]);
  });

  it("compiles nothing, and ends with 2, without exactly one folder", () => {
    for (const args of [[], [join(w.dir, "a"), join(w.dir, "b")]]) {
      const r = w.run(args);
      assert.deepEqual([r.status, r.stderr], [2, "Give it the folder to put the helpers in: node tool/build-helpers.js <folder>\n"]);
    }
    assert.deepEqual(w.calls(), []);
  });
});
