// Nothing in tool/ starts git, python3, swift, swiftc, xcrun or xcode-select unguarded (Phase 1 of the Mac app: Studio runs without git
// or Xcode's command line tools). This reads the code: every .js and .mjs under tool/, but tests/, move-app/ (the old installer, retired
// in Phase 8) and vendor/. It does not read install.sh, which is Phase 4's, nor studio/guard.sh and studio/receipt.sh, which start none of
// these programs. A line that names one of these programs in quotes must be
// one of ALLOWED, each with its reason; a helper is never started with swift itself, only through helpers.js helperCommand.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** A program's name in quotes, as the first argument of a start, bare or as /usr/bin/<name>. */
const PROGRAM = /["'](?:\/usr\/bin\/)?(?:git|python3|swiftc?|xcode-select|xcrun)["']/;
/** A helper started with swift itself, which only helpers.js helperCommand may decide. */
const SWIFT_STARTED = /\b(?:run|runProgram|start|exec|spawn|spawnSync|execFile|execFileSync)\(\s*(?:[\w.]*\.)?swift\b/;

/** [file relative to tool/, substring of the line, why it is allowed]. */
const ALLOWED = [
  ["helpers.js", '"/usr/bin/xcode-select", ["-p"]', "hasXcodeTools: it asks where the tools are, and never installs them."],
  ["dropbox.js", 'program: "/usr/bin/python3"', "The read-through's fallback, used only when hasXcodeTools() is true."],
  ["filing.js", '"git", ["-C", checkout, "rev-parse"', "commitOf, only where isGitCheckout is true."],
  ["edit.js", '"/usr/bin/git", ["-C", ctx.settings.checkout', "behind, only where isGitCheckout is true."],
  ["unedited.js", 'join(dir, "swift")', "findPrograms looking for swift; it starts nothing."],
  ["progress.js", 'once("swift", ', "The key of a log line."],
  ["build-helpers.js", '"swiftc"', "The build's own compile, which Studio never runs."],
];

/** tool/, the folder this test's folder is in. */
const TOOL = fileURLToPath(new URL("..", import.meta.url));
const SKIPPED = new Set(["tests", "move-app", "vendor", "studio-app", "node_modules"]);

/** Every .js and .mjs under `dir`, but the skipped folders, as paths relative to tool/. */
function scripts(dir = TOOL) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name)) found.push(...scripts(path));
    } else if (/\.m?js$/.test(entry.name)) found.push(relative(TOOL, path));
  }
  return found.sort();
}

/** The lines of every script that `pattern` matches, as { file, number, text }. */
function matches(pattern) {
  const hits = [];
  for (const file of scripts()) {
    readFileSync(join(TOOL, file), "utf8").split("\n").forEach((text, i) => {
      if (pattern.test(text)) hits.push({ file, number: i + 1, text });
    });
  }
  return hits;
}

describe("nothing starts git, python3, swift or xcode-select unguarded", () => {
  it("starts git, python3, swift, swiftc, xcrun and xcode-select only where each is guarded", () => {
    const loose = matches(PROGRAM).filter(({ file, text }) => !ALLOWED.some(([name, part]) => file === name && text.includes(part)));
    assert.deepEqual(loose.map(({ file, number, text }) => `${file}:${number}: ${text.trim()}`), []);
  });

  it("has no stale ALLOWED entry: each matches a program line in its file", () => {
    const hits = matches(PROGRAM);
    const stale = ALLOWED.filter(([name, part]) => !hits.some(({ file, text }) => file === name && text.includes(part)));
    assert.deepEqual(stale.map(([name, part]) => `${name}: ${part}`), []);
  });

  it("starts no helper with swift itself: each goes through helpers.js helperCommand", () => {
    assert.deepEqual(matches(SWIFT_STARTED).map(({ file, number, text }) => `${file}:${number}: ${text.trim()}`), []);
  });

  it("knows a program's name when it sees one, and not a word in a sentence", () => {
    for (const l of ['spawnSync("git", ["status"])', 'run("/usr/bin/python3", [])', "start('swift', [x])", 'execFileSync("xcrun", ["swiftc"])', 'run("swiftc", a)']) assert.ok(PROGRAM.test(l), l);
    for (const l of ["// git runs only where there is a .git", '"Run git pull in the checkout"', 'join(dir, "swiftly")', "GIT"]) assert.ok(!PROGRAM.test(l), l);
    for (const l of ["run(tools.swift, [FACES, folder])", "start(swift, [PANEL, folder])", "exec(swift, [UPLOADED, path])", "runProgram(programs.swift, [a])", "run(deps.tools.swift, [a])", "start(ctx.tools.swift, [a])"]) assert.ok(SWIFT_STARTED.test(l), l);
    for (const l of ["start(panel.program, [...panel.args, folder])", 'helperCommand("faces", { swift: tools.swift })']) assert.ok(!SWIFT_STARTED.test(l), l);
  });
});
