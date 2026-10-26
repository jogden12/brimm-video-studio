// The gated places (places.js): where her chat may not read under the open lock, each by its real path, and what Bash may read
// inside them (design 2026-10-26, section 2, "The gated places"). Each test makes a home of its own, with a space and an
// apostrophe in it, a BRIMM Video in a made-up Dropbox and a made-up temp folder, and removes them after: nothing here reads this
// Mac's own home, Dropbox or Claude Code's temp folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { claudeDirName, realOf, bothSpellings, gatedPlaces, readAllowed, isEnvFile } from "../places.js";

/** A made-up Mac: a home with a space and an apostrophe, BRIMM Video in a Dropbox whose root holds `.dropbox.cache` (unless
    told not to), and a temp folder of its own. */
function world({ cache = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-places-"));
  const home = join(dir, "Sallie's home");
  const dropbox = join(dir, "Dropbox (Personal)");
  const root = join(dropbox, "The BRIMM DB", "BRIMM Video");
  const tmp = join(dir, "tmp");
  for (const d of [home, root, tmp]) mkdirSync(d, { recursive: true });
  if (cache) mkdirSync(join(dropbox, ".dropbox.cache"));
  return { dir, home, dropbox, root, tmp, uid: 502, folder: join(home, "BRIMM Video Studio"), done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the gated places", () => {
  it("lists every gated place of the design by its real path, for a home and root with spaces and an apostrophe", () => {
    const w = world();
    const AS = join(w.home, "Library", "Application Support");
    const paths = gatedPlaces(w).map((p) => p.path);
    for (const want of [
      w.root, join(dirname(w.root), "BRIMM VIDEO Transfer"), join(w.home, "Documents", "Zoom"), join(w.home, "Movies", "Final Cut Backups"),
      join(w.home, "BRIMM Video Work"), join(AS, "BRIMM Video"), join(AS, "BRIMM Video Words"), join(w.home, ".claude"), join(w.tmp, `claude-${w.uid}`),
      join(AS, "Claude"), join(w.home, ".claude.json"), join(AS, "com.apple.sharedfilelist"), join(w.home, "Library", "Preferences", "com.apple.finder.plist"),
      join(w.home, ".dropbox"), join(AS, "Dropbox"), join(w.dropbox, ".dropbox.cache"),
      join(w.home, "Library", "Group Containers", "G7HH3F8CAK.com.getdropbox.dropbox.sync"),
      join(w.home, "Library", "Containers", "com.getdropbox.dropbox.fileprovider"),
      join(w.home, "Library", "Containers", "com.getdropbox.dropbox.TransferExtension"),
      join(w.home, "Library", "Containers", "com.getdropbox.dropbox.garcon"),
      join(w.home, "Library", "Logs", "brimm-video.log"), join(w.home, "Library", "Logs", "brimm-video-claude-check.log"),
      join(w.home, ".ssh"), join(w.home, "Library", "Keychains"), join(w.home, ".aws"), join(w.home, ".config"), join(w.home, ".netrc"),
      join(w.home, ".git-credentials"), join(w.home, ".npmrc")
    ]) assert.ok(paths.includes(realOf(want)), want);
    assert.deepEqual(gatedPlaces(w).find((p) => p.path === realOf(w.root)).readRules, ["Drop", "Episodes", "Unedited Video"].map((n) => join(realOf(w.root), n)));
    w.done();
  });
  it("gives each place its read rules, its kind and its carve-out, as the design's table does", () => {
    const w = world();
    const AS = join(w.home, "Library", "Application Support");
    const place = (path) => gatedPlaces(w).find((p) => p.path === realOf(path));
    for (const path of [join(dirname(w.root), "BRIMM VIDEO Transfer"), join(w.home, "BRIMM Video Work"), join(AS, "BRIMM Video"), join(w.home, ".ssh"), join(w.home, ".npmrc")]) assert.deepEqual(place(path).readRules, [realOf(path)], path);
    for (const [path, carve] of [[join(AS, "BRIMM Video Words"), "words"], [join(w.home, ".claude"), "claude"], [join(w.tmp, `claude-${w.uid}`), "tmp"], [join(AS, "Claude"), "app"]]) {
      assert.deepEqual([place(path).readRules, place(path).carve], [[], carve], path);
    }
    for (const name of [".claude.json", ".netrc", ".git-credentials", ".npmrc"]) assert.equal(place(join(w.home, name)).kind, "file", name);
    for (const path of [join(w.home, "Library", "Preferences", "com.apple.finder.plist"), join(w.home, "Library", "Logs", "brimm-video.log"), join(w.home, "Library", "Logs", "brimm-video-claude-check.log")]) assert.equal(place(path).kind, "file", path);
    for (const path of [w.root, join(w.home, ".claude"), join(w.home, ".ssh"), join(w.dropbox, ".dropbox.cache")]) assert.equal(place(path).kind, "folder", path);
    assert.ok(gatedPlaces(w).every((p) => p.kind === "file" || p.kind === "folder"));
    w.done();
  });
  it("finds a place through a link by its real path, as ~/Movies is a link into Dropbox on the Mac Studio", () => {
    const w = world();
    mkdirSync(join(w.dropbox, "Movies"));
    symlinkSync(join(w.dropbox, "Movies"), join(w.home, "Movies"));
    const backups = join(realpathSync.native(w.dropbox), "Movies", "Final Cut Backups");
    assert.equal(realOf(join(w.home, "Movies", "Final Cut Backups")), backups);
    assert.ok(gatedPlaces(w).some((p) => p.path === backups));
    assert.ok(!gatedPlaces(w).some((p) => p.path.startsWith(join(w.home, "Movies"))));
    w.done();
  });
  it("finds Zoom's folder where this Mac's settings put it", () => {
    const w = world();
    const zoomFolder = join(w.home, "Zoom recordings");
    const paths = gatedPlaces({ ...w, zoomFolder }).map((p) => p.path);
    assert.ok(paths.includes(realOf(zoomFolder)));
    assert.ok(!paths.includes(realOf(join(w.home, "Documents", "Zoom"))));
    w.done();
  });
  it("names her folder's own temp folder as Claude Code does", () => {
    assert.equal(claudeDirName("/Users/sallie/BRIMM Video Studio"), "-Users-sallie-BRIMM-Video-Studio");
    assert.equal(claudeDirName("/Users/o'neil/BRIMM Video Studio"), "-Users-o-neil-BRIMM-Video-Studio");
  });
  it("lets Bash read Assets and the three places Bash needs, and no other", () => {
    const w = world();
    assert.deepEqual(readAllowed(w), [
      join(realOf(w.root), "Assets"),
      join(realOf(join(w.tmp, `claude-${w.uid}`)), claudeDirName(w.folder)),
      realOf(join(w.home, ".claude", "shell-snapshots")),
      realOf(join(w.home, "Library", "Application Support", "Claude", "claude-code"))
    ]);
    w.done();
  });
  it("finds Claude Code's temp folder under the temp folder it is given, never /private/tmp in a test", () => {
    const w = world();
    assert.ok(gatedPlaces(w).some((p) => p.carve === "tmp" && p.path === realOf(join(w.tmp, `claude-${w.uid}`))));
    assert.ok(!gatedPlaces(w).some((p) => p.path.startsWith("/private/tmp/")));
    assert.ok(!readAllowed(w).some((p) => p.startsWith("/private/tmp/")));
    w.done();
  });
  it("spells each place a second way, under /System/Volumes/Data", () => {
    assert.deepEqual(bothSpellings("/Users/s/x"), ["/Users/s/x", "/System/Volumes/Data/Users/s/x"]);
  });
  it("leaves out Dropbox's cache folder when no folder above BRIMM Video holds one", () => {
    const w = world({ cache: false });
    assert.ok(!gatedPlaces(w).some((p) => p.path.endsWith("/.dropbox.cache")));
    w.done();
  });
  it("knows a .env file by its name", () => {
    for (const p of ["/a/.env", "/a/.env.local"]) assert.ok(isEnvFile(p), p);
    for (const p of ["/a/env.txt", "/a/.envrc", "/a/x.env", "/a/.env/inside"]) assert.ok(!isEnvFile(p), p);
  });
  it("finds the real path of the nearest folder that is there, with the rest of the path after it", () => {
    const w = world();
    assert.equal(realOf(join(w.home, "not", "there", "yet")), join(realpathSync.native(w.home), "not", "there", "yet"));
    assert.equal(realOf(w.home), realpathSync.native(w.home));
    w.done();
  });
});
