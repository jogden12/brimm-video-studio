// Putting files into an episode kept on this Mac (Phase 3, the local working folder; L4; design D1, D2, D4). `putHere` (unedited.js) writes each
// file whole into the episode's video/ folder on this Mac under a name of its own, renames each file it replaces into video/history/, renames
// the new ones into place, and then writes the record to Dropbox by the rule. A journal, video/.put.json, names the renames it will make, so
// that a run that was stopped is undone by the next put. Nothing waits and nothing is checked afterwards. Nothing here touches Dropbox or a
// program: the root and the home are a test's own folders.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { layoutOf, newEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { episodeFilesFolder } from "../settings.js";
import { putHere } from "../unedited.js";

const NAME = "2026-10-20 IMG_0042 (Mac Studio)";
const WRITER = { commit: "c709b57", on: "Mac Studio" };
const OLD = { "IMG_0042.mov": "the recording", "IMG_0042.cut-plan.json": "the old plan", "IMG_0042.srt": "the words" };

/** A world: a root, a home, an episode kept on the Mac Studio with `OLD` in its video/, and a folder of the run's own to make files in. */
function world() {
  const dir = mkdtempSync(join(tmpdir(), "brimm-put-here-"));
  const root = join(dir, "BRIMM Video");
  const home = join(dir, "home");
  const folder = join(root, "Episodes", NAME);
  const own = episodeFilesFolder(home, NAME);
  mkdirSync(join(folder, "record"), { recursive: true });
  mkdirSync(own, { recursive: true });
  const sizes = {};
  for (const [rel, text] of Object.entries(OLD)) {
    writeFileSync(join(own, rel), text);
    sizes[rel] = Buffer.byteLength(text);
  }
  const made = newEpisode({ id: "e-20261020-3fa9c1", machine: "Mac Studio", at: "2026-10-20T09:00:00-05:00", video: { file: "IMG_0042.mov", bytes: sizes["IMG_0042.mov"], seconds: 42, created: null }, kind: "raw", writer: WRITER, files: sizes, local: { on: "Mac Studio" } });
  writeFileSync(recordFile(folder, 1), recordText({ ...made, rev: 1, version: layoutOf(made) }));
  const work = join(dir, "work");
  mkdirSync(work, { recursive: true });
  /** A file the run made whole in its own folder, to be put at `rel`. */
  const made_ = (rel, text) => {
    const from = join(work, `${Buffer.from(rel).toString("hex")}.made`);
    writeFileSync(from, text);
    return { rel, from };
  };
  const opts = (more = {}) => ({ home, work, writer: WRITER, expectRev: 1, clone: (a, b) => writeFileSync(b, readFileSync(a)), sameDisk: () => true, now: Date.parse("2026-10-20T15:00:00-05:00"), ...more });
  const found = () => ({ folder, name: NAME, record: readEpisode(folder).record });
  /** Every file under the episode's video/, with its text. */
  const inVideo = (from = own) => {
    const out = {};
    for (const name of readdirSync(from)) {
      const at = join(from, name);
      if (statSync(at).isDirectory()) Object.assign(out, Object.fromEntries(Object.entries(inVideo(at)).map(([k, v]) => [`${name}/${k}`, v])));
      else out[name] = readFileSync(at, "utf8");
    }
    return out;
  };
  return { dir, root, home, folder, own, work, made: made_, opts, found, inVideo, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("putHere", () => {
  it("writes the files into video/, sets the replaced ones aside in video/history/, writes the record last and leaves no journal", async () => {
    const w = world();
    const r = await putHere(w.found(), [w.made("IMG_0042.cut-plan.json", "the new plan"), w.made("IMG_0042.notes.txt", "notes"), w.made("history/2026-10-20T15-00-00 IMG_0042.cut-plan.json", "the old plan")], w.opts());
    assert.equal(r.put, true);
    const now = w.inVideo();
    assert.equal(now["IMG_0042.cut-plan.json"], "the new plan");
    assert.equal(now["IMG_0042.notes.txt"], "notes");
    // The file it replaced is kept whole in video/history/, under the stamp, and the file it was given there is there too.
    assert.equal(now["history/2026-10-20T15-00-00 IMG_0042.cut-plan.json"], "the old plan");
    assert.equal(Object.keys(now).filter((k) => k.startsWith("history/")).length, 2);
    // No journal, and no file under a name of its own is left.
    assert.deepEqual(Object.keys(now).filter((k) => k.startsWith(".") || k.endsWith(".put")), []);
    const record = readEpisode(w.folder).record;
    assert.equal(record.rev, 2);
    assert.equal(record.files["IMG_0042.cut-plan.json"], 12);
    assert.equal(record.files["IMG_0042.notes.txt"], 5);
    // A file given under history/ is never listed.
    assert.deepEqual(Object.keys(record.files).filter((k) => k.startsWith("history/")), []);
    // Nothing but the record went into Dropbox.
    assert.deepEqual(readdirSync(w.folder).sort(), ["record"]);
    w.done();
  });
  it("sets a replaced file aside under the moment, in video/history/", async () => {
    const w = world();
    await putHere(w.found(), [w.made("IMG_0042.cut-plan.json", "the new plan")], w.opts());
    const aside = readdirSync(join(w.own, "history"));
    assert.equal(aside.length, 1);
    assert.match(aside[0], /^2026-10-20T\d\d-\d\d-\d\d[+-]\d\d-\d\d IMG_0042\.cut-plan\.json$/);
    assert.equal(readFileSync(join(w.own, "history", aside[0]), "utf8"), "the old plan");
    w.done();
  });
  it("calls the record's change and writes it with the files' sizes", async () => {
    const w = world();
    const r = await putHere(w.found(), [w.made("IMG_0042.notes.txt", "notes")], w.opts({ change: (record) => ({ ...record, name: { text: "Pricing talk", placeholder: false } }) }));
    assert.equal(r.put, true);
    assert.deepEqual(readEpisode(w.folder).record.name, { text: "Pricing talk", placeholder: false });
    assert.equal(r.record.rev, 2);
    w.done();
  });
  it("a refused record write puts the earlier files back, byte for byte, and says why", async () => {
    const w = world();
    const before = w.inVideo();
    const files = [w.made("IMG_0042.cut-plan.json", "the new plan"), w.made("IMG_0042.notes.txt", "notes")];
    // A record written meanwhile, as the other Mac's would be.
    const r = await putHere(w.found(), files, w.opts({ change: (record) => {
      writeFileSync(recordFile(w.folder, 2), recordText({ ...record, rev: 2 }));
      return record;
    } }));
    assert.equal(r.put, false);
    assert.match(r.why, /^the episode's record could not be written again: /);
    assert.deepEqual(w.inVideo(), before);
    w.done();
  });
  it("refuses at once, writing nothing, when the record is not the rev the work was made from", async () => {
    const w = world();
    const before = w.inVideo();
    const r = await putHere(w.found(), [w.made("IMG_0042.notes.txt", "notes")], w.opts({ expectRev: 0 }));
    assert.equal(r.put, false);
    assert.match(r.why, /changed/);
    assert.deepEqual(w.inVideo(), before);
    w.done();
  });
  it("a put stopped between its renames and its record is undone by the next put: video/ holds the files the record lists, at its sizes", async () => {
    const w = world();
    const before = w.inVideo();
    class Killed extends Error {}
    await assert.rejects(putHere(w.found(), [w.made("IMG_0042.cut-plan.json", "the new plan"), w.made("IMG_0042.notes.txt", "notes")], w.opts({ killed: (at) => {
      if (at === "renamed") throw new Killed("killed");
    } })), Killed);
    // It stopped with the new files in place and the journal still there.
    assert.equal(w.inVideo()["IMG_0042.cut-plan.json"], "the new plan");
    assert.equal(existsSync(join(w.own, ".put.json")), true);
    assert.equal(readEpisode(w.folder).record.rev, 1);
    // The next put, of another file, undoes it first.
    const r = await putHere(w.found(), [w.made("IMG_0042.srt", "other words")], w.opts());
    assert.equal(r.put, true);
    const now = w.inVideo();
    assert.equal(now["IMG_0042.cut-plan.json"], before["IMG_0042.cut-plan.json"]);
    assert.equal(now["IMG_0042.notes.txt"], undefined);
    assert.equal(now["IMG_0042.srt"], "other words");
    assert.equal(existsSync(join(w.own, ".put.json")), false);
    const record = readEpisode(w.folder).record;
    for (const [rel, bytes] of Object.entries(record.files)) assert.equal(statSync(join(w.own, rel)).size, bytes, rel);
    w.done();
  });
  it("a stopped put is judged by the sizes the record lists, not by its rev: a title written in between does not make the files it never listed stay", async () => {
    const w = world();
    const before = w.inVideo();
    class Killed extends Error {}
    await assert.rejects(putHere(w.found(), [w.made("IMG_0042.cut-plan.json", "the new plan, a longer one")], w.opts({ killed: (at) => {
      if (at === "renamed") throw new Killed("killed");
    } })), Killed);
    // A title write lands: the next record, listing the files as they were.
    const record = readEpisode(w.folder).record;
    writeFileSync(recordFile(w.folder, 2), recordText({ ...record, rev: 2, name: { text: "A title", placeholder: false } }));
    const r = await putHere(w.found(), [w.made("IMG_0042.srt", "other words")], w.opts({ expectRev: 2 }));
    assert.equal(r.put, true);
    assert.equal(w.inVideo()["IMG_0042.cut-plan.json"], before["IMG_0042.cut-plan.json"]);
    w.done();
  });
  it("says it changed meanwhile, never that the other Mac changed it", async () => {
    const w = world();
    const r = await putHere(w.found(), [w.made("IMG_0042.notes.txt", "notes")], w.opts({ expectRev: 0 }));
    assert.equal(r.put, false);
    assert.doesNotMatch(r.why, /other Mac/);
    assert.match(r.why, /changed meanwhile/);
    w.done();
  });
  it("a put stopped after its record is written leaves its files: the next put removes the journal only", async () => {
    const w = world();
    class Killed extends Error {}
    await assert.rejects(putHere(w.found(), [w.made("IMG_0042.notes.txt", "notes")], w.opts({ killed: (at) => {
      if (at === "recorded") throw new Killed("killed");
    } })), Killed);
    assert.equal(readEpisode(w.folder).record.rev, 2);
    const r = await putHere(w.found(), [w.made("IMG_0042.srt", "other words")], w.opts({ expectRev: 2 }));
    assert.equal(r.put, true);
    const now = w.inVideo();
    assert.equal(now["IMG_0042.notes.txt"], "notes");
    assert.equal(existsSync(join(w.own, ".put.json")), false);
    w.done();
  });
  it("B0-F18 a stopped put whose record was written is not undone while the record cannot be read: the journal stays and the put is refused", async () => {
    const w = world();
    class Killed extends Error {}
    await assert.rejects(putHere(w.found(), [w.made("IMG_0042.notes.txt", "notes")], w.opts({ killed: (at) => {
      if (at === "recorded") throw new Killed("killed");
    } })), Killed);
    // Dropbox keeps a conflicted copy of a record file, and the record cannot be read.
    writeFileSync(join(w.folder, "record", "0002 (Jason Ogden's conflicted copy 2026-10-21).json"), "{}");
    const r = await putHere(w.found(), [w.made("IMG_0042.srt", "other words")], w.opts({ expectRev: 2 }));
    assert.equal(r.put, false);
    assert.equal(existsSync(join(w.own, ".put.json")), true);
    assert.equal(w.inVideo()["IMG_0042.notes.txt"], "notes");
    w.done();
  });
  it("B1-F9 a stopped put under a record from a newer Studio says so, and one under a newer record that does not read yet waits: the journal stays", async () => {
    class Killed extends Error {}
    for (const newer of [true, false]) {
      const w = world();
      await assert.rejects(putHere(w.found(), [w.made("IMG_0042.notes.txt", "notes")], w.opts({ killed: (at) => {
        if (at === (newer ? "recorded" : "renamed")) throw new Killed("killed");
      } })), Killed);
      const top = readEpisode(w.folder).record;
      if (newer) writeFileSync(recordFile(w.folder, top.rev + 1), recordText({ ...top, rev: top.rev + 1, version: 99 }));
      else writeFileSync(recordFile(w.folder, top.rev + 1), "{");
      const r = await putHere(w.found(), [w.made("IMG_0042.srt", "other words")], w.opts({ expectRev: top.rev }));
      assert.equal(r.put, false, `newer ${newer}`);
      if (newer) assert.match(r.why, /newer BRIMM Video Studio\. Ask Jason to update this Mac/);
      assert.equal(existsSync(join(w.own, ".put.json")), true, `newer ${newer}`);
      assert.equal(w.inVideo()["IMG_0042.notes.txt"], "notes", `newer ${newer}`);
      w.done();
    }
  });
  it("waits for nothing and calls no check", async () => {
    const w = world();
    let waited = 0;
    const r = await putHere(w.found(), [w.made("IMG_0042.notes.txt", "notes")], w.opts({ wait: async () => { waited += 1; } }));
    assert.equal(r.put, true);
    assert.equal(waited, 0);
    w.done();
  });
  it("a file written for it is whole before it is renamed: it is written under a name of its own", async () => {
    const w = world();
    const seen = [];
    await putHere(w.found(), [w.made("IMG_0042.notes.txt", "notes")], w.opts({ killed: (at) => {
      if (at === "written") seen.push(readdirSync(w.own).sort());
    } }));
    assert.equal(seen.length, 1);
    assert.equal(seen[0].includes("IMG_0042.notes.txt"), false);
    assert.equal(seen[0].some((n) => n.includes("IMG_0042.notes.txt")), true);
    w.done();
  });
});
