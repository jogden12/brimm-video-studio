// The import status files in Episodes/.importing/: their names, a new file at each write, what each holds, reading the newest
// back, and the judgements
// the import and edit.js both make from one: where its import has got to, whether it holds its video, and whether this Mac
// left it behind when a run crashed. Every test has a temp folder of its own for BRIMM Video, the rule's text writer is a
// stand-in that writes a new file where it is asked and refuses one that is there, as the rule does, and the clock is a fixed
// moment. No program is run here.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STALE_MS, statusName, statusFault, writeStatus, readStatuses, removeStatus, importState, holdsVideo, leftByCrash } from "../importing.js";

const NOW = Date.parse("2026-10-14T09:30:00-05:00");
const STATUS = { version: 1, machine: "Mac Studio", pid: 4242, video: "Pricing talk.mp4", bytes: 1823400112, seconds: 1834.27, step: "Making the rough cut", at: "2026-10-14T09:29:00-05:00" };
/** The status as written `minutes` before NOW, with any more fields given. */
const ago = (minutes, more = {}) => ({ ...STATUS, at: new Date(NOW - minutes * 60000).toISOString(), ...more });

/** One test's folder for BRIMM Video, with nothing in it yet, and a stand-in for the rule's text writer that writes in place
    and keeps where it was asked to write. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "brimm-importing-"));
  const root = join(dir, "BRIMM Video");
  mkdirSync(root);
  const written = [];
  const writeText = (to, text) => {
    if (existsSync(to)) throw new Error(`${to} is there already`);
    written.push(to);
    writeFileSync(to, text);
  };
  const folder = join(root, "Episodes", ".importing");
  const names = () => readdirSync(folder).sort();
  return { dir, root, folder, names, written, writeText, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("an import's status file", () => {
  it("is named for the video, the Mac that imports it and its number", () => {
    assert.equal(statusName("Pricing talk.mp4", "Mac Studio", 3), "Pricing talk.mp4 (Mac Studio) 3.json");
    assert.equal(statusName("/x/Unedited Video/Mac Studio/Pricing talk.mp4", "Sallie's laptop", 1), "Pricing talk.mp4 (Sallie's laptop) 1.json");
  });
  it("is written whole through the rule's text writer, as a new file with the next number, and the one before is deleted", () => {
    const t = setup();
    const first = writeStatus(t.root, STATUS, t.writeText);
    assert.deepEqual([first, t.names()], [join(t.folder, "Pricing talk.mp4 (Mac Studio) 1.json"), ["Pricing talk.mp4 (Mac Studio) 1.json"]]);
    assert.equal(readFileSync(first, "utf8"), JSON.stringify(STATUS, null, 2) + "\n");
    writeStatus(t.root, { ...STATUS, step: "Making the upright version" }, t.writeText);
    const last = writeStatus(t.root, { ...STATUS, step: "Filing" }, t.writeText);
    assert.deepEqual(t.names(), ["Pricing talk.mp4 (Mac Studio) 3.json"]);
    assert.deepEqual([JSON.parse(readFileSync(last, "utf8")).step, t.written.length], ["Filing", 3]);
    t.done();
  });
  it("keeps the two Macs' status files of one video apart", () => {
    const t = setup();
    writeStatus(t.root, STATUS, t.writeText);
    writeStatus(t.root, STATUS, t.writeText);
    writeStatus(t.root, { ...STATUS, machine: "Sallie's laptop" }, t.writeText);
    assert.deepEqual(t.names(), ["Pricing talk.mp4 (Mac Studio) 2.json", "Pricing talk.mp4 (Sallie's laptop) 1.json"]);
    t.done();
  });
  it("says why the import failed, or what the late check found, when there is one", () => {
    assert.equal(statusFault({ ...STATUS, failed: "the transcriber found no speech in it" }), "");
    assert.equal(statusFault({ ...STATUS, problem: "Pricing talk.rough-cut.mp4 is short: 10 bytes of 30" }), "");
    assert.equal(statusFault({ ...STATUS, seconds: null, step: "Waiting to start" }), "");
  });
  it("says why a video is held and not imported, when it is", () => {
    assert.equal(statusFault({ ...STATUS, seconds: null, step: "Held", held: "Zoom downloads are taken from a later version. Put this one in BRIMM VIDEO Transfer." }), "");
  });
  it("names the video by the label of a light import, when it has one", () => {
    assert.equal(statusFault({ ...STATUS, label: "Video of 20 Oct, 15:00 (Mac Studio)" }), "");
    for (const label of ["", 3, null, ["Video"]]) assert.equal(statusFault({ ...STATUS, label }), "its label cannot be read", JSON.stringify(label));
  });
  it("is not written when a field is missing or wrong, and says which", () => {
    const t = setup();
    const broken = [
      [null, "it is not an import's status"],
      [{ ...STATUS, version: 2 }, "it is version 2, and this brimm-video reads version 1"],
      [{ ...STATUS, machine: "" }, "it names no Mac"],
      [{ ...STATUS, pid: "4242" }, "the run that wrote it cannot be read"],
      [{ ...STATUS, video: "Unedited Video/Mac Studio/Pricing talk.mp4" }, "it names no video"],
      [{ ...STATUS, bytes: -1 }, "the video's size cannot be read"],
      [{ ...STATUS, seconds: "long" }, "the video's length cannot be read"],
      [{ ...STATUS, step: "" }, "it names no step"],
      [{ ...STATUS, at: "a minute ago" }, "when it was written cannot be read"],
      [{ ...STATUS, failed: "" }, "why the import failed cannot be read"],
      [{ ...STATUS, problem: 3 }, "the problem it found cannot be read"],
      [{ ...STATUS, held: "" }, "why the video is held cannot be read"],
      [{ ...STATUS, held: 3 }, "why the video is held cannot be read"]
    ];
    for (const [status, why] of broken) assert.equal(statusFault(status), why);
    assert.throws(() => writeStatus(t.root, { ...STATUS, step: "" }, t.writeText), { message: "the import's status was not written, because it names no step" });
    assert.deepEqual([t.written, existsSync(join(t.root, "Episodes"))], [[], false]);
    t.done();
  });
});

describe("the status files, read back", () => {
  it("are listed by name, each with its number and whether it has gone unwritten for 10 minutes", () => {
    const t = setup();
    writeStatus(t.root, ago(1, { video: "b talk.mov" }), t.writeText);
    writeStatus(t.root, ago(10, { video: "a talk.mp4" }), t.writeText);
    assert.deepEqual(readStatuses(t.root, NOW), [
      { file: join(t.folder, "a talk.mp4 (Mac Studio) 1.json"), status: ago(10, { video: "a talk.mp4" }), stale: true, n: 1 },
      { file: join(t.folder, "b talk.mov (Mac Studio) 1.json"), status: ago(1, { video: "b talk.mov" }), stale: false, n: 1 }
    ]);
    assert.deepEqual(readStatuses(t.root, NOW - 60000).map((s) => s.stale), [false, false]);
    assert.equal(STALE_MS, 10 * 60 * 1000);
    t.done();
  });
  it("give the highest number of each video and Mac, and leave out an older one Dropbox has not yet deleted", () => {
    const t = setup();
    mkdirSync(t.folder, { recursive: true });
    writeFileSync(join(t.folder, "Pricing talk.mp4 (Mac Studio) 4.json"), JSON.stringify(ago(2, { step: "Making the rough cut" })));
    writeFileSync(join(t.folder, "Pricing talk.mp4 (Mac Studio) 5.json"), JSON.stringify(ago(1, { step: "Filing" })));
    writeFileSync(join(t.folder, "Pricing talk.mp4 (Sallie's laptop) 2.json"), JSON.stringify(ago(1, { machine: "Sallie's laptop" })));
    const read = readStatuses(t.root, NOW);
    assert.deepEqual(read.map((r) => [r.status.machine, r.n, r.status.step]), [["Mac Studio", 5, "Filing"], ["Sallie's laptop", 2, "Making the rough cut"]]);
    t.done();
  });
  it("tell a Mac's name with brackets in it from the video's", () => {
    const t = setup();
    writeStatus(t.root, ago(1, { video: "Talk (final).mp4", machine: "Sallie's MacBook Pro (M4, 2024)" }), t.writeText);
    writeStatus(t.root, ago(1, { video: "Talk (final).mp4", machine: "Sallie's MacBook Pro (M4, 2024)" }), t.writeText);
    assert.deepEqual(readStatuses(t.root, NOW).map((r) => [r.status.video, r.status.machine, r.n]), [["Talk (final).mp4", "Sallie's MacBook Pro (M4, 2024)", 2]]);
    assert.deepEqual(t.names(), ["Talk (final).mp4 (Sallie's MacBook Pro (M4, 2024)) 2.json"]);
    t.done();
  });
  it("are none when there is no folder for them", () => {
    const t = setup();
    assert.deepEqual(readStatuses(t.root, NOW), []);
    t.done();
  });
  it("list one that cannot be read with why, and leave out hidden files and files that are not statuses", () => {
    const t = setup();
    writeStatus(t.root, ago(1), t.writeText);
    writeFileSync(join(t.folder, "Cut short.mp4 (Mac Studio) 1.json"), JSON.stringify(STATUS).slice(0, 40));
    writeFileSync(join(t.folder, "Old.mp4 (Mac Studio) 1.json"), JSON.stringify({ ...STATUS, version: 2 }));
    writeFileSync(join(t.folder, ".DS_Store"), "");
    writeFileSync(join(t.folder, "notes.txt"), "not a status");
    assert.deepEqual(readStatuses(t.root, NOW), [
      { file: join(t.folder, "Cut short.mp4 (Mac Studio) 1.json"), status: null, stale: false, n: 1, why: "it could not be read (it is not whole)" },
      { file: join(t.folder, "Old.mp4 (Mac Studio) 1.json"), status: null, stale: false, n: 1, why: "it could not be read (it is version 2, and this brimm-video reads version 1)" },
      { file: join(t.folder, "Pricing talk.mp4 (Mac Studio) 1.json"), status: ago(1), stale: false, n: 1 }
    ]);
    t.done();
  });
});

describe("where an import has got to, by its status", () => {
  it("is running while it was written in the last 10 minutes, and stopped after that", () => {
    assert.deepEqual([ago(0), ago(9), ago(10), ago(600)].map((s) => importState(s, NOW)), ["running", "running", "stopped", "stopped"]);
  });
  it("is failed when the status says why it failed, and has a problem when the late check found one, however old it is", () => {
    assert.deepEqual([importState(ago(1, { failed: "ffmpeg stopped" }), NOW), importState(ago(600, { failed: "ffmpeg stopped" }), NOW)], ["failed", "failed"]);
    assert.deepEqual([importState(ago(1, { problem: "edit/main.v0.fcpxml is missing" }), NOW), importState(ago(600, { problem: "edit/main.v0.fcpxml is missing" }), NOW)], ["problem", "problem"]);
  });
  it("is held when the video was left where it is on purpose, however old the status is", () => {
    assert.deepEqual([importState(ago(1, { held: "Zoom downloads wait." }), NOW), importState(ago(600, { held: "Zoom downloads wait." }), NOW)], ["held", "held"]);
    // A failure or a problem says more than a hold does.
    assert.equal(importState(ago(1, { held: "Zoom downloads wait.", failed: "ffmpeg stopped" }), NOW), "failed");
  });
});

describe("whether a status holds its video, so that it is not imported again", () => {
  it("holds it while the import is running, after it failed, and after the late check found a problem", () => {
    assert.equal(holdsVideo(ago(1), NOW), true);
    assert.equal(holdsVideo(ago(600, { failed: "ffmpeg stopped" }), NOW), true);
    assert.equal(holdsVideo(ago(600, { problem: "edit/main.v0.fcpxml is missing" }), NOW), true);
  });
  it("holds it for as long as it is held, however old the status is", () => {
    assert.equal(holdsVideo(ago(600, { held: "Zoom downloads wait." }), NOW), true);
  });
  it("does not hold it once the import has stopped, or when the status could not be read", () => {
    assert.equal(holdsVideo(ago(10), NOW), false);
    assert.equal(holdsVideo(null, NOW), false);
  });
});

describe("a status that a crash left behind", () => {
  it("is one this Mac wrote, not written for 10 minutes, with nothing failed and no problem: this Mac's next run takes it away", () => {
    assert.equal(leftByCrash(ago(10), NOW, "Mac Studio"), true);
  });
  it("is never one that failed or found a problem, one still running, one the other Mac wrote, or one that could not be read", () => {
    assert.equal(leftByCrash(ago(600, { failed: "ffmpeg stopped" }), NOW, "Mac Studio"), false);
    assert.equal(leftByCrash(ago(600, { problem: "edit/main.v0.fcpxml is missing" }), NOW, "Mac Studio"), false);
    assert.equal(leftByCrash(ago(600, { held: "Zoom downloads wait." }), NOW, "Mac Studio"), false);
    assert.equal(leftByCrash(ago(9), NOW, "Mac Studio"), false);
    assert.equal(leftByCrash(ago(600), NOW, "Sallie's laptop"), false);
    assert.equal(leftByCrash(null, NOW, "Mac Studio"), false);
  });
});

describe("taking a status file away", () => {
  it("removes every file of one video and one Mac, leaves the other Mac's, and does nothing when there is none", () => {
    const t = setup();
    writeStatus(t.root, STATUS, t.writeText);
    writeFileSync(join(t.folder, "Pricing talk.mp4 (Mac Studio) 7.json"), JSON.stringify(STATUS));
    writeStatus(t.root, { ...STATUS, machine: "Sallie's laptop" }, t.writeText);
    removeStatus(t.root, "Pricing talk.mp4", "Mac Studio");
    assert.deepEqual(t.names(), ["Pricing talk.mp4 (Sallie's laptop) 1.json"]);
    removeStatus(t.root, "Pricing talk.mp4", "Mac Studio");
    removeStatus(t.root, "Never imported.mov", "Mac Studio");
    assert.deepEqual(t.names(), ["Pricing talk.mp4 (Sallie's laptop) 1.json"]);
    t.done();
  });
  it("does nothing when there is no folder for them", () => {
    const t = setup();
    removeStatus(t.root, "Pricing talk.mp4", "Mac Studio");
    assert.equal(existsSync(t.folder), false);
    t.done();
  });
});

describe("what the lead's review of PR 11 found in the status files", () => {
  it("18. keeps two imports of one name apart by each import's own id, and takes away one's own alone", () => {
    const t = setup();
    writeStatus(t.root, { ...STATUS, import: "aaa" }, t.writeText);
    writeStatus(t.root, { ...STATUS, import: "aaa", step: "Filing" }, t.writeText);
    writeStatus(t.root, { ...STATUS, import: "bbb", failed: "the transcriber stopped" }, t.writeText);
    assert.deepEqual(t.names(), ["Pricing talk.mp4 (Mac Studio) aaa 2.json", "Pricing talk.mp4 (Mac Studio) bbb 1.json"]);
    assert.deepEqual(readStatuses(t.root, NOW).map((r) => [r.status.import, r.status.step, r.status.failed]), [["aaa", "Filing", undefined], ["bbb", "Making the rough cut", "the transcriber stopped"]]);
    removeStatus(t.root, "Pricing talk.mp4", "Mac Studio", "aaa");
    assert.deepEqual(t.names(), ["Pricing talk.mp4 (Mac Studio) bbb 1.json"]);
    removeStatus(t.root, "Pricing talk.mp4", "Mac Studio");
    assert.deepEqual(t.names(), []);
    t.done();
  });
});
