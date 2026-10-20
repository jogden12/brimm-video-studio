// The episode record, record/0001.json, 0002.json and on: its shape, reading the newest whole one, writing each change as a
// new file and only when no newer one is there, the conflicted copies Dropbox keeps, the list of the episode's files, what
// this Mac last wrote, and who is editing it. Every test has a temp folder of its own, and the rule's text writer is a
// stand-in that writes a new file where it is asked, and refuses one that is there, as the rule does. No program is run here.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RECORD_DIR, RECORD_VERSION, recordFile, newEpisode, episodeFault, recordText, readEpisode, writeEpisode, conflictedCopies, conflictedOf, conflictedBy, CONFLICT_FORMS, filesProblems, lastWritten, undone, heldElsewhere, claimed, released, newId, localStamp, shown } from "../episode.js";
import { writtenFile } from "../settings.js";

const AT = "2026-10-14T09:12:00-05:00";
const WRITER = { commit: "c709b57", on: "Mac Studio" };
/** What the import knows of a video when it writes the record. */
const IMPORTED = {
  id: "e-20261014-3fa9c1",
  machine: "Mac Studio",
  at: AT,
  video: { file: "Pricing talk.mp4", bytes: 1823400112, seconds: 1834.27, created: null },
  kind: "episode",
  writer: WRITER,
  files: { "Pricing talk.mp4": 1823400112, "Pricing talk.cut-plan.txt": 5120, "edit/main.v0.fcpxml": 9000 },
  reels: [{ n: 1, status: "candidate", from: 61.2, to: 118.4, title: "Price like you mean it", why: "It makes one point and stands alone.", files: ["Pricing talk.reel-1.mp4"], pushed: [] }]
};
/** The record as the import's first write leaves it. */
const RECORD = { ...newEpisode(IMPORTED), rev: 1 };
const COPY = "record/0002 (Sallie Ogden's conflicted copy 2026-10-14).json";

/** One test's episode folder and home folder, a stand-in for the rule's text writer that writes a new file where it is asked
    and keeps where, `store` to put a record file in the folder by hand, and `files` for the names in record/. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "brimm-episode-"));
  const folder = join(dir, "2026-10-14 Pricing talk (Mac Studio)");
  const home = join(dir, "home");
  mkdirSync(folder);
  const written = [];
  const writeText = (to, text) => {
    if (existsSync(to)) throw new Error(`${to} is there already`);
    written.push(to);
    writeFileSync(to, text);
  };
  const store = (record, text = recordText(record)) => {
    mkdirSync(join(folder, RECORD_DIR), { recursive: true });
    writeFileSync(recordFile(folder, record.rev), text);
  };
  const files = () => readdirSync(join(folder, RECORD_DIR)).sort();
  return { dir, folder, home, written, writeText, store, files, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("a new episode's record", () => {
  it("has every field of version 1, from what the import knows, and rev 0 until it is first written", () => {
    assert.deepEqual(newEpisode(IMPORTED), {
      version: 1,
      id: "e-20261014-3fa9c1",
      rev: 0,
      writer: { commit: "c709b57", on: "Mac Studio" },
      kind: "episode",
      video: { file: "Pricing talk.mp4", bytes: 1823400112, seconds: 1834.27, recorded: "2026-10-14", recordedFrom: "import" },
      imported: { on: "Mac Studio", at: AT },
      name: { text: "Pricing talk", placeholder: true },
      title: null,
      editing: null,
      released: null,
      archived: null,
      files: { "Pricing talk.mp4": 1823400112, "Pricing talk.cut-plan.txt": 5120, "edit/main.v0.fcpxml": 9000 },
      spellings: [],
      main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [], base: null },
      reels: [{ n: 1, status: "candidate", from: 61.2, to: 118.4, title: "Price like you mean it", why: "It makes one point and stands alone.", files: ["Pricing talk.reel-1.mp4"], pushed: [] }],
      libraries: {},
      finished: null
    });
  });
  it("says the video was recorded on the day its file says, when it says one, and on the import's day otherwise", () => {
    const made = "2026-10-12T15:00:00.000000Z";
    const recorded = (created) => newEpisode({ ...IMPORTED, video: { ...IMPORTED.video, created } }).video;
    assert.deepEqual([recorded(made).recorded, recorded(made).recordedFrom], [new Date(made).toLocaleDateString("en-CA"), "video"]);
    for (const none of [null, undefined, "", "not a time", "1904-01-01T00:00:00.000000Z", "1970-01-01T00:00:00.000000Z"]) {
      assert.deepEqual([recorded(none).recorded, recorded(none).recordedFrom], ["2026-10-14", "import"], String(none));
    }
  });
  it("carries the title Claude recommended, when the import was given one", () => {
    const title = { text: "Price like you mean it", from: "claude", approved: false };
    assert.deepEqual(newEpisode({ ...IMPORTED, title }).title, title);
    assert.equal(episodeFault({ ...newEpisode({ ...IMPORTED, title }), rev: 1 }), "");
  });
  it("is sound once written, as an episode with Reel candidates or a short video with none", () => {
    assert.equal(episodeFault(RECORD), "");
    assert.equal(episodeFault({ ...newEpisode({ ...IMPORTED, kind: "short video", reels: [] }), rev: 1 }), "");
    assert.equal(episodeFault(newEpisode(IMPORTED)), "its rev cannot be read");
  });
});

describe("an episode's id", () => {
  it("is e-, the day without its dashes, and six hex digits", () => {
    assert.equal(newId("2026-10-14", () => 0x3fa9c1 / 0x1000000), "e-20261014-3fa9c1");
    assert.equal(newId("2026-10-14", () => 0), "e-20261014-000000");
    assert.match(newId("2026-10-14"), /^e-20261014-[0-9a-f]{6}$/);
  });
});

describe("a moment in the record", () => {
  it("is the Mac's own time with how far it is from UTC, and is shown to a person to the minute", () => {
    const at = localStamp(new Date("2026-10-14T14:12:30Z"));
    assert.match(at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:30[+-]\d{2}:\d{2}$/);
    assert.equal(new Date(at).getTime(), new Date("2026-10-14T14:12:30Z").getTime());
    assert.equal(shown("2026-10-14T09:12:00-05:00"), "2026-10-14 09:12");
  });
});

describe("reading an episode's record", () => {
  it("keeps each record in record/, numbered with four digits", () => {
    assert.deepEqual([RECORD_DIR, RECORD_VERSION, recordFile("/E/x", 7)], ["record", 1, "/E/x/record/0007.json"]);
  });
  it("gives back the record with the highest number, whole, with any field this version does not know kept as it was", () => {
    const t = setup();
    t.store(RECORD);
    const later = { ...RECORD, rev: 2, studio: { note: "from a later version" } };
    t.store(later);
    assert.deepEqual(readEpisode(t.folder), { record: later, file: recordFile(t.folder, 2) });
    t.done();
  });
  it("skips a higher record that is not whole yet, as while Dropbox brings it over, and one whose rev is not its number", () => {
    const t = setup();
    t.store(RECORD);
    t.store({ ...RECORD, rev: 3 }, recordText({ ...RECORD, rev: 3 }).slice(0, 200));
    t.store({ ...RECORD, rev: 2 }, recordText({ ...RECORD, rev: 5 }));
    assert.deepEqual(readEpisode(t.folder), { record: RECORD, file: recordFile(t.folder, 1) });
    t.done();
  });
  it("says why in plain words when the folder is not there, or holds no whole record", () => {
    const t = setup();
    assert.deepEqual(readEpisode(join(t.dir, "2026-10-15 Gone")), { why: "the folder 2026-10-15 Gone could not be read (it is not there)", code: "UNREADABLE" });
    assert.deepEqual(readEpisode(t.folder), { why: "it has no whole record, so its import has not finished, or it is not an episode", code: "NONE" });
    t.store(RECORD, recordText(RECORD).slice(0, 200));
    assert.deepEqual(readEpisode(t.folder).code, "NONE");
    t.store(RECORD, recordText({ ...RECORD, kind: "reel" }));
    assert.deepEqual(readEpisode(t.folder).code, "NONE");
    t.done();
  });
  it("reads a record of a newer layout, and says so, without checking the fields it does not know", () => {
    const t = setup();
    const newer = { version: 2, id: RECORD.id, rev: 1, somethingNew: true };
    t.store(newer);
    assert.deepEqual(readEpisode(t.folder), { record: newer, file: recordFile(t.folder, 1), newer: true });
    t.done();
  });
  it("says which field of version 1 cannot be read", () => {
    const broken = [
      [null, "it is not an episode's record"],
      [{ ...RECORD, id: "Pricing talk" }, "its id cannot be read"],
      [{ ...RECORD, writer: { commit: "c709b57" } }, "who last wrote it cannot be read"],
      [{ ...RECORD, kind: "reel" }, "it is neither an episode nor a short video"],
      [{ ...RECORD, video: { ...RECORD.video, recordedFrom: "guess" } }, "its video cannot be read"],
      [{ ...RECORD, video: { ...RECORD.video, file: "media/Pricing talk.mp4" } }, "its video cannot be read"],
      [{ ...RECORD, imported: { on: "Mac Studio", at: "today" } }, "where and when it was imported cannot be read"],
      [{ ...RECORD, name: { text: "Pricing talk" } }, "its name cannot be read"],
      [{ ...RECORD, title: { text: "Price like you mean it", from: "someone", approved: false } }, "its title cannot be read"],
      [{ ...RECORD, editing: { by: "Mac Studio" } }, "who is editing it cannot be read"],
      [{ ...RECORD, released: { at: AT, files: { "Pricing talk.mp4": -1 } } }, "what it held when it was last let go cannot be read"],
      [{ ...RECORD, archived: { at: "today" } }, "whether it is archived cannot be read"],
      [{ ...RECORD, files: { "../Pricing talk.mp4": 1823400112 } }, "its list of files cannot be read"],
      [{ ...RECORD, spellings: [["Sally"]] }, "its spellings cannot be read"],
      [{ ...RECORD, main: { ...RECORD.main, pushed: [{ v: 0, at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml" }] } }, "its main video cannot be read"],
      [{ ...RECORD, reels: [{ ...RECORD.reels[0], status: "maybe" }] }, "its Reels cannot be read"],
      [{ ...RECORD, reels: [{ ...RECORD.reels[0], pushed: [{ v: 1 }] }] }, "its Reels cannot be read"],
      [{ ...RECORD, libraries: { "Mac Studio": 3 } }, "its libraries cannot be read"],
      [{ ...RECORD, finished: { revision: 1, at: AT } }, "whether it is finished cannot be read"]
    ];
    for (const [record, why] of broken) assert.equal(episodeFault(record), why);
    const { title, ...noTitle } = RECORD;
    assert.equal(episodeFault(noTitle), "its title cannot be read");
  });
  it("stops while Dropbox keeps a conflicted copy of a record, and names the copy", () => {
    const t = setup();
    t.store(RECORD);
    writeFileSync(join(t.folder, COPY), recordText({ ...RECORD, rev: 2 }));
    assert.deepEqual(readEpisode(t.folder), { why: `Dropbox has kept a conflicted copy in this episode: ${COPY}. Two Macs changed the same file before Dropbox could bring one change across, and which to keep is for a person to say. Nothing is changed until one is kept. Say "sort out the conflict"`, code: "CONFLICTED" });
    assert.deepEqual(conflictedCopies(t.folder), [COPY]);
    // resolve reads the newest record past the copies, and the copy is a copy of the record of its number.
    assert.equal(readEpisode(t.folder, { pastCopies: true }).record.rev, RECORD.rev);
    assert.equal(conflictedOf(COPY), COPY.replace(/ \(.*\)/, ""));
    t.done();
  });
  it("stops while Dropbox keeps a conflicted copy of a timeline in edit/, or of any other file in the folder", () => {
    const t = setup();
    t.store(RECORD);
    mkdirSync(join(t.folder, "edit"));
    const timeline = "edit/main.v1.mac-studio (Jason Ogden's conflicted copy 2026-10-14).fcpxml";
    writeFileSync(join(t.folder, timeline), "<fcpxml/>");
    assert.match(readEpisode(t.folder).why, /^Dropbox has kept a conflicted copy in this episode: edit\/main\.v1\.mac-studio \(Jason Ogden's conflicted copy 2026-10-14\)\.fcpxml\. /);
    writeFileSync(join(t.folder, "Pricing talk (Case Conflict).srt"), "1");
    assert.deepEqual(conflictedCopies(t.folder), ["Pricing talk (Case Conflict).srt", timeline]);
    t.done();
  });
  it("goes on when the only conflicted copies are in history/, where they were set aside on purpose", () => {
    const t = setup();
    t.store(RECORD);
    mkdirSync(join(t.folder, "history"));
    writeFileSync(join(t.folder, "history", "0002 (Sallie Ogden's conflicted copy 2026-10-14).json"), recordText(RECORD));
    assert.deepEqual([readEpisode(t.folder), conflictedCopies(t.folder)], [{ record: RECORD, file: recordFile(t.folder, 1) }, []]);
    t.done();
  });
});

describe("writing an episode's record", () => {
  it("writes the import's first record through the rule's text writer, as record/0001.json, with this Mac as its writer", () => {
    const t = setup();
    const writer = { commit: "4f6da46", on: "Mac Studio" };
    const written = writeEpisode(t.folder, newEpisode(IMPORTED), { expectRev: 0, writeText: t.writeText, writer, home: t.home });
    assert.deepEqual(written, { ...RECORD, writer });
    assert.deepEqual([t.written, t.files()], [[recordFile(t.folder, 1)], ["0001.json"]]);
    assert.equal(readFileSync(recordFile(t.folder, 1), "utf8"), recordText(written));
    t.done();
  });
  it("writes each change as a new file with the next number, and never touches the one before", () => {
    const t = setup();
    t.store(RECORD);
    const before = readFileSync(recordFile(t.folder, 1), "utf8");
    const written = writeEpisode(t.folder, { ...RECORD, name: { text: "Pricing with confidence", placeholder: false } }, { expectRev: 1, writeText: t.writeText, writer: WRITER, home: t.home });
    assert.deepEqual([written.rev, t.files(), readFileSync(recordFile(t.folder, 1), "utf8")], [2, ["0001.json", "0002.json"], before]);
    assert.deepEqual(readEpisode(t.folder).record, written);
    t.done();
  });
  it("keeps any field it does not know as it found it", () => {
    const t = setup();
    t.store({ ...RECORD, studio: { note: "from a later version" } });
    const read = readEpisode(t.folder).record;
    const written = writeEpisode(t.folder, read, { expectRev: read.rev, writeText: t.writeText, writer: WRITER, home: t.home });
    assert.deepEqual(written.studio, { note: "from a later version" });
    t.done();
  });
  it("writes nothing, and says the episode changed on the other Mac, when a record above the one it read is there, whole or not", () => {
    const t = setup();
    t.store(RECORD);
    t.store({ ...RECORD, rev: 2 }, "{");
    assert.throws(() => writeEpisode(t.folder, RECORD, { expectRev: 1, writeText: t.writeText, writer: WRITER, home: t.home }), { message: "this episode changed on the other Mac: open it again", code: "CHANGED" });
    assert.throws(() => writeEpisode(t.folder, newEpisode(IMPORTED), { expectRev: 0, writeText: t.writeText, writer: WRITER, home: t.home }), { code: "CHANGED" });
    assert.deepEqual(t.written, []);
    t.done();
  });
  it("writes nothing while Dropbox keeps a conflicted copy in the folder", () => {
    const t = setup();
    t.store(RECORD);
    writeFileSync(join(t.folder, COPY), recordText(RECORD));
    assert.throws(() => writeEpisode(t.folder, RECORD, { expectRev: 1, writeText: t.writeText, writer: WRITER, home: t.home }), { message: /^Dropbox has kept a conflicted copy in this episode: record\/0002 \(Sallie Ogden's conflicted copy 2026-10-14\)\.json\. /, code: "CONFLICTED" });
    assert.deepEqual(t.written, []);
    t.done();
  });
  it("never writes a record of a newer layout, and says this Mac needs updating", () => {
    const t = setup();
    const newer = { version: 2, id: RECORD.id, rev: 1 };
    t.store(newer);
    assert.throws(() => writeEpisode(t.folder, newer, { expectRev: 1, writeText: t.writeText, writer: WRITER, home: t.home }), { message: "Jason has a newer brimm-video. Ask him to update this Mac.", code: "NEWER" });
    assert.deepEqual(t.written, []);
    t.done();
  });
  it("writes nothing that could not be read back, and nothing without the rev it was read at", () => {
    const t = setup();
    const opts = { writeText: t.writeText, writer: WRITER, home: t.home };
    assert.throws(() => writeEpisode(t.folder, { ...newEpisode(IMPORTED), kind: "reel" }, { ...opts, expectRev: 0 }), { message: "the episode's record was not written, because it is neither an episode nor a short video", code: "FAULT" });
    assert.throws(() => writeEpisode(t.folder, newEpisode(IMPORTED), { ...opts, expectRev: 0, writer: undefined }), { message: "the episode's record was not written, because who last wrote it cannot be read" });
    assert.throws(() => writeEpisode(t.folder, newEpisode(IMPORTED), { ...opts }), { message: "the episode's record was not written, because the rev it was read at was not given" });
    assert.deepEqual(t.written, []);
    t.done();
  });
});

describe("what this Mac last wrote", () => {
  it("is noted for each episode by its id, in written.json on this Mac's own disk", () => {
    const t = setup();
    assert.equal(lastWritten(t.home, RECORD.id), 0);
    writeEpisode(t.folder, newEpisode(IMPORTED), { expectRev: 0, writeText: t.writeText, writer: WRITER, home: t.home });
    writeEpisode(t.folder, RECORD, { expectRev: 1, writeText: t.writeText, writer: WRITER, home: t.home });
    assert.equal(lastWritten(t.home, RECORD.id), 2);
    assert.deepEqual(JSON.parse(readFileSync(writtenFile(t.home), "utf8")), { [RECORD.id]: 2 });
    t.done();
  });
  it("says Dropbox undid this Mac's last change when the newest record is older than the one it wrote", () => {
    const t = setup();
    writeEpisode(t.folder, newEpisode(IMPORTED), { expectRev: 0, writeText: t.writeText, writer: WRITER, home: t.home });
    writeEpisode(t.folder, RECORD, { expectRev: 1, writeText: t.writeText, writer: WRITER, home: t.home });
    assert.equal(undone(readEpisode(t.folder).record, t.home), "");
    rmSync(recordFile(t.folder, 2));
    assert.equal(undone(readEpisode(t.folder).record, t.home), "Dropbox undid this Mac's last change to Pricing talk. Say it again.");
    t.done();
  });
  it("is nothing for an episode this Mac never wrote, and when written.json cannot be read", () => {
    const t = setup();
    mkdirSync(join(t.home, "Library", "Application Support", "BRIMM Video"), { recursive: true });
    writeFileSync(writtenFile(t.home), "{");
    assert.deepEqual([lastWritten(t.home, RECORD.id), undone(RECORD, t.home)], [0, ""]);
    t.done();
  });
});

describe("an episode's files, against the list in its record", () => {
  /** A folder holding each file at the size given. */
  const holding = (t, sizes) => {
    mkdirSync(join(t.folder, "edit"));
    for (const [path, bytes] of Object.entries(sizes)) writeFileSync(join(t.folder, path), "x".repeat(bytes));
  };
  const listed = { ...RECORD, files: { "Pricing talk.mp4": 30, "Pricing talk.cut-plan.txt": 12, "edit/main.v0.fcpxml": 9 } };
  it("have no problems when every file is there at its size", () => {
    const t = setup();
    holding(t, listed.files);
    assert.deepEqual(filesProblems(t.folder, listed), []);
    t.done();
  });
  it("are named when one is missing, short, or not the size listed", () => {
    const t = setup();
    holding(t, { "Pricing talk.mp4": 10, "Pricing talk.cut-plan.txt": 14 });
    assert.deepEqual(filesProblems(t.folder, listed), [
      "Pricing talk.mp4 is short: 10 bytes of 30",
      "Pricing talk.cut-plan.txt is 14 bytes, not the 12 the record lists",
      "edit/main.v0.fcpxml is missing"
    ]);
    t.done();
  });
  it("are named with any other name Dropbox may have kept them under", () => {
    const t = setup();
    holding(t, { "Pricing talk.mp4": 10, "Pricing talk (1).mp4": 30, "Pricing talk.cut-plan.txt.writing": 12, "edit/main.v0 (Jason Ogden's conflicted copy 2026-10-14).fcpxml": 9, "Pricing talk.rough-cut.mp4": 3 });
    assert.deepEqual(filesProblems(t.folder, listed), [
      "Pricing talk.mp4 is short: 10 bytes of 30, and Dropbox may have kept it as Pricing talk (1).mp4",
      "Pricing talk.cut-plan.txt is missing, and Dropbox may have kept it as Pricing talk.cut-plan.txt.writing",
      "edit/main.v0.fcpxml is missing, and Dropbox may have kept it as edit/main.v0 (Jason Ogden's conflicted copy 2026-10-14).fcpxml"
    ]);
    t.done();
  });
  it("leave the record files out of what they compare", () => {
    const t = setup();
    holding(t, listed.files);
    t.store(RECORD);
    assert.deepEqual(filesProblems(t.folder, listed), []);
    t.done();
  });
  it("are measured with the stat it is given", () => {
    const t = setup();
    const sizes = { "Pricing talk.mp4": 30, "Pricing talk.cut-plan.txt": 12 };
    const stat = (path) => {
      const found = Object.keys(sizes).find((name) => join(t.folder, name) === path);
      if (!found) throw Object.assign(new Error("no such file"), { code: "ENOENT" });
      return { size: sizes[found] };
    };
    assert.deepEqual(filesProblems(t.folder, listed, { stat }), ["edit/main.v0.fcpxml is missing"]);
    t.done();
  });
});

describe("the file a conflicted copy is a copy of", () => {
  it("takes out Dropbox's words alone, when the file's own name has brackets too", () => {
    for (const [copy, of] of [
      ["record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json", "record/0002.json"],
      ["Leadership (managing conflict) (Sallie's conflicted copy 2026-10-20).mov", "Leadership (managing conflict).mov"],
      ["final/Leadership (part 2) main v5 3fa9c1 (Sallie's laptop's conflicted copy 2026-10-20).mov", "final/Leadership (part 2) main v5 3fa9c1.mov"],
      ["final/Leadership (part 2).brimm-ops (Sallie's laptop's conflicted copy 2026-10-20).json", "final/Leadership (part 2).brimm-ops.json"],
      ["edit/main.v2.mac-studio (Sallie's MacBook Air (2)'s conflicted copy 2026-10-20).fcpxml", "edit/main.v2.mac-studio.fcpxml"],
      ["Talk (Case Conflict).mov", "Talk.mov"],
      // A second copy Dropbox numbers, after its words or inside them (the P2 check, R1 and R13).
      ["edit/main.v2.mac-studio (Sallie's laptop's conflicted copy 2026-10-20) (1).fcpxml", "edit/main.v2.mac-studio.fcpxml"],
      ["edit/main.v2.mac-studio (Sallie's laptop's conflicted copy 2026-10-20 (1)).fcpxml", "edit/main.v2.mac-studio.fcpxml"],
      ["record/0002 (Sallie's laptop's conflicted copy 2026-10-20) (1).json", "record/0002.json"],
      ["Leadership (managing conflict) (Sallie's conflicted copy 2026-10-20) (2).mov", "Leadership (managing conflict).mov"],
      ["Talk (Case Conflict) (1).mov", "Talk.mov"]
    ]) assert.equal(conflictedOf(copy), of, copy);
  });
  /** How copies were found before the list of Dropbox's forms (PR 21): every name this found is a copy still. Finding copies
      may grow wider when the guide's conflict step learns a form, and never narrower: a copy not found is passed over
      without a word, and the side in it with it (the review of the plan, P10). */
  const FOUND_BEFORE = /\(.*conflicted copy.*\)|\((Case|Unicode Encoding|Selective Sync) Conflict\)/i;
  it("finds every copy it found before, and names the file and the Mac of each by the one list of Dropbox's forms", () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-episode-"));
    // The list holds what joins the Mac's name to the copy's words, with a straight apostrophe and with a curly one, which the
    // guide's conflict step may show is how the File Provider writes them.
    assert.deepEqual([Array.isArray(CONFLICT_FORMS.by), ...["'s", "’s"].map((by) => (CONFLICT_FORMS.by || []).includes(by))], [true, true, true]);
    // Each form in the list as Dropbox writes it, and the Mac it names: finding, naming the file and naming the Mac all take
    // it, both ways.
    const forms = [...CONFLICT_FORMS.by.map((by) => [`Talk (Jason Ogden${by} ${CONFLICT_FORMS.copy} 2026-10-14).srt`, "Jason Ogden"]), ...CONFLICT_FORMS.kinds.map((kind) => [`Talk (${kind}).srt`, ""])];
    // The name, whether it is a copy, and the Mac it names.
    const rows = [
      ...forms.map(([name, mac]) => [name, true, mac]),
      ["Leadership (managing conflict) (Sallie's conflicted copy 2026-10-20).mov", true, "Sallie"],
      ["main.v2.mac-studio (Sallie's MacBook Air (2)'s conflicted copy 2026-10-20).fcpxml", true, "Sallie's MacBook Air (2)"],
      ["main.v2.mac-studio (Sallie's laptop's conflicted copy 2026-10-20) (1).fcpxml", true, "Sallie's laptop"],
      ["Talk (Case Conflict) (1).mov", true, ""],
      // A Mac's name with a bracket left open, or with brackets two deep: found, though neither its file nor its Mac can be
      // named from it.
      ["0002 (Sallie's Mac :)'s conflicted copy 2026-10-20).json", true, ""],
      ["0003 (Sallie's Mac (Work (2))'s conflicted copy 2026-10-20).json", true, ""],
      // A Mac whose own name has a curly apostrophe, and a straight one before the copy's words, or the other way round.
      ["main.v2.mac-studio (Sallie’s laptop's conflicted copy 2026-10-20).fcpxml", true, "Sallie’s laptop"],
      ["main.v2.mac-studio (Sallie's laptop’s conflicted copy 2026-10-20).fcpxml", true, "Sallie's laptop"],
      // The words with no Mac's name, with no date, or in other letters' case: found before, so found still. (A different
      // date keeps the case's name from being the same file as the first form's, since a Mac's disk may not tell the case of
      // letters apart.)
      ["Talk (conflicted copy 2026-10-14).srt", true, ""],
      ["Talk (Jason Ogden's conflicted copy).srt", true, "Jason Ogden"],
      ["Talk (Jason Ogden's Conflicted Copy 2026-10-20).srt", true, "Jason Ogden"],
      ["Leadership (managing conflict).mov", false, ""],
      ["Talk (conflict resolution).srt", false, ""],
      ["Pricing talk (1).mp4", false, ""]
    ];
    for (const [name] of rows) writeFileSync(join(dir, name), "x");
    const found = conflictedCopies(dir);
    assert.deepEqual(found, rows.filter(([, copy]) => copy).map(([name]) => name).sort());
    for (const [name, , mac] of rows) {
      if (FOUND_BEFORE.test(name)) assert.ok(found.includes(name), `found before, and not now: ${name}`);
      // Whatever Dropbox's words conflictedOf takes out, the name is found as a copy: one way, for every name.
      if (conflictedOf(name) !== name) assert.ok(found.includes(name), `named as a copy, and not found: ${name}`);
      assert.equal(conflictedBy(name), mac, name);
    }
    for (const [name] of forms) assert.equal(conflictedOf(name), "Talk.srt", name);
    rmSync(dir, { recursive: true, force: true });
  });
  it("spells Dropbox's words in CONFLICT_FORMS alone, so the guide's conflict step changes them there and nowhere else (the review's #27-1)", () => {
    const text = readFileSync(new URL("../episode.js", import.meta.url), "utf8");
    // Finding the copies, naming the file and naming the Mac are each built as text, from the list.
    for (const name of ["KIND_WORDS", "CONFLICTED", "OWN_WORDS", "BY_WORDS"]) assert.match(text, new RegExp(`^const ${name} = .*String\\.raw\``, "m"), name);
    // With what each takes from elsewhere (each ${…}) and a regular expression's own escapes (\d and the like) taken out, no
    // pattern holds a letter or an apostrophe of its own: Dropbox's words, "'s" and "Conflict" among them, come from the list.
    const patterns = [...text.matchAll(/String\.raw`([^`]*)`/g)].map((m) => m[1]);
    assert.ok(patterns.length >= 4, `${patterns.length} patterns`);
    assert.deepEqual(patterns.filter((p) => /[\p{L}'’]/u.test(p.replace(/\$\{[^}]*\}/g, "").replace(/\\[A-Za-z]/g, ""))), []);
  });
  it("keeps an episode stopped by a record's copy whose Mac's name has a bracket left open or two deep", () => {
    for (const copy of ["record/0002 (Sallie's Mac :)'s conflicted copy 2026-10-20).json", "record/0002 (Sallie's Mac (Work (2))'s conflicted copy 2026-10-20).json"]) {
      const t = setup();
      t.store(RECORD);
      writeFileSync(join(t.folder, copy), recordText({ ...RECORD, rev: 2 }));
      assert.equal(readEpisode(t.folder).code, "CONFLICTED", copy);
      assert.deepEqual(conflictedCopies(t.folder), [copy]);
      t.done();
    }
  });
});

describe("who is editing an episode", () => {
  it("is another Mac only when the claim is held by one", () => {
    const held = claimed(RECORD, "Sallie's laptop", "2026-10-14T13:40:00-05:00");
    assert.deepEqual(held.editing, { by: "Sallie's laptop", since: "2026-10-14T13:40:00-05:00" });
    assert.deepEqual(heldElsewhere(held, "Mac Studio"), { by: "Sallie's laptop", since: "2026-10-14T13:40:00-05:00" });
    assert.equal(heldElsewhere(held, "Sallie's laptop"), null);
    assert.equal(heldElsewhere(RECORD, "Mac Studio"), null);
    assert.equal(RECORD.editing, null);
  });
  it("is nobody once the claim is let go, and the record keeps the files the episode held then, with their sizes", () => {
    const held = claimed(RECORD, "Sallie's laptop", "2026-10-14T13:40:00-05:00");
    const files = { ...RECORD.files, "edit/main.v1.sallies-laptop.fcpxml": 9400 };
    const answers = { main: { v: 1, said: "no changes" } };
    const letGo = released(held, files, { at: "2026-10-14T16:05:00-05:00", by: "Sallie's laptop", answers });
    assert.deepEqual([letGo.editing, letGo.released], [null, { at: "2026-10-14T16:05:00-05:00", by: "Sallie's laptop", files, answers }]);
    assert.equal(episodeFault(letGo), "");
    assert.match(released(held, files, { by: "Sallie's laptop" }).released.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    assert.deepEqual(released(held, files, { by: "Sallie's laptop" }).released.answers, {});
  });
});

describe("what the final review found in the record", () => {
  it("takes Dropbox's own names for a conflicted copy, and not a name that has the word conflict in it", () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-episode-"));
    for (const name of ["Leadership (managing conflict).mov", "Talk (conflict resolution).srt"]) writeFileSync(join(dir, name), "x");
    assert.deepEqual(conflictedCopies(dir), []);
    for (const name of ["Talk (Case Conflict).srt", "Talk (Unicode Encoding Conflict).srt", "Talk (Selective Sync Conflict).srt", "Talk (Jason Ogden's conflicted copy 2026-10-14).srt"]) writeFileSync(join(dir, name), "x");
    assert.equal(conflictedCopies(dir).length, 4);
    rmSync(dir, { recursive: true, force: true });
  });
});
