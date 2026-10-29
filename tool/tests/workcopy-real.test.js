// The working copy of an HDR video, made for real (workcopy.js). workcopy.test.js pins what ffmpeg is asked to do, with no video.
// These tests run the job itself, with the real ffmpeg and ffprobe and the real watchdog, on short made-up HDR clips, and look at
// what comes out: the colour tags, the size, whether the picture is the right way up, whether a turn is left in the file, whether
// its length is kept, and whether a smooth gradient is banded. The last tests make a Reel's video of such a clip (plan PR 5): they
// look at whether the Reel begins where its stretch does, picture and sound together. VideoToolbox decodes the clip and makes its colour standard, which
// is a Mac's own hardware, so they need a Mac whose ffmpeg lists the videotoolbox hwaccel and the scale_vt filter, that has
// libx265 to make a made-up HEVC clip with, and on which VideoToolbox does decode one. Anywhere else (CI runs on Linux) they skip
// themselves and say why, as the face finder's tests do. The clips are made in a folder made for the test, outside Dropbox and
// outside BRIMM Video Work, and taken away again. No real video is read, and no test here runs the HyperFrames app, HeyGen or Claude.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { findTools } from "../run.js";
import { hasFilters, hasHwaccel, makeWorkCopy } from "../workcopy.js";

const ffmpeg = findTools().ffmpeg;
const ffprobe = ffmpeg ? join(dirname(ffmpeg), "ffprobe") : "";
const ask = (...args) => spawnSync(ffmpeg, ["-nostdin", "-hide_banner", ...args], { encoding: "utf8", maxBuffer: 1 << 25 });
const dir = mkdtempSync(join(tmpdir(), "brimm-workcopy-real-"));
after(() => rmSync(dir, { recursive: true, force: true }));

/** HDR as an iPhone tags it: BT.2020, HLG, limited range. */
const HLG_TAGS = "setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv";
/** A picture whose left half is bright and whose right half is dark, 640 by 360, a second at 30 a second. Turned a quarter clockwise,
    as an upright phone clip is, the bright half is on top. */
const HALVES = "color=c=black:s=640x360:r=30:d=1,format=yuv420p,geq=lum='if(lt(X,W/2),200,40)':cb=128:cr=128";
/** A smooth ramp across the width, 16 steps of 10-bit luma from one side to the other: a smooth wall or sky. Taken down to 8 bits
    with no dither it is a few flat bands with hard edges; with a dither the edges are broken up. */
const RAMP = "color=c=black:s=640x360:r=30:d=1,format=yuv420p10le,geq=lum='300+16*X/W':cb=512:cr=512";

/** A made-up HDR clip in `dir`, a second of HEVC at `bits` bits (10 as an iPhone writes it, or 8) with the colour tags of an iPhone's
    HDR video and a tone for its sound, from the lavfi picture `picture`. `matrix` is the display matrix the clip is stored with, as
    ffprobe says it (-90 for a phone's upright clip), or null for none. `audio` is the lavfi source of its sound, a tone of a second
    unless it is told otherwise. Gives the clip's path. */
function clip(name, { picture, bits = 10, matrix = null, audio = "sine=frequency=440:duration=1" }) {
  const base = join(dir, `${name}.mp4`);
  const made = spawnSync(ffmpeg, [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `${picture},format=${bits === 10 ? "yuv420p10le" : "yuv420p"},${HLG_TAGS}`,
    "-f", "lavfi", "-i", audio,
    "-c:v", "libx265", "-preset", "ultrafast", "-crf", "10", "-tag:v", "hvc1", "-x265-params", "log-level=error", "-c:a", "aac", "-shortest", base
  ], { encoding: "utf8" });
  assert.equal(made.status, 0, made.stderr);
  if (matrix === null) return base;
  const turned = join(dir, `${name}.mov`);
  const noted = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-display_rotation:v:0", String(matrix), "-i", base, "-c", "copy", turned], { encoding: "utf8" });
  assert.equal(noted.status, 0, noted.stderr);
  return turned;
}

/** Why these tests cannot run here, or false when they can. */
function unable() {
  if (process.platform !== "darwin") return "VideoToolbox is on a Mac only";
  if (!ffmpeg || !existsSync(ffprobe)) return "ffmpeg and ffprobe are not installed";
  if (!hasHwaccel(ask("-hwaccels").stdout, "videotoolbox")) return "this ffmpeg has no videotoolbox hwaccel";
  if (!hasFilters(ask("-filters").stdout, ["scale_vt"])) return "this ffmpeg has no scale_vt filter";
  if (!/\blibx265\b/.test(ask("-encoders").stdout)) return "this ffmpeg has no libx265, which makes the made-up HEVC clips";
  // And that VideoToolbox does decode one here: a Mac without a hardware decoder (a virtual machine) fails, and that is not a fault of the working copy.
  const tried = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld", "-i", clip("probe", { picture: HALVES }),
    "-vf", "scale_vt=w=640:h=360:color_matrix=bt709:color_primaries=bt709:color_transfer=bt709,hwdownload,format=p010le", "-frames:v", "1", "-f", "null", "-"], { encoding: "utf8" });
  return tried.status === 0 ? false : `VideoToolbox did not decode a made-up clip here (${String(tried.stderr).trim().split("\n").pop()})`;
}
const skip = unable();

const probe = (file) => JSON.parse(spawnSync(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf8" }).stdout);
const pictureOf = (file) => probe(file).streams.find((s) => s.codec_type === "video");
/** Is a note to turn the picture left in the file, in either of the ways ffprobe says it? */
const turnLeft = (picture) => (picture.side_data_list || []).some((d) => d.side_data_type === "Display Matrix") || Boolean(picture.tags && picture.tags.rotate);

/** The first picture of a video as ffmpeg decodes it, as luma, 0 to 255, `width` by `height`. */
function luma(file, width, height) {
  const r = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", file, "-frames:v", "1", "-vf", "format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  assert.equal(r.status, 0, String(r.stderr));
  assert.equal(r.stdout.length, width * height, "the picture is not the size ffprobe says");
  return r.stdout;
}
/** The mean luma of the top, bottom, left and right halves of a picture. */
function halves(file, width, height) {
  const grey = luma(file, width, height);
  const mean = (x0, x1, y0, y1) => {
    let sum = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += grey[y * width + x];
    return sum / ((x1 - x0) * (y1 - y0));
  };
  return { top: mean(0, width, 0, height / 2), bottom: mean(0, width, height / 2, height), left: mean(0, width / 2, 0, height), right: mean(width / 2, width, 0, height) };
}

let homes = 0;
/** Make the working copy of a made-up clip, the real job with the real programs, on a home folder of its own in the test's folder.
    `more` is more for the job to be given: a Reel's stretch of the clip (`reel`), for the copy of one Reel. */
async function made(video, more = {}) {
  const logs = [];
  const result = await makeWorkCopy({ home: join(dir, `home-${(homes += 1)}`), folder: "2026-10-28 Made-up HDR", video, name: "a made-up HDR clip", ...more }, { tools: { ffmpeg, ffprobe }, log: (line) => logs.push(line) });
  assert.deepEqual([result.ok, result.failed], [true, []], logs.join("\n"));
  return result;
}

describe("the filters and hardware decoders ffmpeg lists, read as ffmpeg prints them", { skip: ffmpeg && existsSync(ffprobe) ? false : "ffmpeg and ffprobe are not installed" }, () => {
  it("finds every filter this ffmpeg lists, whatever the width of its column of flags", () => {
    const lines = ask("-filters").stdout.split("\n").map((line) => line.trim().split(/\s+/));
    // A filter line is flags, a name, and what it takes and gives (V->V): the legend and the headings are not.
    const names = lines.filter(([flags, , io]) => /^[A-Za-z.|]+$/.test(flags || "") && /^[A-Z|]+->[A-Z|]+$/.test(io || "")).map(([, name]) => name);
    assert.ok(names.length > 100, `${names.length} filters`);
    assert.equal(hasFilters(ask("-filters").stdout, names), true, names.join(" "));
    assert.equal(hasFilters(ask("-filters").stdout, ["no_such_filter_here"]), false);
  });
  it("finds every hardware decoder this ffmpeg lists, and none it does not", () => {
    const listing = ask("-hwaccels").stdout;
    const methods = listing.split("\n").map((line) => line.trim()).filter((line) => /^\w+$/.test(line));
    for (const method of methods) assert.equal(hasHwaccel(listing, method), true, method);
    assert.equal(hasHwaccel(listing, "no_such_decoder"), false);
    assert.equal(hasHwaccel(listing, "Hardware"), false);
  });
});

describe("the working copy of an HDR video, made with the real ffmpeg", { skip }, () => {
  it("makes an iPhone's upright HDR clip standard: BT.709 tags, 8-bit 4:2:0, upright, its width and height swapped, no turn left in the file, and its length kept", async () => {
    // Stored 640 by 360 with a display matrix of -90, as a phone stores an upright clip: shown 360 by 640, with the bright half on top.
    const video = clip("upright", { picture: HALVES, matrix: -90 });
    const source = pictureOf(video);
    assert.deepEqual([source.width, source.height, source.color_transfer, source.color_primaries, source.pix_fmt], [640, 360, "arib-std-b67", "bt2020", "yuv420p10le"]);
    assert.ok(turnLeft(source), "the made-up clip was not stored turned");
    const result = await made(video);
    assert.ok(result.made.includes("its HDR colours made standard"), result.made.join(", "));
    const copy = pictureOf(result.paths.video);
    assert.deepEqual([copy.pix_fmt, copy.color_space, copy.color_transfer, copy.color_primaries, copy.color_range], ["yuv420p", "bt709", "bt709", "bt709", "tv"]);
    assert.deepEqual([copy.width, copy.height], [360, 640]);
    assert.equal(turnLeft(copy), false, JSON.stringify(copy.side_data_list));
    assert.ok(Math.abs(Number(probe(result.paths.video).format.duration) - Number(probe(video).format.duration)) < 0.15, "the length is not kept");
    // The right way up: the bright half is on top, and its sides are the same.
    const seen = halves(result.paths.video, 360, 640);
    assert.ok(seen.top - seen.bottom > 60, JSON.stringify(seen));
    assert.ok(Math.abs(seen.left - seen.right) < 10, JSON.stringify(seen));
  });
  it("turns a clip stored turned the other way a quarter the other way, and a clip stored turned round a half turn, as ffmpeg's own turning would", async () => {
    const cases = [
      // The matrix ffprobe says, the size shown, and where the bright half of the stored picture's left side lands.
      [90, 360, 640, ({ top, bottom }) => bottom - top > 60, "on the bottom"],
      [-180, 640, 360, ({ left, right }) => right - left > 60, "on the right"],
      [-90, 360, 640, ({ top, bottom }) => top - bottom > 60, "on top"]
    ];
    for (const [matrix, width, height, rightWayUp, where] of cases) {
      const video = clip(`turned-${matrix}`, { picture: HALVES, matrix });
      const result = await made(video);
      const copy = pictureOf(result.paths.video);
      assert.deepEqual([copy.width, copy.height], [width, height], `${matrix}`);
      assert.equal(turnLeft(copy), false, `${matrix}`);
      const seen = halves(result.paths.video, width, height);
      assert.ok(rightWayUp(seen), `${matrix}: the bright half should be ${where}: ${JSON.stringify(seen)}`);
    }
  });
  it("leaves a clip that is stored upright as it is, with nothing turned and none left", async () => {
    const result = await made(clip("plain", { picture: HALVES }));
    const copy = pictureOf(result.paths.video);
    assert.deepEqual([copy.width, copy.height, turnLeft(copy)], [640, 360, false]);
    const seen = halves(result.paths.video, 640, 360);
    assert.ok(seen.left - seen.right > 60, JSON.stringify(seen));
    assert.ok(Math.abs(seen.top - seen.bottom) < 10, JSON.stringify(seen));
  });
  it("makes an HDR clip of 8 bits standard too, the same way up", async () => {
    const result = await made(clip("eight", { picture: HALVES, bits: 8, matrix: -90 }));
    const copy = pictureOf(result.paths.video);
    assert.deepEqual([copy.pix_fmt, copy.color_space, copy.width, copy.height, turnLeft(copy)], ["yuv420p", "bt709", 360, 640, false]);
    const seen = halves(result.paths.video, 360, 640);
    assert.ok(seen.top - seen.bottom > 60, JSON.stringify(seen));
  });
  it("does not band a smooth gradient: the drop to 8 bits is dithered, so its edges are broken up and it is not a few flat bands", async () => {
    // 16 steps of 10 bits across 640 pixels come out as four 8-bit levels. With no dither, a row changes level three times, at the
    // edges of the bands; the dither makes it change back and forth along them, a hundred times and more.
    const result = await made(clip("ramp", { picture: RAMP }));
    const grey = luma(result.paths.video, 640, 360);
    const row = (y) => grey.subarray(y * 640, (y + 1) * 640);
    const changes = (y) => row(y).reduce((n, v, x) => n + (x > 0 && v !== row(y)[x - 1] ? 1 : 0), 0);
    assert.ok(new Set(row(100)).size >= 3, [...new Set(row(100))].join(","));
    assert.ok(changes(100) > 40 && changes(101) > 40, `${changes(100)} and ${changes(101)} changes along a row`);
  });
});

// --- A Reel's video of an HDR recording (plan PR 5; architecture 4.3 and 5.7) ---

/** The luma of every picture of a video, made `width` by `height` samples: one array of samples for each picture, in order. */
function pictures(file, width, height) {
  const r = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", file, "-vf", `scale=${width}:${height},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  assert.equal(r.status, 0, String(r.stderr));
  const size = width * height;
  assert.equal(r.stdout.length % size, 0, "the pictures are not the size ffprobe says");
  return Array.from({ length: r.stdout.length / size }, (_, i) => r.stdout.subarray(i * size, (i + 1) * size));
}
/** The mean of `region` of a picture `width` by `height`: its top half, or its left half. */
function regionMean(picture, width, height, region) {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (region === "top" ? y < height / 2 : x < width / 2) {
        sum += picture[y * width + x];
        n += 1;
      }
    }
  }
  return sum / n;
}
/** The time in seconds at which the sound of a video first rises above silence: its first sample of more than a tenth of the loudest
    a sound can be, read as 48 kHz mono. */
function soundStartsAt(file) {
  const r = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", file, "-vn", "-ac", "1", "-ar", "48000", "-f", "s16le", "-"], { maxBuffer: 1 << 27 });
  assert.equal(r.status, 0, String(r.stderr));
  for (let i = 0; i + 1 < r.stdout.length; i += 2) if (Math.abs(r.stdout.readInt16LE(i)) > 3277) return i / 2 / 48000;
  return Infinity;
}

describe("a Reel's video of an HDR recording, made with the real ffmpeg", { skip }, () => {
  // Four seconds, 30 pictures a second. The left half of the stored picture is bright for the first two seconds and dark after; its
  // right half stays as it is. The sound is silence for two seconds and then a tone. So where the picture goes dark, and where the
  // sound starts, say which moment of the recording a Reel's first picture and first sound are: a stretch that begins at 1.5 seconds
  // has them half a second in, and it has them at the same time.
  const TIMED = "color=c=black:s=640x360:r=30:d=4,format=yuv420p,geq=lum='if(lt(X,W/2),if(lt(T,2),200,40),120)':cb=128:cr=128";
  const TONE_FROM_TWO = "aevalsrc=exprs='if(gte(t,2),0.5*sin(2*PI*440*t),0)':s=48000:d=4";
  const CHANGE = 2;
  const cases = [
    // A phone's upright clip, stored on its side: shown 360 by 640, and the stored left half is the top.
    ["stored on its side, as a phone stores an upright clip", -90, 360, 640, "top"],
    ["stored upright", null, 640, 360, "left"]
  ];
  for (const [what, matrix, width, height, region] of cases) {
    for (const start of [1.5, 1.55]) {
      it(`starts a Reel at its stretch's start, picture and sound together, of a clip ${what}, for a stretch from ${start} seconds`, async () => {
        const video = clip(`timed-${matrix}-${start}`, { picture: TIMED, matrix, audio: TONE_FROM_TWO });
        const result = await made(video, { reel: { n: 2, start, end: 3 } });
        assert.deepEqual(result.made.slice(0, 1).concat(result.made.slice(-1)), ["the video for Reel 2", "its HDR colours made standard"], result.made.join(", "));
        const copy = probe(result.paths.video);
        const picture = copy.streams.find((s) => s.codec_type === "video");
        const sound = copy.streams.find((s) => s.codec_type === "audio");
        // The way up, the colour tags and the length are the working copy's, and the length is the stretch's.
        assert.deepEqual([picture.width, picture.height, picture.pix_fmt, picture.color_space, picture.color_transfer, picture.color_primaries], [width, height, "yuv420p", "bt709", "bt709", "bt709"]);
        assert.equal(turnLeft(picture), false, JSON.stringify(picture.side_data_list));
        assert.ok(Math.abs(Number(copy.format.duration) - (3 - start)) < 0.12, `${copy.format.duration} seconds for a stretch of ${3 - start}`);
        // Both streams begin at 0: the Reel's own clock starts at its first moment.
        assert.ok(Math.abs(Number(picture.start_time)) < 0.1 && Math.abs(Number(sound.start_time)) < 0.1, `picture ${picture.start_time}, sound ${sound.start_time}`);
        // The picture goes dark where the recording does, counted from the stretch's start.
        const means = pictures(result.paths.video, width / 40, height / 40).map((p) => regionMean(p, width / 40, height / 40, region));
        const light = means[0];
        const dark = means[means.length - 1];
        assert.ok(light - dark > 80, `${light} then ${dark}`);
        const wentDark = means.findIndex((m) => m < (light + dark) / 2);
        assert.ok(Math.abs(wentDark / 30 - (CHANGE - start)) < 0.06, `the picture went dark at picture ${wentDark}, which is ${wentDark / 30} seconds in; it should be ${CHANGE - start}`);
        // The sound starts where the recording's does, and with the picture.
        const toneAt = soundStartsAt(result.paths.video);
        assert.ok(Math.abs(toneAt - (CHANGE - start)) < 0.08, `the sound started ${toneAt} seconds in; it should be ${CHANGE - start}`);
        assert.ok(Math.abs(toneAt - wentDark / 30) < 0.1, `the picture changed at ${wentDark / 30} and the sound at ${toneAt}`);
      });
    }
  }
  it("cuts the stretch of a Reel from a recording of 8 bits too, the same way up and at the same moment", async () => {
    const video = clip("timed-eight", { picture: TIMED, bits: 8, matrix: -90, audio: TONE_FROM_TWO });
    const result = await made(video, { reel: { n: 3, start: 1.5, end: 3 } });
    const copy = pictureOf(result.paths.video);
    assert.deepEqual([copy.width, copy.height, copy.pix_fmt, turnLeft(copy)], [360, 640, "yuv420p", false]);
    const means = pictures(result.paths.video, 9, 16).map((p) => regionMean(p, 9, 16, "top"));
    const wentDark = means.findIndex((m) => m < (means[0] + means[means.length - 1]) / 2);
    assert.ok(Math.abs(wentDark / 30 - (CHANGE - 1.5)) < 0.06, `the picture went dark at ${wentDark / 30} seconds in`);
  });
});
