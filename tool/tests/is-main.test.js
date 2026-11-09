import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isMain } from "../is-main.js";

test("is the same file however its path is spelled", () => {
  const dir = mkdtempSync(join(tmpdir(), "brimm main "));
  try {
    const real = join(dir, "real dir");
    mkdirSync(real);
    writeFileSync(join(real, "x.js"), "");
    writeFileSync(join(real, "y.js"), "");
    const linked = join(dir, "linked dir");
    symlinkSync(real, linked);
    const url = pathToFileURL(realpathSync(join(real, "x.js"))).href;
    assert.equal(isMain(url, join(linked, "x.js")), true);
    assert.equal(isMain(url, join(dir, "real dir", "x.js")), true);
    const data = "/System/Volumes/Data" + realpathSync(join(real, "x.js"));
    if (existsSync(data)) assert.equal(isMain(url, data), true);
    assert.equal(isMain(url, join(real, "y.js")), false);
    assert.equal(isMain(url, undefined), false);
    assert.equal(isMain(url, join(real, "missing.js")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runs each entry point's main from a folder with spaces reached through a link, and by its Data-volume spelling", () => {
  const tool = fileURLToPath(new URL("..", import.meta.url));
  const base = mkdtempSync(join(tmpdir(), "brimm main "));
  mkdirSync(join(base, "with space"));
  const linked = join(base, "with space", "linked tool");
  symlinkSync(tool, linked);
  const home = mkdtempSync(join(tmpdir(), "brimm home "));
  try {
    const folders = [linked];
    const data = "/System/Volumes/Data" + realpathSync(tool);
    if (existsSync(data)) folders.push(data);
    for (const [file, args, first] of [
      ["edit.js", ["--help"], "The command line for episodes on this Mac."],
      ["settings.js", ["--help"], "This Mac's settings for episodes"],
      ["unedited.js", ["--help"], "For a video that is not edited yet"],
      ["access.js", ["--setup-line"], "  Files and Folders, at the end:"],
    ]) {
      for (const folder of folders) {
        const r = spawnSync(process.execPath, [join(folder, file), ...args], {
          env: { PATH: process.env.PATH, HOME: home, BRIMM_VIDEO_HOME: home },
          encoding: "utf8",
          timeout: 30000,
        });
        assert.equal(r.status, 0, `${file} via ${folder}: ${r.stderr}`);
        assert.ok(r.stdout.startsWith(first), `${file} via ${folder} printed: ${r.stdout.slice(0, 80)}`);
      }
    }
  } finally {
    // rmSync removes a link and not what it points to, so tool/ itself is untouched.
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    assert.ok(existsSync(join(tool, "edit.js")), "removing the temp folders left tool/ alone");
  }
});
