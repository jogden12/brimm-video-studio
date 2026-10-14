// Turning a wide video into a vertical one, and cutting short clips from it: where the crop goes, how long a clip may be, what
// the files are called, and what ffmpeg is asked to do. None of that needs a video. The last tests run the face finder for
// real, on blank stills that ffmpeg makes. They need a Mac with swift and ffmpeg, and anywhere else they skip themselves and
// say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findTools } from "../run.js";
import { stillsArgs, needsReframe, cropFor, cropsFor, verticalArgs, clipArgs, REEL_MIN, REEL_MAX, STORY_MAX, fitReel, storyParts, clipNames, storyCuts } from "../reframe.js";

const WIDE = { width: 1920, height: 1080 };
/** A face box whose middle is `centre` of the way across the picture. `size` is its width, as a share of the picture's. */
const face = (centre, size = 0.1) => ({ x: centre - size / 2, y: 0.2, w: size, h: size * 2 });
/** What the face finder prints for stills numbered from 1: each still's faces are those whose middles are given for it. */
const stillsOf = (...centres) => centres.map((c, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: [].concat(c).map((m) => face(m)) }));

describe("the stills the faces are looked for in", () => {
  it("has ffmpeg write one every two seconds, 640 pixels wide, as numbered .jpg files, never asking a question", () => {
    assert.deepEqual(stillsArgs("/in/a b.mp4", "/tmp/stills"), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", "/in/a b.mp4", "-an", "-vf", "fps=1/2:round=down,scale=640:-2", "-q:v", "4", "/tmp/stills/%04d.jpg"]);
  });
  it("writes them as far apart as it is asked to", () => {
    const a = stillsArgs("/in/a.mp4", "/tmp/stills", 5);
    assert.equal(a[a.indexOf("-vf") + 1], "fps=1/5:round=down,scale=640:-2");
  });
});

describe("whether a video needs a new shape", () => {
  it("does when its picture is wider than it is tall", () => {
    assert.equal(needsReframe({ width: 1920, height: 1080 }), true);
    assert.equal(needsReframe({ width: 1081, height: 1080 }), true);
  });
  it("is left as it is when it is already vertical or square", () => {
    assert.equal(needsReframe({ width: 1080, height: 1920 }), false);
    assert.equal(needsReframe({ width: 1080, height: 1080 }), false);
  });
});

describe("the crop that makes a vertical picture of a wide one", () => {
  it("is the full height, and 9:16 of it wide, rounded down to an even number of pixels", () => {
    assert.deepEqual(cropFor(WIDE, []), { x: 657, y: 0, w: 606, h: 1080, found: false });
    assert.equal(cropFor({ width: 1280, height: 720 }, []).w, 404);
    assert.equal(cropFor({ width: 3840, height: 2160 }, []).w, 1214);
    assert.equal(cropFor({ width: 1920, height: 1088 }, []).w, 612);
    assert.deepEqual(cropFor({ width: 640, height: 360 }, []), { x: 219, y: 0, w: 202, h: 360, found: false });
  });
  it("is taken from the middle when no face was found, and says so", () => {
    assert.deepEqual(cropFor(WIDE, [[], [], []]), { x: 657, y: 0, w: 606, h: 1080, found: false });
  });
  it("puts the speaker's face in the middle, side to side", () => {
    assert.deepEqual(cropFor(WIDE, [[face(0.65)]]), { x: 945, y: 0, w: 606, h: 1080, found: true });
    assert.deepEqual(cropFor(WIDE, [[face(0.25)]]), { x: 177, y: 0, w: 606, h: 1080, found: true });
  });
  it("takes the largest face in a still for the speaker", () => {
    assert.equal(cropFor(WIDE, [[face(0.25, 0.05), face(0.7, 0.2), face(0.4, 0.1)]]).x, 1041);
    // The largest is the one that covers the most of the picture, not the widest.
    assert.equal(cropFor(WIDE, [[{ x: 0.2, y: 0.4, w: 0.1, h: 0.02 }, { x: 0.71, y: 0.2, w: 0.08, h: 0.3 }]]).x, 1137);
  });
  it("goes by the still in the middle of them, so one odd still does not move it", () => {
    assert.equal(cropFor(WIDE, [[face(0.26)], [face(0.9)], [face(0.25)]]).x, 196);
    assert.equal(cropFor(WIDE, [[face(0.9)], [face(0.25)], [face(0.26)], [face(0.27)], [face(0.24)]]).x, 196);
  });
  it("stays on a face, and never in the gap between two people, when the stills are split evenly between them", () => {
    assert.equal(cropFor(WIDE, [[face(0.75)], [face(0.25)]]).x, 177);
    assert.equal(cropFor(WIDE, [[face(0.75)], [face(0.25)], [face(0.75)], [face(0.25)]]).x, 177);
  });
  it("goes only by the stills a face was found in", () => {
    assert.deepEqual(cropFor(WIDE, [[], [face(0.25)], [], []]), { x: 177, y: 0, w: 606, h: 1080, found: true });
  });
  it("is kept inside the picture when the speaker is near an edge", () => {
    assert.equal(cropFor(WIDE, [[face(0.05)]]).x, 0);
    assert.equal(cropFor(WIDE, [[face(0.97)]]).x, 1920 - 606);
  });
  it("is in whole pixels", () => {
    assert.deepEqual(cropFor({ width: 1280, height: 720 }, [[face(0.333)], [face(0.41)], [face(0.377)]]), { x: 281, y: 0, w: 404, h: 720, found: true });
  });
});

describe("a crop for each kept range", () => {
  // Stills every two seconds, so at 2, 4, 6, 8 and 10 seconds. The speaker moves across the picture after the first two.
  const STILLS = stillsOf(0.25, 0.4, 0.75, 0.75, 0.75);
  const at = (x, found = true) => ({ x, y: 0, w: 606, h: 1080, found });
  it("is placed by the stills whose time falls in the range", () => {
    assert.deepEqual(cropsFor(WIDE, [{ start: 0, end: 3 }, { start: 5, end: 10 }], STILLS), [at(177), at(1137)]);
  });
  it("counts the still at a range's end and not the one at its start: a still shows the last frame before its time", () => {
    assert.deepEqual(cropsFor(WIDE, [{ start: 2, end: 4 }], STILLS), [at(465)]);
    assert.deepEqual(cropsFor(WIDE, [{ start: 4, end: 6 }], STILLS), [at(1137)]);
  });
  it("reads a still's time from the number in its name, whatever order the stills come in", () => {
    const some = [{ file: "0005.jpg", faces: [face(0.75)] }, { file: "0001.jpg", faces: [face(0.25)] }];
    assert.deepEqual(cropsFor(WIDE, [{ start: 0, end: 3 }, { start: 9, end: 10 }], some), [at(177), at(1137)]);
  });
  it("counts the time by how far apart the stills were written", () => {
    // Every five seconds they are at 5, 10, 15, 20 and 25 seconds.
    assert.deepEqual(cropsFor(WIDE, [{ start: 0, end: 5 }, { start: 6, end: 10 }, { start: 12, end: 25 }], STILLS, 5), [at(177), at(465), at(1137)]);
  });
  it("takes the place of the whole video's faces for a range no face was found in, and says that none was found in it", () => {
    assert.deepEqual(cropsFor(WIDE, [{ start: 0, end: 3 }, { start: 100, end: 130 }], STILLS), [at(177), at(1137, false)]);
    // A still with nobody in it is in the second range, and says nothing.
    const gap = [...stillsOf(0.25, 0.25, 0.25), { file: "0004.jpg", faces: [] }];
    assert.deepEqual(cropsFor(WIDE, [{ start: 0, end: 6 }, { start: 6, end: 8 }], gap), [at(177), at(177, false)]);
  });
  it("cuts every range from the middle when no face was found anywhere", () => {
    assert.deepEqual(cropsFor(WIDE, [{ start: 0, end: 3 }, { start: 5, end: 10 }], [{ file: "0001.jpg", faces: [] }]), [at(657, false), at(657, false)]);
    assert.deepEqual(cropsFor(WIDE, [{ start: 0, end: 3 }], []), [at(657, false)]);
  });
});

describe("what it asks ffmpeg to do with the video", () => {
  const BEFORE = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", "/in/a b.mp4", "-filter_complex"];
  /** The arguments after the filter graph, for a file written at the quality `crf`. */
  const AFTER = (crf) => ["-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", crf, "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", "-f", "mp4"];
  const RANGES = [{ start: 0, end: 12.5 }, { start: 30, end: 41 }];
  const CROPS = [{ x: 177, y: 0, w: 606, h: 1080, found: true }, { x: 1137, y: 0, w: 606, h: 1080, found: true }];
  /** The filter graph in an argument list, as its parts. */
  const graphOf = (args) => args[args.indexOf("-filter_complex") + 1].split(";");
  it("makes the vertical video in one pass: the video split once into its pieces, each kept range cropped with its own crop, the kept ones joined in order with their sound, and the whole made 1080 by 1920", () => {
    // The pieces are numbered in time order: 0 is kept, 1 is the gap after it, 2 is kept, and 3 is the rest of the video.
    assert.deepEqual(verticalArgs({ video: "/in/a b.mp4", ranges: RANGES, crops: CROPS, out: "/out/a b.vertical.mp4" }), [...BEFORE,
      "[0:v]segment=timestamps=12.5|30|41[pv0][pv1][pv2][pv3];" +
      "[0:a]asegment=timestamps=12.5|30|41[pa0][pa1][pa2][pa3];" +
      "[pv0]setpts=PTS-STARTPTS,crop=606:1080:177:0[v0];[pa0]asetpts=PTS-STARTPTS[a0];" +
      "[pv1]nullsink;[pa1]anullsink;" +
      "[pv2]setpts=PTS-STARTPTS,crop=606:1080:1137:0[v1];[pa2]asetpts=PTS-STARTPTS[a1];" +
      "[pv3]nullsink;[pa3]anullsink;" +
      "[v0][a0][v1][a1]concat=n=2:v=1:a=1[j][a];" +
      "[j]scale=1080:1920,setsar=1[v]",
      ...AFTER("25"), "/out/a b.vertical.mp4"]);
  });
  it("splits the video once and scales it once, however many ranges are kept", () => {
    // With a branch off the whole video for each range, every frame went down every branch. Tried on ffmpeg 9, 300 ranges of a
    // three-minute video took 154 seconds and 2 GB of memory. Split once it takes 8 seconds and 240 MB, as one range does.
    const ranges = Array.from({ length: 300 }, (_, i) => ({ start: i * 0.6, end: i * 0.6 + 0.3 }));
    const graph = graphOf(verticalArgs({ video: "/in/a.mp4", ranges, crops: ranges.map(() => CROPS[0]), out: "/out/v.mp4" }));
    const count = (text) => graph.filter((part) => part.includes(text)).length;
    assert.deepEqual([count("[0:v]"), count("[0:a]"), count("scale="), count("trim=")], [1, 1, 1, 0]);
    assert.deepEqual([count("crop="), count("nullsink"), count("concat=n=300:")], [300, 600, 1]);
  });
  it("throws away the start of the video when the first range starts after it, and nothing between two ranges that touch", () => {
    assert.deepEqual(graphOf(verticalArgs({ video: "/in/a.mp4", ranges: [{ start: 5, end: 10 }, { start: 10, end: 20.5 }], crops: CROPS, out: "/out/v.mp4" })), [
      "[0:v]segment=timestamps=5|10|20.5[pv0][pv1][pv2][pv3]",
      "[0:a]asegment=timestamps=5|10|20.5[pa0][pa1][pa2][pa3]",
      "[pv0]nullsink", "[pa0]anullsink",
      "[pv1]setpts=PTS-STARTPTS,crop=606:1080:177:0[v0]", "[pa1]asetpts=PTS-STARTPTS[a0]",
      "[pv2]setpts=PTS-STARTPTS,crop=606:1080:1137:0[v1]", "[pa2]asetpts=PTS-STARTPTS[a1]",
      "[pv3]nullsink", "[pa3]anullsink",
      "[v0][a0][v1][a1]concat=n=2:v=1:a=1[j][a]",
      "[j]scale=1080:1920,setsar=1[v]"]);
  });
  it("writes H.264 by quality and not at a fixed bitrate, 8-bit 4:2:0, with aac sound at 48 kHz and its index at the front, never asking a question", () => {
    // At a fixed 8 megabits, the upright version of a 32-minute Zoom recording of 182 MB came out at 1.79 GB.
    const a = verticalArgs({ video: "/in/a b.mp4", ranges: RANGES, crops: CROPS, out: "/out/v.mp4" });
    const after = (flag) => a[a.indexOf(flag) + 1];
    assert.deepEqual([after("-c:v"), after("-preset"), after("-pix_fmt")], ["libx264", "medium", "yuv420p"]);
    assert.match(after("-crf"), /^\d+$/);
    assert.ok(!a.includes("-b:v") && !a.includes("-maxrate"));
    assert.deepEqual([after("-c:a"), after("-ar"), after("-movflags")], ["aac", "48000", "+faststart"]);
    assert.ok(a.includes("-nostdin") && a.includes("-y"));
    assert.equal(a[a.length - 1], "/out/v.mp4");
  });
  it("spends fewer bits the more the crop is enlarged: quality 23, and 2 more for each doubling, as the source has no more detail to keep", () => {
    // The crop is the full height of the picture, made 1920 high: from 360 lines it is made more than five times its size.
    const crf = (h) => {
      const a = clipArgs({ video: "/in/a.mp4", start: 30, end: 41, crop: { x: 0, y: 0, w: Math.floor(h * 9 / 32) * 2, h, found: true }, out: "/out/c.mp4" });
      return a[a.indexOf("-crf") + 1];
    };
    assert.deepEqual([2160, 1920, 1440, 1080, 720, 480, 360].map(crf), ["23", "23", "24", "25", "26", "27", "28"]);
    // A video that keeps its shape is not cropped, and is taken as not enlarged.
    const kept = clipArgs({ video: "/in/a.mp4", start: 30, end: 41, out: "/out/c.mp4" });
    assert.equal(kept[kept.indexOf("-crf") + 1], "23");
  });
  it("tells the file it is an mp4, so that it can be written under another name and given its own when it is whole", () => {
    // ffmpeg goes by the ending of a name, and stops at one it does not know, such as .writing.
    const a = verticalArgs({ video: "/in/a b.mp4", ranges: RANGES, crops: CROPS, out: "/out/v.mp4.writing" });
    assert.deepEqual(a.slice(-3), ["-f", "mp4", "/out/v.mp4.writing"]);
    assert.deepEqual(clipArgs({ video: "/in/a b.mp4", start: 30, end: 41, out: "/out/c.mp4.writing" }).slice(-3), ["-f", "mp4", "/out/c.mp4.writing"]);
  });
  it("leaves a video that needs no new shape uncropped, and fits it inside 1080 by 1920 without stretching it", () => {
    for (const crops of [undefined, null]) {
      assert.deepEqual(verticalArgs({ video: "/in/a b.mp4", ranges: RANGES, crops, out: "/out/a b.vertical.mp4" }), [...BEFORE,
        "[0:v]segment=timestamps=12.5|30|41[pv0][pv1][pv2][pv3];" +
        "[0:a]asegment=timestamps=12.5|30|41[pa0][pa1][pa2][pa3];" +
        "[pv0]setpts=PTS-STARTPTS[v0];[pa0]asetpts=PTS-STARTPTS[a0];" +
        "[pv1]nullsink;[pa1]anullsink;" +
        "[pv2]setpts=PTS-STARTPTS[v1];[pa2]asetpts=PTS-STARTPTS[a1];" +
        "[pv3]nullsink;[pa3]anullsink;" +
        "[v0][a0][v1][a1]concat=n=2:v=1:a=1[j][a];" +
        "[j]scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1[v]",
        ...AFTER("23"), "/out/a b.vertical.mp4"]);
    }
  });
  it("joins as many ranges as it is given, in their order", () => {
    const graph = graphOf(verticalArgs({ video: "/in/a.mp4", ranges: [...RANGES, { start: 50.25, end: 58 }], crops: [...CROPS, CROPS[0]], out: "/out/v.mp4" }));
    assert.equal(graph.length, 16);
    assert.equal(graph[0], "[0:v]segment=timestamps=12.5|30|41|50.25|58[pv0][pv1][pv2][pv3][pv4][pv5]");
    assert.equal(graph[1], "[0:a]asegment=timestamps=12.5|30|41|50.25|58[pa0][pa1][pa2][pa3][pa4][pa5]");
    assert.equal(graph[10], "[pv4]setpts=PTS-STARTPTS,crop=606:1080:177:0[v2]");
    assert.equal(graph[11], "[pa4]asetpts=PTS-STARTPTS[a2]");
    assert.equal(graph[14], "[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[j][a]");
  });
  it("writes a time to the thousandth of a second, and one that a computer's sums leave a hair off 0 as 0", () => {
    // JavaScript writes such a time as 5.551115123125783e-17, and ffmpeg cannot read that.
    assert.ok(0.1 + 0.2 - 0.3 > 0 && 0.3 - 0.1 - 0.2 < 0);
    for (const start of [0.1 + 0.2 - 0.3, 0.3 - 0.1 - 0.2]) {
      const graph = graphOf(clipArgs({ video: "/in/a.mp4", start, end: 5, crop: CROPS[0], out: "/out/c.mp4" }));
      assert.deepEqual(graph.slice(0, 2), ["[0:v]segment=timestamps=5[pv0][pv1]", "[0:a]asegment=timestamps=5[pa0][pa1]"]);
    }
    const ranges = [{ start: 0.1 + 0.2, end: 2.00049 }, { start: 3.0006, end: 4.1234567 }, { start: 4.1234567, end: 0.000001 + 5 }];
    const graph = graphOf(verticalArgs({ video: "/in/a.mp4", ranges, crops: [...CROPS, CROPS[0]], out: "/out/v.mp4" }));
    assert.equal(graph[0], "[0:v]segment=timestamps=0.3|2|3.001|4.123|5[pv0][pv1][pv2][pv3][pv4][pv5]");
    assert.equal(graph[1], "[0:a]asegment=timestamps=0.3|2|3.001|4.123|5[pa0][pa1][pa2][pa3][pa4][pa5]");
  });
  it("refuses ranges that are not in rising order: a later moment put first would have every frame before it kept in memory", () => {
    assert.throws(() => verticalArgs({ video: "/in/a.mp4", ranges: [{ start: 120, end: 170 }, { start: 0, end: 50 }], crops: CROPS, out: "/out/v.mp4" }),
      { message: "The ranges must be in rising order and must not overlap: the one from 0 to 50 starts before the one before it ends." });
  });
  it("refuses ranges that overlap", () => {
    assert.throws(() => verticalArgs({ video: "/in/a.mp4", ranges: [{ start: 0, end: 30 }, { start: 10, end: 40 }], crops: CROPS, out: "/out/v.mp4" }),
      { message: "The ranges must be in rising order and must not overlap: the one from 10 to 40 starts before the one before it ends." });
  });
  it("refuses a range that does not end after it starts, or whose start or end is not a number of seconds", () => {
    for (const range of [{ start: 40, end: 31 }, { start: 40, end: 40 }, { start: 10 }, { start: "0:10", end: "0:40" }, { start: 0, end: Infinity }]) {
      assert.throws(() => verticalArgs({ video: "/in/a.mp4", ranges: [RANGES[0], range], crops: CROPS, out: "/out/v.mp4" }),
        { message: `A range must end after it starts, at times in seconds: this one runs from ${range.start} to ${range.end}.` });
    }
    // A clip is a range, and is refused the same way.
    assert.throws(() => clipArgs({ video: "/in/a.mp4", start: 10, crop: CROPS[0], out: "/out/c.mp4" }),
      { message: "A range must end after it starts, at times in seconds: this one runs from 10 to undefined." });
  });
  it("cuts one short clip the same way", () => {
    assert.deepEqual(clipArgs({ video: "/in/a b.mp4", start: 30, end: 41, crop: CROPS[1], out: "/out/a b.reel-1.mp4" }), [...BEFORE,
      "[0:v]segment=timestamps=30|41[pv0][pv1][pv2];" +
      "[0:a]asegment=timestamps=30|41[pa0][pa1][pa2];" +
      "[pv0]nullsink;[pa0]anullsink;" +
      "[pv1]setpts=PTS-STARTPTS,crop=606:1080:1137:0[v0];[pa1]asetpts=PTS-STARTPTS[a0];" +
      "[pv2]nullsink;[pa2]anullsink;" +
      "[v0][a0]concat=n=1:v=1:a=1[j][a];" +
      "[j]scale=1080:1920,setsar=1[v]",
      ...AFTER("25"), "/out/a b.reel-1.mp4"]);
  });
  it("cuts a clip from a video that needs no new shape without a crop", () => {
    assert.deepEqual(graphOf(clipArgs({ video: "/in/a b.mp4", start: 30, end: 41, out: "/out/a b.reel-1.mp4" })).slice(2), [
      "[pv0]nullsink", "[pa0]anullsink",
      "[pv1]setpts=PTS-STARTPTS[v0]", "[pa1]asetpts=PTS-STARTPTS[a0]",
      "[pv2]nullsink", "[pa2]anullsink",
      "[v0][a0]concat=n=1:v=1:a=1[j][a]",
      "[j]scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1[v]"]);
  });
});

describe("how long a clip may be", () => {
  it("goes by Instagram's limits: a Reel clip is 15 to 90 seconds, and a Story part is at most 60", () => {
    assert.deepEqual([REEL_MIN, REEL_MAX, STORY_MAX], [15, 90, 60]);
  });
  it("says a clip of 15 to 90 seconds fits a Reel", () => {
    for (const clip of [{ start: 100, end: 115 }, { start: 0, end: 90 }, { start: 12.5, end: 60 }]) assert.deepEqual(fitReel(clip), { fits: true, why: "" });
  });
  it("says in plain words why a clip does not fit", () => {
    assert.deepEqual(fitReel({ start: 100, end: 112 }), { fits: false, why: "It is 12 seconds long, and a Reel clip is at least 15 seconds." });
    assert.deepEqual(fitReel({ start: 3, end: 17.96 }), { fits: false, why: "It is 14.96 seconds long, and a Reel clip is at least 15 seconds." });
    assert.deepEqual(fitReel({ start: 0, end: 95.5 }), { fits: false, why: "It is 95.5 seconds long, and a Reel clip is at most 90 seconds." });
    assert.deepEqual(fitReel({ start: 7, end: 8 }), { fits: false, why: "It is 1 second long, and a Reel clip is at least 15 seconds." });
    for (const clip of [{ start: 40, end: 40 }, { start: 40, end: 31 }]) assert.deepEqual(fitReel(clip), { fits: false, why: "It has no length: it ends where it starts, or before." });
  });
  it("is not put off by a length that a computer's sums leave a hair short or a hair long", () => {
    assert.ok(75.1 - 60.1 < 15 && 128.3 - 38.3 > 90);
    assert.deepEqual(fitReel({ start: 60.1, end: 75.1 }), { fits: true, why: "" });
    assert.deepEqual(fitReel({ start: 38.3, end: 128.3 }), { fits: true, why: "" });
  });
  it("says a clip does not fit when its start or its end is missing or is not a number of seconds", () => {
    // No end, clock text, a pair where a {start, end} is wanted, and a clip that never ends.
    for (const clip of [{ start: 10 }, { end: 40 }, { start: "1:40", end: "2:10" }, [100, 130], { start: 0, end: Infinity }, {}]) {
      assert.deepEqual(fitReel(clip), { fits: false, why: "Its start or its end is not a time in seconds." }, JSON.stringify(clip));
    }
  });
});

describe("a clip too long for one Story", () => {
  it("is only a clip of more than 60 seconds: a shorter one is one part, as it is", () => {
    assert.deepEqual(storyParts({ start: 100, end: 160 }, []), [{ start: 100, end: 160 }]);
    assert.deepEqual(storyParts({ start: 5, end: 20 }, [[10, 11]]), [{ start: 5, end: 20 }]);
    // 64.4 - 4.4 comes out a hair over 60.
    assert.ok(64.4 - 4.4 > 60);
    assert.deepEqual(storyParts({ start: 4.4, end: 64.4 }, []), [{ start: 4.4, end: 64.4 }]);
  });
  it("is cut at the 60 second mark when nobody pauses in the 15 seconds before it", () => {
    assert.deepEqual(storyParts({ start: 100, end: 230 }, []), [{ start: 100, end: 160 }, { start: 160, end: 220 }, { start: 220, end: 230 }]);
    // These pauses are over more than 15 seconds before the mark at 160, and the next one starts after it.
    assert.deepEqual(storyParts({ start: 100, end: 170 }, [[120, 121], [143.9, 144.9], [160.5, 162]]), [{ start: 100, end: 160 }, { start: 160, end: 170 }]);
  });
  it("is cut on the last pause edge before the mark: where the last pause ends, or where one that runs over the mark starts", () => {
    assert.deepEqual(storyParts({ start: 100, end: 170 }, [[148, 149.5], [155, 156.2], [165, 166]]), [{ start: 100, end: 156.2 }, { start: 156.2, end: 170 }]);
    assert.deepEqual(storyParts({ start: 100, end: 170 }, [[148, 149.5], [158, 163]]), [{ start: 100, end: 158 }, { start: 158, end: 170 }]);
    // An edge exactly 15 seconds before the mark still counts.
    assert.deepEqual(storyParts({ start: 100, end: 170 }, [[144, 145]]), [{ start: 100, end: 145 }, { start: 145, end: 170 }]);
  });
  it("counts each part's 60 seconds from where the part before it was cut", () => {
    assert.deepEqual(storyParts({ start: 100, end: 260 }, [[149, 150], [205, 206], [215, 216]]), [{ start: 100, end: 150 }, { start: 150, end: 206 }, { start: 206, end: 260 }]);
  });
  it("makes no part longer than 60 seconds, and leaves nothing out", () => {
    const parts = storyParts({ start: 12.5, end: 400 }, [[30, 31], [70.2, 71], [118, 119.4], [200, 205], [251, 251.6], [330, 331]]);
    for (const p of parts) assert.ok(p.end - p.start <= 60 && p.end > p.start, JSON.stringify(p));
    assert.equal(parts[0].start, 12.5);
    assert.equal(parts[parts.length - 1].end, 400);
    for (let i = 1; i < parts.length; i++) assert.equal(parts[i].start, parts[i - 1].end);
  });
  it("leaves a clip that never ends as one part: a silence that never ends is given the end Infinity, and no cutting gets there", () => {
    assert.deepEqual(storyParts({ start: 0, end: Infinity }, []), [{ start: 0, end: Infinity }]);
    assert.deepEqual(storyParts({ start: 100, end: Infinity }, [[150, 151], [200, Infinity]]), [{ start: 100, end: Infinity }]);
    assert.deepEqual(clipNames("ep", [{ start: 0, end: Infinity }]), [{ reel: "ep.reel-1.mp4", story: ["ep.story-1.mp4"] }]);
  });
});

describe("what the clips are called", () => {
  it("names each clip's Reel and its Story after the video, numbered from 1", () => {
    assert.deepEqual(clipNames("Episode 12 final", [{ start: 10, end: 40 }, { start: 100, end: 160 }]), [
      { reel: "Episode 12 final.reel-1.mp4", story: ["Episode 12 final.story-1.mp4"] },
      { reel: "Episode 12 final.reel-2.mp4", story: ["Episode 12 final.story-2.mp4"] }
    ]);
  });
  it("names each part of a Story that is cut into parts", () => {
    assert.deepEqual(clipNames("ep", [{ start: 10, end: 40 }, { start: 100, end: 230 }]), [
      { reel: "ep.reel-1.mp4", story: ["ep.story-1.mp4"] },
      { reel: "ep.reel-2.mp4", story: ["ep.story-2-part-1.mp4", "ep.story-2-part-2.mp4", "ep.story-2-part-3.mp4"] }
    ]);
  });
  it("names as many parts as the Story is cut into, which the pauses decide", () => {
    const clip = { start: 0, end: 110 };
    const pauses = [[45, 46], [91, 92]];
    assert.deepEqual(clipNames("ep", [clip])[0].story, ["ep.story-1-part-1.mp4", "ep.story-1-part-2.mp4"]);
    assert.equal(storyParts(clip, pauses).length, 3);
    assert.deepEqual(clipNames("ep", [clip], pauses)[0].story, ["ep.story-1-part-1.mp4", "ep.story-1-part-2.mp4", "ep.story-1-part-3.mp4"]);
  });
  it("names nothing when there are no clips", () => {
    assert.deepEqual(clipNames("ep", []), []);
  });
});

describe("the face finder, run for real", () => {
  const FACES = fileURLToPath(new URL("../faces.swift", import.meta.url));
  const ffmpeg = findTools().ffmpeg;
  // Linux can have swift and ffmpeg too, but Apple's Vision framework, which finds the faces, is only on a Mac.
  const noFinder = process.platform !== "darwin" ? "the face finder uses Apple's Vision framework, which is only on a Mac"
    : spawnSync("swift", ["--version"]).status !== 0 ? "swift is not installed, so the face finder cannot be run" : false;
  const noStills = noFinder || (ffmpeg ? false : "ffmpeg is not installed, so there are no stills to look at");
  const find = (folder) => spawnSync("swift", [FACES, folder], { encoding: "utf8" });
  /** Run a test in a folder made for it, which is taken away again. */
  const inFolder = (test) => () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-reframe-"));
    try {
      test(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  it("finds no face in blank stills, and prints one JSON document of them in name order and nothing else", { skip: noStills }, inFolder((dir) => {
    // Twenty seconds of a blank grey picture, and the stills ffmpeg writes of it when it is asked as the tool asks.
    const video = join(dir, "blank.mp4");
    const stills = join(dir, "stills");
    mkdirSync(stills);
    const made = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=1280x720:r=5:d=20", "-c:v", "mpeg4", video], { encoding: "utf8" });
    assert.equal(made.status, 0, made.stderr);
    const cut = spawnSync(ffmpeg, stillsArgs(video, stills), { encoding: "utf8" });
    assert.equal(cut.status, 0, cut.stderr);
    const names = readdirSync(stills).sort();
    assert.ok(names.length > 5 && names[0] === "0001.jpg", names.join(" "));
    const r = find(stills);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), names.map((file) => ({ file, faces: [] })));
  }));
  it("prints [] for a folder with no stills in it", { skip: noFinder }, inFolder((dir) => {
    writeFileSync(join(dir, "notes.txt"), "not a still");
    const r = find(dir);
    assert.deepEqual([r.status, r.stdout], [0, "[]"]);
  }));
  it("says in one plain line that a folder cannot be read, prints nothing, and does not end with 0", { skip: noFinder }, inFolder((dir) => {
    const r = find(join(dir, "not there"));
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, `The folder of stills could not be read: ${join(dir, "not there")}\n`);
  }));
});

describe("storyCuts", () => {
  const words = (pairs) => pairs.map(([start, end]) => ({ w: "word", start, end }));
  it("leaves a Reel of a minute or less whole", () => {
    assert.deepEqual(storyCuts(60, { fps: "30/1" }), [{ start: 0, end: 60 }]);
  });
  it("cuts at the last pause edge in the 15 seconds before the minute", () => {
    assert.deepEqual(storyCuts(75, { pauses: [[40, 41], [50, 51.2]], words: words([[51.2, 74]]), fps: "30/1" }), [{ start: 0, end: 51.2 }, { start: 51.2, end: 75 }]);
  });
  it("cuts in the middle of the widest gap between words when no pause is heard there, as under music", () => {
    assert.deepEqual(storyCuts(75, { words: words([[44, 46], [46.1, 52], [53, 58], [58.2, 74]]), fps: "30/1" }), [{ start: 0, end: 52.5 }, { start: 52.5, end: 75 }]);
  });
  it("cuts at the minute, on the picture before it, when there is neither", () => {
    assert.deepEqual(storyCuts(75, { fps: "30/1" }), [{ start: 0, end: 60 }, { start: 60, end: 75 }]);
    const [first] = storyCuts(75, { fps: "30000/1001" });
    assert.equal(first.end, 1798 / (30000 / 1001));
  });
  it("never cuts where no word comes after, so no part is silence alone", () => {
    assert.deepEqual(storyCuts(61, { pauses: [[59, 61]], words: words([[0, 59]]), fps: "30/1" }), [{ start: 0, end: 60 }, { start: 60, end: 61 }]);
  });
  it("counts each part's minute from the last cut, not from the Reel's start", () => {
    assert.deepEqual(storyCuts(150, { pauses: [[50, 50.5]], fps: "30/1" }), [{ start: 0, end: 50.5 }, { start: 50.5, end: 110.5 }, { start: 110.5, end: 150 }]);
  });
  it("moves a cut back to the start of the picture it falls in, never forward past the minute", () => {
    const rate = 24000 / 1001;
    const [first] = storyCuts(75, { fps: "24000/1001" });
    assert.equal(first.end, 1438 / rate);
    assert.ok(first.end <= 60);
    const [onPause] = storyCuts(75, { pauses: [[50, 50.3]], fps: "24000/1001" });
    assert.equal(onPause.end, 1205 / rate);
  });
  it("cuts at a pause edge before it looks at the gaps between words, however wide a gap is", () => {
    const said = words([[40, 46.9], [47.4, 52], [55, 59], [59.5, 74]]);
    assert.deepEqual(storyCuts(75, { pauses: [[47, 47.4]], words: said, fps: "30/1" })[0], { start: 0, end: 47.4 });
  });
  it("looks for a pause or a gap only in the 15 seconds before the minute", () => {
    assert.deepEqual(storyCuts(75, { pauses: [[43, 44.9]], fps: "30/1" })[0], { start: 0, end: 60 });
    assert.deepEqual(storyCuts(75, { pauses: [[43, 45]], fps: "30/1" })[0], { start: 0, end: 45 });
    assert.deepEqual(storyCuts(75, { words: words([[30, 40], [44.5, 74]]), fps: "30/1" })[0], { start: 0, end: 60 });
  });
  it("takes no words when the word pass gave none, as when it died", () => {
    assert.deepEqual(storyCuts(75, { pauses: [[50, 51]], words: null, fps: "30/1" }), [{ start: 0, end: 51 }, { start: 51, end: 75 }]);
  });
  it("cuts a long Reel into parts of at most a minute each, each counted from the last cut", () => {
    const parts = storyCuts(130, { fps: "30000/1001" });
    assert.equal(parts.length, 3);
    for (const p of parts) assert.ok(p.end - p.start <= 60, JSON.stringify(p));
    assert.equal(parts[2].end, 130);
  });
});
