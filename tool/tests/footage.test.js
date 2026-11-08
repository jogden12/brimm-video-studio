// Footage for a planned video (PR H5a; design 2026-11-04, H5): the plans a dropped video may be for, the parts a plan has, and whether a part
// may go into a project. This is safety code. A part is a dropped video that was answered as footage for a plan; it shows a client, or it
// does not; and a part that shows a client goes into no project until the plan holds a client's agreement for it (`planned.consent`). The
// words of the command (footage.js footageAsked) and of what is said of the footage are fixed here too.
// Nothing here runs a program or touches Dropbox: each test has a folder of its own under the temp folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEWEST_VERSION, PART_KINDS, newEpisode, newPlannedEpisode, recordFile, recordText } from "../episode.js";
import { footageOption } from "../receipts.js";
import { footageAsked, footageCounts, mayBeUsed, mayGoIn, partHeld, partLine, partsOf, partsReader, plannedOffers } from "../footage.js";
import { setup } from "./episodes.js";

const WRITER = { commit: "c709b57", on: "Mac Studio" };
const PLAN_ID = "e-20261104-3fa9c1";
const OTHER_ID = "e-20261104-4aa9c2";
const AT = "2026-11-04T09:12:00-05:00";
const SHOTS = [
  { n: 1, kind: "talking", what: "Open on the problem, to the camera." },
  { n: 2, kind: "b-roll", what: "Sallie at her desk sorting invoices." },
  { n: 3, kind: "talking", what: "Why it matters, to the camera." },
  { n: 4, kind: "screen", what: "Her dashboard, scrolling the SKU list." },
  { n: 5, kind: "b-roll", what: "A coaching session." }
];

/** A plan, whole, at rev 1, with its package set unless `over` says otherwise. */
const plan = ({ id = PLAN_ID, title = "Too many SKUs", at = AT, route = "script", planned = {}, ...over } = {}) => {
  const made = newPlannedEpisode({ id, machine: "Mac Studio", at, title, route, voice: null, writer: WRITER });
  return { ...made, rev: 1, planned: { ...made.planned, set: at, shots: route === "script" ? SHOTS : [], lines: ["Too many SKUs will sink a small shop."], ...planned }, ...over };
};
/** A video waiting for her answer, as the light import files it. */
const waitingVideo = ({ id = "e-20261104-aa11bb", label = "Video of 4 Nov, 09:12 (Mac Studio)", sound = true } = {}) => ({
  ...newEpisode({ id, machine: "Mac Studio", at: AT, video: { file: "Sorting invoices.mov", bytes: 5, seconds: 8, created: null, ...(sound ? {} : { sound: false }) }, kind: null, writer: WRITER,
    answer: { state: "needs your answer", guess: null, seen: sound ? "upright, 0:08" : "upright, 0:08, no sound", came: "phone", match: null }, label }),
  rev: 1
});
/** The same, answered as footage for the plan `of`. */
const part = ({ id = "e-20261104-aa11bb", label = "Video of 4 Nov, 09:12 (Mac Studio)", of = PLAN_ID, as = "b-roll", shot = 2, client = false, at = "2026-11-04T09:30:00-05:00", sound = false, ...over } = {}) => ({
  ...waitingVideo({ id, label, sound }),
  version: 5,
  answer: { state: "part", guess: null, seen: sound ? "upright, 0:08" : "upright, 0:08, no sound", came: "phone", match: null, by: "Mac Studio", on: "Mac Studio", at, private: "no" },
  partOf: { id: of, as, shot: as === "talking" ? null : shot, client },
  ...over
});
/** Put `record` in Episodes as the folder `name`, at its rev. */
function put(t, name, record) {
  const folder = join(t.root, "Episodes", name);
  mkdirSync(join(folder, "record"), { recursive: true });
  writeFileSync(recordFile(folder, record.rev), recordText(record));
  return folder;
}

describe("plannedOffers, the plans a dropped video may be for", () => {
  const PICTURE = { picture: true, sound: true };
  it("offers a script whose package is set and not filmed or dropped, for a video with a picture, as Footage for its title", () => {
    const offers = plannedOffers([plan()], PICTURE);
    assert.deepEqual(offers.map((o) => o.option), ['Footage for "Too many SKUs"']);
    assert.equal(offers[0].option, footageOption("Too many SKUs"));
    assert.equal(offers[0].record.id, PLAN_ID);
    assert.deepEqual(Object.keys(offers[0]).sort(), ["option", "record"]);
  });
  it("offers a plan for a video with a picture whether it has sound or none: b-roll and a screen recording are mute", () => {
    for (const sound of [true, false]) assert.equal(plannedOffers([plan()], { picture: true, sound }).length, 1, String(sound));
  });
  it("offers none for a video with no picture, whatever its sound, in this PR", () => {
    for (const sound of [true, false]) assert.deepEqual(plannedOffers([plan()], { picture: false, sound }), []);
    assert.deepEqual(plannedOffers([plan()], {}), []);
    assert.deepEqual(plannedOffers([plan()]), []);
  });
  it("offers none that is not set, filmed, dropped, an explainer, or not a plan at all", () => {
    const FILMED = [AT, { at: AT, parts: [] }];
    const records = [
      plan({ id: "e-20261104-000001", title: "Not set", planned: { set: null } }),
      ...FILMED.map((filmed, i) => plan({ id: `e-20261104-00001${i}`, title: `Filmed ${i}`, planned: { filmed } })),
      plan({ id: "e-20261104-000002", title: "Dropped", archived: { at: AT } }),
      plan({ id: "e-20261104-000003", title: "An explainer", route: "explainer" }),
      waitingVideo(), part(), { kind: "raw" }, {}, null, undefined, "plan", 3, []
    ];
    assert.deepEqual(plannedOffers(records, PICTURE), []);
    assert.deepEqual(plannedOffers([...records, plan()], PICTURE).map((o) => o.record.id), [PLAN_ID]);
  });
  it("offers none that only claims to be a plan: a plan failing the rule of a whole planned record", () => {
    assert.deepEqual(plannedOffers([{ ...plan(), version: 4 }, { ...plan(), video: { file: "a.mp4" } }, { ...plan(), kind: "raw" }, { ...plan(), session: { marked: AT } }, { ...plan(), planned: { ...plan().planned, route: "podcast" } }], PICTURE), []);
  });
  it("offers the plans newest first by the moment they were planned, and at most three", () => {
    const four = ["2026-11-01T09:00:00-05:00", "2026-11-04T09:00:00-05:00", "2026-11-02T09:00:00-05:00", "2026-11-03T09:00:00-05:00"].map((at, i) => plan({ id: `e-2026110${i + 1}-00000${i}`, title: `Plan ${i + 1}`, at }));
    assert.deepEqual(plannedOffers(four, PICTURE).map((o) => o.option), [footageOption("Plan 2"), footageOption("Plan 4"), footageOption("Plan 3")]);
    assert.deepEqual(plannedOffers(four.slice(0, 2), PICTURE).map((o) => o.option), [footageOption("Plan 2"), footageOption("Plan 1")]);
    // Two moments in two zones: ordered by the moment, not by the text, which says the other order.
    const zones = [plan({ id: "e-20261104-000001", title: "Text later", at: "2026-11-05T01:00:00-05:00" }), plan({ id: "e-20261104-000002", title: "Moment later", at: "2026-11-04T23:00:00-08:00" })];
    assert.deepEqual(plannedOffers(zones, PICTURE).map((o) => o.option), [footageOption("Moment later"), footageOption("Text later")]);
  });
  it("names a plan by the name she gave it, as every line does, and by its title when it was given none", () => {
    const renamed = plan({ name: { text: "Why SKUs sink you", placeholder: false } });
    assert.deepEqual(plannedOffers([renamed], PICTURE).map((o) => o.option), [footageOption("Why SKUs sink you")]);
    assert.deepEqual(plannedOffers([{ ...plan(), name: undefined }], PICTURE).map((o) => o.option), [footageOption("Too many SKUs")]);
  });
  it("holds a title with every mark in it whole", () => {
    const odd = 'Say "hi" | $10 and 100% `now` \\ it\'s';
    assert.deepEqual(plannedOffers([plan({ title: odd, name: { text: odd, placeholder: false } })], PICTURE).map((o) => o.option), [`Footage for "${odd}"`]);
  });
  it("offers none when it is given something that is not a list", () => {
    for (const bad of [null, undefined, "x", 3, {}]) assert.deepEqual(plannedOffers(bad, PICTURE), []);
  });
  it("offers a plan kept on one Mac (Phase 3, L2: layout 6 with `local`) as it offers one at layout 5, and none whose `local` it cannot read", () => {
    const local = plan({ version: 6, local: { on: "Mac Studio" } });
    assert.deepEqual(plannedOffers([local], PICTURE).map((o) => [o.option, o.record.id]), [['Footage for "Too many SKUs"', PLAN_ID]]);
    const explainer = plan({ id: OTHER_ID, title: "Why SKUs", route: "explainer", version: 6, local: { on: "Mac Studio" } });
    assert.deepEqual(plannedOffers([explainer], { picture: false, sound: true }).map((o) => o.record.id), [OTHER_ID], "an explainer kept on one Mac is offered its voiceover");
    for (const bad of [plan({ version: 6, local: {} }), plan({ local: { on: "Mac Studio" } }), plan({ version: 6 })]) assert.deepEqual(plannedOffers([bad], PICTURE), [], JSON.stringify([bad.version, bad.local]));
  });
});

describe("plannedOffers, a plan made from its footage (PR H5b)", () => {
  const PICTURE = { picture: true, sound: true };
  /** The plan as the join leaves it: a video of its own, answered, with its plan kept and filmed. */
  const madeFrom = (over = {}) => {
    const { planned = {}, ...rest } = over;
    const base = plan(rest);
    return {
      ...base, kind: "raw", video: { file: "Too many SKUs.mov", bytes: 16, seconds: 120, recorded: "2026-11-04", recordedFrom: "import" },
      answer: { state: "answered", guess: null, seen: "wide, 2:00, no retakes", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" },
      planned: { ...base.planned, filmed: { at: AT, parts: [] }, ...planned }
    };
  };
  it("offers a video made from a plan, with no hand-off yet, for a video with a picture: it takes b-roll and a screen recording still", () => {
    const offers = plannedOffers([madeFrom()], PICTURE);
    assert.deepEqual(offers.map((o) => o.option), ['Footage for "Too many SKUs"']);
    assert.equal(offers[0].record.id, PLAN_ID);
    for (const sound of [true, false]) assert.equal(plannedOffers([madeFrom()], { picture: true, sound }).length, 1, String(sound));
    assert.deepEqual(plannedOffers([madeFrom()], { picture: false, sound: true }), []);
  });
  it("offers none that has a hand-off, was dropped, is an explainer's, is not set, or is a video that is no plan's", () => {
    const finished = { at: AT, revision: 1, on: "Mac Studio" };
    for (const [what, record] of [["handed off", madeFrom({ finished })], ["dropped", madeFrom({ archived: { at: AT } })], ["an explainer", madeFrom({ route: "explainer" })], ["not set", madeFrom({ planned: { set: null } })],
      ["a video of its own", { ...madeFrom(), planned: undefined }], ["no kind", { ...madeFrom(), kind: null }]]) {
      assert.deepEqual(plannedOffers([record], PICTURE), [], what);
    }
  });
  it("offers it among the plans waiting for their footage, newest first, at most three", () => {
    const newer = plan({ id: "e-20261105-000001", title: "A newer plan", at: "2026-11-05T09:00:00-05:00" });
    const older = madeFrom({ id: "e-20261103-000001", title: "An older plan", at: "2026-11-03T09:00:00-05:00" });
    assert.deepEqual(plannedOffers([older, plan(), newer], PICTURE).map((o) => o.option), [footageOption("A newer plan"), footageOption("Too many SKUs"), footageOption("An older plan")]);
  });
});

describe("partsOf, the parts of a plan", () => {
  it("is the dropped videos answered as footage for the plan, by their records in force, in the order they were answered", () => {
    const t = setup();
    put(t, "2026-11-04 Third (Mac Studio)", part({ id: "e-20261104-cc3333", label: "Video of 4 Nov, 11:00 (Mac Studio)", as: "talking", at: "2026-11-04T11:30:00-05:00", sound: true }));
    put(t, "2026-11-04 First (Mac Studio)", part({ id: "e-20261104-aa1111", label: "Video of 4 Nov, 09:00 (Mac Studio)", at: "2026-11-04T09:30:00-05:00" }));
    put(t, "2026-11-04 Second (Mac Studio)", part({ id: "e-20261104-bb2222", label: "Video of 4 Nov, 10:00 (Mac Studio)", as: "screen", shot: 4, at: "2026-11-04T10:30:00-05:00" }));
    const parts = partsOf(t.root, PLAN_ID);
    assert.deepEqual(parts.map((p) => p.record.label), ["Video of 4 Nov, 09:00 (Mac Studio)", "Video of 4 Nov, 10:00 (Mac Studio)", "Video of 4 Nov, 11:00 (Mac Studio)"]);
    assert.deepEqual(parts.map((p) => p.name), ["2026-11-04 First (Mac Studio)", "2026-11-04 Second (Mac Studio)", "2026-11-04 Third (Mac Studio)"]);
    assert.deepEqual(parts.map((p) => p.folder), parts.map((p) => join(t.root, "Episodes", p.name)));
    assert.deepEqual(Object.keys(parts[0]).sort(), ["folder", "name", "record"]);
    assert.deepEqual(parts.map((p) => p.record.partOf.as), ["b-roll", "screen", "talking"]);
    t.done();
  });
  it("is the plan's own and no other's, and nothing else in Episodes: no plan, no video, no part of another plan, none dropped", () => {
    const t = setup();
    put(t, "2026-11-04 Plan (Mac Studio)", plan());
    put(t, "2026-11-04 Waiting (Mac Studio)", waitingVideo({ id: "e-20261104-ee5555" }));
    put(t, "2026-11-04 Other plan's (Mac Studio)", part({ id: "e-20261104-ff6666", of: OTHER_ID }));
    put(t, "2026-11-04 Dropped (Mac Studio)", part({ id: "e-20261104-aa7777", archived: { at: AT } }));
    put(t, "2026-11-04 Raw (Mac Studio)", { ...waitingVideo({ id: "e-20261104-aa8888" }), kind: "raw", version: 3, answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" } });
    put(t, "2026-11-04 Mine (Mac Studio)", part({ id: "e-20261104-aa9999" }));
    mkdirSync(join(t.root, "Episodes", ".importing"), { recursive: true });
    assert.deepEqual(partsOf(t.root, PLAN_ID).map((p) => p.record.id), ["e-20261104-aa9999"]);
    assert.deepEqual(partsOf(t.root, OTHER_ID).map((p) => p.record.id), ["e-20261104-ff6666"]);
    assert.deepEqual(partsOf(t.root, "e-20261104-000000"), []);
    t.done();
  });
  it("passes over a record that is not whole, one a newer BRIMM Video Studio wrote, and a folder that cannot be read, and says [] for no Episodes", () => {
    const t = setup();
    put(t, "2026-11-04 Whole (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    // A part with no shot is not a whole record, so it is not a part of anything.
    put(t, "2026-11-04 Broken (Mac Studio)", part({ id: "e-20261104-bb2222", partOf: { id: PLAN_ID, as: "b-roll", shot: null, client: false } }));
    // A record of a layout newer than this brimm-video's is read for its id alone, never as a part.
    put(t, "2026-11-04 Newer (Mac Studio)", { ...part({ id: "e-20261104-cc3333" }), version: NEWEST_VERSION + 1 });
    mkdirSync(join(t.root, "Episodes", "2026-11-04 Empty (Mac Studio)"), { recursive: true });
    assert.deepEqual(partsOf(t.root, PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111"]);
    t.done();
    assert.deepEqual(partsOf(join(t.dir, "nowhere"), PLAN_ID), []);
  });
  it("reads a conflicted episode past its copies, as the plan lookup does, and a part it cannot tell is none", () => {
    const t = setup();
    const folder = put(t, "2026-11-04 Conflicted (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    writeFileSync(join(folder, "record", "0001 (Sallie's laptop's conflicted copy 2026-11-04).json"), recordText(part({ id: "e-20261104-aa1111", client: true })));
    assert.deepEqual(partsOf(t.root, PLAN_ID).map((p) => [p.record.id, p.record.rev]), [["e-20261104-aa1111", 1]]);
    t.done();
  });
  it("lists a part kept on one Mac (Phase 3, L2: layout 6 with `local`) as it lists one at layout 5, by its record in Dropbox", () => {
    const t = setup();
    put(t, "2026-11-04 Kept (Mac Studio)", part({ id: "e-20261104-aa1111", version: 6, local: { on: "Mac Studio" } }));
    put(t, "2026-11-04 In Dropbox (Mac Studio)", part({ id: "e-20261104-bb2222", at: "2026-11-04T10:30:00-05:00" }));
    assert.deepEqual(partsOf(t.root, PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111", "e-20261104-bb2222"]);
    assert.deepEqual(partsOf(t.root, PLAN_ID)[0].record.local, { on: "Mac Studio" });
    t.done();
  });
  it("counts a part once for each folder of Episodes that holds it, and none that is not a folder", () => {
    const t = setup();
    put(t, "2026-11-04 One (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    writeFileSync(join(t.root, "Episodes", "notes.txt"), "not an episode");
    assert.deepEqual(partsOf(t.root, PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111"]);
    t.done();
  });
  it("lists a part a newer BRIMM Video Studio wrote only when it is asked to (newer: true): flagged, after the others, by the plan its record names (PR H5b)", () => {
    const t = setup();
    put(t, "2026-11-04 Whole (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    put(t, "2026-11-04 Newer (Mac Studio)", { ...part({ id: "e-20261104-cc3333", at: "2026-11-04T08:00:00-05:00" }), version: NEWEST_VERSION + 1 });
    put(t, "2026-11-04 Newer of another plan (Mac Studio)", { ...part({ id: "e-20261104-dd4444", of: OTHER_ID }), version: NEWEST_VERSION + 1 });
    put(t, "2026-11-04 Newer, no part (Mac Studio)", { ...waitingVideo({ id: "e-20261104-ee5555" }), version: NEWEST_VERSION + 1 });
    assert.deepEqual(partsOf(t.root, PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111"]);
    const all = partsOf(t.root, PLAN_ID, { newer: true });
    assert.deepEqual(all.map((p) => [p.record.id, p.newer === true]), [["e-20261104-aa1111", false], ["e-20261104-cc3333", true]]);
    assert.deepEqual(Object.keys(all[0]).sort(), ["folder", "name", "record"], "a whole part is listed as it always was");
    t.done();
  });
});

describe("partHeld and mayBeUsed, whether a part may be used to make anything (PR H5b, ruling 1)", () => {
  const CONFLICT = "record/0001 (Sallie's laptop's conflicted copy 2026-11-04).json";
  it("holds nothing back of a part whose episode is as its record in force says", () => {
    const t = setup();
    put(t, "2026-11-04 One (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    const [listed] = partsOf(t.root, PLAN_ID);
    assert.equal(partHeld(listed), null);
    assert.equal(mayBeUsed(listed, plan().planned), true);
    t.done();
  });
  it("holds back a part whose episode holds a conflicted copy, though its record in force shows no client, and a conflicted copy of anything else in it", () => {
    for (const copy of [CONFLICT, "Sorting invoices (Sallie's laptop's conflicted copy 2026-11-04).mov"]) {
      const t = setup();
      const folder = put(t, "2026-11-04 One (Mac Studio)", part({ id: "e-20261104-aa1111" }));
      writeFileSync(join(folder, copy), copy.startsWith("record") ? recordText(part({ id: "e-20261104-aa1111", client: true })) : "video");
      const [listed] = partsOf(t.root, PLAN_ID);
      assert.equal(listed.record.partOf.client, false, "its record in force shows no client");
      assert.equal(mayGoIn(listed, plan().planned), true, "mayGoIn judges the record in force alone, as the guide's line needs it to");
      const held = partHeld(listed);
      assert.equal(held.why, "conflicted");
      assert.equal(held.read.code, "CONFLICTED");
      assert.equal(mayBeUsed(listed, plan().planned), false);
      t.done();
    }
  });
  it("holds back a part whose newest record a newer BRIMM Video Studio wrote, listed as newer or found so when it is looked at", () => {
    const t = setup();
    const folder = put(t, "2026-11-04 One (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    const [listed] = partsOf(t.root, PLAN_ID);
    writeFileSync(recordFile(folder, 2), recordText({ ...part({ id: "e-20261104-aa1111" }), rev: 2, version: 9 }));
    // Looked at again, it is a newer brimm-video's.
    assert.deepEqual([partHeld(listed).why, mayBeUsed(listed, plan().planned)], ["newer", false]);
    // Listed as newer, it is held without a look.
    const [flagged] = partsOf(t.root, PLAN_ID, { newer: true });
    assert.deepEqual([partHeld(flagged).why, flagged.newer, mayBeUsed(flagged, plan().planned)], ["newer", true, false]);
    t.done();
  });
  it("holds back a part whose record cannot be read, and anything that is no part", () => {
    const t = setup();
    const folder = put(t, "2026-11-04 One (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    const [listed] = partsOf(t.root, PLAN_ID);
    rmSync(join(folder, "record"), { recursive: true });
    assert.equal(partHeld(listed).why, "unreadable");
    assert.equal(mayBeUsed(listed, plan().planned), false);
    for (const nothing of [null, undefined, {}, { folder: 5 }]) assert.notEqual(partHeld(nothing), null);
    t.done();
  });
  it("asks the client's agreement too: a part that shows a client is used only once the plan holds it, and never while its episode is held", () => {
    const t = setup();
    const folder = put(t, "2026-11-04 One (Mac Studio)", part({ id: "e-20261104-aa1111", client: true }));
    const [listed] = partsOf(t.root, PLAN_ID);
    const agreed = { ...plan().planned, consent: [{ id: "e-20261104-aa1111", label: "Video of 4 Nov, 09:12 (Mac Studio)", at: "2026-11-04" }] };
    assert.deepEqual([mayBeUsed(listed, plan().planned), mayBeUsed(listed, agreed)], [false, true]);
    writeFileSync(join(folder, CONFLICT), "x");
    assert.equal(mayBeUsed(listed, agreed), false);
    t.done();
  });
});

describe("partsReader, the parts of every plan from one look at Episodes", () => {
  it("says what partsOf says for each plan, and for a plan with none, and for no Episodes", () => {
    const t = setup();
    put(t, "2026-11-04 Second (Mac Studio)", part({ id: "e-20261104-bb2222", label: "Video of 4 Nov, 10:00 (Mac Studio)", as: "screen", shot: 4, at: "2026-11-04T10:30:00-05:00" }));
    put(t, "2026-11-04 First (Mac Studio)", part({ id: "e-20261104-aa1111", at: "2026-11-04T09:30:00-05:00" }));
    put(t, "2026-11-04 Other's (Mac Studio)", part({ id: "e-20261104-ff6666", of: OTHER_ID, as: "talking", sound: true }));
    put(t, "2026-11-04 Plan (Mac Studio)", plan());
    const of = partsReader(t.root);
    for (const id of [PLAN_ID, OTHER_ID, "e-20261104-000000"]) assert.deepEqual(of(id), partsOf(t.root, id), id);
    assert.deepEqual(of(PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111", "e-20261104-bb2222"]);
    assert.deepEqual(of(OTHER_ID).map((p) => p.record.id), ["e-20261104-ff6666"]);
    assert.deepEqual(partsReader(join(t.dir, "nowhere"))(PLAN_ID), []);
    t.done();
  });
  it("looks at Episodes when it is first asked, and not again: a pass is one picture of the disk", () => {
    const t = setup();
    put(t, "2026-11-04 First (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    const of = partsReader(t.root);
    // Made, it has looked at nothing: a part answered before the first ask is in what it says.
    put(t, "2026-11-04 Second (Mac Studio)", part({ id: "e-20261104-bb2222", as: "screen", shot: 4, at: "2026-11-04T10:30:00-05:00" }));
    assert.deepEqual(of(PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111", "e-20261104-bb2222"]);
    // A part answered after it has looked is a part of the next pass, and partsOf, which looks every time, already says it.
    put(t, "2026-11-04 Third (Mac Studio)", part({ id: "e-20261104-cc3333", as: "talking", sound: true, at: "2026-11-04T11:30:00-05:00" }));
    assert.deepEqual(of(PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111", "e-20261104-bb2222"]);
    assert.deepEqual(of(OTHER_ID), []);
    assert.deepEqual(partsOf(t.root, PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111", "e-20261104-bb2222", "e-20261104-cc3333"]);
    assert.deepEqual(partsReader(t.root)(PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111", "e-20261104-bb2222", "e-20261104-cc3333"]);
    t.done();
  });
});

describe("mayGoIn, whether a part may go into a project", () => {
  const consent =(...ids) => ({ consent: ids.map((id) => ({ id, label: "Video of 4 Nov, 09:12 (Mac Studio)", at: "2026-11-04" })) });
  const asPart = (record) => ({ name: "2026-11-04 Part (Mac Studio)", folder: "/x", record });
  it("is true of a part that shows no client, with or without any agreement", () => {
    assert.equal(mayGoIn(asPart(part()), plan().planned), true);
    assert.equal(mayGoIn(asPart(part({ as: "talking", sound: true })), plan().planned), true);
    assert.equal(mayGoIn(asPart(part()), { ...plan().planned, ...consent("e-20261104-bb2222") }), true);
  });
  it("is false of a part that shows a client until the plan holds the client's agreement for that part's id", () => {
    const shows = asPart(part({ client: true }));
    assert.equal(mayGoIn(shows, plan().planned), false, "no agreement");
    assert.equal(mayGoIn(shows, { ...plan().planned, ...consent() }), false, "an empty list");
    assert.equal(mayGoIn(shows, { ...plan().planned, ...consent("e-20261104-bb2222") }), false, "another part's agreement");
    assert.equal(mayGoIn(shows, { ...plan().planned, ...consent("e-20261104-bb2222", "e-20261104-aa11bb") }), true, "its own, among others");
    assert.equal(mayGoIn(asPart(part({ as: "screen", shot: 4, client: true })), { ...plan().planned, ...consent("e-20261104-aa11bb") }), true);
  });
  it("is false whenever it cannot tell: the plan's agreement is not a list of the part's id, or the part's client is not a plain no", () => {
    const shows = asPart(part({ client: true }));
    for (const consentBad of [null, "yes", {}, 3, [null], ["e-20261104-aa11bb"], [{ label: "Video" }], [{ id: "e-20261104-aa11bb2" }], [{ id: "E-20261104-AA11BB" }]]) {
      assert.equal(mayGoIn(shows, { ...plan().planned, consent: consentBad }), false, JSON.stringify(consentBad));
    }
    for (const planned of [null, undefined, "plan", 3, []]) assert.equal(mayGoIn(shows, planned), false, JSON.stringify(planned));
    // A client that is not a plain false is a client.
    for (const client of [true, "no", "false", 0, null, undefined, 1]) {
      const odd = asPart({ ...part(), partOf: { ...part().partOf, client } });
      assert.equal(mayGoIn(odd, plan().planned), false, String(client));
    }
    // A part that is not a part.
    for (const bad of [asPart(waitingVideo()), asPart(null), asPart({}), null, undefined, {}, asPart({ partOf: null })]) assert.equal(mayGoIn(bad, plan().planned), false, JSON.stringify(bad));
  });
});

describe("footageAsked, the words of footage", () => {
  const words = (...w) => w;
  const flags = (client, shot) => ({ ...(client === undefined ? {} : { client: [client] }), ...(shot === undefined ? {} : { shot: [shot] }) });
  it("takes a video, a plan, a kind and whether it shows a client, with a shot for a screen recording or b-roll when it has one", () => {
    assert.deepEqual(footageAsked(words("Video", "Too many SKUs", "talking"), flags("no")), { form: "set", video: "Video", planned: "Too many SKUs", as: "talking", client: false, shot: null });
    assert.deepEqual(footageAsked(words("Video", "Too many SKUs", "b-roll"), flags("yes", "2")), { form: "set", video: "Video", planned: "Too many SKUs", as: "b-roll", client: true, shot: 2 });
    assert.deepEqual(footageAsked(words("Video", "Too many SKUs", "screen"), flags("No", "12")), { form: "set", video: "Video", planned: "Too many SKUs", as: "screen", client: false, shot: 12 });
    assert.deepEqual(footageAsked(words("Video", "Too many SKUs", "B-ROLL"), flags("YES")), { form: "set", video: "Video", planned: "Too many SKUs", as: "b-roll", client: true, shot: null });
    // Every kind of part but the voiceover (PR H6), which takes no --client and has a form of its own (tests/explainer.test.js).
    for (const as of PART_KINDS.filter((kind) => kind !== "voiceover")) assert.equal(footageAsked(words("V", "P", as), flags("no")).as, as);
  });
  it("takes a video and none, to take it back", () => {
    assert.deepEqual(footageAsked(words("Video", "none"), {}), { form: "none", video: "Video" });
  });
  it("is nothing, the help, for anything else", () => {
    for (const [w, f] of [
      [[], {}], [["V"], {}], [["V", "P"], flags("no")], [["V", "P", "talking"], {}], [["V", "P", "talking"], flags("maybe")], [["V", "P", "talking"], flags("")], [["V", "P", "talking"], { client: ["yes", "no"] }],
      [["V", "P", "talking"], { client: true }], [["V", "P", "voiceover"], flags("no")], [["V", "P", "drone"], flags("no")], [["V", "P", "talking", "more"], flags("no")],
      [["V", "P", "b-roll"], flags("no", "0")], [["V", "P", "b-roll"], flags("no", "-1")], [["V", "P", "b-roll"], flags("no", "1.5")], [["V", "P", "b-roll"], flags("no", "two")], [["V", "P", "b-roll"], flags("no", "")],
      [["V", "P", "b-roll"], { client: ["no"], shot: ["1", "2"] }], [["V", "P", "talking"], { ...flags("no"), zzz: true }], [["V", "none"], flags("no")], [["V", "none"], { shot: ["1"] }], [["V", "none", "extra"], {}],
      [["", "P", "talking"], flags("no")], [["V", "  ", "talking"], flags("no")], [["V", "none", "none"], {}]]) {
      assert.equal(footageAsked(w, f), null, JSON.stringify([w, f]));
    }
  });
});

describe("what is said of the footage a plan has", () => {
  const asPart = (record) => ({ name: "n", folder: "/x", record });
  it("counts the parts by their kind, each kind in its words, and leaves out a kind with none", () => {
    const parts = [part({ as: "talking", sound: true }), part({ as: "talking", sound: true }), part({ as: "screen", shot: 4 }), part({ as: "b-roll", shot: 2 }), part({ as: "b-roll", shot: 5 })].map(asPart);
    assert.equal(footageCounts(parts), "2 talking parts, 1 screen recording and 2 b-roll clips");
    assert.equal(footageCounts(parts.slice(0, 1)), "1 talking part");
    assert.equal(footageCounts([parts[2], parts[3]]), "1 screen recording and 1 b-roll clip");
    assert.equal(footageCounts([parts[0], parts[1], parts[4]]), "2 talking parts and 1 b-roll clip");
    assert.equal(footageCounts([]), "");
  });
  it("says each part in the lines of a plan, with a client's agreement as it stands", () => {
    assert.equal(partLine(asPart(part({ as: "talking", sound: true })), plan().planned), "Footage: Video of 4 Nov, 09:12 (Mac Studio), talking to the camera.");
    assert.equal(partLine(asPart(part({ as: "b-roll", shot: 2 })), plan().planned), "Footage: Video of 4 Nov, 09:12 (Mac Studio), b-roll for shot 2.");
    assert.equal(partLine(asPart(part({ as: "screen", shot: 4 })), plan().planned), "Footage: Video of 4 Nov, 09:12 (Mac Studio), a screen recording for shot 4.");
    assert.equal(partLine(asPart(part({ as: "b-roll", shot: 5, client: true })), plan().planned), "Footage: Video of 4 Nov, 09:12 (Mac Studio), b-roll for shot 5. It shows a client, and waits for their agreement.");
    const agreed = { ...plan().planned, consent: [{ id: "e-20261104-aa11bb", label: "Video of 4 Nov, 09:12 (Mac Studio)", at: "2026-11-04" }] };
    assert.equal(partLine(asPart(part({ as: "b-roll", shot: 5, client: true })), agreed), "Footage: Video of 4 Nov, 09:12 (Mac Studio), b-roll for shot 5. It shows a client, who agreed on 4 November.");
    // A consent written on another day is said as that day.
    const later = { ...plan().planned, consent: [{ id: "e-20261104-aa11bb", label: "x", at: "2026-12-09" }] };
    assert.match(partLine(asPart(part({ as: "b-roll", shot: 5, client: true })), later), /who agreed on 9 December\.$/);
  });
});
