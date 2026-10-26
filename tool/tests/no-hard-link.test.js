// No hard link out of a gated place (design 2026-10-26, section 9, K1). A hard link to a gated file is the file itself under another
// name: a link made in BRIMM Video Work, or anywhere a sandboxed command may read, would carry a session's words or a client's
// video out of the place the open lock holds, under a name no deny rule knows. So brimm-video makes none, but the one it makes on
// purpose, its episode lock's own (below). A copy that must take no room is a clone (`cp -c`, clonefile), which is a file of its own.
// This reads the code: every .js, .mjs and .sh under tool/, but the tests.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// `link(` touches its parenthesis, so a comment's "a new link (--version-of)" (edit.js) is not taken for a call. `linkSync(` is a call
// of its own, not the end of symlinkSync, readlinkSync or unlinkSync (places.js reads links with readlinkSync).
const HARD_LINK = [/(?<![A-Za-z0-9_$])linkSync\s*\(/, /(?<![A-Za-z0-9_$])link\(/, /["']\/bin\/ln["']/, /["']ln["']\s*,/, /\bln\s+(?!-s)/, /["']\/bin\/cp["']\s*,\s*\[[^\]]*["']-l["']/, /\bcp\s+-l\b/];
/** The episode lock's own atomic links (detached.js takeEpisodeLock): its lock text linked to the lock's name beside it, in BRIMM Video Work.
    Both ends are brimm-video's lock files; no gated content leaves a gated place, and a clone would lose the atomic claim. */
const ALLOWED_LINKS = [["detached.js", "linkSync(mine, lock);"], ["detached.js", "linkSync(mine, guard);"]];

/** tool/, the folder this test's folder is in. */
const TOOL = fileURLToPath(new URL("..", import.meta.url));

/** Every .js, .mjs and .sh under `dir`, but tests/, as paths relative to tool/. */
function scripts(dir = TOOL) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (relative(TOOL, path) !== "tests" && entry.name !== "node_modules") found.push(...scripts(path));
    } else if (/\.(?:js|mjs|sh)$/.test(entry.name)) found.push(relative(TOOL, path));
  }
  return found.sort();
}

describe("no hard link out of a gated place", () => {
  it("knows a hard link when it sees one, and not a symbolic one, a clone or whisper's language flag", () => {
    for (const line of ['linkSync(a, b)', 'fs.linkSync(a, b)', 'fs.link(a, b, cb)', 'spawnSync("/bin/ln", [a, b])', 'run("ln", [a, b])', 'cp -l a b', 'spawnSync("/bin/cp", ["-l", a, b])']) assert.ok(HARD_LINK.some((r) => r.test(line)), line);
    for (const line of ['symlinkSync(a, b)', 'readlinkSync(a)', 'unlinkSync(a)', 'unlink(a)', 'readlink(a)', 'spawnSync("/bin/cp", ["-c", a, b])', 'ln -s a b', '["-m", model, "-f", wav, "-l", language]', 'still refuses a new link (--version-of)']) assert.ok(!HARD_LINK.some((r) => r.test(line)), line);
  });

  it("makes no hard link anywhere in tool/, its scripts included, but the episode lock's own", () => {
    const files = scripts();
    assert.ok(files.includes("edit.js") && files.includes("detached.js") && files.includes("install.sh") && files.includes(join("studio", "guard.sh")), files.join("\n"));
    const seen = new Set();
    for (const file of files) {
      readFileSync(join(TOOL, file), "utf8").split("\n").forEach((line, i) => {
        if (!HARD_LINK.some((r) => r.test(line))) return;
        const allowed = ALLOWED_LINKS.find(([name, text]) => name === file && line.trim() === text);
        assert.ok(allowed, `${file}:${i + 1} makes a hard link: ${line.trim()}`);
        seen.add(allowed[1]);
      });
    }
    // Each line allowed is still there, so that the allowance goes when the code does.
    assert.deepEqual([...seen].sort(), ALLOWED_LINKS.map(([, text]) => text).sort());
  });
});
