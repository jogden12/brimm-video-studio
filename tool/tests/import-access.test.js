// The launch agent's import notes each look at the drop folder and at Episodes in access.json, and stops cleanly when macOS refuses a folder
// (plan A2). Built on checks-world.js. A refusal is made with watched-fs.js `deny` for readdirSync, statSync, opendirSync and readFileSync in the
// folder, never for existsSync, which the real one never throws. Each test has a temp world of its own: no Dropbox, no real home, no program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { accessLog, placeWordsOf, readAccess } from "../access.js";
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

  it("a folder not there is noted missing, in both branches: the log still says so, and a local Mac's late checks still run", () =>
    withWorld(async (w) => {
      rmSync(w.drop, { recursive: true, force: true });
      const r = runs(w, L, { settings: settingsOf(w), home: w.home });
      const code = await uneditedFolders([w.drop], r.deps);
      assert.equal(code, 2);
      assert.equal(readAccess(w.home).places.drop.state, "missing");
      assert.ok(r.logs.includes(`There is no folder at ${w.drop}.`), r.logs.join("|"));
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
      assert.deepEqual(w.statuses(), [], "and nothing was started for it");
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
