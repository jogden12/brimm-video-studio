// No hard link out of a gated place (design 2026-10-26, section 9, K1). A hard link to a gated file is the file itself under another
// name: a link made in BRIMM Video Work, or anywhere a sandboxed command may read, would carry a session's words or a client's
// video out of the place the open lock holds, under a name no deny rule knows. So brimm-video makes none, but those it makes on
// purpose, its episode lock's own and held.js's writeNew (below). A copy that must take no room is a clone (`cp -c`, clonefile),
// which is a file of its own. This reads the code: every .js, .mjs and .sh under tool/, but the tests.
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
/** held.js writeNew: writeNew makes each mark, note and uuids file whole and new by linking its own temporary file to the name beside
    it; both are in Application Support/BRIMM Video/held, a gated place out of the sandbox's reach; both ends are brimm-video's own
    records, the temporary name is removed at once, and nothing leaves a gated place. Allowed by Jason, 26 Oct. */
const ALLOWED_LINKS = [["detached.js", "linkSync(mine, lock);"], ["detached.js", "linkSync(mine, guard);"], ["held.js", "linkSync(temporary, join(folder, name));"]];

/** tool/, the folder this test's folder is in. */
const TOOL = fileURLToPath(new URL("..", import.meta.url));

/** Every .js, .mjs and .sh (or what `kinds` names) under `dir`, but tests/, as paths relative to tool/. */
function scripts(dir = TOOL, kinds = /\.(?:js|mjs|sh)$/) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (relative(TOOL, path) !== "tests" && entry.name !== "node_modules") found.push(...scripts(path, kinds));
    } else if (kinds.test(entry.name)) found.push(relative(TOOL, path));
  }
  return found.sort();
}

// Beyond the plan's patterns, the other ways macOS makes a hard link: `cp` with -l among other flags, /bin/link (the same program as
// ln), rsync's -H and --link-dest, pax -l, FileManager's linkItem in Swift, link or linkSync taken from fs under any name, and a
// member call `.link (` with a space; and, in a shell script, `link` or `ln` as a command.
const MORE_LINKS = [/\bcp\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*l/, /["'](?:\/bin\/)?cp["']\s*,\s*\[[^\]]*["']-[A-Za-z]*l[A-Za-z]*["']/, /\/bin\/link\b/, /\brsync\b.*(?:\s-[A-Za-z]*H|--hard-links|--link-dest)/, /\bpax\b.*\s-[A-Za-z]*l/, /\blinkItem\s*\(/, /\.link\s*\(/];
const SHELL_LINKS = [/(?:^|[;&|(`])\s*(?:\/bin\/)?(?:link|ln)\s+(?!-s)/];
/** An import of fs's link or linkSync, under its own name or another: detached.js takes linkSync for the episode lock, and held.js for
    writeNew (its reason is with ALLOWED_LINKS above; allowed by Jason, 26 Oct), and no other file does. */
const FS_LINK = /\{[^}]*\blink(?:Sync)?\b[^}]*\}\s*from\s*["'](?:node:)?fs(?:\/promises)?["']/;
const FS_LINK_ALLOWED = ["detached.js", "held.js"];

describe("no hard link out of a gated place", () => {
  it("knows the other ways macOS makes a hard link, in code and in a shell script", () => {
    const all = [...HARD_LINK, ...MORE_LINKS];
    for (const line of ['cp -al a b', 'cp -lR a b', 'cp -R -l a b', 'spawnSync("/bin/cp", ["-lR", a, b])', 'run("cp", ["-l", a, b])', 'spawnSync("/bin/link", [a, b])', 'rsync -aH a b', 'rsync --link-dest=x a b', 'pax -rwl a b', 'try FileManager.default.linkItem(at: a, to: b)', 'fs.link (a, b, cb)', 'fsp.link(a, b)']) assert.ok(all.some((r) => r.test(line)), line);
    for (const line of ['cp -c a b', 'cp -R a b', 'spawnSync("/bin/cp", ["-c", a, b])', 'rsync -a a b', 'symlinkSync(a, b)', '["-m", model, "-f", wav, "-l", language]', 'still refuses a new link (--version-of)']) assert.ok(!all.some((r) => r.test(line)), line);
    for (const line of ['link a b', '  ln a b', 'x && ln a b', '`ln a b`', '/bin/link a b']) assert.ok(SHELL_LINKS.some((r) => r.test(line)), line);
    for (const line of ['ln -s a b', '# a link to the folder', 'echo "the link is made"']) assert.ok(!SHELL_LINKS.some((r) => r.test(line)), line);
    for (const line of ['import { closeSync, linkSync, mkdirSync } from "node:fs";', 'import { linkSync as hard } from "node:fs";', 'import { link } from "node:fs/promises";', 'import { link as l } from "fs";']) assert.ok(FS_LINK.test(line), line);
    for (const line of ['import { symlinkSync, readlinkSync } from "node:fs";', 'import { linksOf } from "./finish.js";']) assert.ok(!FS_LINK.test(line), line);
  });

  it("makes no other hard link in tool/, its scripts and Swift included, and takes fs's link only for the episode lock and writeNew", () => {
    for (const file of scripts(TOOL, /\.(?:js|mjs|sh|swift)$/)) {
      readFileSync(join(TOOL, file), "utf8").split("\n").forEach((line, i) => {
        const shell = file.endsWith(".sh") && SHELL_LINKS.some((r) => r.test(line));
        assert.ok(!MORE_LINKS.some((r) => r.test(line)) && !shell, `${file}:${i + 1} makes a hard link: ${line.trim()}`);
        if (FS_LINK.test(line)) assert.ok(FS_LINK_ALLOWED.includes(file), `${file}:${i + 1} takes fs's link: ${line.trim()}`);
      });
    }
  });

  it("knows a hard link when it sees one, and not a symbolic one, a clone or whisper's language flag", () => {
    for (const line of ['linkSync(a, b)', 'fs.linkSync(a, b)', 'fs.link(a, b, cb)', 'spawnSync("/bin/ln", [a, b])', 'run("ln", [a, b])', 'cp -l a b', 'spawnSync("/bin/cp", ["-l", a, b])']) assert.ok(HARD_LINK.some((r) => r.test(line)), line);
    for (const line of ['symlinkSync(a, b)', 'readlinkSync(a)', 'unlinkSync(a)', 'unlink(a)', 'readlink(a)', 'spawnSync("/bin/cp", ["-c", a, b])', 'ln -s a b', '["-m", model, "-f", wav, "-l", language]', 'still refuses a new link (--version-of)']) assert.ok(!HARD_LINK.some((r) => r.test(line)), line);
  });

  it("makes no hard link anywhere in tool/, its scripts included, but the episode lock's own and writeNew's", () => {
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
