// Footage for a planned video (PR H5a; design 2026-11-04, H5): the plans a dropped video may be for, the parts a plan has, and whether a part
// may go into a project. This is safety code. A part is a dropped video that was answered as footage for a plan; it shows a client, or it
// does not; and a part that shows a client goes into no project until the plan holds a client's agreement for it (`planned.consent`). The
// words of the command (footage.js footageAsked) and of what is said of the footage are fixed here too.
// Nothing here runs a program or touches Dropbox: each test has a folder of its own under the temp folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PART_KINDS, newEpisode, newPlannedEpisode, recordFile, recordText } from "../episode.js";
import { footageOption } from "../receipts.js";
import { footageAsked, footageCounts, mayGoIn, partLine, partsOf, partsReader, plannedOffers } from "../footage.js";
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
  it("passes over a record that is not whole, one a newer brimm-video wrote, and a folder that cannot be read, and says [] for no Episodes", () => {
    const t = setup();
    put(t, "2026-11-04 Whole (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    // A part with no shot is not a whole record, so it is not a part of anything.
    put(t, "2026-11-04 Broken (Mac Studio)", part({ id: "e-20261104-bb2222", partOf: { id: PLAN_ID, as: "b-roll", shot: null, client: false } }));
    // A record of a layout newer than this brimm-video's is read for its id alone, never as a part.
    put(t, "2026-11-04 Newer (Mac Studio)", { ...part({ id: "e-20261104-cc3333" }), version: 6 });
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
  it("counts a part once for each folder of Episodes that holds it, and none that is not a folder", () => {
    const t = setup();
    put(t, "2026-11-04 One (Mac Studio)", part({ id: "e-20261104-aa1111" }));
    writeFileSync(join(t.root, "Episodes", "notes.txt"), "not an episode");
    assert.deepEqual(partsOf(t.root, PLAN_ID).map((p) => p.record.id), ["e-20261104-aa1111"]);
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
    for (const as of PART_KINDS) assert.equal(footageAsked(words("V", "P", as), flags("no")).as, as);
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
