// The planned episode's record (PR H4; design 2026-11-03, section 5): an episode made in Sallie's chat from words she gave, before
// any footage exists, so it has no video and no kind. It is written at layout 5, which a Mac on older code reads as newer and leaves
// alone, and it is the one record with no kind that is not gated: gate.js's "Not gated" rule lets a record through only when it is
// whole in every way, and a record that only claims to be planned is gated exactly as a video not yet answered is.
// Nothing here runs a program or touches Dropbox: each test has a folder of its own, and the rule's text writer is a stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  NEWEST_VERSION, PART_KINDS, PLANNED_VERSION, RECORD_VERSION, SHOT_LIST_KINDS, episodeFault, faultFor, isPart, isPlannedRecord, kindOf, layoutOf, newEpisode, newPlannedEpisode,
  readEpisode, recordFile, recordText, shownName, writeEpisode
} from "../episode.js";

const AT = "2026-11-04T09:12:00-05:00";
const WRITER = { commit: "c709b57", on: "Mac Studio" };
const ID = "e-20261104-3fa9c1";
const TITLE = "Too many SKUs";

/** The record `plan new` writes for a script, at rev 1 as it is once written. */
const made = (over = {}) => ({ ...newPlannedEpisode({ id: ID, machine: "Mac Studio", at: AT, title: TITLE, route: "script", voice: null, writer: WRITER }), rev: 1, ...over });
/** The same with a package in it, as `plan … set` leaves one. */
const CUE = { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of product boxes that keeps growing until it topples.", seconds: 4, style: null };
const SHOT = { n: 1, kind: "talking", what: "Open on the problem, to the camera." };
const packaged = (over = {}) => made({ planned: { ...made().planned, set: AT, cues: [CUE], shots: [SHOT], lines: ["Too many SKUs will sink a small shop."], ...over } });

/** A folder for one test, and a stand-in for the rule's text writer that never writes over a file. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "brimm-planned-"));
  const folder = join(dir, "2026-11-04 Too many SKUs (Mac Studio)");
  mkdirSync(folder);
  const writeText = (to, text) => {
    if (existsSync(to)) throw new Error(`${to} is there already`);
    writeFileSync(to, text);
  };
  return { dir, folder, home: join(dir, "home"), writeText, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("a planned episode's record", () => {
  it("is layout 5, from the title and the route she gave, with no video and no kind", () => {
    assert.deepEqual(newPlannedEpisode({ id: ID, machine: "Mac Studio", at: AT, title: TITLE, route: "script", voice: null, writer: WRITER }), {
      version: 5,
      id: ID,
      rev: 0,
      writer: WRITER,
      kind: null,
      video: null,
      imported: { on: "Mac Studio", at: AT },
      name: { text: TITLE, placeholder: false },
      title: null,
      editing: null,
      released: null,
      archived: null,
      files: {},
      spellings: [],
      main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [], base: null },
      reels: [],
      libraries: {},
      finished: null,
      answer: { state: "planned", by: "plan new", on: "Mac Studio", at: AT, private: "no" },
      planned: { route: "script", title: TITLE, voice: null, at: AT, on: "Mac Studio", set: null, cues: [], shots: [], lines: [], filmed: null }
    });
  });
  it("keeps the explainer's voice, and none for a script", () => {
    for (const voice of ["sallie", "heygen", null]) {
      const record = { ...newPlannedEpisode({ id: ID, machine: "Mac Studio", at: AT, title: TITLE, route: "explainer", voice, writer: WRITER }), rev: 1 };
      assert.equal(record.planned.route, "explainer");
      assert.equal(record.planned.voice, voice);
      assert.equal(episodeFault(record), "", String(voice));
    }
  });
  it("is at layout 5 and every other record stays where it was: the layouts 1 to 4, which a Mac on older code reads", () => {
    assert.deepEqual([RECORD_VERSION, PLANNED_VERSION, NEWEST_VERSION], [4, 5, 5]);
    assert.equal(layoutOf(made()), 5);
    assert.equal(made().version, 5);
    const video = newEpisode({ id: ID, machine: "Mac Studio", at: AT, video: { file: "a.mp4", bytes: 1, seconds: 20, created: null }, kind: "episode", writer: WRITER });
    assert.equal(layoutOf(video), 1);
    for (const over of [{ spellings: [["Sally", "Sallie"]] }, { kind: "raw", answer: { state: "answered", guess: null, seen: "", came: "camera" } }, { app: { toolchain: "0.8.208", projects: [] } }]) {
      assert.ok(layoutOf({ ...video, ...over }) <= RECORD_VERSION, JSON.stringify(over));
    }
  });
  it("is a whole record, with its package or without, and kindOf says it has no kind", () => {
    for (const record of [made(), packaged(), made({ files: { "video guide.md": 120, "shot list.md": 90, "teleprompter.txt": 40 } })]) assert.equal(episodeFault(record), "");
    assert.equal(kindOf(made()), null);
    assert.equal(isPlannedRecord(made()), true);
  });
  it("is read by readEpisode from its folder, and written at layout 5 through writeEpisode", () => {
    const t = setup();
    try {
      const first = newPlannedEpisode({ id: ID, machine: "Mac Studio", at: AT, title: TITLE, route: "script", voice: null, writer: WRITER });
      const wrote = writeEpisode(t.folder, first, { expectRev: 0, writeText: t.writeText, writer: WRITER, home: t.home });
      assert.deepEqual([wrote.version, wrote.rev], [5, 1]);
      assert.equal(JSON.parse(readFileSync(recordFile(t.folder, 1), "utf8")).version, 5);
      assert.deepEqual(readEpisode(t.folder), { record: wrote, file: recordFile(t.folder, 1) });
      // The next change keeps it at 5 and keeps the plan.
      const next = writeEpisode(t.folder, { ...wrote, planned: { ...wrote.planned, lines: ["One."] } }, { expectRev: 1, writeText: t.writeText, writer: WRITER, home: t.home });
      assert.deepEqual([next.version, next.rev, readEpisode(t.folder).record.planned.lines], [5, 2, ["One."]]);
    } finally {
      t.done();
    }
  });
  it("is written at layout 5 even when it comes with a version below, since the plan it holds is layout 5's", () => {
    const t = setup();
    try {
      const wrote = writeEpisode(t.folder, { ...made(), rev: 0, version: 1 }, { expectRev: 0, writeText: t.writeText, writer: WRITER, home: t.home });
      assert.equal(wrote.version, 5);
    } finally {
      t.done();
    }
  });
});

describe("layout 5 on a Mac on older code", () => {
  it("reads the planned record as newer, for its id and rev alone, and does not give an older record in its place", () => {
    const t = setup();
    try {
      writeFileSync(recordFile((mkdirSync(join(t.folder, "record")), t.folder), 1), recordText({ ...made(), rev: 1 }));
      const older = readEpisode(t.folder, { known: RECORD_VERSION });
      assert.deepEqual(older, { record: made(), file: recordFile(t.folder, 1), newer: true });
      assert.equal(faultFor(RECORD_VERSION)(made()), "it is version 5, and this brimm-video reads versions 1 to 4");
      // This brimm-video reads it whole.
      assert.deepEqual(readEpisode(t.folder), { record: made(), file: recordFile(t.folder, 1) });
    } finally {
      t.done();
    }
  });
  it("is the record in force when it sits above an older one, as any newer record is", () => {
    const t = setup();
    try {
      mkdirSync(join(t.folder, "record"));
      const video = { ...newEpisode({ id: ID, machine: "Mac Studio", at: AT, video: { file: "a.mp4", bytes: 1, seconds: 20, created: null }, kind: "episode", writer: WRITER }), rev: 1 };
      writeFileSync(recordFile(t.folder, 1), recordText(video));
      writeFileSync(recordFile(t.folder, 2), recordText({ ...made(), rev: 2 }));
      const older = readEpisode(t.folder, { known: RECORD_VERSION });
      assert.equal(older.newer, true);
      assert.equal(older.record.rev, 2);
    } finally {
      t.done();
    }
  });
  it("is refused, for want of a layout, by a Mac that stands in for layout 4 alone: a record of layout 6 is newer here too", () => {
    assert.equal(faultFor(NEWEST_VERSION)({ ...made(), version: 6 }), "it is version 6, and this brimm-video reads versions 1 to 5");
    assert.equal(faultFor(NEWEST_VERSION)(made()), "");
  });
});

describe("what makes a record with no video and no kind whole", () => {
  it("is the answer \"planned\" and a whole `planned` together: nothing else lets a video be null", () => {
    // A video of the made-up kind, with its video taken away: its video cannot be read.
    const video = { ...newEpisode({ id: ID, machine: "Mac Studio", at: AT, video: { file: "a.mp4", bytes: 1, seconds: 20, created: null }, kind: "episode", writer: WRITER }), rev: 1 };
    assert.equal(episodeFault({ ...video, video: null }), "its video cannot be read");
    // No `planned`, or one that cannot be read, with the answer "planned".
    const { planned, ...without } = made();
    assert.equal(episodeFault(without), "its kind cannot be read");
    for (const bad of [null, "x", [], {}, { ...planned, route: "podcast" }, { ...planned, title: "" }, { ...planned, voice: "sallie" }, { ...planned, voice: "robot" }, { ...planned, at: "yesterday" }, { ...planned, on: "" },
      { ...planned, set: "soon" }, { ...planned, cues: {} }, { ...planned, cues: [1] }, { ...planned, shots: [{ n: 0, kind: "talking", what: "x" }] }, { ...planned, shots: [{ n: 1, kind: "drone", what: "x" }] },
      { ...planned, shots: [{ n: 1, kind: "talking", what: "" }] }, { ...planned, lines: "x" }, { ...planned, lines: [1] }, { ...planned, filmed: undefined }]) {
      assert.match(episodeFault({ ...made(), planned: bad }), /cannot be read/, JSON.stringify(bad));
    }
    // A voice is the explainer's alone.
    assert.match(episodeFault({ ...made(), planned: { ...planned, voice: "heygen" } }), /cannot be read/);
  });
  it("needs the answer \"planned\" for it, and takes an answer with no guess, seen or came", () => {
    assert.equal(episodeFault(made()), "");
    for (const state of ["needs your answer", "answered", "not for brimm-video"]) assert.match(episodeFault({ ...made(), answer: { ...made().answer, state } }), /cannot be read/, state);
    for (const bad of [null, "planned", { ...made().answer, by: "" }, { ...made().answer, on: undefined }, { ...made().answer, at: "never" }, { ...made().answer, private: "yes" }, { ...made().answer, private: undefined },
      { ...made().answer, guess: null }, { ...made().answer, seen: "" }, { ...made().answer, came: "camera" }, { ...made().answer, match: null }]) {
      assert.equal(episodeFault({ ...made(), answer: bad }), "its kind cannot be read", JSON.stringify(bad));
    }
  });
  it("is a record with no kind and no video, and refuses a video or a kind beside the plan", () => {
    const video = { file: "a.mp4", bytes: 1, seconds: 20, recorded: "2026-11-04", recordedFrom: "import" };
    assert.equal(episodeFault({ ...made(), kind: "raw" }), "its video cannot be read");
    assert.equal(episodeFault({ ...made(), video }), "its kind cannot be read");
    // A video and a kind beside the answer "planned": the answer is not one a video has.
    assert.equal(episodeFault({ ...made(), kind: "raw", video }), "its answer cannot be read");
  });
  it("is layout 5: a plan with a lower version is refused", () => {
    for (const version of [1, 2, 3, 4]) assert.match(episodeFault({ ...made(), version }), /cannot be read/, String(version));
  });
  it("knows the three kinds of shot, in the order the design lists them", () => {
    assert.deepEqual([...SHOT_LIST_KINDS], ["talking", "screen", "b-roll"]);
  });
});

describe("the planned record is named by its title, and no other record with no kind is", () => {
  it("is shown by its name, which is its title", () => {
    assert.equal(shownName(made()), TITLE);
    assert.equal(shownName({ ...made(), name: { text: "Another name", placeholder: false } }), "Another name");
    // A name it has not got is its title.
    assert.equal(shownName({ ...made(), name: undefined }), TITLE);
  });
});

// --- A part: a dropped video that is footage for a planned video (PR H5a; design 2026-11-04, H5) ---

const PART_ID = "e-20261104-aa11bb";
const LABEL = "Video of 4 Nov, 09:12 (Mac Studio)";
/** A video waiting for her answer, as the light import files one: no kind, her card to answer, and its label. */
const WAITING = { state: "needs your answer", guess: null, seen: "upright, 0:08, no sound", came: "phone", match: null };
const waiting = (over = {}) => ({
  ...newEpisode({ id: PART_ID, machine: "Mac Studio", at: AT, video: { file: "Sorting invoices.mov", bytes: 5, seconds: 8, created: null, sound: false }, kind: null, writer: WRITER, answer: WAITING, label: LABEL }),
  rev: 1,
  ...over
});
/** The same, answered as footage for the plan `ID`: `footage` writes the answer and `partOf` in one write, at layout 5. */
const PART_ANSWER = { ...WAITING, state: "part", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
const PART_OF = { id: ID, as: "b-roll", shot: 2, client: false };
const part = (partOf = PART_OF, over = {}) => waiting({ version: 5, answer: PART_ANSWER, partOf, ...over });

describe("a part's record (PR H5a)", () => {
  it("has the four kinds of part: the shots' own, in the order the design lists them, and the voiceover of an explainer (PR H6)", () => {
    assert.deepEqual([...PART_KINDS], ["talking", "screen", "b-roll", "voiceover"]);
  });
  it("is the dropped video's own record: no kind, the answer \"part\" and `partOf`, at layout 5, and a whole record", () => {
    const record = part();
    assert.equal(record.kind, null);
    assert.equal(layoutOf(record), 5);
    assert.equal(layoutOf({ ...record, partOf: undefined }), 3, "a record with an answer and no partOf is layout 3 as it was");
    assert.equal(episodeFault(record), "");
    assert.equal(isPart(record), true);
    assert.equal(kindOf(record), null);
    assert.deepEqual(record.partOf, { id: ID, as: "b-roll", shot: 2, client: false });
    // Its answer is the one `kind` writes: who answered, on which Mac, when, and that it is no private session.
    assert.deepEqual([record.answer.state, record.answer.by, record.answer.on, record.answer.at, record.answer.private], ["part", "Mac Studio", "Mac Studio", AT, "no"]);
  });
  it("is each kind of part: talking to the camera (no shot, no client), a screen recording and b-roll (a shot, with or without a client)", () => {
    for (const partOf of [
      { id: ID, as: "talking", shot: null, client: false },
      { id: ID, as: "screen", shot: 4, client: false }, { id: ID, as: "screen", shot: 4, client: true },
      { id: ID, as: "b-roll", shot: 2, client: false }, { id: ID, as: "b-roll", shot: 12, client: true }]) {
      assert.equal(episodeFault(part(partOf)), "", JSON.stringify(partOf));
      assert.equal(isPart(part(partOf)), true, JSON.stringify(partOf));
    }
  });
  it("refuses `partOf` without the answer \"part\", and the answer \"part\" without `partOf`", () => {
    for (const state of ["needs your answer", "not for brimm-video"]) {
      assert.equal(episodeFault(part(PART_OF, { answer: { ...PART_ANSWER, state } })), "which plan it is footage for cannot be read", state);
    }
    // A video answered as a kind has no `partOf` either (an answered video with no kind is none: its kind cannot be read).
    assert.equal(episodeFault(part(PART_OF, { kind: "raw", answer: { ...PART_ANSWER, state: "answered" } })), "which plan it is footage for cannot be read", "answered");
    assert.equal(episodeFault(part(PART_OF, { answer: { ...PART_ANSWER, state: "answered" } })), "its kind cannot be read", "answered, with no kind");
    assert.equal(episodeFault(part(undefined, { partOf: undefined })), "its answer cannot be read");
    assert.equal(episodeFault(part(null)), "its answer cannot be read", "a null partOf is none");
    assert.equal(episodeFault(waiting({ version: 5, partOf: PART_OF })), "which plan it is footage for cannot be read", "a video waiting for its answer");
  });
  it("refuses a screen part or a b-roll part with no shot, and a talking part with one, or with a client", () => {
    for (const as of ["screen", "b-roll"]) for (const shot of [null, undefined, 0, -1, 1.5, "2", NaN]) assert.equal(episodeFault(part({ id: ID, as, shot, client: false })), "which plan it is footage for cannot be read", `${as} ${String(shot)}`);
    for (const shot of [1, 2, 0, "1", false]) assert.equal(episodeFault(part({ id: ID, as: "talking", shot, client: false })), "which plan it is footage for cannot be read", `talking ${String(shot)}`);
    assert.equal(episodeFault(part({ id: ID, as: "talking", shot: null, client: true })), "which plan it is footage for cannot be read", "a talking part shows no client");
  });
  it("refuses a `partOf` that is not whole: its plan's id, its kind, its client and anything beside them", () => {
    for (const bad of [
      "b-roll", [], {}, { ...PART_OF, id: "" }, { ...PART_OF, id: "e-1" }, { ...PART_OF, id: undefined }, { ...PART_OF, as: "voiceover" }, { ...PART_OF, as: "drone" }, { ...PART_OF, as: "B-roll" }, { ...PART_OF, as: undefined },
      { ...PART_OF, client: "no" }, { ...PART_OF, client: undefined }, { ...PART_OF, client: null }, { ...PART_OF, client: 0 }, { ...PART_OF, who: "Jane Doe" }, { ...PART_OF, file: "Sorting invoices.mov" }]) {
      assert.match(episodeFault(part(bad)), /cannot be read/, JSON.stringify(bad));
    }
  });
  it("is layout 5: a part with a lower version, a kind or no video is refused", () => {
    for (const version of [1, 2, 3, 4]) assert.equal(episodeFault(part(PART_OF, { version })), "which plan it is footage for cannot be read", String(version));
    assert.equal(episodeFault(part(PART_OF, { kind: "raw" })), "which plan it is footage for cannot be read");
    assert.equal(episodeFault(part(PART_OF, { kind: "session" })), "which plan it is footage for cannot be read");
    assert.equal(episodeFault(part(PART_OF, { video: null })), "its video cannot be read");
  });
  it("takes an answer \"part\" only with who answered it, where, when, and no private session", () => {
    for (const bad of [{ by: undefined }, { by: "" }, { on: undefined }, { at: "never" }, { at: undefined }, { private: "yes" }, { private: undefined }]) {
      assert.equal(episodeFault(part(PART_OF, { answer: { ...PART_ANSWER, ...bad } })), "its answer cannot be read", JSON.stringify(bad));
    }
    // The import's own facts stay: what it saw, how it came, and the guess and match it made.
    assert.equal(episodeFault(part(PART_OF, { answer: { ...PART_ANSWER, guess: "clip", seen: "", came: null, match: null } })), "");
  });
  it("is written at layout 5 by writeEpisode, whatever version it comes with, and stays at 5 once taken back", () => {
    const t = setup();
    try {
      const wrote = writeEpisode(t.folder, { ...part(), rev: 0, version: 3 }, { expectRev: 0, writeText: t.writeText, writer: WRITER, home: t.home });
      assert.deepEqual([wrote.version, wrote.rev], [5, 1]);
      assert.deepEqual(readEpisode(t.folder).record.partOf, PART_OF);
      // Taken back: it waits for its answer again, and a record once written at 5 stays there.
      const { partOf, ...rest } = wrote;
      const back = writeEpisode(t.folder, { ...rest, answer: WAITING }, { expectRev: 1, writeText: t.writeText, writer: WRITER, home: t.home });
      assert.deepEqual([back.version, back.rev, back.partOf, back.answer.state, isPart(back)], [5, 2, undefined, "needs your answer", false]);
    } finally {
      t.done();
    }
  });
});

describe("isPart", () => {
  it("is a record that is a part, whole in its answer and its partOf, and nothing else", () => {
    assert.equal(isPart(part()), true);
    for (const not of [made(), packaged(), waiting(), waiting({ version: 3, answer: { ...WAITING, state: "answered" }, kind: "raw" }), part(PART_OF, { kind: "raw" }), part(PART_OF, { answer: { ...PART_ANSWER, state: "answered" } }),
      part({ ...PART_OF, shot: null }), part({ ...PART_OF, as: "talking" }), part(undefined, { partOf: undefined }), null, undefined, "part", 3, [], {}, { kind: null, answer: { state: "part" } }]) {
      assert.equal(isPart(not), false, JSON.stringify(not));
    }
  });
  it("does not make a plan, a video not yet answered or a video left alone a part", () => {
    assert.equal(isPlannedRecord(part()), false);
    assert.equal(isPart(made()), false);
    assert.equal(isPart({ ...waiting(), answer: { ...WAITING, state: "not for brimm-video" } }), false);
  });
});

describe("a video with no sound (PR H5a)", () => {
  it("holds `video.sound` false when the import gave it, and no `sound` when it did not", () => {
    assert.equal(waiting().video.sound, false);
    const loud = newEpisode({ id: PART_ID, machine: "Mac Studio", at: AT, video: { file: "a.mp4", bytes: 1, seconds: 8, created: null }, kind: null, writer: WRITER, answer: WAITING, label: LABEL });
    assert.equal(Object.hasOwn(loud.video, "sound"), false);
    const talks = newEpisode({ id: PART_ID, machine: "Mac Studio", at: AT, video: { file: "a.mp4", bytes: 1, seconds: 8, created: null, sound: true }, kind: null, writer: WRITER, answer: WAITING, label: LABEL });
    assert.equal(Object.hasOwn(talks.video, "sound"), false, "only a video with no sound says so");
  });
  it("is a whole record when `sound` is false or not there, and not when it is anything else", () => {
    assert.equal(episodeFault({ ...waiting(), version: 3 }), "");
    const { sound, ...bare } = waiting().video;
    assert.equal(episodeFault({ ...waiting(), version: 3, video: bare }), "");
    for (const bad of [true, "no", 0, null, "false"]) assert.equal(episodeFault({ ...waiting(), version: 3, video: { ...waiting().video, sound: bad } }), "its video cannot be read", String(bad));
  });
});

describe("a plan's `consent` (PR H5a)", () => {
  const CONSENT = [{ id: PART_ID, label: LABEL, at: "2026-11-04" }];
  it("is read whole in `planned`: the part by its id, its label and the day, and nothing else", () => {
    assert.equal(episodeFault(packaged({ consent: CONSENT })), "");
    assert.equal(episodeFault(packaged({ consent: [] })), "");
    assert.equal(episodeFault(packaged({ consent: [...CONSENT, { id: "e-20261104-cc22dd", label: "Video of 4 Nov, 09:20 (Mac Studio)", at: "2026-11-05" }] })), "");
    // A plan with none at all is a whole plan, as every plan before this one is.
    assert.equal(episodeFault(packaged()), "");
    assert.equal(Object.hasOwn(made().planned, "consent"), false);
  });
  it("refuses a `consent` that is not a list of { id, label, at }, so that nothing she typed can be kept in the record", () => {
    for (const bad of [null, "yes", {}, [null], ["x"], [[]], [{ id: PART_ID }], [{ ...CONSENT[0], id: "x" }], [{ ...CONSENT[0], id: "" }], [{ ...CONSENT[0], label: "" }], [{ ...CONSENT[0], label: 3 }],
      [{ ...CONSENT[0], at: "yesterday" }], [{ ...CONSENT[0], at: "2026-02-30" }], [{ ...CONSENT[0], at: undefined }], [{ ...CONSENT[0], who: "Zebedee Quayle" }], [{ ...CONSENT[0], text: "Zebedee Quayle" }],
      [{ ...CONSENT[0], at: "2026-11-04T09:12:00-05:00" }]]) {
      assert.match(episodeFault(packaged({ consent: bad })), /cannot be read/, JSON.stringify(bad));
    }
  });
  it("is kept by writeEpisode as it was, and a plan with it is still a whole planned record", () => {
    const t = setup();
    try {
      const wrote = writeEpisode(t.folder, { ...packaged({ consent: CONSENT }), rev: 0 }, { expectRev: 0, writeText: t.writeText, writer: WRITER, home: t.home });
      assert.deepEqual(readEpisode(t.folder).record.planned.consent, CONSENT);
      assert.equal(isPlannedRecord(wrote), true);
    } finally {
      t.done();
    }
  });
});
