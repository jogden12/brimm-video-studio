// The gated places (places.js): where her chat may not read under the open lock, each by its real path, and what Bash may read
// inside them (design 2026-10-26, section 2, "The gated places"). Each test makes a home of its own, with a space and an
// apostrophe in it, a BRIMM Video in a made-up Dropbox and a made-up temp folder, and removes them after: nothing here reads this
// Mac's own home, Dropbox or Claude Code's temp folder.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { claudeDirName, realOf, bothSpellings, gatedPlaces, readAllowed, isEnvFile, gatedIndex, pathsIn, searchRoot } from "../places.js";

/** A made-up Mac: a home with a space and an apostrophe, BRIMM Video in a Dropbox whose root holds `.dropbox.cache` (unless
    told not to), and a temp folder of its own. Its folder is by its real path, as Claude Code is given one. */
function world({ cache = true } = {}) {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-places-")));
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
    for (const p of [...gatedPlaces(w).map((place) => place.path), ...readAllowed(w)]) assert.ok(p.startsWith(`${w.dir}/`), p);
    w.done();
  });
  it("spells each place a second way, under /System/Volumes/Data", () => {
    assert.deepEqual(bothSpellings("/Users/s/x"), ["/Users/s/x", "/System/Volumes/Data/Users/s/x"]);
    assert.deepEqual(bothSpellings("/"), ["/", "/System/Volumes/Data"]);
  });
  it("leaves out Dropbox's cache folder when no folder above BRIMM Video holds one", () => {
    const w = world({ cache: false });
    assert.ok(!gatedPlaces(w).some((p) => p.path.endsWith("/.dropbox.cache")));
    w.done();
  });
  it("knows a .env file by its name", () => {
    for (const p of ["/a/.env", "/a/.env.local", "/a/.ENV", "/a/.Env.Local"]) assert.ok(isEnvFile(p), p);
    for (const p of ["/a/env.txt", "/a/.envrc", "/a/x.env", "/a/.env/inside"]) assert.ok(!isEnvFile(p), p);
  });
  it("opens no folder that is a link, so an Assets that links to Episodes, or her temp folder linked to ~/.claude, opens nothing", () => {
    const w = world();
    const own = join(w.tmp, `claude-${w.uid}`, claudeDirName(w.folder));
    for (const d of [join(w.root, "Episodes", "x"), join(w.home, ".claude", "projects"), dirname(own)]) mkdirSync(d, { recursive: true });
    writeFileSync(join(w.root, "Episodes", "x", "t.txt"), "x");
    symlinkSync(join(w.root, "Episodes"), join(w.root, "Assets"));
    symlinkSync(join(w.home, ".claude"), own);
    assert.deepEqual(readAllowed(w).slice(0, 2), [join(realOf(w.root), "Assets"), join(realOf(dirname(own)), claudeDirName(w.folder))]);
    const ix = gatedIndex(gatedPlaces(w), readAllowed(w));
    assert.equal(ix.at(join(w.root, "Episodes", "x", "t.txt"))?.path, realOf(w.root));
    assert.equal(ix.at(join(w.root, "Assets", "x", "t.txt"))?.path, realOf(w.root));
    assert.equal(ix.at(join(w.home, ".claude", "projects", "a.jsonl"))?.carve, "claude");
    assert.equal(ix.at(join(own, "projects", "a.jsonl"))?.carve, "claude");
    w.done();
  });
  it("finds the real path of the nearest folder that is there, with the rest of the path after it", () => {
    const w = world();
    assert.equal(realOf(join(w.home, "not", "there", "yet")), join(realpathSync.native(w.home), "not", "there", "yet"));
    assert.equal(realOf(w.home), realpathSync.native(w.home));
    w.done();
  });
});

describe("paths by what they are", () => {
  const notAMac = process.platform !== "darwin" && "/System/Volumes/Data and letter case are a Mac's";
  const ID = "0f1e2d3c-4b5a-4968-8776-655443322110";
  const OTHER = "11111111-2222-4333-8444-555555555555";
  let w;
  let ix;
  before(() => {
    w = world();
    const AS = join(w.home, "Library", "Application Support");
    w.cwd = w.folder;
    w.workshop = join(w.home, "BRIMM Video Workshop");
    w.transcript = join(w.home, ".claude", "projects", claudeDirName(w.folder), `${ID}.jsonl`);
    w.words = join(AS, "BRIMM Video Words", OTHER, "x.txt");
    w.episode = join(w.root, "Episodes", "x", "t.txt");
    w.notes = join(w.home, "Documents", "notes.txt");
    w.ownTmp = join(w.tmp, `claude-${w.uid}`, claudeDirName(w.folder));
    for (const d of [w.cwd, w.workshop, join(w.root, "Assets"), dirname(w.transcript), dirname(w.words), dirname(w.episode), dirname(w.notes), join(w.ownTmp, ID, "tasks"), join(w.tmp, `claude-${w.uid}`, "-another-folder"), join(w.home, ".claude", "shell-snapshots")]) mkdirSync(d, { recursive: true });
    for (const f of [w.transcript, w.words, w.episode, w.notes, join(w.root, "Assets", "logo.png"), join(w.ownTmp, ID, "tasks", "a.output"), join(w.tmp, `claude-${w.uid}`, "-another-folder", "b.output"), join(w.home, ".claude", "shell-snapshots", "snap.sh")]) writeFileSync(f, "x");
    symlinkSync(join(w.root, "Episodes"), join(w.home, "Documents", "link-to-episodes"));
    symlinkSync(join(w.root, "Episodes", "x"), join(w.root, "Assets", "eps-link"));
    symlinkSync(join(w.root, "Assets", "logo.png"), join(w.root, "Episodes", "to-logo.png"));
    symlinkSync(join(w.root, "Episodes", "x"), join(w.workshop, "eps-folder"));
    for (const [at, prefix] of [[w.workshop, ""], [join(w.root, "Assets"), "a-"]]) {
      symlinkSync(w.transcript, join(at, `${prefix}transcript.jsonl`));
      symlinkSync(w.words, join(at, `${prefix}words.txt`));
      symlinkSync(w.episode, join(at, `${prefix}episode.txt`));
      symlinkSync(join(w.root, "Drop", "Mac Studio", "x.mov"), join(at, `${prefix}dangling.mov`));
      symlinkSync(w.notes, join(at, `${prefix}notes.txt`));
    }
    ix = gatedIndex(gatedPlaces(w), readAllowed(w));
  });
  after(() => w.done());

  it("finds a gated place by any spelling: .., a link into it, a file not there yet", () => {
    for (const p of [join(w.root, "Episodes", "x", "t.txt"), join(w.root, "Assets", "..", "Episodes"), join(w.home, "Documents", "link-to-episodes", "t.txt"), join(w.root, "Episodes", "not-yet", "new.txt")]) assert.ok(ix.at(p), p);
    assert.equal(ix.at(join(w.home, "Documents", "notes.txt")), null);
    assert.equal(ix.at(join(w.root, "Assets", "..", "Episodes")).path, realOf(w.root));
    // `..` as a string keeps it, as a tool's input would: as text (Claude Code's own tools) and as macOS takes it, after a link.
    assert.equal(ix.at(`${w.root}/Assets/../Episodes/x/t.txt`)?.path, realOf(w.root));
    assert.equal(ix.at(`${w.root}/Assets/eps-link/../t.txt`)?.path, realOf(w.root));
    assert.equal(ix.at(`${w.workshop}/eps-folder/../t.txt`)?.path, realOf(w.root));
    assert.equal(ix.at(`${w.workshop}/eps-folder/../../../../../BRIMM Video Workshop/x.txt`), null);
  });
  it("finds one by /System/Volumes/Data and by changed letter case", { skip: notAMac }, () => {
    for (const p of [`/System/Volumes/Data${w.episode}`, `/System/Volumes/Data${join(w.home, ".ssh", "id_ed25519")}`, w.episode.replace("BRIMM Video", "brimm video").replace("Episodes", "EPISODES"), join(w.home, ".SSH", "config")]) {
      assert.ok(ix.at(p), p);
    }
    assert.equal(ix.at(`/System/Volumes/Data${w.notes}`), null);
  });
  it("finds a gated file through a link to it, from an open folder or the workshop, dangling or not", () => {
    const AS = join(w.home, "Library", "Application Support");
    for (const [at, prefix] of [[w.workshop, ""], [join(w.root, "Assets"), "a-"]]) {
      assert.equal(ix.at(join(at, `${prefix}transcript.jsonl`))?.path, realOf(join(w.home, ".claude")), `${prefix}transcript`);
      assert.equal(ix.at(join(at, `${prefix}words.txt`))?.path, realOf(join(AS, "BRIMM Video Words")), `${prefix}words`);
      assert.equal(ix.at(join(at, `${prefix}episode.txt`))?.path, realOf(w.root), `${prefix}episode`);
      assert.equal(ix.at(join(at, `${prefix}dangling.mov`))?.path, realOf(w.root), `${prefix}dangling`);
    }
    assert.equal(ix.at(join(w.workshop, "notes.txt")), null);
  });
  it("lets a path inside Assets through, and not a link from Assets into Episodes", () => {
    assert.equal(ix.at(join(w.root, "Assets", "logo.png")), null);
    assert.equal(ix.at(join(w.root, "Assets", "not-yet.png")), null);
    assert.equal(ix.at(join(w.root, "Assets", "eps-link", "t.txt"))?.path, realOf(w.root));
    assert.equal(ix.at(join(w.root, "Assets", "a-notes.txt")), null);
    assert.equal(ix.at(join(w.root, "Episodes", "to-logo.png"))?.path, realOf(w.root), "a link in a gated place is held, the stricter, wherever it leads");
  });
  it("lets a path in a carve-out through only when that carve-out is among those open", () => {
    const output = join(w.ownTmp, ID, "tasks", "a.output");
    const snapshot = join(w.home, ".claude", "shell-snapshots", "snap.sh");
    assert.equal(ix.at(output), null);
    assert.equal(ix.at(snapshot), null);
    assert.equal(ix.at(join(w.tmp, `claude-${w.uid}`, "-another-folder", "b.output"))?.carve, "tmp");
    assert.equal(ix.at(join(w.home, ".claude", "projects"))?.carve, "claude");
    const shut = gatedIndex(gatedPlaces(w), []);
    assert.equal(shut.at(output)?.carve, "tmp");
    assert.equal(shut.at(snapshot)?.carve, "claude");
    assert.equal(shut.at(join(w.root, "Assets", "logo.png"))?.path, realOf(w.root));
    assert.equal(gatedIndex(gatedPlaces(w), [w.ownTmp]).at(snapshot)?.carve, "claude");
  });
  it("lets a path through a carve-out one call is given, and only for that call", () => {
    const output = join(w.ownTmp, ID, "tasks", "a.output");
    const shut = gatedIndex(gatedPlaces(w), [join(realOf(w.root), "Assets")]);
    assert.equal(shut.at(output)?.carve, "tmp");
    assert.equal(shut.at(output, [join(realOf(join(w.tmp, `claude-${w.uid}`)), claudeDirName(w.folder), ID, "tasks")]), null);
    assert.equal(shut.at(output)?.carve, "tmp");
    assert.equal(shut.at(join(w.root, "Assets", "logo.png"), [join(w.home, "Documents")]), null);
    assert.equal(shut.at(join(w.tmp, `claude-${w.uid}`, "-another-folder", "b.output"), [join(realOf(join(w.tmp, `claude-${w.uid}`)), claudeDirName(w.folder))])?.carve, "tmp");
  });
  it("holds a gated place that is not there yet by its text, both spellings, any letter case", () => {
    // Zoom's folder is not made; "<home>/documents/ZOOM/x.m4a" and "/System/Volumes/Data<home>/Documents/Zoom" are held.
    assert.equal(ix.at(join(w.home, "documents", "ZOOM", "x.m4a"))?.path, realOf(join(w.home, "Documents", "Zoom")));
    assert.equal(ix.at(`/System/Volumes/Data${join(w.home, "Documents", "Zoom")}`)?.path, realOf(join(w.home, "Documents", "Zoom")));
    assert.equal(ix.at(join(w.home, "Documents", "Zoom recordings", "x.m4a")), null);
  });
  it("holds a path by macOS's dot-root spellings, /.vol, /.nofollow and /.resolve, and a search of them", () => {
    for (const p of ["/.vol", "/.vol/16777234/2", `/.nofollow${w.episode}`, `/.resolve/1${w.episode}`, `/.nofollow${w.notes}`]) assert.ok(ix.at(p), p);
    for (const d of ["/.vol", "/.vol/16777234", "/.nofollow", `/.nofollow${w.home}`]) assert.ok(ix.holds(d), d);
  });
  it("holds a link in a gated place that leads to an open folder", () => {
    symlinkSync(join(w.root, "Assets"), join(w.root, "Episodes", "to-assets"));
    assert.equal(ix.at(join(w.root, "Episodes", "to-assets"))?.path, realOf(w.root));
  });
  it("says /, /System, /System/Volumes and /System/Volumes/Data each hold a gated place", () => {
    for (const d of ["/", "/System", "/System/Volumes", "/System/Volumes/Data"]) assert.ok(ix.holds(d), d);
  });
  it("takes no path from a string too long to be one, and is quick about it", () => {
    const code = "const a = b / c; // see ../x\n".repeat(40000);
    const started = Date.now();
    assert.deepEqual(pathsIn({ content: code, long: `/${"a/".repeat(600)}` }, w.cwd, w.home), []);
    assert.ok(Date.now() - started < 5000);
    assert.deepEqual(pathsIn({ p: `/${"b".repeat(1022)}` }, w.cwd, w.home), [`/${"b".repeat(1022)}`]);
  });
  it("holds a .env file anywhere, in any letter case", () => {
    for (const p of ["/anywhere/.env", join(w.home, "Documents", ".env.local"), join(w.workshop, ".env"), "/anywhere/.ENV", join(w.workshop, ".Env.Local")]) assert.ok(ix.at(p), p);
    assert.equal(ix.at(join(w.home, "Documents", "env.txt")), null);
  });
  it("takes every path-like string from any field, nested, and nothing else", () => {
    writeFileSync(join(w.cwd, "notes.txt"), "x");
    assert.deepEqual(pathsIn({ file_path: "~/x", nested: { list: ["../y", "plain words", "/abs", "notes.txt"] }, url: "https://a.b/c", n: 3 }, w.cwd, w.home).sort(), [join(w.home, "x"), resolve(w.cwd, "../y"), "/abs", join(w.cwd, "notes.txt")].sort());
    assert.deepEqual(pathsIn({ a: "~", b: ["", null, true, { c: [[`${w.root}/Episodes`]] }] }, w.cwd, w.home).sort(), [w.home, join(w.root, "Episodes")].sort());
    assert.deepEqual(pathsIn("plain words", w.cwd, w.home), []);
    // White space around a path is taken off, as Claude Code's own tools take it off.
    assert.deepEqual(pathsIn({ a: ` ${w.episode}`, b: `\n${w.episode}`, c: `${w.episode} `, d: `\t~/x\n` }, w.cwd, w.home).sort(), [w.episode, join(w.home, "x")].sort());
    assert.deepEqual(pathsIn({ a: "   ", b: "\n" }, w.cwd, w.home), []);
  });
  it("says a search folder holds a gated place when one is inside it", () => {
    // Zoom's folder, <home>/Documents/Zoom, is gated, so Documents holds one; Pictures holds none.
    assert.ok(ix.holds(w.home)); assert.ok(ix.holds(join(w.home, "Documents"))); assert.ok(!ix.holds(join(w.home, "Pictures")));
    assert.ok(ix.holds(w.root)); assert.ok(ix.holds(dirname(w.root))); assert.ok(!ix.holds(join(w.root, "Assets"))); assert.ok(!ix.holds(w.workshop));
  });
  it("takes Glob's folder from the literal start of an absolute or ~/ pattern, before path", () => {
    assert.equal(searchRoot("Glob", { pattern: `${w.root}/Ep*/**`, path: "/tmp" }, w.cwd, w.home), w.root);
    assert.equal(searchRoot("Glob", { pattern: "~/Lib*/x" }, w.cwd, w.home), w.home);
    assert.equal(searchRoot("Glob", { pattern: "**/*.md", path: "/tmp" }, w.cwd, w.home), "/tmp");
    assert.equal(searchRoot("Grep", {}, w.cwd, w.home), w.cwd);
  });
  it("takes a .. pattern's folder from where it climbs to, and a search's path as given", () => {
    assert.equal(searchRoot("Glob", { pattern: "../Episodes/*" }, w.cwd, w.home), join(dirname(w.cwd), "Episodes"));
    assert.equal(searchRoot("Glob", { pattern: "*/../../x/*" }, w.cwd, w.home), dirname(w.cwd));
    assert.equal(searchRoot("Glob", { pattern: "/*" }, w.cwd, w.home), "/");
    assert.equal(searchRoot("Grep", { path: "~/Documents" }, w.cwd, w.home), join(w.home, "Documents"));
    assert.equal(searchRoot("Grep", { path: "sub" }, w.cwd, w.home), join(w.cwd, "sub"));
  });
});
