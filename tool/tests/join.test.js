// The talking parts joined into the plan's video, and the plan's footage ready for its project (PR H5b; design 2026-11-04, H5). Here: the pure half of
// join.js, which says where each talking part falls in the script, whether the parts can be joined by copying their streams, the list and the
// arguments ffmpeg is given, and the footage a plan's parts give its project; then the run that makes the plan the video it was waiting to be.
// Nothing here runs a real program: ffprobe, ffmpeg and the transcriber are stand-ins that print as the real ones do, and each test has a folder of
// its own under the temp folder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELP, editMain } from "../edit.js";
import { episodeFault, isPart, isPlannedRecord, layoutOf, localStamp, newEpisode, newPlannedEpisode, readEpisode, recordFile, recordText, writeEpisode } from "../episode.js";
import { concatList, isFromPlan, joinArgs, partOrder, partsFault } from "../join.js";
import { footageOf, footageToUse, footageWithheld, withMaterial } from "../plan-project.js";
import { partHeld, partsOf } from "../footage.js";
import { lockOf, readResult, takeEpisodeLock } from "../detached.js";
import { guardDecision } from "../studio.js";
import { CHECKOUT, EDIT, NODE } from "./guard-cases.js";
import { fileSafe } from "../names.js";
import { fileEpisode, readPendings } from "../filing.js";
import { clockAt, importInto } from "../unedited.js";
import { COPY_STEP } from "../guide.js";
import { addRates, progressFolder } from "../progress.js";
import { holds } from "../snapshot.js";
import { episodeWork } from "../settings.js";
import { localDay } from "../shared/text.js";
import { FOOTAGE_STEP, WORK_COPY_STEP, footageCopyPaths, workCopyDir, workCopyKey, workCopyPaths } from "../workcopy.js";
import { probed } from "./fixtures.js";
import { setup, listAll, otherMac, reread } from "./episodes.js";

const WRITER = { commit: "c709b57", on: "Mac Studio" };
const PLAN_ID = "e-20261104-3fa9c1";
const AT = "2026-11-04T09:12:00-05:00";
const SHOTS = [
  { n: 1, kind: "talking", what: "Open on the problem, to the camera." },
  { n: 2, kind: "b-roll", what: "Sallie at her desk sorting invoices." },
  { n: 3, kind: "talking", what: "Why it matters, to the camera." },
  { n: 4, kind: "screen", what: "Her dashboard, scrolling the SKU list." },
  { n: 5, kind: "b-roll", what: "A coaching session." }
];

describe("partOrder, where each talking part falls in the teleprompter script", () => {
  const SCRIPT = [
    "Too many SKUs will sink a small shop before it ever finds its footing.",
    "The first thing you need to do is count what you actually sell each week.",
    "Then cut the bottom fifth of the list and watch what happens to your cash."
  ];
  const wordsOf = (...lines) => lines.flatMap((line) => line.split(" ")).map((w, i) => ({ w, start: i, end: i + 1 }));
  const talk = (id, ...lines) => ({ id, label: `Video ${id}`, words: wordsOf(...lines) });
  const ids = (ordered) => ordered.map((p) => p.id);

  it("puts two parts given out of order in the script's order, each as { id, label, place }", () => {
    const later = talk("b", SCRIPT[2]);
    const earlier = talk("a", SCRIPT[0], "and so on");
    const ordered = partOrder([later, earlier], SCRIPT);
    assert.deepEqual(ids(ordered), ["a", "b"]);
    assert.deepEqual(Object.keys(ordered[0]).sort(), ["id", "label", "place"]);
    assert.deepEqual(ordered.map((p) => p.label), ["Video a", "Video b"]);
    assert.ok(Number.isInteger(ordered[0].place) && Number.isInteger(ordered[1].place) && ordered[0].place < ordered[1].place, JSON.stringify(ordered));
  });
  it("votes with each run of four tokens found once in the script, and takes the middle vote as the part's place", () => {
    // The middle paragraph's 15 tokens are 12 runs of four, all found once; the middle of them is the sixth run, which starts at its sixth token.
    const middle = partOrder([talk("m", SCRIPT[1])], SCRIPT)[0];
    const first = SCRIPT[0].split(" ").length;
    assert.equal(middle.place, first + 6);
  });
  it("reads words as the script is read: in any case, without accents and marks, so a stumble over spelling does not lose a vote", () => {
    const said = talk("c", "THE FIRST THING you need to do, is count what you actually sell each week!");
    assert.ok(partOrder([said], SCRIPT)[0].place !== null);
  });
  it("lands a part with a retake, a paragraph read twice, where its words are", () => {
    // A part reads the first paragraph twice and the last once: most of its votes are the first paragraph's, so its middle vote is there.
    const retaken = talk("r", SCRIPT[0], SCRIPT[0], SCRIPT[2]);
    const between = talk("q", SCRIPT[1]);
    const ordered = partOrder([between, retaken], SCRIPT);
    assert.deepEqual(ids(ordered), ["r", "q"]);
    assert.ok(ordered[0].place < SCRIPT[0].split(" ").length, String(ordered[0].place));
  });
  it("puts a part whose words are not in the script after the placed ones, with the others who have none in the order they were answered", () => {
    const parts = [talk("u", "Nothing of the script at all is said in this one."), talk("b", SCRIPT[2]), talk("v", "Another that is wholly off the page."), talk("a", SCRIPT[0])];
    const ordered = partOrder(parts, SCRIPT);
    assert.deepEqual(ids(ordered), ["a", "b", "u", "v"]);
    assert.deepEqual(ordered.map((p) => p.place === null), [false, false, true, true]);
  });
  it("gives a part with fewer than three votes no place: five tokens in the script are two runs, six are three", () => {
    const five = talk("f", "Too many SKUs will sink", "and then it says something else entirely different");
    const six = talk("s", "Too many SKUs will sink a", "and then it says something else entirely different");
    assert.equal(partOrder([five], SCRIPT)[0].place, null);
    assert.notEqual(partOrder([six], SCRIPT)[0].place, null);
  });
  it("counts no run that the script holds twice: a run found more than once votes for nothing", () => {
    const script = ["Count the stock. Count the stock. Count the stock. Count the stock. Count the stock."];
    assert.equal(partOrder([talk("d", "Count the stock. Count the stock. Count the stock. Count the stock.")], script)[0].place, null);
  });
  it("keeps the order given for two parts at one place, and works with no script, no words or one part", () => {
    const one = talk("x", SCRIPT[1]);
    const two = talk("y", SCRIPT[1]);
    assert.deepEqual(ids(partOrder([two, one], SCRIPT)), ["y", "x"]);
    assert.deepEqual(ids(partOrder([talk("n"), talk("m")], [])), ["n", "m"]);
    assert.deepEqual(partOrder([{ id: "z", label: "Z" }], SCRIPT), [{ id: "z", label: "Z", place: null }]);
    assert.deepEqual(partOrder([], SCRIPT), []);
  });
  it("takes a part as it is listed (partsOf) too: its id and label from its record", () => {
    const listed = { name: "x", folder: "/x", record: { id: PLAN_ID, label: "Video of 4 Nov, 01:00 (Mac Studio)" }, words: wordsOf(SCRIPT[0]) };
    assert.deepEqual(partOrder([listed], SCRIPT).map(({ id, label }) => [id, label]), [[PLAN_ID, "Video of 4 Nov, 01:00 (Mac Studio)"]]);
  });
});

describe("partsFault, whether talking parts can be joined by copying their streams", () => {
  const SAME = { picture: { codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "30/1", pix_fmt: "yuv420p" }, sound: { codec_name: "aac", sample_rate: "48000", channels: 2 } };
  const probe = (over = {}) => probed({ picture: { ...SAME.picture, ...(over.picture || {}) }, sound: { ...SAME.sound, ...(over.sound || {}) }, duration: "30.000000" });
  it("passes parts of the same picture, the same sound and the same streams at the same indexes, and a part alone", () => {
    assert.equal(partsFault([probe(), probe(), probe()]), "");
    assert.equal(partsFault([probe()]), "");
    assert.equal(partsFault([]), "");
  });
  it("says the size of the first part that differs from the first, in its words", () => {
    assert.equal(partsFault([probe(), probe({ picture: { width: 3840, height: 2160 } })]), "talking part 2 is 3840 by 2160, and talking part 1 is 1920 by 1080");
  });
  it("says the rate it was filmed at, to two places", () => {
    assert.equal(partsFault([probe(), probe({ picture: { r_frame_rate: "60/1", avg_frame_rate: "60/1" } })]), "talking part 2 was filmed at 60 pictures a second, and talking part 1 at 30");
    assert.equal(partsFault([probe({ picture: { r_frame_rate: "30000/1001", avg_frame_rate: "30000/1001" } }), probe()]), "talking part 2 was filmed at 30 pictures a second, and talking part 1 at 29.97");
  });
  it("says a picture in another form: its codec or its pixel format", () => {
    for (const picture of [{ codec_name: "hevc" }, { pix_fmt: "yuv420p10le" }]) assert.equal(partsFault([probe(), probe({ picture })]), "talking part 2 has its picture in another form", JSON.stringify(picture));
  });
  it("says a sound in another form: its codec, its rate or its channels", () => {
    for (const sound of [{ codec_name: "mp3" }, { sample_rate: "44100" }, { channels: 1 }]) assert.equal(partsFault([probe(), probe({ sound })]), "talking part 2 has its sound in another form", JSON.stringify(sound));
  });
  it("refuses another layout of streams: the sound before the picture", () => {
    const swapped = JSON.stringify({
      streams: [{ index: 0, codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2 }, { index: 1, codec_type: "video", codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "30/1", pix_fmt: "yuv420p", disposition: { attached_pic: 0 } }],
      format: { duration: "30.000000" }
    });
    assert.equal(partsFault([probe(), swapped]), "talking part 2 has its streams in another order");
  });
  it("says the first part that differs, and of that part the size before the rate before the forms", () => {
    assert.equal(partsFault([probe(), probe(), probe({ picture: { width: 1280, height: 720 } })]), "talking part 3 is 1280 by 720, and talking part 1 is 1920 by 1080");
    assert.equal(partsFault([probe(), probe({ sound: { channels: 1 } }), probe({ picture: { width: 1280, height: 720 } })]), "talking part 2 has its sound in another form");
    assert.equal(partsFault([probe(), probe({ picture: { width: 1280, height: 720, r_frame_rate: "60/1", avg_frame_rate: "60/1", codec_name: "hevc" }, sound: { channels: 1 } })]), "talking part 2 is 1280 by 720, and talking part 1 is 1920 by 1080");
    assert.equal(partsFault([probe(), probe({ picture: { r_frame_rate: "60/1", avg_frame_rate: "60/1", codec_name: "hevc" } })]), "talking part 2 was filmed at 60 pictures a second, and talking part 1 at 30");
  });
  it("takes the size as it is shown: a phone's picture stored on its side is its upright size", () => {
    const upright = JSON.stringify({ streams: [{ index: 0, codec_type: "video", codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "30/1", pix_fmt: "yuv420p", disposition: { attached_pic: 0 }, side_data_list: [{ rotation: -90 }] }, { index: 1, codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2 }], format: { duration: "9.000000" } });
    assert.equal(partsFault([probe(), upright]), "talking part 2 is 1080 by 1920, and talking part 1 is 1920 by 1080");
    assert.equal(partsFault([upright, upright]), "");
  });
  it("says a part it cannot read at all", () => {
    assert.equal(partsFault([probe(), "not JSON"]), "talking part 2 could not be read as a video");
    assert.equal(partsFault(["", probe()]), "talking part 1 could not be read as a video");
  });
});

describe("concatList and joinArgs, what ffmpeg is given to join by copying", () => {
  it("writes ffconcat's header and a line for each file, in the order given", () => {
    assert.equal(concatList(["/work/one.mov", "/work/two three.mov"]), "ffconcat version 1.0\nfile '/work/one.mov'\nfile '/work/two three.mov'\n");
  });
  it("writes an apostrophe in a path as '\\'' and no other mark differently", () => {
    assert.equal(concatList(["/Users/Jane's/it's \"fine\" $1 \\ ok.mov"]), "ffconcat version 1.0\nfile '/Users/Jane'\\''s/it'\\''s \"fine\" $1 \\ ok.mov'\n");
  });
  it("refuses a path with a line break in it, which the list cannot carry", () => {
    for (const bad of ["/a\nb.mov", "/a\rb.mov", "/a\0b.mov"]) assert.throws(() => concatList([bad]), /cannot/, JSON.stringify(bad));
  });
  it("copies the picture and the sound it is told, by their numbers in the first part, into the .mov, and re-encodes nothing", () => {
    const argv = joinArgs("/work/list.txt", "/work/Too many SKUs.mov", { video: 0, audio: 1 });
    const at = (flag) => argv[argv.indexOf(flag) + 1];
    assert.deepEqual([at("-f"), at("-safe"), at("-i")], ["concat", "0", "/work/list.txt"]);
    assert.deepEqual(argv.reduce((maps, a, i) => (a === "-map" ? [...maps, argv[i + 1]] : maps), []), ["0:0", "0:1"]);
    assert.equal(at("-c"), "copy");
    assert.equal(argv[argv.length - 1], "/work/Too many SKUs.mov");
    for (const re of ["-vf", "-af", "-c:v", "-c:a", "-crf", "-preset"]) assert.ok(!argv.includes(re), re);
    assert.ok(argv.includes("-nostdin") && argv.includes("-y"));
  });
  it("maps the numbers it is given: a sound that is not the second stream", () => {
    const argv = joinArgs("/l.txt", "/o.mov", { video: 1, audio: 2 });
    assert.deepEqual(argv.reduce((maps, a, i) => (a === "-map" ? [...maps, argv[i + 1]] : maps), []), ["0:1", "0:2"]);
  });
});

describe("a video made from a plan (isFromPlan)", () => {
  const planRecord = () => ({ ...newPlannedEpisode({ id: PLAN_ID, machine: "Mac Studio", at: AT, title: "Too many SKUs", route: "script", voice: null, writer: WRITER }), rev: 1 });
  /** The plan as the join leaves it: a video of its own with its kind and its answer, and its plan kept. */
  const made = (over = {}) => {
    const plan = planRecord();
    return {
      ...plan, kind: "raw", video: { file: "Too many SKUs.mov", bytes: 5, seconds: 120, recorded: "2026-11-04", recordedFrom: "import" },
      answer: { state: "answered", guess: null, seen: "wide, 2:00, no retakes", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" },
      planned: { ...plan.planned, set: AT, filmed: { at: AT, parts: ["e-20261104-aa11bb"] } }, ...over
    };
  };
  it("is a record that holds its plan, a video and a kind, and no plan that is waiting for its footage", () => {
    assert.equal(isFromPlan(made()), true);
    assert.equal(isFromPlan(made({ kind: "short video" })), true);
    assert.equal(isFromPlan(planRecord()), false, "a plan waiting for its footage has no video and no kind");
  });
  it("is not a plain video, a part, a plan whose plan cannot be read, or anything that is not a record", () => {
    const video = newEpisode({ id: "e-20261104-bb22cc", machine: "Mac Studio", at: AT, video: { file: "a.mov", bytes: 1, seconds: 20, created: null }, kind: "raw", writer: WRITER });
    assert.equal(isFromPlan(video), false);
    assert.equal(isFromPlan(made({ kind: null })), false);
    assert.equal(isFromPlan(made({ video: null })), false);
    assert.equal(isFromPlan(made({ planned: { route: "script" } })), false);
    for (const nothing of [null, undefined, 5, "plan", [], {}]) assert.equal(isFromPlan(nothing), false);
  });
});

describe("the footage a plan's parts give its project (footageOf, withMaterial)", () => {
  /** A plan's record, made as the join leaves it, with the shots above. */
  const plan = (over = {}) => ({ ...newPlannedEpisode({ id: PLAN_ID, machine: "Mac Studio", at: AT, title: "Too many SKUs", route: "script", voice: null, writer: WRITER }), rev: 1, kind: "raw", planned: { ...newPlannedEpisode({ id: PLAN_ID, machine: "Mac Studio", at: AT, title: "Too many SKUs", route: "script", voice: null, writer: WRITER }).planned, set: AT, shots: SHOTS, ...over } });
  const partRecord = (n, as, shot, client = false) => ({
    ...newEpisode({ id: `e-20261104-aa${n}${n}${n}${n}`, machine: "Mac Studio", at: AT, video: { file: `Take ${n}.mov`, bytes: 5, seconds: 8, created: null }, kind: null, writer: WRITER, label: `Video ${n}`, answer: { state: "needs your answer", guess: null, seen: "upright, 0:08", came: "phone", match: null } }),
    rev: 2, version: 5, answer: { state: "part", guess: null, seen: "upright, 0:08", came: "phone", match: null, by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" }, partOf: { id: PLAN_ID, as, shot, client }
  });
  /** A part listed as partsOf lists it, its episode in a folder of its own on disk. */
  const listed = (t, n, as, shot, client = false) => {
    const record = partRecord(n, as, shot, client);
    const folder = join(t.root, "Episodes", `2026-11-04 Take ${n} (Mac Studio)`);
    mkdirSync(join(folder, "record"), { recursive: true });
    writeFileSync(recordFile(folder, record.rev), recordText(record));
    return { name: `2026-11-04 Take ${n} (Mac Studio)`, folder, record };
  };
  it("gives each b-roll and screen part as { part, as, shot, path }, the path being media/<as>-<shot>.mp4", () => {
    const t = setup();
    const broll = listed(t, 1, "b-roll", 2);
    const screen = listed(t, 2, "screen", 4);
    const talking = listed(t, 3, "talking", null);
    assert.deepEqual(footageOf(plan(), [broll, screen, talking]), [
      { part: broll, as: "b-roll", shot: 2, path: "media/b-roll-2.mp4" },
      { part: screen, as: "screen", shot: 4, path: "media/screen-4.mp4" }
    ]);
    t.done();
  });
  it("gives nothing of a part of another plan, nor of anything that is no part", () => {
    const t = setup();
    const mine = listed(t, 1, "b-roll", 2);
    const other = listed(t, 2, "b-roll", 5);
    other.record.partOf = { ...other.record.partOf, id: "e-20261104-ffffff" };
    assert.deepEqual(footageOf(plan(), [mine, other, { name: "x", folder: "/x", record: {} }, null]).map((f) => f.path), ["media/b-roll-2.mp4"]);
    t.done();
  });
  it("gives no footage, and no material, for a part whose shot is no longer a shot of its kind in the plan's shot list (ruling 4)", () => {
    const t = setup();
    // plan … set made shot 2 a screen recording and left only four shots: the b-roll part's shot is not b-roll now, the screen part's is not there.
    const stale = [{ n: 1, kind: "talking", what: "a" }, { n: 2, kind: "screen", what: "b" }, { n: 3, kind: "talking", what: "c" }];
    const broll = listed(t, 1, "b-roll", 2);
    const screen = listed(t, 2, "screen", 4);
    assert.deepEqual(footageOf(plan({ shots: stale }), [broll, screen]), []);
    // A shot still of its kind is footage.
    assert.deepEqual(footageOf(plan({ shots: SHOTS }), [broll]).map((f) => f.path), ["media/b-roll-2.mp4"]);
    t.done();
  });
  it("gives no footage of a part whose episode holds a conflicted copy, though its record in force shows no client (ruling 1)", () => {
    const t = setup();
    const broll = listed(t, 1, "b-roll", 2);
    const screen = listed(t, 2, "screen", 4);
    // Dropbox kept a conflicted copy of the b-roll part's record, which says it shows a client.
    writeFileSync(join(broll.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText({ ...broll.record, partOf: { ...broll.record.partOf, client: true } }));
    assert.deepEqual(footageOf(plan(), [broll, screen]).map((f) => f.path), ["media/screen-4.mp4"]);
    t.done();
  });
  it("gives no footage of a part a newer BRIMM Video Studio wrote, listed with newer: true", () => {
    const t = setup();
    const broll = listed(t, 1, "b-roll", 2);
    assert.deepEqual(footageOf(plan(), [{ ...broll, newer: true }]), []);
    writeFileSync(recordFile(broll.folder, 3), recordText({ ...broll.record, rev: 3, version: 9 }));
    assert.deepEqual(footageOf(plan(), [broll]), []);
    t.done();
  });
  it("gives a cue that shows footage the file of its shot as its material, whether or not the file is in yet", () => {
    const t = setup();
    const broll = listed(t, 1, "b-roll", 2);
    const cues = [
      { n: 1, words: "too many SKUs", kind: "graphic", show: "A stack of boxes.", seconds: 4, style: null },
      { n: 2, words: "at my desk", kind: "b-roll", show: "Sallie at her desk.", seconds: 5, style: null, shot: 2 },
      { n: 3, words: "the dashboard", kind: "screen", show: "Her dashboard.", seconds: 6, style: null, shot: 4 },
      { n: 4, words: "a session", kind: "words", show: "Words.", seconds: 3, style: null }
    ];
    const got = withMaterial(cues, plan(), [broll]);
    assert.deepEqual(got.map((c) => c.material), [undefined, "media/b-roll-2.mp4", "media/screen-4.mp4", undefined]);
    assert.deepEqual(got.map((c) => Object.keys(c).includes("material")), [false, true, true, false], "a graphic or words cue gets no material key");
    assert.deepEqual(got[1], { ...cues[1], material: "media/b-roll-2.mp4" });
    t.done();
  });
  it("gives no material to a cue whose part is withheld: a stale shot, or an episode in conflict", () => {
    const t = setup();
    const broll = listed(t, 1, "b-roll", 2);
    const screen = listed(t, 2, "screen", 4);
    writeFileSync(join(screen.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText(screen.record));
    const cues = [
      { n: 1, words: "at my desk", kind: "b-roll", show: "Sallie at her desk.", seconds: 5, style: null, shot: 2 },
      { n: 2, words: "the dashboard", kind: "screen", show: "Her dashboard.", seconds: 6, style: null, shot: 4 }
    ];
    assert.deepEqual(withMaterial(cues, plan(), [broll, screen]).map((c) => c.material), ["media/b-roll-2.mp4", undefined]);
    assert.deepEqual(withMaterial(cues, plan({ shots: [{ n: 1, kind: "talking", what: "a" }, { n: 2, kind: "screen", what: "b" }] }), [broll]).map((c) => c.material), [undefined, "media/screen-4.mp4"]);
    t.done();
  });
  it("lets only the footage her client agreed to go in: a part that shows no client, or whose id the plan holds an agreement for", () => {
    const t = setup();
    const free = listed(t, 1, "b-roll", 2);
    const waits = listed(t, 2, "screen", 4, true);
    const agreed = listed(t, 3, "b-roll", 5, true);
    const consent = [{ id: agreed.record.id, label: "Video 3", at: "2026-11-04" }];
    assert.deepEqual(footageToUse(plan(), [free, waits, agreed]).map((f) => f.path), ["media/b-roll-2.mp4"]);
    assert.deepEqual(footageToUse(plan({ consent }), [free, waits, agreed]).map((f) => f.path), ["media/b-roll-2.mp4", "media/b-roll-5.mp4"]);
    // Footage that is withheld is still footage (footageOf), and a cue names its file all the same.
    assert.deepEqual(footageOf(plan(), [free, waits, agreed]).map((f) => f.path), ["media/b-roll-2.mp4", "media/screen-4.mp4", "media/b-roll-5.mp4"]);
    t.done();
  });
  it("lets no footage go in of a part held for its episode, whatever its agreement says (ruling 1)", () => {
    const t = setup();
    const conflicted = listed(t, 1, "b-roll", 2);
    const newer = listed(t, 2, "screen", 4);
    writeFileSync(join(conflicted.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText({ ...conflicted.record, partOf: { ...conflicted.record.partOf, client: true } }));
    assert.deepEqual(footageToUse(plan(), [conflicted, { ...newer, newer: true }]), []);
    t.done();
  });
  it("says of each b-roll and screen part that gives nothing now why, in the words the log has: conflict, a newer record, an unreadable one, a shot that changed, a client who has not agreed", () => {
    const t = setup();
    const going = listed(t, 1, "b-roll", 2);
    const conflicted = listed(t, 2, "screen", 4);
    const newer = listed(t, 3, "b-roll", 5);
    const stale = listed(t, 4, "b-roll", 9);
    const waits = listed(t, 5, "b-roll", 2, true);
    const talking = listed(t, 6, "talking", null);
    const other = listed(t, 7, "b-roll", 2);
    other.record.partOf = { ...other.record.partOf, id: "e-20261104-ffffff" };
    const lost = listed(t, 8, "screen", 4);
    writeFileSync(join(conflicted.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText(conflicted.record));
    rmSync(recordFile(lost.folder, lost.record.rev));
    const why = footageWithheld(plan(), [going, conflicted, { ...newer, newer: true }, stale, waits, talking, other, lost]).map(({ part, why: said }) => [part.record.label, said]);
    assert.deepEqual(why, [
      ["Video 2", "its episode holds a conflicted copy"],
      ["Video 3", "a newer BRIMM Video Studio wrote its record"],
      ["Video 4", "its shot is not a shot of its kind in the plan any more"],
      ["Video 5", "her client has not agreed to it"],
      ["Video 8", "its record cannot be read"]
    ]);
    t.done();
  });
});

// --- A world of plans and their parts, for `plan … join` and the run ---

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const TITLE = "Too many SKUs";
const SCRIPT = [
  "Too many SKUs will sink a small shop before it ever finds its footing.",
  "The first thing you need to do is count what you actually sell each week.",
  "Then cut the bottom fifth of the list and watch what happens to your cash."
];
const SHOT_ARGS = ["--shot", "talking | Open on the problem, to the camera.", "--shot", "b-roll | Sallie at her desk sorting invoices.", "--shot", "talking | Why it matters, to the camera.", "--shot", "screen | Her dashboard, scrolling the SKU list.", "--shot", "b-roll | A coaching session.", ...SCRIPT.flatMap((line) => ["--line", line])];
/** What ffprobe prints of a talking part by default: a wide picture of a minute with sound, which every part shares so that they can be joined. */
const WIDE = (over = {}) => probed({ picture: { codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "30/1", pix_fmt: "yuv420p", ...(over.picture || {}) }, sound: { codec_name: "aac", sample_rate: "48000", channels: 2, ...(over.sound || {}) }, duration: over.duration || "60.000000" });

/** What ffprobe prints of a video with the picture of WIDE's and no sound, `duration` seconds long. */
const silentOf = (duration) => probed({ picture: { codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "30/1", pix_fmt: "yuv420p" }, sound: null, duration });
/** What ffprobe prints of a footage copy: the same picture as WIDE's, a minute of it, and no sound. */
const SILENT = silentOf("60.000000");

/** A folder for one test with the programs' stand-ins: ffprobe prints what `script.probes` has for the file's name (WIDE otherwise, and for the joined
    file one that is `script.joined` long), ffmpeg joins by writing the file it is told to when it is told to concat (unless `script.concat` says it
    fails), and any other call is the made-up recording's as episodes.js has it. Each program asked is written down in `t.joins`. */
function world(script = {}) {
  const base = setup({
    programs: {
      FFPROBE: (args) => {
        const file = args[args.length - 1];
        const name = file.split("/").pop();
        if ((script.fails || []).includes(name)) return { code: 1, stderr: "moov atom not found\n" };
        // A footage copy is the sound-less copy of a part's video (workcopy.js): what ffmpeg wrote of it has a picture and no sound, unless a test says it has.
        const printed = (script.probes || {})[name] ?? (name.startsWith("footage-") ? script.footage ?? SILENT : name === `${fileSafe(TITLE)}.mov` ? WIDE({ duration: script.joined || "120.000000" }) : /^\d+-\d+\.mp4$/.test(name) ? WIDE({ duration: script.copy || "60.000000" }) : WIDE());
        writeFileSync(args[args.indexOf("-o") + 1], printed);
        return { code: 0, stderr: "" };
      },
      FFMPEG: (args) => {
        if (args.includes("concat")) {
          if (script.concat === "fail") return { code: 1, stderr: "[concat @ 0x1] Impossible to open 'x'\nInvalid data found when processing input\n" };
          // ffmpeg's last line names the second file of its list, as it does when it cannot open one.
          if (script.concat === "names") {
            const second = readFileSync(args[args.indexOf("-i") + 1], "utf8").split("\n").filter((line) => line.startsWith("file '"))[1];
            return { code: 1, stderr: `[concat @ 0x1] Impossible to open '${second.slice(6, -1)}'\n` };
          }
          writeFileSync(args[args.length - 1], "the joined video");
          return { code: 0, stderr: "" };
        }
        const out = args[args.length - 1];
        if (out !== "-") writeFileSync(out, "RIFF");
        return { code: 0, stderr: "" };
      }
    }
  });
  const calls = [];
  const kicks = [];
  const t = { ...base, kicks, joins: calls };
  // Every program asked is written down, with its arguments, over the stand-ins episodes.js made.
  const run = t.ctx.deps.run;
  t.ctx.deps.run = async (cmd, args, asked) => {
    calls.push({ cmd, args });
    return run(cmd, args, asked);
  };
  const guarded = t.ctx.deps.runGuarded;
  t.ctx.deps.runGuarded = async (cmd, args, limits) => {
    calls.push({ cmd, args, limits });
    return guarded(cmd, args, limits);
  };
  t.ctx.deps.kickstart = () => kicks.push("kickstart");
  return t;
}
/** The deps every command here is run with: the made-up Mac's, with an id for a plan that is the same every time (400000). */
const depsOf = (t, over = {}) => ({ ...t.ctx.deps, rand: () => 0.25, ...over });
const dayOf = (t) => localDay(new Date(t.now()));
const planIdOf = (t) => `e-${dayOf(t).replaceAll("-", "")}-400000`;
const folderOf = (t, title = TITLE) => join(t.root, "Episodes", `${dayOf(t)} ${fileSafe(title)} (Mac Studio)`);
const planOf = (t, title = TITLE) => readEpisode(folderOf(t, title)).record;
const atOf = (t) => localStamp(new Date(t.now()));

/** A planned script made on this Mac, its package set (`plan new` and `plan … set`): its folder. */
async function planned(t, { title = TITLE, shots = SHOT_ARGS } = {}) {
  assert.equal((await on(depsOf(t), "plan", "new", title)).code, 0);
  const s = await on(depsOf(t), "plan", title, "set", ...shots);
  assert.equal(s.code, 0, s.text);
  return folderOf(t, title);
}

const labelOf = (n) => `Video of 4 Nov, 0${n}:00 (Mac Studio)`;
const idOf = (n) => `e-20261104-a${String(n).repeat(5)}`;
/** The files a light import leaves of a video called `stem`, with what each holds. */
const LIGHT = (stem, words) => ({
  [`${stem}.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.transcript.txt`]: "[0:00] words\n",
  [`${stem}.words.json`]: JSON.stringify({ video: `${stem}.mov`, duration: 60, words: words.map((w, i) => ({ w, start: i, end: i + 1 })) }),
  [`${stem}.cut-plan.json`]: JSON.stringify({ version: 1, video: `${stem}.mov` }),
  [`${stem}.cut-plan.txt`]: "The cut plan.\n",
  [`${stem}.rough-cut.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.rough-cut.transcript.txt`]: "[0:00] words\n"
});
/** A dropped video answered as a part of the plan: its episode folder with the video and, for a part that has sound, the files its light import filed,
    and its record at layout 5. `words` are what it says. Returns what partsOf lists of it. */
function part(t, n, { as = "talking", shot = null, client = false, words = [], stem = `Take ${n}`, over = {}, record = {} } = {}) {
  const name = `2026-11-04 Drop ${n} (Mac Studio)`;
  const folder = join(t.root, "Episodes", name);
  mkdirSync(join(folder, "record"), { recursive: true });
  const files = { [`${stem}.mov`]: `video ${n}`, ...(as === "talking" ? LIGHT(stem, words) : {}) };
  for (const [rel, text] of Object.entries(files)) writeFileSync(join(folder, rel), text);
  const sizes = Object.fromEntries(Object.entries(files).map(([rel, text]) => [rel, Buffer.byteLength(text)]));
  const made = newEpisode({
    id: idOf(n), machine: "Mac Studio", at: "2026-11-04T09:00:00-05:00", video: { file: `${stem}.mov`, bytes: sizes[`${stem}.mov`], seconds: 60, created: null, ...(as === "talking" ? {} : { sound: false }) }, kind: null, writer: { commit: "c709b57", on: "Mac Studio" },
    files: sizes, label: labelOf(n), fingerprint: as === "talking" ? `fp${n}` : "",
    answer: { state: "needs your answer", guess: "raw", seen: as === "talking" ? "wide, 1:00, no retakes" : "upright, 1:00, no sound", came: "camera", match: null }, ...over
  });
  const next = {
    ...made, rev: 2, version: 5,
    answer: { ...made.answer, state: "part", by: "Mac Studio", on: "Mac Studio", at: `2026-11-04T09:3${n}:00-05:00`, private: "no" },
    partOf: { id: planIdOf(t), as, shot: as === "talking" ? null : shot, client }, ...record
  };
  writeFileSync(recordFile(folder, 2), recordText(next));
  return { name, folder, record: readEpisode(folder).record };
}
/** Every file of the test's folders, whole, by its path. */
const snapshot = (t) => Object.fromEntries(listAll(t.dir).map((rel) => [rel, readFileSync(join(t.dir, rel), "utf8")]));

const JOINING = `"${TITLE}" is being made from its footage. A notice comes when it is ready.`;
const NO_MORE = "Once they are joined, no more talking parts can be added.";

describe("plan … join, for \"that's all the footage\" (PR H5b)", () => {
  it("refuses a plan that is an explainer read by a HeyGen voice, in words, and writes nothing", async () => {
    const t = world();
    assert.equal((await on(depsOf(t), "plan", "new", "Why SKUs", "--explainer", "--voice", "heygen")).code, 0);
    const before = snapshot(t);
    const r = await on(depsOf(t), "plan", "Why SKUs", "join");
    assert.deepEqual([r.code, r.said], [1, [`"Why SKUs" is an explainer: its voice makes it, and it has no footage to join.`]]);
    assert.deepEqual([snapshot(t), t.started], [before, []]);
    t.done();
  });
  it("takes an explainer in her voice for a plan with a voiceover to join (PR H6): with none yet it says so, in words, and writes nothing", async () => {
    const t = world();
    assert.equal((await on(depsOf(t), "plan", "new", "Why SKUs", "--explainer")).code, 0);
    const before = snapshot(t);
    const r = await on(depsOf(t), "plan", "Why SKUs", "join");
    assert.deepEqual([r.code, r.said], [1, [`"Why SKUs" has no voiceover yet: a video needs one.`]]);
    assert.deepEqual([snapshot(t), t.started], [before, []]);
    t.done();
  });
  it("refuses a plan with no talking part yet, whatever other footage it has", async () => {
    const t = world();
    await planned(t);
    const before = snapshot(t);
    assert.deepEqual((await on(depsOf(t), "plan", TITLE, "join")).said, [`"${TITLE}" has no talking part yet: a video needs at least one.`]);
    part(t, 1, { as: "b-roll", shot: 2 });
    part(t, 2, { as: "screen", shot: 4 });
    const after = snapshot(t);
    const r = await on(depsOf(t), "plan", TITLE, "join");
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" has no talking part yet: a video needs at least one.`]]);
    assert.deepEqual([snapshot(t), t.started], [after, []]);
    assert.notDeepEqual(before, after);
    t.done();
  });
  it("says the order of two or more talking parts by the script, and writes and starts nothing", async () => {
    const t = world();
    await planned(t);
    // Part 1 says the last paragraph, part 2 the first, and part 3 nothing of the script.
    part(t, 1, { words: SCRIPT[2].split(" ") });
    part(t, 2, { words: SCRIPT[0].split(" ") });
    part(t, 3, { words: ["Nothing", "of", "the", "script", "at", "all", "is", "said", "here", "ever"] });
    const before = snapshot(t);
    const r = await on(depsOf(t), "plan", TITLE, "join");
    assert.deepEqual([r.code, r.said], [0, [
      `The talking parts of "${TITLE}", in the order of its script:`,
      `1. ${labelOf(2)}`,
      `2. ${labelOf(1)}`,
      `3. ${labelOf(3)}, whose words weren't found in the script`,
      NO_MORE
    ]]);
    assert.deepEqual([snapshot(t), t.started], [before, []]);
    t.done();
  });
  it("starts the run at once for one talking part, and again when it is named", async () => {
    const t = world();
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    part(t, 2, { as: "b-roll", shot: 2 });
    const before = snapshot(t);
    const r = await on(depsOf(t), "plan", TITLE, "join");
    assert.deepEqual([r.code, r.said], [0, [JOINING]]);
    assert.equal(t.started.length, 1);
    const [, args] = t.started[0];
    assert.deepEqual(args.slice(1), ["join", "--now", `${dayOf(t)} ${TITLE} (Mac Studio)`, "--parts", one.record.id]);
    // The plan is not changed by the command that starts the run: the run writes the record.
    assert.deepEqual(snapshot(t), before);
    // Named, it is the same.
    const named = await on(depsOf(t), "plan", TITLE, "join", labelOf(1));
    assert.deepEqual([named.code, named.said], [0, [JOINING]]);
    assert.equal(t.started.length, 2);
    assert.equal(planOf(t).planned.filmed, null);
    assert.ok(existsSync(folder));
    t.done();
  });
  it("starts the run with the ids of the talking parts in the order she gave them", async () => {
    const t = world();
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    const c = part(t, 3, { words: SCRIPT[2].split(" ") });
    const r = await on(depsOf(t), "plan", TITLE, "join", labelOf(3), labelOf(1), labelOf(2));
    assert.deepEqual([r.code, r.said], [0, [JOINING]]);
    const args = t.started[0][1];
    assert.equal(args[args.indexOf("--parts") + 1], [c, a, b].map((p) => p.record.id).join(","));
    // A part may be named by its label, its id or its short id, in any case.
    const by = await on(depsOf(t), "plan", TITLE, "join", c.record.id, a.record.id.slice(-6), labelOf(2).toUpperCase());
    assert.deepEqual([by.code, by.said], [0, [JOINING]]);
    t.done();
  });
  it("refuses words that are not each of the plan's talking parts once: one it does not know, one given twice, one left out, a part that is not talking", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    part(t, 2, { words: SCRIPT[1].split(" ") });
    part(t, 3, { as: "b-roll", shot: 2 });
    const before = snapshot(t);
    const THEY = `Those aren't the talking parts of "${TITLE}". They are: ${labelOf(1)}, ${labelOf(2)}.`;
    for (const words of [[labelOf(1)], [labelOf(1), labelOf(1)], [labelOf(1), labelOf(2), labelOf(2)], [labelOf(1), "Nothing like it"], [labelOf(1), labelOf(3)], [labelOf(3)], [labelOf(1), labelOf(2), labelOf(3)]]) {
      const r = await on(depsOf(t), "plan", TITLE, "join", ...words);
      assert.deepEqual([r.code, r.said], [1, [THEY]], words.join(" | "));
    }
    assert.deepEqual([snapshot(t), t.started], [before, []]);
    t.done();
  });
  it("refuses while a run is at work on the plan, as kind does, and starts none", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    const folder = `${dayOf(t)} ${TITLE} (Mac Studio)`;
    mkdirSync(episodeWork(t.home, folder), { recursive: true });
    writeFileSync(join(episodeWork(t.home, folder), "episode.lock"), JSON.stringify({ pid: 4242, command: "join", nonce: "x" }));
    const r = await on(depsOf(t, { alive: () => true }), "plan", TITLE, "join");
    assert.deepEqual([r.code, r.said, t.started], [1, [`join is running for ${folder} already. Say it again when it has finished.`], []]);
    t.done();
  });
  it("is the help, with 2, for a flag it does not take", async () => {
    const t = world();
    await planned(t);
    const r = await on(depsOf(t), "plan", TITLE, "join", "--now");
    assert.deepEqual([r.code, r.text], [2, HELP]);
    t.done();
  });
  it("is in the help, as the way to say that the footage is all in", () => {
    assert.ok(HELP.includes('node edit.js plan "<planned>" join ["<video>"…]'), HELP);
  });
});

/** The plan's record written once more as the video it was waiting to be, as the join leaves it (without the run): a raw video, answered, with its plan kept. */
function joined(t, over = {}, planned = {}) {
  const plan = planOf(t);
  const next = {
    ...plan, kind: "raw", video: { file: "Too many SKUs.mov", bytes: 16, seconds: 120, recorded: "2026-10-20", recordedFrom: "import" }, files: { ...plan.files, "Too many SKUs.mov": 16 },
    answer: { state: "answered", guess: null, seen: "wide, 2:00, no retakes", came: "camera", by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" },
    planned: { ...plan.planned, filmed: { at: atOf(t), parts: [idOf(1)] }, ...planned }, ...over
  };
  writeEpisode(folderOf(t), next, { expectRev: plan.rev, writeText: (to, text) => writeFileSync(to, text), writer: plan.writer, home: t.home });
  return readEpisode(folderOf(t)).record;
}

describe("plan … join, a talking part that must not be joined (ruling 1)", () => {
  it("refuses a talking part whose episode holds a conflicted copy, in the words of that conflict with its label first, writing nothing", async () => {
    const t = world();
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    part(t, 2, { words: SCRIPT[1].split(" ") });
    // Dropbox kept a conflicted copy of the first part's record.
    writeFileSync(join(one.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText(one.record));
    const before = snapshot(t);
    for (const words of [[], [labelOf(1), labelOf(2)]]) {
      const r = await on(depsOf(t), "plan", TITLE, "join", ...words);
      assert.equal(r.code, 1, words.join(" "));
      assert.equal(r.said.length, 1, r.text);
      assert.ok(r.said[0].startsWith(`${labelOf(1)} (a11111): Dropbox has kept a conflicted copy in this episode: record/0002 (Sallie's conflicted copy 2026-11-04).json. `), r.text);
      assert.ok(r.said[0].endsWith('Say "sort out the conflict".'), r.text);
    }
    assert.deepEqual([snapshot(t), t.started], [before, []]);
    t.done();
  });
  it("refuses a talking part a newer BRIMM Video Studio wrote, which partsOf does not list, in the newer record's words, with its label first", async () => {
    const t = world();
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    writeFileSync(recordFile(one.folder, 3), recordText({ ...one.record, rev: 3, version: 9 }));
    const before = snapshot(t);
    const r = await on(depsOf(t), "plan", TITLE, "join");
    assert.deepEqual([r.code, r.said], [1, [`${labelOf(1)}: That is an episode a newer BRIMM Video Studio wrote (a11111). Jason has a newer BRIMM Video Studio. Ask him to update this Mac.`]]);
    assert.deepEqual([snapshot(t), t.started], [before, []]);
    t.done();
  });
  it("does not stop for a b-roll or screen part in conflict: only the talking parts are joined", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    const broll = part(t, 2, { as: "b-roll", shot: 2 });
    writeFileSync(join(broll.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText(broll.record));
    const r = await on(depsOf(t), "plan", TITLE, "join");
    assert.deepEqual([r.code, r.said], [0, [JOINING]]);
    t.done();
  });
});

const FOLDER_NAME = (t) => `${dayOf(t)} ${TITLE} (Mac Studio)`;
/** The deps of a run on a Mac set up for HyperFrames, as its settings say. */
const appDeps = (t, over = {}) => depsOf(t, { settings: { ...t.ctx.settings, app: "hyperframes" }, ...over });
/** The run `plan … join` starts, as the detached run runs it: `join --now <the plan's folder> --parts <ids>`. */
const joinRun = (t, ids, over = {}) => on(appDeps(t, over), "join", "--now", FOLDER_NAME(t), "--parts", ids.join(","));
const resultOf = (t) => readResult(t.home, FOLDER_NAME(t), "join");
/** What the run's failure says in its result, whatever the reason. */
const COULD_NOT = (why) => `The footage of "${TITLE}" couldn't be made into one video: ${why}.`;
const READY = `Ready: "${TITLE}" is made from its footage. In Claude, say "what's next?"`;
/** The files of a part's light import, by their names. */
const LIGHT_NAMES = (stem) => ["srt", "transcript.txt", "words.json", "cut-plan.json", "cut-plan.txt", "rough-cut.srt", "rough-cut.transcript.txt"].map((e) => `${stem}.${e}`);
const longTalk = (stem) => ({ [`${stem}.mov`]: WIDE({ duration: "120.000000" }) });

describe("plan … join and join --now refuse in the same words (the plan's ruling 1 of PR H6: the refusals are one function)", () => {
  /** What the plan's command says, and what the run leaves as its reason, for the same plan, parts and words. */
  async function both(t, { words = [], ids }) {
    const said = await on(depsOf(t), "plan", TITLE, "join", ...words);
    const run = await joinRun(t, ids);
    const reason = resultOf(t).failed[0];
    const why = reason.startsWith(`The footage of "${TITLE}" couldn't be made into one video: `) ? reason.slice(`The footage of "${TITLE}" couldn't be made into one video: `.length).replace(/\.$/, "") : reason;
    return { said, run, why };
  }
  it("says no talking part, a talking part held by a conflict, and a talking part a newer BRIMM Video Studio wrote, in one set of words", async () => {
    const t = world();
    await planned(t);
    const none = await both(t, { ids: [idOf(1)] });
    assert.deepEqual([none.said.code, none.run.code], [1, 1]);
    assert.equal(`${none.why}.`, none.said.said[0]);
    t.done();
    for (const hold of [
      (one) => writeFileSync(join(one.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText(one.record)),
      (one) => writeFileSync(recordFile(one.folder, 3), recordText({ ...one.record, rev: 3, version: 9 }))
    ]) {
      const u = world();
      await planned(u);
      const one = part(u, 1, { words: SCRIPT[0].split(" ") });
      hold(one);
      const held = await both(u, { ids: [one.record.id] });
      assert.deepEqual([held.said.code, held.run.code], [1, 1]);
      assert.equal(held.why.replace(/^.*?: /, ""), held.said.said[0].replace(/^.*?: /, "").replace(/\.$/, ""), "the same reason");
      assert.equal(`${held.why}.`, held.said.said[0].replace(/\.$/, "") + ".");
      u.done();
    }
  });
  it("says parts that are not each of the plan's talking parts once in one set of words, whether she named them or the run was given their ids", async () => {
    const t = world();
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    part(t, 3, { as: "b-roll", shot: 2 });
    for (const [words, ids] of [[[labelOf(1)], [a.record.id]], [[labelOf(1), labelOf(1)], [a.record.id, a.record.id]], [[labelOf(1), "Nothing like it"], [a.record.id, "e-20261104-ffffff"]], [[labelOf(1), labelOf(3)], [a.record.id, idOf(3)]]]) {
      const r = await both(t, { words, ids });
      assert.deepEqual([r.said.code, r.run.code], [1, 1], words.join(" | "));
      assert.equal(`${r.why}.`, r.said.said[0], words.join(" | "));
      assert.equal(r.why, `Those aren't the talking parts of "${TITLE}". They are: ${labelOf(1)}, ${labelOf(2)}`);
    }
    assert.ok(b);
    t.done();
  });
});

describe("the join run, with one talking part (PR H5b)", () => {
  it("makes the plan its video: the part's video and its light import's files are cloned in under their own names, and the record is written last as the video", async () => {
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const plan = planOf(t);
    const r = await joinRun(t, [one.record.id]);
    assert.equal(r.code, 0, r.text);
    // The plan's folder holds its package, the part's video and its light import's files, and the records: the plan's, and the video's.
    assert.deepEqual(listAll(folder), ["Take 1.cut-plan.json", "Take 1.cut-plan.txt", "Take 1.mov", ...LIGHT_NAMES("Take 1").filter((n) => !n.includes("cut-plan")), "record/0001.json", "record/0002.json", "record/0003.json", "shot list.md", "teleprompter.txt", "video guide.md"].sort());
    for (const rel of ["Take 1.mov", ...LIGHT_NAMES("Take 1")]) assert.equal(readFileSync(join(folder, rel), "utf8"), readFileSync(join(one.folder, rel), "utf8"), rel);
    const now = readEpisode(folder).record;
    assert.deepEqual([now.rev, now.version, now.kind, now.id, now.name], [3, 5, "raw", plan.id, plan.name]);
    assert.equal(episodeFault(now), "");
    assert.deepEqual([isPlannedRecord(now), isFromPlan(now), layoutOf(now)], [false, true, 5]);
    assert.deepEqual(now.video, { file: "Take 1.mov", bytes: 7, seconds: 120, recorded: "2026-10-20", recordedFrom: "import" });
    assert.deepEqual(now.files, { ...plan.files, "Take 1.mov": 7, ...Object.fromEntries(LIGHT_NAMES("Take 1").map((n) => [n, statSync(join(folder, n)).size])) });
    assert.equal(now.fingerprint, "fp1");
    assert.deepEqual(now.answer, { state: "answered", guess: null, seen: "wide, 1:00, no retakes", came: "camera", by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" });
    // The plan is kept as it was but for when it was filmed, and of which parts.
    assert.deepEqual(now.planned, { ...plan.planned, filmed: { at: atOf(t), parts: [one.record.id] } });
    assert.deepEqual([now.editing, now.archived, now.finished, now.reading], [null, null, null, undefined]);
    t.done();
  });
  it("calls it an iPhone clip when the part is upright or short, by today's rule", async () => {
    const upright = probed({ picture: { width: 1080, height: 1920, r_frame_rate: "30/1", avg_frame_rate: "30/1", codec_name: "h264", pix_fmt: "yuv420p" }, sound: { codec_name: "aac", sample_rate: "48000", channels: 2 }, duration: "300.000000" });
    for (const [what, printed] of [["upright", upright], ["short", WIDE({ duration: "40.000000" })]]) {
      const t = world({ probes: { "Take 1.mov": printed } });
      await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      assert.equal((await joinRun(t, [one.record.id])).code, 0, what);
      assert.equal(planOf(t).kind, "short video", what);
      t.done();
    }
  });
  it("keeps the late check on this Mac, for the video and the files put in, under a name that is not the part's own and a drop file that is nobody's", async () => {
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    await joinRun(t, [one.record.id]);
    const [pending] = readPendings(t.home);
    const now = planOf(t);
    assert.deepEqual([pending.id, pending.name, pending.folder, pending.machine, pending.root, pending.video, pending.bytes, pending.seconds, pending.label], [now.id, FOLDER_NAME(t), folder, "Mac Studio", t.root, "Take 1.mov", 7, 120, TITLE]);
    // The late check takes the "drop" file away once it has passed: it must never be a part's own video, which stays in its own episode.
    assert.ok(!pending.drop.startsWith(one.folder) && !pending.drop.startsWith(t.root), pending.drop);
    assert.deepEqual(pending.entries.map((e) => e.to.slice(folder.length + 1)).sort(), ["Take 1.mov", ...LIGHT_NAMES("Take 1"), "record/0003.json"].sort());
    assert.equal(pending.planTxt, "Take 1.cut-plan.txt");
    t.done();
  });
  it("starts Claude's reading of the video as it stands, asks for the working copy, asks the launch agent to make the late check, and posts its notice", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    t.started.length = 0;
    await joinRun(t, [one.record.id]);
    const rev = planOf(t).rev;
    const starts = t.started.map(([, args]) => args.slice(1));
    assert.deepEqual(starts, [["read", "--now", FOLDER_NAME(t), "--kind", "raw", "--rev", String(rev)], ["workcopy", "--now", FOLDER_NAME(t)]]);
    assert.deepEqual(t.notices, [READY]);
    assert.deepEqual(t.kicks, ["kickstart"]);
    t.done();
  });
  describe("says when the video opens in HyperFrames (plan R1a)", () => {
    const near = (ms) => clockAt(Math.round(ms / 60000) * 60000);
    const READY_AT = (at) => `Ready: "${TITLE}" is made from its footage. It opens in HyperFrames about ${at}. In Claude, say "what's next?"`;
    it("names the clock time the copy will be ready when this Mac has measured a speed, and the copy starts from the file the join put in from: with no wait for the check", async () => {
      const t = world({ probes: longTalk("Take 1") });
      await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      // 0.1 seconds of work for each second of the video's 120: 12 seconds.
      addRates(progressFolder(t.home), { [COPY_STEP]: 0.1 });
      await joinRun(t, [one.record.id]);
      assert.deepEqual(t.notices, [READY_AT(near(t.now() + 12 * 1000))]);
      t.done();
    });
    it("counts the wait for the late check in that time when the copy cannot start from a local file", async () => {
      const t = world({ probes: longTalk("Take 1") });
      await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      addRates(progressFolder(t.home), { [COPY_STEP]: 0.1 });
      // The part's file is not whole on this Mac once the join has been made, so the copy has to wait for the check, which is due 15 minutes after the join's copy.
      let after = false;
      const start = (...args) => {
        after = true;
        return t.ctx.deps.start(...args);
      };
      const isWhole = (path) => !(after && path.startsWith(one.folder));
      await joinRun(t, [one.record.id], { start, isWhole });
      const [pending] = readPendings(t.home);
      assert.deepEqual(t.notices, [READY_AT(near(pending.lastCopy + 15 * 60 * 1000 + 12 * 1000))]);
      t.done();
    });
    it("says what it always said when no speed is known, when the copy is not asked for, and of a plan made from its voice", async () => {
      const t = world({ probes: longTalk("Take 1") });
      await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      await joinRun(t, [one.record.id]);
      assert.deepEqual(t.notices, [READY]);
      t.done();
      const u = world({ probes: longTalk("Take 1") });
      await planned(u);
      const two = part(u, 1, { words: SCRIPT[0].split(" ") });
      addRates(progressFolder(u.home), { [COPY_STEP]: 0.1 });
      await on(depsOf(u), "join", "--now", FOLDER_NAME(u), "--parts", two.record.id);
      assert.deepEqual(u.notices, [READY], "a Mac not set up for HyperFrames makes no copy, so it opens nowhere");
      u.done();
    });
    it("keeps the line about the check of the copies in the result's made text, with no title in it", async () => {
      const t = world({ probes: longTalk("Take 1") });
      await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      const r = await joinRun(t, [one.record.id]);
      assert.ok(r.text.includes(`${TITLE}: copied into Dropbox. Dropbox's check of its copies is made in 15 minutes.`), r.text);
      assert.deepEqual(resultOf(t).made, ["the video from its footage", "copied into Dropbox, and Dropbox's check of its copies is made in 15 minutes"]);
      assert.ok(!resultOf(t).made.join(" ").includes(TITLE));
      t.done();
    });
  });
  it("asks for no working copy on a Mac not set up for HyperFrames, and no reading while this Mac's readings are off", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    t.started.length = 0;
    await on(depsOf(t), "join", "--now", FOLDER_NAME(t), "--parts", one.record.id);
    assert.deepEqual(t.started.map(([, args]) => args[1]), ["read"]);
    t.done();
    const u = world({ probes: longTalk("Take 1") });
    await planned(u);
    const two = part(u, 1, { words: SCRIPT[0].split(" ") });
    u.started.length = 0;
    await on(depsOf(u, { settings: { ...u.ctx.settings, app: "hyperframes", readings: false } }), "join", "--now", FOLDER_NAME(u), "--parts", two.record.id);
    assert.deepEqual(u.started, []);
    assert.equal(planOf(u).kind, "raw", "the video is made all the same");
    u.done();
  });
  it("leaves a result that says it made it, and holds no lock", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    await joinRun(t, [one.record.id]);
    const result = resultOf(t);
    assert.deepEqual([result.ok, result.failed, result.command], [true, [], "join"]);
    assert.equal(existsSync(join(episodeWork(t.home, FOLDER_NAME(t)), "episode.lock")), false);
    t.done();
  });
  it("is then a video of its own: a second `plan … join` says it is made already", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    await joinRun(t, [one.record.id]);
    assert.deepEqual((await on(depsOf(t), "plan", TITLE, "join")).said, [`"${TITLE}" is made from its footage already.`]);
    t.done();
  });
});

describe("the join run, with several talking parts (PR H5b)", () => {
  it("joins their videos by copying, in the order she gave, into <title>.mov in the run's own folder, and takes that in with the light import's steps", async () => {
    const t = world({ probes: { "Take 1.mov": WIDE(), "Take 2.mov": WIDE(), "Take 3.mov": WIDE() }, joined: "180.000000" });
    const folder = await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    const c = part(t, 3, { words: SCRIPT[2].split(" ") });
    const told = [];
    const progress = { begin: (n) => told.push(["begin", n]), length: () => {}, steps: (n) => told.push(["steps", n]), step: (n) => told.push(["step", n]), fraction: () => {}, encoding: () => ({ args: [], stop: () => {} }), end: (f) => told.push(["end", f]) };
    const r = await joinRun(t, [c.record.id, a.record.id, b.record.id], { progress });
    assert.equal(r.code, 0, r.text);
    // ffmpeg was asked once to join, by copying, the three videos in her order.
    const joinCalls = t.joins.filter((c) => c.cmd === "FFMPEG" && c.args.includes("concat"));
    assert.equal(joinCalls.length, 1);
    const args = joinCalls[0].args;
    assert.equal(args[args.length - 1].split("/").pop(), "Too many SKUs.mov");
    assert.ok(args[args.length - 1].startsWith(`${t.home}/BRIMM Video Work/.runs/join-`), args[args.length - 1]);
    assert.equal(args[args.indexOf("-c") + 1], "copy");
    // The joined video is the plan's video, with the words of the joined file, read by the light import's steps.
    for (const ending of ["mov", "srt", "transcript.txt", "words.json", "cut-plan.json", "cut-plan.txt", "rough-cut.srt", "rough-cut.transcript.txt"]) assert.ok(existsSync(join(folder, `Too many SKUs.${ending}`)), ending);
    assert.equal(readFileSync(join(folder, "Too many SKUs.mov"), "utf8"), "the joined video");
    for (const rel of ["Take 1.mov", "Take 2.mov", "Take 3.mov"]) assert.ok(!existsSync(join(folder, rel)), `${rel} stays in its own episode`);
    const now = readEpisode(folder).record;
    assert.deepEqual([now.kind, now.video.file, now.rev], ["raw", "Too many SKUs.mov", 3]);
    assert.deepEqual(now.planned.filmed, { at: atOf(t), parts: [c.record.id, a.record.id, b.record.id] });
    assert.equal(now.answer.came, "camera");
    assert.equal(now.answer.state, "answered");
    assert.equal(episodeFault(now), "");
    // The light import's steps, and nothing of an import's notice: the run posts its own.
    assert.deepEqual(told.filter(([what]) => what === "step").map(([, name]) => name), ["Joining the parts", "Reading the sound", "Writing the transcript", "Making the cut plan", "Filing"]);
    assert.deepEqual(t.notices, [READY]);
    t.done();
  });
  it("writes the list of the parts' videos for ffmpeg in her order, with an apostrophe in a path written as ffmpeg reads it", async () => {
    const t = world({ probes: {} });
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" "), stem: "Sallie's take" });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    let list = "";
    const guarded = t.ctx.deps.runGuarded;
    const seeing = async (cmd, args, limits) => {
      if (cmd === "FFMPEG" && args.includes("concat")) list = readFileSync(args[args.indexOf("-i") + 1], "utf8");
      return guarded(cmd, args, limits);
    };
    await joinRun(t, [b.record.id, a.record.id], { runGuarded: seeing });
    assert.equal(list, `ffconcat version 1.0\nfile '${b.folder}/Take 2.mov'\nfile '${a.folder}/Sallie'\\''s take.mov'\n`);
    t.done();
  });
  it("refuses parts of different settings, in the words of the first that differs, and leaves the plan, its folder and Dropbox as they were", async () => {
    const t = world({ probes: { "Take 2.mov": WIDE({ picture: { width: 3840, height: 2160 } }) } });
    const folder = await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    const before = snapshot(t);
    const r = await joinRun(t, [a.record.id, b.record.id]);
    assert.equal(r.code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("talking part 2 is 3840 by 2160, and talking part 1 is 1920 by 1080")]);
    assert.equal(resultOf(t).ok, false);
    assert.deepEqual(snapshot(t), { ...before, [`home/BRIMM Video Work/${FOLDER_NAME(t)}/join.result.json`]: snapshot(t)[`home/BRIMM Video Work/${FOLDER_NAME(t)}/join.result.json`] });
    assert.equal(planOf(t).kind, null);
    assert.deepEqual([t.joins.filter((c) => c.cmd === "FFMPEG").length, readPendings(t.home), t.notices], [0, [], []]);
    assert.equal(readdirSync(join(t.home, "BRIMM Video Work", ".runs")).filter((n) => n.startsWith("join-")).length, 0, "the run's own folder is gone");
    assert.ok(existsSync(folder));
    t.done();
  });
  it("says another rate, picture or sound in the words of the difference", async () => {
    for (const [probe, why] of [
      [WIDE({ picture: { r_frame_rate: "60/1", avg_frame_rate: "60/1" } }), "talking part 2 was filmed at 60 pictures a second, and talking part 1 at 30"],
      [WIDE({ picture: { codec_name: "hevc" } }), "talking part 2 has its picture in another form"],
      [WIDE({ sound: { codec_name: "mp3" } }), "talking part 2 has its sound in another form"]
    ]) {
      const t = world({ probes: { "Take 2.mov": probe } });
      await planned(t);
      const a = part(t, 1, { words: SCRIPT[0].split(" ") });
      const b = part(t, 2, { words: SCRIPT[1].split(" ") });
      await joinRun(t, [a.record.id, b.record.id]);
      assert.deepEqual(resultOf(t).failed, [COULD_NOT(why)], why);
      t.done();
    }
  });
  it("says ffmpeg's last line when it cannot join them, and leaves the plan as it was", async () => {
    const t = world({ concat: "fail" });
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    const before = planOf(t);
    const r = await joinRun(t, [a.record.id, b.record.id]);
    assert.equal(r.code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("Invalid data found when processing input")]);
    assert.deepEqual([planOf(t), readPendings(t.home), t.started.length, t.notices], [before, [], 0, []]);
    t.done();
  });
});

describe("the join run, the kind of the video several parts make (PR H5b)", () => {
  it("files a joined video that is short as an iPhone clip, and one that is long as a raw video, by today's rule, and starts the reading as that kind", async () => {
    for (const [what, probes, joinedSeconds, kind] of [
      ["short by its length", { "Take 1.mov": WIDE({ duration: "30.000000" }), "Take 2.mov": WIDE({ duration: "30.000000" }) }, "60.000000", "short video"],
      ["long", { "Take 1.mov": WIDE({ duration: "100.000000" }), "Take 2.mov": WIDE({ duration: "100.000000" }) }, "200.000000", "raw"]
    ]) {
      const t = world({ probes, joined: joinedSeconds });
      const folder = await planned(t);
      const a = part(t, 1, { words: SCRIPT[0].split(" ") });
      const b = part(t, 2, { words: SCRIPT[1].split(" ") });
      t.started.length = 0;
      const r = await joinRun(t, [b.record.id, a.record.id]);
      assert.equal(r.code, 0, `${what}: ${r.text}`);
      const now = readEpisode(folder).record;
      assert.deepEqual([now.kind, now.video.file, now.video.seconds, isFromPlan(now), episodeFault(now)], [kind, "Too many SKUs.mov", Number(joinedSeconds), true, ""], what);
      assert.deepEqual(now.planned.filmed.parts, [b.record.id, a.record.id], what);
      assert.deepEqual(t.started.map(([, args]) => args.slice(1))[0], ["read", "--now", FOLDER_NAME(t), "--kind", kind, "--rev", String(now.rev)], what);
      t.done();
    }
  });
  it("files a joined video that is upright as an iPhone clip, however long it is", async () => {
    const upright = { picture: { width: 1080, height: 1920 } };
    const t = world({ probes: { "Take 1.mov": WIDE(upright), "Take 2.mov": WIDE(upright), "Too many SKUs.mov": WIDE({ ...upright, duration: "300.000000" }) } });
    const folder = await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    assert.equal((await joinRun(t, [a.record.id, b.record.id])).code, 0);
    assert.deepEqual([readEpisode(folder).record.kind, readEpisode(folder).record.video.seconds], ["short video", 300]);
    t.done();
  });
});

describe("the join run, a talking part with no sound (PR H5b, ruling 5: a video with no sound takes no kind)", () => {
  const NO_SOUND = (n) => `${labelOf(n)} has no sound, so it can't be a talking part`;
  /** A talk with a picture and a sound this Mac's ffmpeg has no decoder for, an iPhone's APAC alone. */
  const APAC = (duration = "120.000000") => WIDE({ sound: { codec_name: "apple_apac" }, duration });
  /** The folder of the run's own result, the one file a run that stopped leaves. */
  const resultFile = (t) => `home/BRIMM Video Work/${FOLDER_NAME(t)}/join.result.json`;
  it("stops one that is alone, in words, before anything is filed, and leaves the plan, its folder and Dropbox as they were", async () => {
    for (const [what, probe] of [["no sound at all", silentOf("120.000000")], ["only a sound this Mac cannot read", APAC()]]) {
      const t = world({ probes: { "Take 1.mov": probe } });
      await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      const before = snapshot(t);
      const r = await joinRun(t, [one.record.id]);
      assert.equal(r.code, 1, `${what}: ${r.text}`);
      assert.deepEqual(resultOf(t).failed, [COULD_NOT(NO_SOUND(1))], what);
      assert.equal(COULD_NOT(NO_SOUND(1)), `The footage of "${TITLE}" couldn't be made into one video: ${labelOf(1)} has no sound, so it can't be a talking part.`);
      assert.deepEqual(snapshot(t), { ...before, [resultFile(t)]: snapshot(t)[resultFile(t)] }, `${what}: nothing is written but its result`);
      assert.deepEqual([planOf(t).kind, isPlannedRecord(planOf(t)), readPendings(t.home), t.started, t.notices, t.kicks], [null, true, [], [], [], []], what);
      assert.equal(readdirSync(join(t.home, "BRIMM Video Work", ".runs")).filter((n) => n.startsWith("join-")).length, 0, `${what}: the run's own folder is gone`);
      t.done();
    }
  });
  it("stops one among several in the words of the checks the parts are held to, and joins nothing", async () => {
    const mute = silentOf("60.000000");
    for (const [what, probes, why] of [
      ["the second has no sound", { "Take 2.mov": mute }, "talking part 2 has its sound in another form"],
      ["the first has no sound", { "Take 1.mov": mute }, "talking part 2 has its sound in another form"],
      ["none has any", { "Take 1.mov": mute, "Take 2.mov": mute }, "talking part 1 has no picture or no sound this Mac can read, so the parts cannot be joined"],
      ["none has a sound this Mac can read", { "Take 1.mov": APAC("60.000000"), "Take 2.mov": APAC("60.000000") }, "talking part 1 has no picture or no sound this Mac can read, so the parts cannot be joined"]
    ]) {
      const t = world({ probes });
      await planned(t);
      const a = part(t, 1, { words: SCRIPT[0].split(" ") });
      const b = part(t, 2, { words: SCRIPT[1].split(" ") });
      const before = planOf(t);
      assert.equal((await joinRun(t, [a.record.id, b.record.id])).code, 1, what);
      assert.deepEqual(resultOf(t).failed, [COULD_NOT(why)], what);
      assert.deepEqual([planOf(t), t.joins.filter((c) => c.cmd === "FFMPEG").length, readPendings(t.home)], [before, 0, []], what);
      t.done();
    }
  });
  it("fails a joined file with no sound in the light import's steps, writing nothing into the plan and never asking for its record", async () => {
    const t = world({ probes: { "Too many SKUs.mov": silentOf("120.000000") } });
    const folder = await planned(t);
    const plan = planOf(t);
    const work = join(t.home, "BRIMM Video Work", ".runs", "join-by-hand");
    mkdirSync(work, { recursive: true });
    const file = join(work, "Too many SKUs.mov");
    writeFileSync(file, "the joined video, with no sound");
    const before = listAll(join(t.root, "Episodes"));
    let asked = 0;
    const into = { folder, record: plan, change: () => { asked += 1; return plan; } };
    const deps = { run: t.ctx.deps.run, tools: t.ctx.deps.tools, log: () => {}, now: () => new Date(t.now()), clock: t.now, wait: t.ctx.deps.wait, isWhole: () => true, clone: t.ctx.deps.clone, sameDisk: () => true, commit: "c709b57", episode: { root: t.root, machine: "Mac Studio", checkout: "/checkout", home: t.home }, work, shown: TITLE };
    const done = await importInto(file, into, deps);
    assert.deepEqual([done.ok, done.filed, done.message], [false, undefined, "there is no sound in the file"]);
    assert.equal(asked, 0);
    assert.deepEqual([listAll(join(t.root, "Episodes")), readEpisode(folder).record.rev, readPendings(t.home), t.notices, existsSync(work)], [before, plan.rev, [], [], false]);
    t.done();
  });
  it("is refused by the filing itself, whoever asks: a record with a kind and a video with no sound is never written into a plan, and what was put in is taken out again", async () => {
    const t = world();
    const folder = await planned(t);
    const plan = planOf(t);
    const work = join(t.home, "BRIMM Video Work", ".runs", "filing-by-hand");
    mkdirSync(work, { recursive: true });
    const file = join(work, "Take 1.mov");
    writeFileSync(file, "a talk");
    const before = listAll(folder);
    const into = {
      folder, record: plan,
      change: (first) => ({
        ...plan, kind: first.kind, video: first.video, files: { ...plan.files, ...first.files },
        answer: { state: "answered", guess: null, seen: "wide, 1:00", came: "camera", by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" }, planned: { ...plan.planned, filmed: { at: atOf(t), parts: [] } }
      })
    };
    const deps = { episode: { root: t.root, machine: "Mac Studio", checkout: "/checkout", home: t.home }, clone: t.ctx.deps.clone, sameDisk: () => true, commit: "c709b57" };
    const filing = (facts, printed, kind) => fileEpisode({ file, made: [], at: (to) => to, fcpxml: "", facts, printed, kind, read: null, reels: [], work, fingerprint: "", into }, deps);
    const SILENT_FACTS = { duration: 60, width: 1920, height: 1080, fps: "30/1", sound: false };
    for (const kind of ["raw", "short video"]) {
      assert.throws(() => filing(SILENT_FACTS, silentOf("60.000000"), kind), /^Error: a video with no sound takes no kind, so it is not filed as one$/, kind);
      assert.deepEqual([listAll(folder), readEpisode(folder).record.rev], [before, plan.rev], `${kind}: the episode is as it was`);
    }
    // A video with sound is filed by the same call, and a video with no sound is filed with no kind, as the light import files one it finds.
    const filed = filing({ ...SILENT_FACTS, sound: true }, WIDE(), "raw");
    assert.deepEqual([filed.record.kind, filed.record.video.file, filed.record.rev, episodeFault(filed.record)], ["raw", "Take 1.mov", plan.rev + 1, ""]);
    t.done();
  });
  it("leaves a silent b-roll or screen part what it was after the join, a part with no kind, and `kind` gives it none", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const talk = part(t, 1, { words: SCRIPT[0].split(" ") });
    const parts = [part(t, 2, { as: "b-roll", shot: 2 }), part(t, 3, { as: "screen", shot: 4 })];
    const was = parts.map((p) => [readFileSync(recordFile(p.folder, 2), "utf8"), listAll(p.folder)]);
    assert.equal((await joinRun(t, [talk.record.id])).code, 0);
    parts.forEach((p, i) => {
      const now = readEpisode(p.folder).record;
      assert.deepEqual([now.kind, now.video.sound, isPart(now), now.rev], [null, false, true, 2], labelOf(i + 2));
      assert.deepEqual([readFileSync(recordFile(p.folder, 2), "utf8"), listAll(p.folder)], was[i], `${labelOf(i + 2)} is as it was, file for file`);
    });
    // It is footage for the plan, and stays so: asked to be a kind, it is told to be taken back first, and taken back, that the plan is made.
    for (const [n, kind] of [[2, "raw"], [3, "clip"]]) {
      const asked = await on(depsOf(t), "kind", labelOf(n), kind, "--private", "no");
      assert.deepEqual([asked.code, asked.said], [1, [`${labelOf(n)} is footage for "${TITLE}". Say "that's not footage for ${TITLE}" first.`]], kind);
    }
    assert.deepEqual((await on(depsOf(t), "footage", labelOf(2), "none")).said, [`"${TITLE}" is made from its footage already: ask Jason.`]);
    assert.deepEqual(parts.map((p) => readEpisode(p.folder).record.kind), [null, null]);
    t.done();
  });
});

describe("the join run, what stops it (PR H5b)", () => {
  /** Run the plan's join with `hook` called the first time ffprobe is asked, so that something changes while the run works. */
  async function meanwhile(t, ids, hook) {
    const run = t.ctx.deps.run;
    let done = false;
    return joinRun(t, ids, {
      run: async (cmd, args, asked) => {
        if (cmd === "FFPROBE" && !done) {
          done = true;
          hook();
        }
        return run(cmd, args, asked);
      }
    });
  }
  /** The plan's folder holds what a plan's folder holds and nothing of a video: none of the files a join cloned in, and no pending late check. */
  const asPlanned = (t, folder, rev) => {
    assert.deepEqual(listAll(folder).filter((rel) => !rel.startsWith("record/")), ["shot list.md", "teleprompter.txt", "video guide.md"]);
    assert.deepEqual([readEpisode(folder).record.rev, readPendings(t.home), t.notices, t.started], [rev, [], [], []]);
  };
  it("leaves the plan as it was when a record is written to it meanwhile, and takes away the files it had put in (the rev it was read at)", async () => {
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const plan = planOf(t);
    const r = await meanwhile(t, [one.record.id], () => writeEpisode(folder, { ...plan, name: { text: "A better name", placeholder: false } }, { expectRev: plan.rev, writeText: (to, text) => writeFileSync(to, text), writer: plan.writer, home: t.home }));
    assert.equal(r.code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("this episode changed on the other Mac: open it again")]);
    asPlanned(t, folder, plan.rev + 1);
    assert.equal(planOf(t).name.text, "A better name", "what was written meanwhile is not written over");
    assert.equal(planOf(t).kind, null);
    t.done();
  });
  it("leaves the plan as it was when a talking part was taken back, or answered as something else, while the run worked", async () => {
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const plan = planOf(t);
    const r = await meanwhile(t, [one.record.id], () => {
      const { partOf, ...rest } = one.record;
      writeEpisode(one.folder, { ...rest, answer: { ...one.record.answer, state: "needs your answer" } }, { expectRev: one.record.rev, writeText: (to, text) => writeFileSync(to, text), writer: one.record.writer, home: t.home });
    });
    assert.equal(r.code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("a talking part changed while the footage was joined")]);
    asPlanned(t, folder, plan.rev);
    t.done();
  });
  it("leaves the plan as it was when another talking part was answered while the run worked: the join takes the parts it was told", async () => {
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const plan = planOf(t);
    const r = await meanwhile(t, [one.record.id], () => part(t, 2, { words: SCRIPT[1].split(" ") }));
    assert.equal(r.code, 1);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("a talking part changed while the footage was joined")]);
    asPlanned(t, folder, plan.rev);
    t.done();
  });
  it("leaves the plan as it was when a talking part's episode got a conflicted copy while the run worked (ruling 1)", async () => {
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const plan = planOf(t);
    await meanwhile(t, [one.record.id], () => writeFileSync(join(one.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText(one.record)));
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("a talking part changed while the footage was joined")]);
    asPlanned(t, folder, plan.rev);
    t.done();
  });
  it("never writes over a file: one of the names it would put in is there already, and it says which, and puts nothing in", async () => {
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const plan = planOf(t);
    writeFileSync(join(folder, "Take 1.words.json"), "hers");
    const r = await joinRun(t, [one.record.id]);
    assert.equal(r.code, 1);
    // The part's file is named as the gate names a gated video's files wherever it says them: a part is gated, and no result holds a name of its video.
    assert.match(resultOf(t).failed[0], new RegExp(`^The footage of "${TITLE}" couldn't be made into one video: the video\\.words\\.json is in .* already, and a file there is never written over\\.$`));
    assert.equal(readFileSync(join(folder, "Take 1.words.json"), "utf8"), "hers");
    assert.deepEqual(listAll(folder).filter((rel) => !rel.startsWith("record/")), ["Take 1.words.json", "shot list.md", "teleprompter.txt", "video guide.md"]);
    assert.equal(readEpisode(folder).record.rev, plan.rev);
    t.done();
  });
  it("refuses at the run what the command refused: a talking part in conflict or written by a newer BRIMM Video Studio, in the words of the conflict, with its label first", async () => {
    const t = world();
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    writeFileSync(join(one.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText(one.record));
    const before = snapshot(t);
    const r = await joinRun(t, [one.record.id]);
    assert.equal(r.code, 1);
    const [failed] = resultOf(t).failed;
    assert.ok(failed.startsWith(`The footage of "${TITLE}" couldn't be made into one video: ${labelOf(1)} (a11111): Dropbox has kept a conflicted copy in this episode: `), failed);
    assert.ok(failed.endsWith('Say "sort out the conflict".'), failed);
    assert.deepEqual(readPendings(t.home), []);
    rmSync(join(one.folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"));
    writeFileSync(recordFile(one.folder, 3), recordText({ ...one.record, rev: 3, version: 9 }));
    await joinRun(t, [one.record.id]);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT(`${labelOf(1)}: That is an episode a newer BRIMM Video Studio wrote (a11111). Jason has a newer BRIMM Video Studio. Ask him to update this Mac`)]);
    assert.equal(planOf(t).kind, null);
    assert.ok(existsSync(folder) && !existsSync(join(folder, "Take 1.mov")) && Object.keys(before).length > 0);
    t.done();
  });
  it("refuses at the run ids that are not each of the plan's talking parts once, and a plan that is no plan, and writes nothing", async () => {
    const t = world();
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    part(t, 2, { words: SCRIPT[1].split(" ") });
    const before = planOf(t);
    await joinRun(t, [a.record.id]);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT(`Those aren't the talking parts of "${TITLE}". They are: ${labelOf(1)}, ${labelOf(2)}`)]);
    await joinRun(t, [a.record.id, a.record.id]);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT(`Those aren't the talking parts of "${TITLE}". They are: ${labelOf(1)}, ${labelOf(2)}`)]);
    await joinRun(t, [a.record.id, "e-20261104-zzzzzz"]);
    assert.equal(resultOf(t).ok, false);
    assert.deepEqual(planOf(t), before);
    t.done();
    // A plan with no talking part, an explainer and a video made from its footage already are refused at the run too.
    const u = world();
    await planned(u);
    await joinRun(u, ["e-20261104-a11111"]);
    assert.deepEqual(resultOf(u).failed, [COULD_NOT(`"${TITLE}" has no talking part yet: a video needs at least one`)]);
    joined(u);
    await joinRun(u, ["e-20261104-a11111"]);
    assert.deepEqual(resultOf(u).failed, [COULD_NOT(`"${TITLE}" is made from its footage already`)]);
    u.done();
  });
  it("makes a part it cannot read through ffprobe a refusal in words, and leaves nothing", async () => {
    const t = world({ fails: ["Take 1.mov"] });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const plan = planOf(t);
    await joinRun(t, [one.record.id]);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("talking part 1 could not be read as a video")]);
    asPlanned(t, folder, plan.rev);
    t.done();
  });
  it("makes no part a refusal while Dropbox is still bringing its video over, and reads it through first when it is not here", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const asked = [];
    let here = false;
    const r = await joinRun(t, [one.record.id], { isWhole: () => here, readAll: async (path) => { asked.push(path.split("/").pop()); here = true; } });
    assert.equal(r.code, 0, r.text);
    assert.equal(asked[0], "Take 1.mov");
    t.done();
    const u = world({ probes: longTalk("Take 1") });
    await planned(u);
    const two = part(u, 1, { words: SCRIPT[0].split(" ") });
    await joinRun(u, [two.record.id], { isWhole: () => false, readAll: async () => {} });
    assert.deepEqual(resultOf(u).failed, [COULD_NOT(`Dropbox is still bringing ${labelOf(1)} over to this Mac`)]);
    await joinRun(u, [two.record.id], { isWhole: () => false, readAll: async () => { throw new Error("Dropbox sent nothing of it for 2 minutes, so it was given up"); } });
    assert.deepEqual(resultOf(u).failed, [COULD_NOT(`${labelOf(1)} could not be read from Dropbox (Dropbox sent nothing of it for 2 minutes, so it was given up)`)]);
    u.done();
  });
});

describe("a failed join says nothing of its parts' names (PR H5b: a part is gated, so no result holds a name of its video)", () => {
  /** What a part's names are, as the gate takes them out: its video's file, that without its ending, and the folder of its episode. */
  const namesOf = (one) => [one.record.video.file, basename(one.record.video.file, ".mov"), basename(one.folder)];
  const light = (t) => depsOf(t, { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 }, alive: (pid) => pid === process.pid });
  /** Every place a failed run's words reach her: the result file as it is written, what `status` says of the plan, and the lines the run said. */
  async function whatSheCanRead(t, run) {
    const file = readFileSync(join(episodeWork(t.home, FOLDER_NAME(t)), "join.result.json"), "utf8");
    const status = (await on(light(t), "status")).said.join("\n");
    return { file, status, said: run.text };
  }
  const holdsNone = (readable, parts, what) => {
    for (const [where, text] of Object.entries(readable)) for (const one of parts) for (const name of namesOf(one)) assert.ok(!text.includes(name), `${what}: ${JSON.stringify(name)} is in ${where}:\n${text}`);
  };
  it("takes out of the result, and of what status says of it, the name of a part's file that the filing names when it will not write over a file", async () => {
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    writeFileSync(join(folder, "Take 1.words.json"), "hers");
    const r = await joinRun(t, [one.record.id]);
    assert.equal(r.code, 1);
    const readable = await whatSheCanRead(t, r);
    holdsNone(readable, [one], "never over a file");
    // It is still a reason she can act on: the file is named as the gate names a video's files, and what is wrong is said.
    assert.match(readResult(t.home, FOLDER_NAME(t), "join").failed[0], /^The footage of "Too many SKUs" couldn't be made into one video: the video\.words\.json is in .* already, and a file there is never written over\.$/);
    assert.match(readable.status, /Not done: The footage of "Too many SKUs" couldn't be made into one video: the video\.words\.json is in /);
    t.done();
  });
  it("takes it out of ffmpeg's last line, which names the file it could not open", async () => {
    const t = world({ concat: "names" });
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    const r = await joinRun(t, [a.record.id, b.record.id]);
    assert.equal(r.code, 1);
    const readable = await whatSheCanRead(t, r);
    holdsNone(readable, [a, b], "ffmpeg's last line");
    assert.match(readResult(t.home, FOLDER_NAME(t), "join").failed[0], /^The footage of "Too many SKUs" couldn't be made into one video: \[concat @ 0x1\] Impossible to open /);
    t.done();
  });
  it("takes it out of the last words of the program that reads a part through from Dropbox, and keeps the part's label, which names it for her", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const gone = join(one.folder, "Take 1.mov");
    const r = await joinRun(t, [one.record.id], { isWhole: () => false, readAll: async () => { throw new Error(`cat: ${gone}: Resource deadlock avoided`); } });
    assert.equal(r.code, 1);
    const readable = await whatSheCanRead(t, r);
    holdsNone(readable, [one], "readThrough");
    const [failed] = readResult(t.home, FOLDER_NAME(t), "join").failed;
    assert.ok(failed.startsWith(`The footage of "${TITLE}" couldn't be made into one video: ${labelOf(1)} could not be read from Dropbox (cat: `), failed);
    assert.ok(failed.endsWith(": Resource deadlock avoided)."), failed);
    assert.ok(readable.status.includes(labelOf(1)), "the part is named by its label in what status says");
    t.done();
  });
  it("leaves a result that holds no name of a part just as it was: the words of a plan's own are not touched", async () => {
    const t = world({ probes: { "Take 2.mov": WIDE({ picture: { width: 3840, height: 2160 } }) } });
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    await joinRun(t, [a.record.id, b.record.id]);
    assert.deepEqual(resultOf(t).failed, [COULD_NOT("talking part 2 is 3840 by 2160, and talking part 1 is 1920 by 1080")]);
    t.done();
  });
});

describe("workcopy's result, for a video made from a plan, holds no name of a part's file either (PR H5b)", () => {
  it("says only its own fixed reasons when a footage copy cannot be made, whatever the programs and Dropbox said of the part's file", async () => {
    const t = world({ probes: longTalk("Take 1"), copy: "120.000000" });
    await planned(t);
    const talk = part(t, 1, { words: SCRIPT[0].split(" ") });
    const broll = part(t, 2, { as: "b-roll", shot: 2 });
    const screen = part(t, 3, { as: "screen", shot: 4 });
    assert.equal((await joinRun(t, [talk.record.id])).code, 0);
    const { finishLate } = await import("../filing.js");
    const [pending] = readPendings(t.home);
    assert.deepEqual(finishLate(pending, { episode: { root: t.root, machine: "Mac Studio", home: t.home }, log: () => {}, notify: () => {}, clone: t.ctx.deps.clone, sameDisk: () => true }).problems, []);
    // The b-roll's video is not here, and Dropbox's last words name it; ffmpeg fails on the screen recording and its last line names that.
    const guarded = t.ctx.deps.runGuarded;
    const failing = async (cmd, args, limits) => (args.some((a) => String(a).endsWith("Take 3.mov")) ? { code: 1, signal: null, stderr: `Error opening input ${args.find((a) => String(a).endsWith("Take 3.mov"))}: Invalid data\n`, overMemory: false, outOfTime: false, peak: 0, stopped: "" } : guarded(cmd, args, limits));
    const here = (path) => !path.startsWith(broll.folder);
    const read = async (path) => { throw new Error(`cat: ${path}: Resource deadlock avoided`); };
    const r = await on(appDeps(t, { runGuarded: failing, isWhole: here, readAll: read }), "workcopy", "--now", FOLDER_NAME(t), "--footage");
    assert.equal(r.code, 1, r.text);
    const result = readResult(t.home, FOLDER_NAME(t), "workcopy");
    assert.deepEqual(result.failed, [`The footage for shot 2 could not be made: Dropbox is still bringing ${TITLE}, b-roll for shot 2 over to this Mac.`, "The footage for shot 4 could not be made: it could not be converted."]);
    const file = readFileSync(join(episodeWork(t.home, FOLDER_NAME(t)), "workcopy.result.json"), "utf8");
    const status = (await on(depsOf(t, { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 } }), "status")).said.join("\n");
    for (const one of [broll, screen]) for (const name of [one.record.video.file, basename(one.record.video.file, ".mov"), basename(one.folder)]) {
      assert.ok(!file.includes(name) && !status.includes(name), `${JSON.stringify(name)} is in what she can read`);
    }
    t.done();
  });
});

describe("after the join, footage still comes (PR H5b)", () => {
  /** A video dropped and waiting for her answer, as the light import files it, with a picture and no sound unless it has some. */
  function waiting(t, n, { sound = false } = {}) {
    const name = `2026-11-04 Drop ${n} (Mac Studio)`;
    const folder = join(t.root, "Episodes", name);
    mkdirSync(join(folder, "record"), { recursive: true });
    const made = newEpisode({
      id: idOf(n), machine: "Mac Studio", at: "2026-11-04T09:00:00-05:00", video: { file: `Drop ${n}.mov`, bytes: 5, seconds: 8, created: null, ...(sound ? {} : { sound: false }) }, kind: null, writer: { commit: "c709b57", on: "Mac Studio" },
      label: labelOf(n), answer: { state: "needs your answer", guess: null, seen: sound ? "upright, 0:08, no retakes" : "upright, 0:08, no sound", came: "phone", match: null }
    });
    writeFileSync(recordFile(folder, 1), recordText({ ...made, rev: 1 }));
    return { name, folder };
  }
  it("offers a plan made from its footage on the planned card of a video that waits, as it offers one that waits for its footage", async () => {
    const t = world();
    await planned(t);
    waiting(t, 1);
    joined(t);
    const r = await on(depsOf(t), "episodes");
    const card = r.said.find((line) => line.includes("Planned card:"));
    assert.ok(card && card.includes(`Footage for \\"${TITLE}\\"`), r.text);
    t.done();
  });
  it("takes a screen recording or b-roll for it, and says it in the plan", async () => {
    const t = world();
    await planned(t);
    const one = waiting(t, 1);
    waiting(t, 2);
    joined(t);
    const r = await on(depsOf(t), "footage", labelOf(1), TITLE, "screen", "--client", "no");
    assert.deepEqual([r.code, r.said], [0, [`${labelOf(1)} is footage for "${TITLE}": the screen recording for shot 4. It goes in with no sound. When all its footage is in, say "that's all the footage for ${TITLE}".`]]);
    assert.deepEqual(readEpisode(one.folder).record.partOf, { id: planOf(t).id, as: "screen", shot: 4, client: false });
    const b = await on(depsOf(t), "footage", labelOf(2), TITLE, "b-roll", "--client", "no", "--shot", "5");
    assert.equal(b.code, 0, b.text);
    assert.ok((await on(depsOf(t), "plan", TITLE)).said.includes(`Footage: ${labelOf(1)}, a screen recording for shot 4.`));
    t.done();
  });
  it("refuses a talking part for it, in words, and writes nothing", async () => {
    const t = world();
    await planned(t);
    const one = waiting(t, 1, { sound: true });
    joined(t);
    const before = snapshot(t);
    const r = await on(depsOf(t), "footage", labelOf(1), TITLE, "talking", "--client", "no");
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" is made from its footage already: a talking part can't be added.`]]);
    assert.deepEqual(snapshot(t), before);
    assert.equal(readEpisode(one.folder).record.partOf, undefined);
    t.done();
  });
  it("does not take a part back once the plan is made from its footage: a talking part that was joined, or b-roll added since", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    part(t, 2, { as: "b-roll", shot: 2 });
    joined(t);
    const before = snapshot(t);
    for (const n of [1, 2]) {
      const r = await on(depsOf(t), "footage", labelOf(n), "none");
      assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" is made from its footage already: ask Jason.`]], String(n));
    }
    assert.deepEqual(snapshot(t), before);
    t.done();
  });
  it("offers it no more once its hand-off is written: it takes no more footage", async () => {
    const t = world();
    await planned(t);
    waiting(t, 1);
    const plan = joined(t);
    const handed = readEpisode(folderOf(t)).record;
    writeEpisode(folderOf(t), { ...handed, finished: { revision: 1, at: atOf(t), on: "Mac Studio", handoff: "final/x.json" } }, { expectRev: plan.rev, writeText: (to, text) => writeFileSync(to, text), writer: plan.writer, home: t.home });
    const r = await on(depsOf(t), "footage", labelOf(1), TITLE, "screen", "--client", "no");
    assert.deepEqual([r.code, r.said], [1, [`There's no planned video called "${TITLE}" waiting for its footage.`]]);
    t.done();
  });
});

describe("the join's late check (PR H5b)", () => {
  it("is made by the import's own late check from what the join kept: a file Dropbox lost is put in again, and the part's own video is never taken away", async () => {
    const { finishLate } = await import("../filing.js");
    const t = world({ probes: longTalk("Take 1") });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    await joinRun(t, [one.record.id]);
    const [pending] = readPendings(t.home);
    // Dropbox loses a file of the plan's folder, and the late check puts it in again from the one it was put in from.
    rmSync(join(folder, "Take 1.words.json"));
    const log = [];
    const done = finishLate(pending, { episode: { root: t.root, machine: "Mac Studio", home: t.home }, log: (line) => log.push(line), notify: () => {}, clone: t.ctx.deps.clone, sameDisk: () => true });
    assert.deepEqual([done.ok, done.problems], [true, []]);
    assert.ok(existsSync(join(folder, "Take 1.words.json")));
    assert.ok(existsSync(join(one.folder, "Take 1.mov")), "the part's own video stays in its own episode");
    assert.deepEqual([readPendings(t.home), existsSync(pending.work)], [[], false]);
    t.done();
  });
});

describe("the joined video's copy starts from the local file (plan R1b)", () => {
  it("is made with no wait while the join's late check is still owed: the file the join put in from is read, and the check goes on behind", async () => {
    const t = world({ probes: longTalk("Take 1"), copy: "120.000000" });
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    await joinRun(t, [one.record.id]);
    const [pending] = readPendings(t.home);
    const waits = [];
    const wait = async (ms) => waits.push(ms);
    const r = await on(appDeps(t, { wait }), "workcopy", "--now", FOLDER_NAME(t));
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(waits, []);
    assert.ok(!r.text.includes("once the import has checked"), r.text);
    const raw = statSync(join(folder, "Take 1.mov"));
    const copy = workCopyPaths(t.home, FOLDER_NAME(t), workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
    assert.deepEqual([existsSync(copy.video), existsSync(copy.facts)], [true, true]);
    // The late check is still owed, and the file it checks is as it was.
    assert.deepEqual(readPendings(t.home).map((p) => p.id), [pending.id]);
    t.done();
  });
});

describe("plan … agreed, for a video made from its footage (PR H5b)", () => {
  const TYPED = "Quayle Widgets, 21 October";
  /** `edit.js` with a stand-in for osascript that answers her click on "They agreed". */
  const clicking = (t) => {
    const run = async (cmd, args, opts) => (cmd === "/usr/bin/osascript" ? { code: 0, stdout: `button returned:They agreed, text returned:${TYPED}\n`, stderr: "" } : t.ctx.deps.run(cmd, args, opts));
    return (...argv) => on(depsOf(t, { run }), ...argv);
  };
  it("notes a client's agreement to a part added after the join, as it does for a plan that waits, and writes it in the video's record: the plan stays in it", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    const client = part(t, 2, { as: "b-roll", shot: 2, client: true });
    joined(t);
    const before = planOf(t);
    const r = await clicking(t)("plan", TITLE, "agreed", labelOf(2));
    assert.equal(r.code, 0, r.text);
    assert.ok(r.said.some((line) => line.includes("the client's agreement is noted")), r.text);
    const now = planOf(t);
    assert.deepEqual(now.planned.consent, [{ id: client.record.id, label: labelOf(2), at: dayOf(t) }]);
    assert.deepEqual([now.rev, now.kind, isFromPlan(now), now.video], [before.rev + 1, "raw", true, before.video]);
    // What she typed is in the note on this Mac and nowhere else.
    assert.ok(!JSON.stringify(now).includes("Quayle"));
    assert.ok(!r.text.includes("Quayle"));
    t.done();
  });
  it("says a part that shows no client needs none, and a part of another plan is not footage for it", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    part(t, 2, { as: "b-roll", shot: 2 });
    joined(t);
    assert.deepEqual((await clicking(t)("plan", TITLE, "agreed", labelOf(2))).said, [`${labelOf(2)} shows no client, so no agreement is needed.`]);
    assert.deepEqual((await clicking(t)("plan", TITLE, "agreed", "Nothing like it")).said, [`That video is not footage for "${TITLE}".`]);
    t.done();
  });
});

describe("plan … drop and the plan of a video made from its footage (PR H5b)", () => {
  it("refuses to drop a plan that has footage before the join, naming each piece, and writes nothing (ruling 2)", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    part(t, 2, { as: "b-roll", shot: 2 });
    const before = snapshot(t);
    const r = await on(depsOf(t), "plan", TITLE, "drop");
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" has footage: ${labelOf(1)}, ${labelOf(2)}. To drop it, first say "that's not footage for ${TITLE}" for each.`]]);
    assert.deepEqual(snapshot(t), before);
    // Each piece taken back, it is dropped.
    for (const n of [1, 2]) assert.equal((await on(depsOf(t), "footage", labelOf(n), "none")).code, 0);
    const dropped = await on(depsOf(t), "plan", TITLE, "drop");
    assert.deepEqual([dropped.code, dropped.said], [0, [`The plan for "${TITLE}" is dropped.`]]);
    t.done();
  });
  it("drops a plan that has no footage as it did", async () => {
    const t = world();
    await planned(t);
    assert.deepEqual((await on(depsOf(t), "plan", TITLE, "drop")).said, [`The plan for "${TITLE}" is dropped.`]);
    t.done();
  });
  it("refuses a plan that is a video made from its footage: set and drop say its plan can't be changed, join that it is made already, and nothing is written", async () => {
    const t = world();
    await planned(t);
    joined(t);
    const before = snapshot(t);
    const NO = `"${TITLE}" is made from its footage already: its plan can't be changed.`;
    for (const [words, why] of [[["set", "--line", "One."], NO], [["drop"], NO], [["join"], `"${TITLE}" is made from its footage already.`], [["join", labelOf(1)], `"${TITLE}" is made from its footage already.`]]) {
      const r = await on(depsOf(t), "plan", TITLE, ...words);
      assert.deepEqual([r.code, r.said], [1, [why]], words.join(" "));
    }
    assert.deepEqual([snapshot(t), t.started], [before, []]);
    t.done();
  });
  it("says the plan of a video made from its footage, with a line for each part, as it says a plan", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    part(t, 2, { as: "b-roll", shot: 2 });
    joined(t);
    const r = await on(depsOf(t), "plan", TITLE);
    assert.equal(r.code, 0);
    assert.ok(r.said.includes(`The plan for "${TITLE}":`), r.text);
    assert.ok(r.said.includes(`Footage: ${labelOf(1)}, talking to the camera.`), r.text);
    assert.ok(r.said.includes(`Footage: ${labelOf(2)}, b-roll for shot 2.`), r.text);
    t.done();
  });
  it("refuses a command that is not for a plan with the gate's words, now that a plan is not made from its footage yet", async () => {
    const t = world();
    await planned(t);
    const r = await on(depsOf(t), "open", TITLE);
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}" is a planned video, and it isn't made from its footage yet.`]]);
    const gone = await on(depsOf(t), "leave", TITLE);
    assert.deepEqual(gone.said, [`To drop a plan, say "drop the plan for ${TITLE}".`]);
    t.done();
  });
});

describe("the footage copies, which `workcopy` makes for a video made from a plan (PR H5b)", () => {
  /** The panel's reporter, as a list of what it was told. */
  const panel = () => {
    const events = [];
    return { events, progress: { begin: (n) => events.push(["begin", n]), length: () => {}, steps: (n) => events.push(["steps", n]), step: (n) => events.push(["step", n]), fraction: () => {}, encoding: () => ({ args: [], stop: () => {} }), end: (f) => events.push(["end", f]) } };
  };
  /** A plan that has become its video, with the parts of its footage: by default b-roll for shot 2 (part 2) and a screen recording for shot 4 (part 3). The
      video is a minute long, as its working copy and every part's are. */
  async function made(t, { parts = [[2, "b-roll", 2, false], [3, "screen", 4, false]], plan = {} } = {}) {
    const folder = await planned(t);
    const given = parts.map(([n, as, shot, client]) => part(t, n, { as, shot, client }));
    joined(t, {}, plan);
    writeFileSync(join(folder, "Too many SKUs.mov"), "x".repeat(16));
    return { folder, parts: given };
  }
  const name = (t) => FOLDER_NAME(t);
  /** Where the working copy of the plan's video goes, and where the copy of a part's footage goes. */
  const mainCopy = (t, folder) => {
    const raw = statSync(join(folder, "Too many SKUs.mov"));
    return workCopyPaths(t.home, name(t), workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  };
  const footageCopy = (t, one, shot) => {
    const raw = statSync(join(one.folder, one.record.video.file));
    return footageCopyPaths(t.home, name(t), shot, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
  };
  const copies = (t) => (existsSync(workCopyDir(t.home, name(t))) ? readdirSync(workCopyDir(t.home, name(t))).sort() : []);
  const ffmpegRuns = (t) => t.joins.filter((c) => c.cmd === "FFMPEG");
  const workcopy = (t, ...flags) => on(appDeps(t, t.over), "workcopy", "--now", name(t), ...flags);

  it("makes the plan's working copy, then a copy with no sound of each b-roll and screen part that may go in, named by its shot and its video's key", async () => {
    const t = world({ joined: "60.000000" });
    const { folder, parts } = await made(t);
    const r = await workcopy(t);
    assert.equal(r.code, 0, r.text);
    const main = mainCopy(t, folder);
    const broll = footageCopy(t, parts[0], 2);
    const screen = footageCopy(t, parts[1], 4);
    assert.deepEqual(copies(t), [main.facts, main.video, broll.facts, broll.video, screen.facts, screen.video].map((p) => basename(p)).sort());
    // ffmpeg ran three times: the video, then the b-roll and the screen recording, each of its own part's video and with no sound.
    const runs = ffmpegRuns(t);
    assert.deepEqual(runs.map((c) => c.args[c.args.indexOf("-i") + 1]), [join(folder, "Too many SKUs.mov"), join(parts[0].folder, "Take 2.mov"), join(parts[1].folder, "Take 3.mov")]);
    assert.deepEqual(runs.map((c) => c.args.includes("-an")), [false, true, true]);
    assert.equal(readFileSync(broll.video, "utf8"), "RIFF");
    const result = readResult(t.home, name(t), "workcopy");
    assert.deepEqual([result.ok, result.failed, result.made[0], result.made.slice(-2)], [true, [], "the video for HyperFrames", ["the footage for shot 2", "the footage for shot 4"]]);
    t.done();
  });
  it("tells the panel the video's step, then each footage copy's own, by the plan's name and what the part shows", async () => {
    const t = world({ joined: "60.000000" });
    await made(t);
    const { events, progress } = panel();
    t.over = { progress };
    assert.equal((await workcopy(t)).code, 0);
    const begins = events.filter(([what]) => what === "begin").map(([, n]) => n);
    assert.deepEqual(begins, [TITLE, `${TITLE}, b-roll for shot 2`, `${TITLE}, a screen recording for shot 4`]);
    assert.deepEqual(events.filter(([what]) => what === "steps").map(([, n]) => n), [[WORK_COPY_STEP], [FOOTAGE_STEP], [FOOTAGE_STEP]]);
    t.done();
  });
  it("makes the copies of the footage of a client only once the plan holds that client's agreement for it", async () => {
    const t = world({ joined: "60.000000" });
    const { folder, parts } = await made(t, { parts: [[2, "b-roll", 2, true], [3, "screen", 4, false]] });
    const r = await workcopy(t);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(copies(t).filter((n) => n.startsWith("footage-")), [basename(footageCopy(t, parts[1], 4).facts), basename(footageCopy(t, parts[1], 4).video)].sort());
    assert.ok(r.said.some((line) => line.includes(labelOf(2)) && line.includes("her client has not agreed to it")), r.text);
    // Her click noted the agreement: the next run makes the copy that was left, and the others are made already.
    const plan = readEpisode(folder).record;
    writeEpisode(folder, { ...plan, planned: { ...plan.planned, consent: [{ id: parts[0].record.id, label: labelOf(2), at: "2026-11-04" }] } }, { expectRev: plan.rev, writeText: (to, text) => writeFileSync(to, text), writer: plan.writer, home: t.home });
    const again = await workcopy(t);
    assert.equal(again.code, 0, again.text);
    assert.equal(copies(t).filter((n) => n.startsWith("footage-2-")).length, 2);
    assert.equal(ffmpegRuns(t).length, 3, "the main copy and the screen recording were made already: only the b-roll was made");
    t.done();
  });
  it("makes no copy of a part whose episode holds a conflicted copy or whose record a newer BRIMM Video Studio wrote, though its record in force shows no client, and says so (ruling 1)", async () => {
    const t = world({ joined: "60.000000" });
    const { parts } = await made(t, { parts: [[2, "b-roll", 2, false], [3, "screen", 4, false], [4, "b-roll", 5, false]] });
    // Dropbox kept a conflicted copy of the b-roll's record that says it shows a client; a newer brimm-video wrote the third.
    writeFileSync(join(parts[0].folder, "record", "0002 (Sallie's conflicted copy 2026-11-04).json"), recordText({ ...parts[0].record, partOf: { ...parts[0].record.partOf, client: true } }));
    writeFileSync(recordFile(parts[2].folder, 3), recordText({ ...parts[2].record, rev: 3, version: 9 }));
    const r = await workcopy(t);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(copies(t).filter((n) => n.startsWith("footage-")).map((n) => n.split("-")[1]), ["4", "4"]);
    assert.ok(r.said.some((line) => line.includes(labelOf(2)) && line.includes("its episode holds a conflicted copy")), r.text);
    assert.ok(r.said.some((line) => line.includes(labelOf(4)) && line.includes("a newer BRIMM Video Studio wrote its record")), r.text);
    t.done();
  });
  it("makes no copy of a part whose shot is no longer a shot of its kind in the plan (ruling 4)", async () => {
    const t = world({ joined: "60.000000" });
    const { folder } = await made(t, { parts: [[2, "b-roll", 2, false], [3, "screen", 4, false]] });
    // plan … set made shot 4 a b-roll: the screen recording is for a shot that is not a screen recording now.
    const plan = readEpisode(folder).record;
    writeEpisode(folder, { ...plan, planned: { ...plan.planned, shots: plan.planned.shots.map((s) => (s.n === 4 ? { ...s, kind: "b-roll" } : s)) } }, { expectRev: plan.rev, writeText: (to, text) => writeFileSync(to, text), writer: plan.writer, home: t.home });
    const r = await workcopy(t);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(copies(t).filter((n) => n.startsWith("footage-")).map((n) => n.split("-")[1]), ["2", "2"]);
    assert.ok(r.said.some((line) => line.includes(labelOf(3)) && line.includes("its shot is not a shot of its kind")), r.text);
    t.done();
  });
  it("leaves the main copy standing when a footage copy fails or has sound: the failure is in the log, the run's result is the main copy's", async () => {
    // What ffmpeg wrote of every footage copy has a sound stream: it is never put in place.
    const t = world({ joined: "60.000000", footage: WIDE() });
    const { folder } = await made(t);
    const r = await workcopy(t);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(copies(t), [basename(mainCopy(t, folder).facts), basename(mainCopy(t, folder).video)].sort());
    assert.ok(r.said.some((line) => line.includes("could not be made") && line.includes("a sound stream")), r.text);
    const result = readResult(t.home, name(t), "workcopy");
    assert.deepEqual([result.ok, result.failed], [true, []]);
    t.done();
  });
  it("makes the footage copies alone with --footage: no working copy, the footage's own steps, a result that says which", async () => {
    const t = world({ joined: "60.000000" });
    const { folder, parts } = await made(t);
    const { events, progress } = panel();
    t.over = { progress };
    const r = await workcopy(t, "--footage");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(copies(t), [footageCopy(t, parts[0], 2), footageCopy(t, parts[1], 4)].flatMap((p) => [p.facts, p.video]).map((p) => basename(p)).sort());
    assert.equal(existsSync(mainCopy(t, folder).video), false);
    assert.deepEqual(events.filter(([what]) => what === "steps").map(([, n]) => n), [[FOOTAGE_STEP], [FOOTAGE_STEP]]);
    const result = readResult(t.home, name(t), "workcopy");
    assert.deepEqual([result.ok, result.made, result.failed], [true, ["the footage for shot 2", "the footage for shot 4"], []]);
    t.done();
  });
  it("makes none of a copy that is made already, and says Done all the same", async () => {
    const t = world({ joined: "60.000000" });
    await made(t);
    assert.equal((await workcopy(t, "--footage")).code, 0);
    const before = ffmpegRuns(t).length;
    assert.equal(before, 2, "the b-roll and the screen recording, and not the video");
    const again = await workcopy(t, "--footage");
    assert.equal(again.code, 0, again.text);
    assert.equal(ffmpegRuns(t).length, before);
    assert.deepEqual([readResult(t.home, name(t), "workcopy").ok, readResult(t.home, name(t), "workcopy").made], [true, []]);
    t.done();
  });
  it("fails a --footage run whose footage cannot be made, in words, since footage is all it makes", async () => {
    const t = world({ joined: "60.000000", footage: WIDE() });
    await made(t);
    const r = await workcopy(t, "--footage");
    assert.equal(r.code, 1, r.text);
    const result = readResult(t.home, name(t), "workcopy");
    assert.deepEqual([result.ok, result.failed], [false, ["The footage for shot 2 could not be made: what was made has sound.", "The footage for shot 4 could not be made: what was made has sound."]]);
    t.done();
  });
  it("makes nothing for a plan that is not made from its footage yet: the gate refuses it, as it does every command, in its own words", async () => {
    const t = world();
    await planned(t);
    const r = await workcopy(t, "--footage");
    assert.deepEqual([r.code, ffmpegRuns(t).length], [1, 0]);
    assert.deepEqual(r.said, [`"${TITLE}" is a planned video, and it isn't made from its footage yet.`]);
    t.done();
  });
  it("is the footage's alone: --footage with --4k or --reel is not a use the run knows, and says the help", async () => {
    for (const extra of [["--4k"], ["--reel", "1"]]) {
      const t = world({ joined: "60.000000" });
      await made(t);
      const r = await workcopy(t, "--footage", ...extra);
      assert.deepEqual([r.code, r.said, ffmpegRuns(t).length], [2, [HELP], 0], extra.join(" "));
      t.done();
    }
  });
  it("reads a part's video through first when Dropbox has not brought it over, and says Dropbox is still bringing it when it does not come", async () => {
    const t = world({ joined: "60.000000" });
    const { parts } = await made(t, { parts: [[2, "b-roll", 2, false], [3, "screen", 4, false]] });
    const here = new Set();
    const read = [];
    t.over = {
      isWhole: (path) => !path.startsWith(parts[0].folder) && !path.startsWith(parts[1].folder) ? true : here.has(path),
      readAll: async (path) => {
        read.push(basename(path));
        if (path.startsWith(parts[0].folder)) here.add(path);
      }
    };
    const r = await workcopy(t, "--footage");
    assert.deepEqual(read, ["Take 2.mov", "Take 3.mov"]);
    assert.deepEqual(copies(t).filter((n) => n.startsWith("footage-")).map((n) => n.split("-")[1]), ["2", "2"]);
    assert.equal(r.code, 1);
    assert.deepEqual(readResult(t.home, name(t), "workcopy").failed, [`The footage for shot 4 could not be made: Dropbox is still bringing ${TITLE}, a screen recording for shot 4 over to this Mac.`]);
    t.done();
  });
});

describe("the guide, and the words of the join through the guard (PR H5b)", () => {
  const JOINING_SAID = "Its footage is being made into one video. A notice comes when it is ready.";
  const FAILED_SAID = 'Its footage could not be made into one video. Say "how far is it?" to see why.';
  /** This Mac on the light import, as the guide needs it. */
  const light = (t) => depsOf(t, { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 }, alive: (pid) => pid === process.pid });
  const SHORT = (t) => planIdOf(t).slice(-6);
  const guideOf = async (t) => (await on(light(t), "guide", TITLE)).said;
  it("says the footage is being made into one video while the run that does it is at work, and the same of the overview", async () => {
    const t = world();
    await planned(t);
    part(t, 1, { words: SCRIPT[0].split(" ") });
    assert.deepEqual(await guideOf(t), [`${TITLE} (${SHORT(t)}): Its footage so far: 1 talking part. When it is all in, say "that's all the footage".`]);
    mkdirSync(episodeWork(t.home, FOLDER_NAME(t)), { recursive: true });
    assert.equal(takeEpisodeLock(lockOf(t.home, FOLDER_NAME(t)), "join", () => true).taken, true);
    assert.deepEqual(await guideOf(t), [`${TITLE} (${SHORT(t)}): ${JOINING_SAID}`]);
    assert.ok((await on(light(t), "guide")).said.includes(`  ${TITLE} (${SHORT(t)}): ${JOINING_SAID}`));
    t.done();
  });
  it("says the footage could not be made into one video after a run that failed and left the plan as it was, and says it is joining again while the next run is at work", async () => {
    const t = world({ probes: { "Take 2.mov": WIDE({ picture: { width: 1280, height: 720 } }) } });
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    assert.equal((await joinRun(t, [a.record.id, b.record.id])).code, 1);
    assert.deepEqual(await guideOf(t), [`${TITLE} (${SHORT(t)}): ${FAILED_SAID}`]);
    assert.ok(readResult(t.home, FOLDER_NAME(t), "join").ok === false);
    assert.equal(takeEpisodeLock(lockOf(t.home, FOLDER_NAME(t)), "join", () => true).taken, true);
    assert.deepEqual(await guideOf(t), [`${TITLE} (${SHORT(t)}): ${JOINING_SAID}`]);
    t.done();
  });
  it("has `status` name the run in words, with what it could not do, after a run that failed", async () => {
    const t = world({ probes: { "Take 2.mov": WIDE({ picture: { width: 1280, height: 720 } }) } });
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    assert.equal((await joinRun(t, [a.record.id, b.record.id])).code, 1);
    const said = (await on(light(t), "status")).said.join("\n");
    assert.match(said, new RegExp(`making the video from its footage ended \\d+ \\w+ ago\\. Not done: ${COULD_NOT("talking part 2 is 1280 by 720, and talking part 1 is 1920 by 1080").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.doesNotMatch(said, /\bjoin ended/);
    t.done();
  });
  it("is a raw video's guide, and nothing of joining, once the plan is its video", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    assert.equal((await joinRun(t, [a.record.id])).code, 0);
    const said = await guideOf(t);
    assert.equal(said.length, 1, said.join("\n"));
    assert.ok(!said[0].includes("footage") && !said[0].includes("one video"), said[0]);
    t.done();
  });
  it("lets `plan … join` through the guard as Claude runs it, in her order and with a title written in codes, without widening the guard", () => {
    const decision = (tail) => guardDecision({ tool_name: "Bash", tool_input: { command: `${EDIT} ${tail}` } }, { checkout: CHECKOUT, node: NODE }).decision;
    assert.equal(decision(`plan "Too many SKUs" join`), "allow");
    assert.equal(decision(`plan "Too many SKUs" join "${labelOf(2)}" "${labelOf(1)}"`), "allow");
    assert.equal(decision(`plan "Make %2410k %22fast%22" join "${labelOf(1)}"`), "allow");
    assert.equal(decision(`plan "Make $10k" join "${labelOf(1)}"`), "deny");
  });
});

describe("a snapshot of the project of a video made from a plan (PR H5b)", () => {
  it("leaves the footage in media/ out, as it leaves the recording: a project rebuilt on the other Mac gets it at its open, where the copies are made again from the parts' own videos", () => {
    for (const rel of ["media/b-roll-2.mp4", "media/screen-4.mp4", "media/recording.mp4"]) assert.equal(holds(rel), false, rel);
    // What a snapshot does hold of such a project is what it held: the notes with the footage rule, the cues with their material, the brand kit.
    for (const rel of ["CLAUDE.md", "brimm/graphic-cues.json", "brimm/facts.json", "index.html"]) assert.equal(holds(rel), true, rel);
  });
});

describe("the README on the join (PR H5b)", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const rows = readme.split("\n");
  it("has a row for `plan … join`, with the order it says, the refusals, the run, the copies and what the project is given", () => {
    const row = rows.find((line) => line.startsWith('| `plan "<planned>" join ["<video>"…]` |')) || "";
    for (const words of ['`The talking parts of "Too many SKUs", in the order of its script:`', "Once they are joined, no more talking parts can be added.", '`"Too many SKUs" is being made from its footage. A notice comes when it is ready.`',
      "`join --now <the plan's folder> --parts <id>[,<id>…]`", "Those aren't the talking parts of", "a talking part held by a conflict in its episode or a record a newer BRIMM Video Studio wrote", "talking part 2 is 3840 by 2160, and talking part 1 is 1920 by 1080", "has no sound, so it can't be a talking part", "a video with no sound takes no kind",
      "`Making the footage for HyperFrames`", "`--footage` makes these alone", "a copy in which ffprobe finds a sound stream is never put in place", "`media/b-roll-<n>.mp4`", "her client has not agreed to", "Its footage is still being made for HyperFrames: say \"open it in HyperFrames\" again when it is done."]) assert.ok(row.includes(words), words);
  });
  it("lists the two modules, and says the gate's words for a plan as they are now", () => {
    assert.ok(rows.some((line) => line.startsWith("| `tool/join.js`, `tool/sentences.js` |")));
    const drop = rows.find((line) => line.startsWith('| `plan "<planned>" drop` |')) || "";
    assert.ok(drop.includes("is a planned video, and it isn't made from its footage yet.") && !drop.includes("there's no footage for it yet"), drop);
    assert.ok(drop.includes("`join` (the detached half of `plan … join`)"), drop);
  });
  it("says the guide's two stages, and that `guide wait` waits for a join", () => {
    const guide = rows.find((line) => line.startsWith('| `guide ["<video>"]` |')) || "";
    assert.ok(guide.includes("`joining`") && guide.includes("`join-failed`") && guide.includes("Its footage could not be made into one video."), guide);
    assert.ok((rows.find((line) => line.startsWith("| `guide drop [zoom]")) || "").includes("having a plan's footage made into one video"));
  });
});

describe("from the parts to the project: the join, the copies and the open, run by edit.js (PR H5b)", () => {
  const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
  const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
  const CUES = ["--cue", "words | 3 | Too many SKUs | Her title card", "--cue", "b-roll | 4 | count what you actually sell | Sallie at her desk | shot: 2", "--cue", "screen | 5 | watch what happens to your cash | Her dashboard | shot: 4", "--cue", "b-roll | 4 | cut the bottom fifth | A coaching session | shot: 5"];
  const COMING = 'Its footage is still being made for HyperFrames: say "open it in HyperFrames" again when it is done.';
  const TYPED = "Quayle Widgets, 21 October";
  it("makes the plan its video, copies the footage that may go in, opens a project that holds it and names the rest, and takes a client's footage in only after her click", async () => {
    const t = world({ probes: longTalk("Take 1"), copy: "120.000000" });
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
    const folder = await planned(t, { shots: [...SHOT_ARGS, ...CUES] });
    const talk = part(t, 1, { words: SCRIPT.join(" ").split(" ") });
    const broll = part(t, 2, { as: "b-roll", shot: 2 });
    const screen = part(t, 3, { as: "screen", shot: 4 });
    const client = part(t, 4, { as: "b-roll", shot: 5, client: true });
    const app = (more = {}) => appDeps(t, { app: { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE }, ...more });
    // "That's all the footage": the plan is its video, and the launch agent is asked to make the late check.
    assert.equal((await joinRun(t, [talk.record.id])).code, 0);
    assert.equal(isFromPlan(planOf(t)), true);
    // The launch agent's late check of the joined video passes (it is not at work in a test), so that the copy waits for nothing.
    const { finishLate } = await import("../filing.js");
    const [pending] = readPendings(t.home);
    const checked = finishLate(pending, { episode: { root: t.root, machine: "Mac Studio", home: t.home }, log: () => {}, notify: () => {}, clone: t.ctx.deps.clone, sameDisk: () => true });
    assert.deepEqual([checked.ok, checked.problems], [true, []]);
    // The run `kind` started makes the working copy, and then the copies with no sound of the footage that may go in: not the client's.
    const made = await on(app(), "workcopy", "--now", FOLDER_NAME(t));
    assert.equal(made.code, 0, made.text);
    assert.deepEqual(readdirSync(workCopyDir(t.home, FOLDER_NAME(t))).filter((n) => n.startsWith("footage-") && n.endsWith(".mp4")).map((n) => n.split("-")[1]), ["2", "4"]);
    assert.ok(made.said.some((line) => line.includes(labelOf(4)) && line.includes("her client has not agreed to it")), made.text);
    // The open: the project holds the recording and the footage, in media/, and the cues name theirs.
    const opened = await on(app(), "app", TITLE);
    assert.equal(opened.code, 0, opened.text);
    assert.deepEqual(opened.said.slice(0, 1), ["It's open in HyperFrames."]);
    const project = join(episodeWork(t.home, FOLDER_NAME(t)), planOf(t).app.projects[0].name);
    assert.deepEqual(readdirSync(join(project, "media")).sort(), ["b-roll-2.mp4", "recording.mp4", "screen-4.mp4"]);
    const cues = JSON.parse(readFileSync(join(project, "brimm", "graphic-cues.json"), "utf8")).cues;
    assert.deepEqual(cues.map((cue) => [cue.kind, cue.shot ?? null, cue.material ?? null, cue.at !== null]), [["words", null, null, true], ["b-roll", 2, "media/b-roll-2.mp4", true], ["screen", 4, "media/screen-4.mp4", true], ["b-roll", 5, "media/b-roll-5.mp4", true]]);
    assert.match(readFileSync(join(project, "CLAUDE.md"), "utf8"), /- \*\*Footage cues\.\*\*/);
    // The footage of the client waits for her click: nothing is asked for, and nothing is said of it.
    assert.deepEqual(t.started.filter(([, args]) => args.includes("--footage")), []);
    assert.ok(!opened.said.includes(COMING));
    // Her click is noted.
    const run = async (cmd, args, opts) => (cmd === "/usr/bin/osascript" ? { code: 0, stdout: `button returned:They agreed, text returned:${TYPED}\n`, stderr: "" } : t.ctx.deps.run(cmd, args, opts));
    assert.equal((await on(depsOf(t, { run }), "plan", TITLE, "agreed", labelOf(4))).code, 0);
    // The next open asks for the copy, says it is being made, and opens all the same.
    const again = await on(app(), "app", TITLE);
    assert.equal(again.code, 0, again.text);
    assert.ok(again.said.includes(COMING));
    assert.deepEqual(t.started.filter(([, args]) => args.includes("--footage")).map(([, args]) => args.slice(1)), [["workcopy", "--now", FOLDER_NAME(t), "--footage"]]);
    assert.deepEqual(readdirSync(join(project, "media")).sort(), ["b-roll-2.mp4", "recording.mp4", "screen-4.mp4"]);
    // The run makes it, and the open after that moves it in.
    assert.equal((await on(app(), "workcopy", "--now", FOLDER_NAME(t), "--footage")).code, 0);
    const last = await on(app(), "app", TITLE);
    assert.equal(last.code, 0, last.text);
    assert.ok(!last.said.includes(COMING));
    assert.deepEqual(readdirSync(join(project, "media")).sort(), ["b-roll-2.mp4", "b-roll-5.mp4", "recording.mp4", "screen-4.mp4"]);
    // Nothing of any of it was written into Dropbox but the join's files and the records: no part's video was taken, and the footage is only on this Mac.
    for (const one of [broll, screen, client, talk]) assert.ok(existsSync(join(one.folder, one.record.video.file)), "a part's own video stays in its own episode");
    assert.deepEqual(listAll(folder).filter((rel) => /b-roll|screen|footage/.test(rel)), []);
    t.done();
  });
  it("rebuilds the project on the other Mac from its snapshot, and gives it the footage her client agreed to and none that waits for a click", async () => {
    const t = world({ probes: longTalk("Take 1"), copy: "120.000000" });
    t.ctx.deps.running = async () => false;
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
    await planned(t, { shots: [...SHOT_ARGS, ...CUES] });
    const talk = part(t, 1, { words: SCRIPT.join(" ").split(" ") });
    part(t, 2, { as: "b-roll", shot: 2 });
    part(t, 3, { as: "screen", shot: 4, client: true });
    part(t, 4, { as: "b-roll", shot: 5, client: true });
    const studio = (more = {}) => appDeps(t, { app: { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE }, ...more });
    // The plan is its video; the launch agent's late check of it passes; her click is noted for the screen recording of one client and not for the b-roll of the other.
    assert.equal((await joinRun(t, [talk.record.id])).code, 0);
    const { finishLate } = await import("../filing.js");
    const [pending] = readPendings(t.home);
    assert.deepEqual(finishLate(pending, { episode: { root: t.root, machine: "Mac Studio", home: t.home }, log: () => {}, notify: () => {}, clone: t.ctx.deps.clone, sameDisk: () => true }).problems, []);
    const run = async (cmd, args, opts) => (cmd === "/usr/bin/osascript" ? { code: 0, stdout: `button returned:They agreed, text returned:${TYPED}\n`, stderr: "" } : t.ctx.deps.run(cmd, args, opts));
    assert.equal((await on(depsOf(t, { run }), "plan", TITLE, "agreed", labelOf(3))).code, 0);
    // Mac Studio makes the copies and the project, which holds the footage that may go in, and hands it over.
    assert.equal((await on(studio(), "workcopy", "--now", FOLDER_NAME(t))).code, 0);
    assert.equal((await on(studio(), "app", TITLE)).code, 0);
    const name = planOf(t).app.projects[0].name;
    const here = join(episodeWork(t.home, FOLDER_NAME(t)), name);
    assert.deepEqual(readdirSync(join(here, "media")).sort(), ["b-roll-2.mp4", "recording.mp4", "screen-4.mp4"]);
    const handed = await on(studio(), "release", TITLE);
    assert.equal(handed.code, 0, handed.text);
    // The snapshot holds the project but for its media/: the notes and the cues are in it, the footage is not.
    const snapshotted = Object.keys(planOf(t).files).filter((rel) => rel.startsWith("app-snapshot/"));
    assert.ok(snapshotted.some((rel) => rel.endsWith(`/${name}/CLAUDE.md`)) && snapshotted.some((rel) => rel.endsWith("/brimm/graphic-cues.json")), snapshotted.join("\n"));
    assert.deepEqual(snapshotted.filter((rel) => rel.includes("/media/")), []);
    // Sallie's laptop has no folder for the project and no copy of anything: it rebuilds the project from the snapshot, and its video is to be made.
    const b = otherMac(t);
    b.deps.settings = { ...b.deps.settings, app: "hyperframes", handoffVersion: 2 };
    b.deps.running = async () => false;
    b.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
    writeFileSync(join(b.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
    const there = join(episodeWork(b.home, FOLDER_NAME(t)), name);
    const rebuilt = await on(b.deps, "app", TITLE);
    assert.equal(rebuilt.code, 0, rebuilt.text);
    assert.ok(rebuilt.said.some((line) => line.includes("is rebuilt on this Mac from what Mac Studio handed over")), rebuilt.text);
    assert.equal(existsSync(join(there, "index.html")), true);
    assert.equal(existsSync(join(there, "media", "screen-4.mp4")), false, "the snapshot has no media/");
    // The run that makes the video makes the copies of the footage that may go in, here too; the open after it puts the video back and the footage in.
    assert.equal((await on(b.deps, "workcopy", "--now", FOLDER_NAME(t))).code, 0);
    assert.deepEqual(readdirSync(workCopyDir(b.home, FOLDER_NAME(t))).filter((n) => n.startsWith("footage-") && n.endsWith(".mp4")).map((n) => n.split("-")[1]), ["2", "4"], "no copy for the client who has not agreed");
    const opened = await on(b.deps, "app", TITLE);
    assert.equal(opened.code, 0, opened.text);
    assert.ok(opened.said.includes("It's open in HyperFrames."), opened.text);
    assert.deepEqual(readdirSync(join(there, "media")).sort(), ["b-roll-2.mp4", "recording.mp4", "screen-4.mp4"]);
    assert.equal(existsSync(join(there, "media", "b-roll-5.mp4")), false);
    // The rebuilt project still names the file of the cue whose client has not agreed, and the notes still say a cue with no file has no footage yet.
    const cues = JSON.parse(readFileSync(join(there, "brimm", "graphic-cues.json"), "utf8")).cues;
    assert.deepEqual(cues.map((cue) => cue.material ?? null), [null, "media/b-roll-2.mp4", "media/screen-4.mp4", "media/b-roll-5.mp4"]);
    assert.match(readFileSync(join(there, "CLAUDE.md"), "utf8"), /A cue whose `material` is not in `media\/` has no footage yet, or waits for her client's agreement/);
    // No second run was asked for: nothing was missing.
    assert.deepEqual(t.started.filter(([, args]) => args.includes("--footage")), []);
    t.done();
  });
  it("keeps, in the record of the video a plan made, nothing a record's own judge would refuse: a record with a kind and no sound is the filing's to refuse, not the judge's", async () => {
    // episode.js faultFor is the judge of a record written and of every record read back from disk (recordIn): a rule in it would make a record
    // already written with a kind and a video with no sound unreadable, so the rule stands in the filing (filing.js fileEpisode's `into`).
    const t = world();
    const folder = await planned(t);
    const plan = planOf(t);
    const odd = { ...plan, kind: "raw", video: { file: "Odd.mov", bytes: 5, seconds: 8, recorded: "2026-10-20", recordedFrom: "import", sound: false }, files: { ...plan.files, "Odd.mov": 5 }, answer: { state: "answered", guess: null, seen: "", came: "phone", by: "Mac Studio", on: "Mac Studio", at: atOf(t), private: "no" } };
    assert.equal(episodeFault(odd), "");
    writeEpisode(folder, odd, { expectRev: plan.rev, writeText: (to, text) => writeFileSync(to, text), writer: plan.writer, home: t.home });
    assert.deepEqual([readEpisode(folder).record.kind, readEpisode(folder).record.video.sound], ["raw", false]);
    t.done();
  });
});

describe("a part that comes to be held as a session is used for nothing (the final review, fix 1)", () => {
  const SESSION_ID = "e-20261104-5e5510";
  const HELD_AS_SESSION = "This video is a version of a client or group session: answer it as a session too, or ask Jason.";
  const MATCHED_AS_SESSION = "This video holds most of the words of a client or group session: answer it as a session, or ask Jason.";
  /** A client or group session, answered and not cleared, in Episodes. */
  function session(t, versionOf = null) {
    const folder = join(t.root, "Episodes", "2026-11-04 Group call (Mac Studio)");
    mkdirSync(join(folder, "record"), { recursive: true });
    const made = newEpisode({
      id: SESSION_ID, machine: "Mac Studio", at: "2026-11-04T08:00:00-05:00", video: { file: "Group call.mov", bytes: 5, seconds: 600, created: null }, kind: "session", writer: { commit: "c709b57", on: "Mac Studio" },
      label: "Video of 4 Nov, 08:00 (Mac Studio)", answer: { state: "answered", guess: null, seen: "wide, 10:00", came: "zoom", by: "Mac Studio", on: "Mac Studio", at: "2026-11-04T08:30:00-05:00", private: "no" }
    });
    writeFileSync(recordFile(folder, 1), recordText({ ...made, ...(versionOf ? { versionOf } : {}), rev: 1 }));
    return folder;
  }
  /** The part's video is matched to a session after it was answered as a part (its import matched the session's words). */
  const matched = (t, one) => {
    session(t);
    writeFileSync(recordFile(one.folder, 3), recordText({ ...one.record, rev: 3, answer: { ...one.record.answer, match: SESSION_ID } }));
  };
  /** A session is answered as a version of the part's video: the part is held beside it (a part has no kind, so its own walk stops at itself). */
  const beside = (t, one) => session(t, one.record.id);

  it("holds a part by the gate's words, the part's label first: it matched a session, or it is a version of one", async () => {
    for (const [hold, words] of [[matched, MATCHED_AS_SESSION], [beside, HELD_AS_SESSION]]) {
      const t = world();
      await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      hold(t, one);
      const held = partHeld(partsOf(t.root, planIdOf(t))[0]);
      assert.equal(held.why, "session");
      const r = await on(depsOf(t), "plan", TITLE, "join");
      assert.deepEqual([r.code, r.said], [1, [`${labelOf(1)}: ${words}`]]);
      t.done();
    }
  });
  it("refuses `plan … join` and `join --now` for a talking part answered as a session after it became a part, and writes nothing", async () => {
    for (const hold of [matched, beside]) {
      const t = world();
      const folder = await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      hold(t, one);
      const before = snapshot(t);
      const said = await on(depsOf(t), "plan", TITLE, "join");
      assert.equal(said.code, 1, said.text);
      assert.deepEqual([snapshot(t), t.started], [before, []]);
      const run = await joinRun(t, [one.record.id]);
      assert.equal(run.code, 1);
      const [failed] = resultOf(t).failed;
      assert.equal(failed, COULD_NOT(said.said[0].replace(/\.$/, "")));
      assert.deepEqual(readPendings(t.home), []);
      assert.equal(planOf(t).kind, null);
      assert.ok(!existsSync(join(folder, "Take 1.mov")));
      t.done();
    }
  });
  it("says nothing in the guide that names the session", async () => {
    const t = world();
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    beside(t, one);
    const text = (await on(depsOf(t), "guide")).text + (await on(depsOf(t), "plan", TITLE)).text;
    assert.ok(!text.includes("Group call") && !text.includes("08:00") && !text.includes(SESSION_ID), text);
    t.done();
  });
  it("gives no footage, makes no copy and puts nothing in media/ for a b-roll part held beside a session, once the plan is its video", async () => {
    const t = world({ probes: longTalk("Take 1"), copy: "120.000000" });
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
    const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
    const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
    await planned(t, { shots: [...SHOT_ARGS, "--cue", "b-roll | 4 | count what you actually sell | Sallie at her desk | shot: 2"] });
    const talk = part(t, 1, { words: SCRIPT.join(" ").split(" ") });
    const broll = part(t, 2, { as: "b-roll", shot: 2 });
    part(t, 3, { as: "screen", shot: 4 });
    const app = () => appDeps(t, { app: { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE } });
    assert.equal((await joinRun(t, [talk.record.id])).code, 0);
    const { finishLate } = await import("../filing.js");
    const [pending] = readPendings(t.home);
    assert.deepEqual(finishLate(pending, { episode: { root: t.root, machine: "Mac Studio", home: t.home }, log: () => {}, notify: () => {}, clone: t.ctx.deps.clone, sameDisk: () => true }).problems, []);
    // The b-roll's video is then found to be a version of a session. The screen recording is not.
    beside(t, broll);
    const parts = partsOf(t.root, planOf(t).id, { newer: true });
    assert.deepEqual(footageOf(planOf(t), parts).map((f) => f.path), ["media/screen-4.mp4"]);
    assert.deepEqual(footageWithheld(planOf(t), parts).map(({ part: p, why }) => [p.record.label, why]), [[labelOf(2), "it is held as a session"]]);
    const made = await on(app(), "workcopy", "--now", FOLDER_NAME(t));
    assert.equal(made.code, 0, made.text);
    assert.deepEqual(readdirSync(workCopyDir(t.home, FOLDER_NAME(t))).filter((n) => n.startsWith("footage-") && n.endsWith(".mp4")).map((n) => n.split("-")[1]), ["4"]);
    assert.ok(made.said.some((line) => line.includes(labelOf(2)) && line.includes("held as a session")), made.text);
    const opened = await on(app(), "app", TITLE);
    assert.equal(opened.code, 0, opened.text);
    const project = join(episodeWork(t.home, FOLDER_NAME(t)), planOf(t).app.projects[0].name);
    assert.deepEqual(readdirSync(join(project, "media")).sort(), ["recording.mp4", "screen-4.mp4"]);
    t.done();
  });
});

describe("the join takes a part's files as they came in (the final review, fix 3)", () => {
  const CHANGED = (label) => COULD_NOT(`${label} has changed since it came in, so it can't be joined yet. Say it again in a few minutes`);
  /** Everything in Episodes, whole: a join that stops leaves it as it was. */
  const episodesOf = (t) => Object.fromEntries(listAll(join(t.root, "Episodes")).map((rel) => [rel, readFileSync(join(t.root, "Episodes", rel), "utf8")]));
  it("stops while one of several parts has a video that is not the size its record says, and files nothing", async () => {
    const t = world();
    const folder = await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    // Dropbox is still bringing the second part's video over, or another Mac changed it: it is not the size the record says.
    writeFileSync(join(b.folder, "Take 2.mov"), "video 2, longer than it came in");
    const before = episodesOf(t);
    const r = await joinRun(t, [a.record.id, b.record.id]);
    assert.equal(r.code, 1);
    assert.deepEqual(resultOf(t).failed, [CHANGED(labelOf(2))]);
    assert.deepEqual(episodesOf(t), before);
    assert.deepEqual([planOf(t).kind, readPendings(t.home), t.notices, t.started], [null, [], [], []]);
    assert.ok(!existsSync(join(folder, "Take 1.mov")));
    t.done();
  });
  it("stops while the video of the one part is not the size its record says, and while a file its light import filed is not the one it holds", async () => {
    for (const [file, text] of [["Take 1.mov", "video 1, longer than it came in"], ["Take 1.srt", "1\n00:00:00,000 --> 00:00:04,000\n a different caption\n"], ["Take 1.words.json", "{}"]]) {
      const t = world({ probes: longTalk("Take 1") });
      const folder = await planned(t);
      const one = part(t, 1, { words: SCRIPT[0].split(" ") });
      writeFileSync(join(one.folder, file), text);
      const before = episodesOf(t);
      const r = await joinRun(t, [one.record.id]);
      assert.equal(r.code, 1, file);
      assert.deepEqual(resultOf(t).failed, [CHANGED(labelOf(1))], file);
      assert.deepEqual(episodesOf(t), before, file);
      assert.deepEqual([planOf(t).kind, readPendings(t.home), t.notices, t.started], [null, [], [], []], file);
      assert.ok(!existsSync(join(folder, "Take 1.mov")), file);
      t.done();
    }
  });
  it("does not look at a file of the light import when several parts are joined: those are not filed", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    writeFileSync(join(b.folder, "Take 2.srt"), "a caption that Dropbox has not finished bringing over");
    assert.equal((await joinRun(t, [a.record.id, b.record.id])).code, 0);
    assert.equal(isFromPlan(planOf(t)), true);
    t.done();
  });
  it("joins a part whose files are the sizes its record says, as before", async () => {
    const t = world({ probes: longTalk("Take 1") });
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    assert.equal((await joinRun(t, [one.record.id])).code, 0);
    assert.equal(isFromPlan(planOf(t)), true);
    t.done();
  });
});

describe("a footage copy that keeps failing is not asked for again at every open (the final review, fix 4)", () => {
  const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
  const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
  const CUES = ["--cue", "b-roll | 4 | count what you actually sell | Sallie at her desk | shot: 2"];
  const COMING = 'Its footage is still being made for HyperFrames: say "open it in HyperFrames" again when it is done.';
  const UNMADE = `Some of its footage could not be made for HyperFrames. Say "open ${TITLE} in HyperFrames" again in a few minutes. If it says this again, tell Jason.`;
  const asksFootage = (t) => t.started.filter(([, args]) => args.includes("--footage")).length;
  /** A plan made its video, with a b-roll part for shot 2; the launch agent's late check passed. */
  async function made(script) {
    const t = world(Object.assign(script, { probes: longTalk("Take 1"), copy: "120.000000" }));
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
    await planned(t, { shots: [...SHOT_ARGS, ...CUES] });
    const talk = part(t, 1, { words: SCRIPT.join(" ").split(" ") });
    part(t, 2, { as: "b-roll", shot: 2 });
    assert.equal((await joinRun(t, [talk.record.id])).code, 0);
    const { finishLate } = await import("../filing.js");
    const [pending] = readPendings(t.home);
    assert.deepEqual(finishLate(pending, { episode: { root: t.root, machine: "Mac Studio", home: t.home }, log: () => {}, notify: () => {}, clone: t.ctx.deps.clone, sameDisk: () => true }).problems, []);
    const app = (more = {}) => appDeps(t, { app: { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE }, ...more });
    return { t, app, project: () => join(episodeWork(t.home, FOLDER_NAME(t)), planOf(t).app.projects[0].name) };
  }
  it("says it could not be made, and asks for no new run, when the last run failed for a reason that will not pass: a copy with a sound stream", async () => {
    const script = { footage: WIDE() };
    const { t, app, project } = await made(script);
    // The run `kind` started makes the video's copy, and the footage's: the footage's fails and costs the video's nothing.
    assert.equal((await on(app(), "workcopy", "--now", FOLDER_NAME(t))).code, 0);
    const first = await on(app(), "app", TITLE);
    assert.equal(first.code, 0, first.text);
    assert.ok(first.said.includes(UNMADE), first.text);
    assert.ok(first.said.indexOf("It's open in HyperFrames.") < first.said.indexOf(UNMADE), "it says it is open first: " + first.text);
    assert.ok(!first.said.includes(COMING), first.text);
    assert.equal(asksFootage(t), 0);
    assert.ok(!existsSync(join(project(), "media", "b-roll-2.mp4")));
    // The run for the footage alone fails the same way; the open says the same and asks for nothing.
    assert.equal((await on(app(), "workcopy", "--now", FOLDER_NAME(t), "--footage")).code, 1);
    const second = await on(app(), "app", TITLE);
    assert.ok(second.said.includes(UNMADE) && !second.said.includes(COMING), second.text);
    assert.equal(asksFootage(t), 0);
    // Once a run makes it, the next open moves it in and says nothing of it.
    script.footage = SILENT;
    assert.equal((await on(app(), "workcopy", "--now", FOLDER_NAME(t), "--footage")).code, 0);
    const last = await on(app(), "app", TITLE);
    assert.equal(last.code, 0, last.text);
    assert.ok(!last.said.includes(UNMADE) && !last.said.includes(COMING), last.text);
    assert.deepEqual(readdirSync(join(project(), "media")).sort(), ["b-roll-2.mp4", "recording.mp4"]);
    t.done();
  });
  it("asks again, as before, when the last run failed because Dropbox is still bringing the part's video over", async () => {
    const { t, app, project } = await made({});
    // (The video's own copy is made; the run's footage waits for Dropbox.)
    const waiting = { isWhole: (path) => !path.endsWith("Take 2.mov"), readAll: async () => {} };
    assert.equal((await on(app(waiting), "workcopy", "--now", FOLDER_NAME(t))).code, 0);
    assert.ok(resultFootage(t).footageFailed[0].includes("Dropbox is still bringing"), JSON.stringify(resultFootage(t)));
    const opened = await on(app(), "app", TITLE);
    assert.equal(opened.code, 0, opened.text);
    assert.ok(opened.said.includes(COMING));
    assert.ok(!opened.said.includes(UNMADE));
    assert.equal(asksFootage(t), 1);
    assert.ok(!existsSync(join(project(), "media", "b-roll-2.mp4")));
    t.done();
  });
  it("asks as before when no run has been made for it yet", async () => {
    const { t, app } = await made({});
    assert.equal((await on(app(), "workcopy", "--now", FOLDER_NAME(t))).code, 0);
    // The footage's copies and the run's result are gone, as if the run had not been made.
    const dir = workCopyDir(t.home, FOLDER_NAME(t));
    for (const name of readdirSync(dir).filter((n) => n.startsWith("footage-"))) rmSync(join(dir, name));
    rmSync(join(episodeWork(t.home, FOLDER_NAME(t)), "workcopy.result.json"));
    const opened = await on(app(), "app", TITLE);
    assert.ok(opened.said.includes(COMING));
    assert.ok(!opened.said.includes(UNMADE));
    assert.equal(asksFootage(t), 1);
    t.done();
  });
  const resultFootage = (t) => readResult(t.home, FOLDER_NAME(t), "workcopy");
});
