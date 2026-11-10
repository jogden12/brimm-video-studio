// The launch agent's import notes each look at the drop folder and at Episodes in access.json, and stops cleanly when macOS refuses a folder
// (plan A2). Built on checks-world.js. A refusal is made with watched-fs.js `deny` for readdirSync, statSync, opendirSync and readFileSync in the
// folder, never for existsSync, which the real one never throws. Each test has a temp world of its own: no Dropbox, no real home, no program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { accessBanner, accessLog, placeWordsOf, readAccess, writeAccess } from "../access.js";
import { noteSeen, readEveryPending, readSeen, writePending } from "../filing.js";
import { episodesFolder, seenFile } from "../settings.js";
import { uneditedFolders } from "../unedited.js";
import { L, MAC, run, runs, world, holdImport } from "./checks-world.js";
import { watched } from "./watched-fs.js";

const NODE = process.execPath;
const refusal = (code, path) => Object.assign(new Error(`${code}: refused, '${path}'`), { code, path });
const READS = ["readdirSync", "statSync", "opendirSync", "readFileSync"];
const inside = (folder, path) => path === folder || path.startsWith(`${folder}/`);
/** Deny every read in `folder` (as macOS does when it refuses a program all of a folder) with `code`. */
const denyAll = (folder, code = "EPERM") => (name, path) => (READS.includes(name) && inside(folder, path) ? refusal(code, path) : null);
/** Deny only the listing of `folder`. */
const denyList = (folder, code = "EPERM") => (name, path) => (name === "readdirSync" && resolve(path) === resolve(folder) ? refusal(code, path) : null);
const withWorld = async (fn) => {
  const w = world();
  try {
    return await fn(w);
  } finally {
    w.done();
  }
};
const settingsOf = (w, dropPath = w.drop) => ({ version: 1, machine: MAC, root: w.root, checkout: "/c", drop: "Drop", dropPath });
const wordsOf = (w, place, folder) => placeWordsOf(place, folder, w.home);
const AT = L + 16 * 60 * 1000;

describe("the import notes each look (A2)", () => {
  it("the drop folder's first touch in a run is inside the bracket, and old-mode folders are not bracketed", () =>
    withWorld(async (w) => {
      let at = null;
      let oldAt = "not asked";
      const old = join(w.dir, "Old");
      mkdirSync(old);
      const r = runs(w, L, { settings: settingsOf(w), home: w.home });
      await watched(() => uneditedFolders([w.drop], r.deps), {
        names: ["existsSync"],
        deny: (name, path) => {
          if (path === w.drop && at === null) at = readAccess(w.home).looking;
          return null;
        }
      });
      assert.equal(at && at.place, "drop");
      assert.equal(readAccess(w.home).looking, null, "and it is taken out again");
      await watched(() => uneditedFolders([old], r.deps), {
        names: ["existsSync"],
        deny: (name, path) => {
          if (path === old && oldAt === "not asked") oldAt = readAccess(w.home).looking;
          return null;
        }
      });
      assert.equal(oldAt, null);
    }));

  it("on a Mac with its own drop folder, the first read under Episodes is inside the bracket (a held Dropbox question is seen)", () =>
    withWorld(async (w) => {
      const local = join(w.home, "BRIMM Video Work", "Drop");
      mkdirSync(local, { recursive: true });
      const r = runs(w, L, { settings: settingsOf(w, local), home: w.home });
      const episodes = episodesFolder(w.root);
      let first = "not asked";
      await watched(() => uneditedFolders([local], r.deps), {
        names: READS,
        deny: (name, path) => {
          if (inside(episodes, path) && first === "not asked") first = readAccess(w.home).looking;
          return null;
        }
      });
      assert.ok(first && first !== "not asked", `looking was ${JSON.stringify(first)} at the first read under Episodes`);
      assert.equal(first.place, "episodes");
    }));

  it("a folder not there is noted missing, in both branches: the log still says so, and a local Mac's late checks still run", () =>
    withWorld(async (w) => {
      rmSync(w.drop, { recursive: true, force: true });
      const r = runs(w, L, { settings: settingsOf(w), home: w.home });
      const code = await uneditedFolders([w.drop], r.deps);
      assert.equal(code, 2);
      assert.equal(readAccess(w.home).places.drop.state, "missing");
      assert.ok(r.logs.includes(`There is no folder at ${w.drop}.`), r.logs.join("|"));
      // The other branch: a Mac with its drop folder in Dropbox (no dropPath) notes it missing too, and goes no further.
      const dropbox = join(w.root, "Unedited Video", MAC);
      const r2 = runs(w, L, { settings: { version: 1, machine: MAC, root: w.root, checkout: "/c" }, home: w.home });
      rmSync(join(w.home, "Library"), { recursive: true, force: true });
      assert.equal(await uneditedFolders([dropbox], r2.deps), 2);
      assert.equal(readAccess(w.home).places.drop.state, "missing");
      assert.equal(readAccess(w.home).places.drop.folder, resolve(dropbox));
    }));

  it("a refused drop folder is noted, logged, and nothing more is read there", () =>
    withWorld(async (w) => {
      writeFileSync(join(w.drop, "Talk.mov"), "video");
      let imported = 0;
      const { result: out, calls } = await watched(() => run(w, L, { importOne: async () => { imported += 1; return { ok: true }; } }), { names: READS, deny: denyList(w.drop) });
      assert.equal(imported, 0);
      assert.equal(readAccess(w.home).places.drop.state, "refused");
      assert.equal(readAccess(w.home).places.drop.code, "EPERM");
      assert.ok(out.logs.includes(accessLog("refused", "EPERM", NODE, wordsOf(w, "drop", w.drop))), out.logs.join("|"));
      const touched = calls.filter((c) => inside(w.drop, c.path) && c.path !== w.drop);
      assert.deepEqual(touched, [], "nothing inside the drop folder is read");
      assert.ok(calls.filter((c) => c.path === w.drop).every((c) => c.name === "readdirSync"), "and the folder itself is only listed");
      assert.equal(readEveryPending(w.home).length, 0);
    }));

  it("every read refused still ends cleanly, the late check put off by the pending's label", () =>
    withWorld(async (w) => {
      const p = holdImport(w, "Talk.mov", L);
      writePending(w.home, { ...p, label: "Video of 6 Nov, 10:00 (Mac Studio)", dropFile: { ino: 1, size: 10, mtimeMs: 1 } });
      const out = await watched(() => run(w, AT), { names: READS, deny: denyAll(w.drop) });
      const logs = out.result.logs;
      assert.deepEqual(out.result.results, []);
      assert.equal(readEveryPending(w.home).length, 1, "the pending is still there");
      assert.ok(logs.includes("Video of 6 Nov, 10:00 (Mac Studio): its check could not be made (EPERM). The next run makes it again."), logs.join("|"));
      assert.equal(logs.some((l) => l.includes("The work on this folder stopped")), false);
      assert.equal(logs.some((l) => l.includes("Talk.mov")), false, "no line names the file");
    }));

  it("a pending with no label is put off as \"A video\", never by its file", () =>
    withWorld(async (w) => {
      const p = holdImport(w, "Talk.mov", L);
      writePending(w.home, { ...p, dropFile: { ino: 1, size: 10, mtimeMs: 1 } });
      const out = await watched(() => run(w, AT), { names: READS, deny: denyAll(w.drop) });
      assert.ok(out.result.logs.includes("A video: its check could not be made (EPERM). The next run makes it again."), out.result.logs.join("|"));
      assert.equal(out.result.logs.some((l) => l.includes("Talk.mov")), false);
    }));

  it("Episodes refused on a local Mac: nothing is imported", () =>
    withWorld(async (w) => {
      const drop = join(w.home, "BRIMM Video Work", "Drop");
      mkdirSync(drop, { recursive: true });
      writeFileSync(join(drop, "Talk.mov"), "video");
      const deps = runs(w, L, { settings: settingsOf(w, drop), home: w.home });
      const episodes = episodesFolder(w.root);
      await watched(() => uneditedFolders([drop], deps.deps), { names: READS, deny: denyList(episodes) });
      const note = readAccess(w.home);
      assert.equal(note.places.episodes.state, "refused");
      assert.equal(note.places.drop.state, "ok");
      assert.equal(existsSync(join(drop, "Talk.mov")), true, "the video stays in the drop folder");
      assert.equal(deps.logs.some((l) => /Episodes could not be read|Looked in the folder/.test(l)), false, "importOne never ran, nor its backstop: " + deps.logs.join("|"));
      assert.ok(deps.logs.includes(accessLog("refused", "EPERM", NODE, wordsOf(w, "episodes", episodes))), deps.logs.join("|"));
    }));

  it("Episodes missing is noted and the import goes on", () =>
    withWorld(async (w) => {
      rmSync(join(w.root, "Episodes"), { recursive: true, force: true });
      writeFileSync(join(w.drop, "Talk.mov"), "video");
      const seen = [];
      const out = await run(w, L, { importOne: async (name) => { seen.push(name); return { ok: true, name }; } });
      assert.deepEqual(seen, ["Talk.mov"]);
      assert.equal(readAccess(w.home).places.episodes.state, "missing");
      assert.equal(out.logs.some((l) => /does not let node|permissions do not let node/.test(l)), false);
    }));

  it("an ok look after a refused one clears it", () =>
    withWorld(async (w) => {
      await watched(() => run(w, L), { names: READS, deny: denyList(w.drop) });
      const first = readAccess(w.home).places.drop;
      assert.equal(first.state, "refused");
      await run(w, L + 60 * 1000);
      const later = readAccess(w.home).places.drop;
      assert.equal(later.state, "ok");
      assert.equal(later.code, "");
      assert.ok(later.at > first.at);
      assert.equal(later.since, later.at, "since begins again with the state");
    }));

  it("every look of the drop folder while the run waits writes its time", () =>
    withWorld(async (w) => {
      writePending(w.home, { ...holdImport(w, "Talk.mov", L), label: "A label" });
      const times = [];
      await run(w, L + 60 * 1000, {
        onWait: async (ms, ctl) => {
          times.push(readAccess(w.home).places.drop.at);
          ctl.add(ms);
        }
      });
      assert.ok(times.length >= 2, `looked ${times.length} times while waiting`);
      assert.ok(times[times.length - 1] > times[0], times.join(","));
    }));

  it("noteSeen does not list the folder when it is given the names, and its prune is guarded", () =>
    withWorld(async (w) => {
      writeFileSync(join(w.drop, "Talk.mov"), "video");
      noteSeen(w.home, w.drop, 1000);
      const key = Object.keys(readSeen(w.home));
      assert.equal(key.length, 1);
      const { calls } = await watched(
        async () => {
          noteSeen(w.home, w.drop, 2000, []);
        },
        { names: ["readdirSync", "statSync"], deny: (name, path) => (name === "statSync" && inside(w.drop, path) ? refusal("EPERM", path) : null) }
      );
      assert.deepEqual(calls.filter((c) => c.name === "readdirSync" && c.path === w.drop), []);
      assert.deepEqual(Object.keys(readSeen(w.home)), key, "a noted file that cannot be looked at stays noted");
      assert.equal(existsSync(seenFile(w.home)), true);
      assert.equal(readEveryPending(w.home).length, 0);
    }));
});

const MIN = 60 * 1000;
describe("the banners (A3)", () => {
  it("a refused look posts once, not again within the hour, and again after it", () =>
    withWorld(async (w) => {
      const deny = { names: READS, deny: denyList(w.drop) };
      const first = await watched(() => run(w, L, { node: "/n/a" }), deny);
      const second = await watched(() => run(w, L + 10 * MIN, { node: "/n/a" }), deny);
      const third = await watched(() => run(w, L + 61 * MIN, { node: "/n/a" }), deny);
      const said = accessBanner("refused", wordsOf(w, "drop", w.drop));
      assert.deepEqual(first.result.notices, [said]);
      assert.deepEqual(second.result.notices, []);
      assert.deepEqual(third.result.notices, [said]);
    }));

  it("a change of state, place or node posts at once", () =>
    withWorld(async (w) => {
      const drop = wordsOf(w, "drop", w.drop);
      const a = await watched(() => run(w, L, { node: "/n/a" }), { names: READS, deny: denyList(w.drop) });
      const b = await watched(() => run(w, L + MIN, { node: "/n/a" }), { names: READS, deny: denyList(w.drop, "EACCES") });
      assert.deepEqual([a.result.notices, b.result.notices], [[accessBanner("refused", drop)], [accessBanner("locked", drop)]]);
      // Node A then node B.
      const c = await watched(() => run(w, L + 2 * MIN, { node: "/n/b" }), { names: READS, deny: denyList(w.drop, "EACCES") });
      assert.deepEqual(c.result.notices, [accessBanner("locked", drop)]);
    }));

  it("a drop folder refused then Episodes refused posts twice", () =>
    withWorld(async (w) => {
      const a = await watched(() => run(w, L, { node: "/n/a" }), { names: READS, deny: denyList(w.drop) });
      const b = await watched(() => run(w, L + MIN, { node: "/n/a" }), { names: READS, deny: denyList(episodesFolder(w.root)) });
      assert.deepEqual(a.result.notices, [accessBanner("refused", wordsOf(w, "drop", w.drop))]);
      assert.deepEqual(b.result.notices, [accessBanner("refused", wordsOf(w, "episodes", episodesFolder(w.root)))]);
    }));

  it("an ok look posts nothing, and the next refusal posts at once", () =>
    withWorld(async (w) => {
      const deny = { names: READS, deny: denyList(w.drop) };
      await watched(() => run(w, L, { node: "/n/a" }), deny);
      const ok = await run(w, L + MIN, { node: "/n/a" });
      assert.deepEqual(ok.notices, []);
      const again = await watched(() => run(w, L + 2 * MIN, { node: "/n/a" }), deny);
      assert.deepEqual(again.result.notices, [accessBanner("refused", wordsOf(w, "drop", w.drop))]);
    }));

  it("a banner that cannot be posted does not stop the run", () =>
    withWorld(async (w) => {
      const out = await watched(() => run(w, L, { node: "/n/a", notify: () => { throw new Error("no notifier"); } }), { names: READS, deny: denyList(w.drop) });
      assert.equal(readAccess(w.home).places.drop.state, "refused");
      assert.ok(out.result.logs.length > 0);
    }));

  const newNodeRun = async (w, places, node, extra = {}) => {
    writeAccess(w.home, { version: 1, places, looking: null, told: {} });
    const r = runs(w, L, { settings: settingsOf(w), home: w.home, node, ...extra });
    let before = null;
    await watched(() => uneditedFolders([w.drop], r.deps), {
      names: ["existsSync"],
      deny: (name, path) => {
        if (path === w.drop && before === null) before = r.notices.length;
        return null;
      }
    });
    return { r, before };
  };
  const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "", broken: false };
  const cloud = (w) => join(w.home, "Library", "CloudStorage", "Dropbox-x", "BRIMM Video");
  const okPlace = (folder, okNode) => ({ state: "ok", code: "", at: L, since: L, folder, node: okNode, okNode });

  it("a new node posts once, before the first touch of the drop folder, when an okNode is known", () =>
    withWorld(async (w) => {
      const { r, before } = await newNodeRun(w, { episodes: okPlace(cloud(w), "/n/a") }, "/n/b");
      assert.equal(before, 1, "posted before the first existsSync on the drop folder");
      assert.deepEqual(r.notices.slice(0, 1), [accessBanner("newNode", "")]);
      // Run one rewrote the Episodes place with the new node as okNode; put the old one back, keeping `told`, so that only the note's own
      // "told" stops a second banner for this node.
      const kept = readAccess(w.home);
      writeAccess(w.home, { ...kept, places: { episodes: okPlace(cloud(w), "/n/a") } });
      const two = runs(w, L + MIN, { settings: settingsOf(w), home: w.home, node: "/n/b" });
      await uneditedFolders([w.drop], two.deps);
      assert.equal(two.notices.includes(accessBanner("newNode", "")), false, "once per node");
    }));

  it("an installed Mac posts no new-node banner, though a place has a foreign okNode", () =>
    withWorld(async (w) => {
      const { r } = await newNodeRun(w, { episodes: okPlace(cloud(w), "/n/a") }, "/n/b", { build: INSTALLED });
      assert.equal(r.notices.includes(accessBanner("newNode", "")), false);
      assert.equal(readAccess(w.home).told.newNode, undefined);
    }));

  it("an installed Mac's banner and log name BRIMM Video Studio, as macOS does, for a refused drop folder and a locked one (review finding 1)", () =>
    withWorld(async (w) => {
      const drop = wordsOf(w, "drop", w.drop);
      const a = await watched(() => run(w, L, { node: "/n/a", build: INSTALLED }), { names: READS, deny: denyList(w.drop) });
      assert.deepEqual(a.result.notices, [`This Mac does not let BRIMM Video Studio look in ${drop}. Allow it in System Settings › Privacy & Security › Files and Folders.`]);
      assert.ok(a.result.logs.includes(`macOS does not let BRIMM Video Studio (/n/a) look in ${drop} (EPERM). Allow BRIMM Video Studio in System Settings, Privacy & Security, Files and Folders; then say "look again" in her chat, or drop the video again.`), a.result.logs.join("|"));
      const b = await watched(() => run(w, L + MIN, { node: "/n/a", build: INSTALLED }), { names: READS, deny: denyList(w.drop, "EACCES") });
      assert.ok(b.result.logs.includes(`The folder's own permissions do not let BRIMM Video Studio look in ${drop} (EACCES). Jason checks them in Finder, Get Info, Sharing & Permissions.`), b.result.logs.join("|"));
      for (const line of [...a.result.notices, ...a.result.logs, ...b.result.logs]) assert.doesNotMatch(line, /\bnode\b/, line);
    }));

  it("an installed Mac's log names BRIMM Video Studio for Episodes refused", () =>
    withWorld(async (w) => {
      const drop = join(w.home, "BRIMM Video Work", "Drop");
      mkdirSync(drop, { recursive: true });
      writeFileSync(join(drop, "Talk.mov"), "video");
      const r = runs(w, L, { settings: settingsOf(w, drop), home: w.home, node: "/n/a", build: INSTALLED });
      const episodes = episodesFolder(w.root);
      await watched(() => uneditedFolders([drop], r.deps), { names: READS, deny: denyList(episodes) });
      const words = wordsOf(w, "episodes", episodes);
      assert.ok(r.logs.includes(accessLog("refused", "EPERM", "/n/a", words, { name: "BRIMM Video Studio" })), r.logs.join("|"));
      assert.deepEqual(r.notices, [`This Mac does not let BRIMM Video Studio look in ${words}. Allow it in System Settings › Privacy & Security › Files and Folders.`]);
    }));

  it("a new node posts nothing with no okNode, or when every noted place is in the home folder", () =>
    withWorld(async (w) => {
      const none = await newNodeRun(w, { episodes: { ...okPlace(cloud(w), "/n/a"), okNode: undefined } }, "/n/b");
      assert.equal(none.r.notices.includes(accessBanner("newNode", "")), false);
      const home = await newNodeRun(w, { episodes: okPlace(join(w.home, "BRIMM Video Work"), "/n/a") }, "/n/b");
      assert.equal(home.r.notices.includes(accessBanner("newNode", "")), false);
    }));

  it("a noted Downloads place with an okNode counts", () =>
    withWorld(async (w) => {
      const { r } = await newNodeRun(w, { downloads: okPlace(join(w.home, "Downloads"), "/n/a") }, "/n/b");
      assert.equal(r.notices.includes(accessBanner("newNode", "")), true);
    }));

  it("a new-node banner that cannot be posted does not stop the run", () =>
    withWorld(async (w) => {
      const { r } = await newNodeRun(w, { episodes: okPlace(cloud(w), "/n/a") }, "/n/b", { notify: () => { throw new Error("no notifier"); } });
      assert.ok(r.logs.includes(`Folder: ${w.drop}`), r.logs.join("|"));
      assert.equal(readAccess(w.home).told.newNode, undefined, "and it is not noted as told");
    }));

  it("an old-mode folder gets no new-node banner, though a place has a foreign okNode", () =>
    withWorld(async (w) => {
      const old = join(w.dir, "Old");
      mkdirSync(old);
      writeAccess(w.home, { version: 1, places: { episodes: okPlace(cloud(w), "/n/a") }, looking: null, told: {} });
      const r = runs(w, L, { settings: settingsOf(w), home: w.home, node: "/n/b" });
      await uneditedFolders([old], r.deps);
      assert.equal(r.notices.includes(accessBanner("newNode", "")), false);
    }));


  it("on an ordinary run (node unchanged) no drop or Episodes path is resolved before the bracketed existsSync", () =>
    withWorld(async (w) => {
      writeAccess(w.home, { version: 1, places: { episodes: okPlace(episodesFolder(w.root), "/n/b") }, looking: null, told: {} });
      const r = runs(w, L, { settings: settingsOf(w), home: w.home, node: "/n/b" });
      let first = null;
      const out = await watched(() => uneditedFolders([w.drop], r.deps), {
        names: ["existsSync", "realpathSync"],
        deny: (name, path) => {
          if (first === null && ((name === "existsSync" && path === w.drop) || (name === "realpathSync" && (inside(w.drop, path) || inside(episodesFolder(w.root), path))))) first = { name, looking: (readAccess(w.home).looking || {}).place };
          return null;
        }
      });
      assert.ok(out.calls.length > 0);
      assert.deepEqual(first, { name: "existsSync", looking: "drop" });
    }));

  it("on a changed-node run any resolve of a drop or Episodes path happens while looking.place is drop", () =>
    withWorld(async (w) => {
      writeAccess(w.home, { version: 1, places: { episodes: okPlace(episodesFolder(w.root), "/n/a") }, looking: null, told: {} });
      const r = runs(w, L, { settings: settingsOf(w), home: w.home, node: "/n/b" });
      const seen = [];
      let beforeExists = true;
      await watched(() => uneditedFolders([w.drop], r.deps), {
        names: ["existsSync", "realpathSync"],
        deny: (name, path) => {
          if (name === "existsSync" && path === w.drop) beforeExists = false;
          if (beforeExists && name === "realpathSync" && (inside(w.drop, path) || inside(episodesFolder(w.root), path))) seen.push((readAccess(w.home).looking || {}).place);
          return null;
        }
      });
      assert.ok(seen.length > 0, "the changed-node run resolves the Episodes path");
      assert.ok(seen.every((place) => place === "drop"), seen.join(","));
    }));
});
