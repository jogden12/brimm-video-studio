// The working copy of a raw video (workcopy.js): the video HyperFrames is given to edit. What it is made as, the words said when
// a video cannot be used, the key and the places of the copy are all decided from what ffprobe printed, so the arguments and the
// words are tested here with no video. The job is tested with stand-ins for ffprobe and ffmpeg, which write the files the real
// programs would. No test here runs ffmpeg or ffprobe, and none touches the real Final Cut Pro, HyperFrames or Claude. The job
// run with the real ffmpeg, on made-up HDR clips, is workcopy-real.test.js, which needs a Mac that has VideoToolbox and skips
// itself anywhere else.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { factsOf, streamsOf, colourOf, encodeArgs } from "../cuts.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { clearRuns } from "../filing.js";
import { episodeWork, runsFolder, workFolder } from "../settings.js";
import { STILL_EVERY } from "../reframe.js";
import {
  rateOf, workCopySize, isHdr, storedOf, workCopyArgs, workCopyFault, workCopyKey, workCopyPaths, workCopyFacts, workCopyLimits, workCopyNotes,
  canNotBeUsed, hasFilters, hasHwaccel, makeWorkCopy, requestWorkCopy, workCopyLockOf, WORK_COPY_STEP, WORK_COPY_STEPS, WORK_COPY_DONE, WORK_COPY_CRF, WORK_COPY_PRESET,
  reelCopyKey, reelCopyPaths, FACES_STEP, REEL_COPY_STEPS
} from "../workcopy.js";

/** What ffprobe writes of a video, cut down to what the tool reads: its picture (null for none), then its sounds in the order
    given, each with the number it has in the file. The picture is a 4K one of 30 a second, in standard colour, unless it is told
    otherwise. */
const printedOf = ({ picture = {}, sounds = [{ codec_name: "aac" }], duration = "23.423400" } = {}) => JSON.stringify({
  streams: [
    ...(picture ? [{
      index: 0, codec_type: "video", codec_name: "hevc", width: 3840, height: 2160, r_frame_rate: "30/1", avg_frame_rate: "30/1", start_time: "0.000000",
      color_range: "tv", color_space: "bt709", color_transfer: "bt709", color_primaries: "bt709", disposition: { attached_pic: 0 }, ...picture
    }] : []),
    ...sounds.map((sound, i) => ({ index: (picture ? 1 : 0) + i, codec_type: "audio", sample_rate: "44100", channels: 2, start_time: "0.000000", ...sound }))
  ],
  format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", start_time: "0.000000", duration }
});
/** The colour of an iPhone's HDR video, and of one in PQ: both 10 bits, 4:2:0, as an iPhone writes them. */
const HLG = { color_primaries: "bt2020", color_transfer: "arib-std-b67", color_space: "bt2020nc", pix_fmt: "yuv420p10le" };
const PQ = { color_primaries: "bt2020", color_transfer: "smpte2084", color_space: "bt2020nc", pix_fmt: "yuv420p10le" };
/** An iPhone's clip, turned on its side: coded 3840 by 2160, with a note to turn it a quarter. */
const UPRIGHT = { side_data_list: [{ side_data_type: "Display Matrix", rotation: -90 }] };
/** An iPhone's HDR clip of 1920 by 1080, stored turned round (a display matrix of -180, and a Dolby Vision record beside it), with
    the rate that wanders a little: the shape ffprobe printed of a real one. */
const TURNED_ROUND = {
  ...HLG, width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "1662900/55433",
  side_data_list: [{ side_data_type: "DOVI configuration record", dv_profile: 8, dv_bl_signal_compatibility_id: 4 }, { side_data_type: "Display Matrix", rotation: -180 }]
};

/** Everything the module decides from what ffprobe printed, as the job asks for it. */
const factsFrom = (printed) => ({ facts: factsOf(printed), streams: streamsOf(printed), colour: colourOf(printed), rate: rateOf(printed).rate, stored: storedOf(printed) });
const argsFor = (printed, more = {}, input = "/in/a b.mov", output = "/out/work/key.mp4") => workCopyArgs(input, output, { ...factsFrom(printed), ...more });
const after = (args, flag) => args[args.indexOf(flag) + 1];

/** What ffmpeg prints for -filters, with the filters given among the others: a source, and the names that merely begin as the
    ones looked for do, as scale_vaapi does for scale_vt. The column of flags before each name is the width `flags` is: three
    characters, as ffmpeg printed it before, or two (`listing(".S", ...)`), as ffmpeg 9.0.2 on the Mac Studio prints it. */
const listing = (flags, names) => {
  const plainFlags = ".".repeat(flags.length);
  return `Filters:
  T.. = Timeline support
  .S. = Slice threading
${flags.length === 3 ? "  ..C = Command support\n" : ""}  A = Audio input/output
  V = Video input/output
  N = Dynamic number and/or type of input/output
  | = Source or sink filter
  ------
 ${plainFlags} aresample         A->A       Resample audio data.
 ${plainFlags} fps               V->V       Force constant framerate.
${names.map((name) => ` ${flags} ${name.padEnd(17)} V->V       A filter.`).join("\n")}
 ${plainFlags} yuvtestsrc        |->V       Generate YUV test pattern.
`;
};
const filtersOf = (...names) => listing(".S.", names);
/** The same, in the two-character column of flags ffmpeg 9.0.2 prints. */
const filtersOf9 = (...names) => listing(".S", names);
/** What ffmpeg prints for -hwaccels, with the methods given. */
const hwaccelsOf = (...names) => `Hardware acceleration methods:\n${names.map((name) => `${name}\n`).join("")}`;
/** A Mac's ffmpeg that can make an HDR video standard: the filter that sizes and converts the colour in VideoToolbox, with names
    that merely begin as it does beside it, and the hwaccel that decodes in VideoToolbox. */
const WITH_SCALE_VT = filtersOf9("scale_vt", "scale_vaapi", "tonemap");
const WITH_VIDEOTOOLBOX = hwaccelsOf("videotoolbox");

/** Words Sallie reads hold no path, no flag and no command name. */
const plain = (text) => !/[/\\]/.test(text) && !/(^|\s)--?[A-Za-z]/.test(text) && !/ffmpeg|ffprobe|zscale|tonemap|scale_vt|videotoolbox|hwaccel|x264|libx|\.mp4|\.json|\.js\b|workcopy|node\b/i.test(text);

describe("the frame rate of a working copy", () => {
  const rates = (r_frame_rate, avg_frame_rate) => printedOf({ picture: { r_frame_rate, avg_frame_rate } });
  it("is the video's own when its two rates agree, so a video of 24 a second stays at 24 and is not made 30", () => {
    assert.deepEqual(rateOf(rates("24/1", "24/1")), { rate: "24", steady: true });
    assert.deepEqual(rateOf(rates("30000/1001", "30000/1001")), { rate: "30000/1001", steady: true });
  });
  it("takes two rates within a half per cent of each other as one: a measured rate is a little off even for a steady video", () => {
    // 30000/1001 is 29.97 a second, and 30 is a tenth of a per cent more. 29.9 is a third of a per cent less than 30.
    assert.deepEqual(rateOf(rates("30000/1001", "30/1")), { rate: "30000/1001", steady: true });
    assert.deepEqual(rateOf(rates("30/1", "2990/100")), { rate: "30", steady: true });
  });
  it("is 30, and not steady, when the two differ by more: a phone or Zoom video, whose pictures come at uneven times", () => {
    // What ffprobe printed for a made-up recording of 60 a second with some of its pictures dropped at random (37.97 on average),
    // and one of 29.8 a second against 30.
    assert.deepEqual(rateOf(rates("60/1", "3000/79")), { rate: "30", steady: false });
    assert.deepEqual(rateOf(rates("30/1", "2980/100")), { rate: "30", steady: false });
  });
  it("takes the one rate there is when only one can be used, and 30 when neither can, as the rough cut does", () => {
    assert.deepEqual(rateOf(rates("0/0", "25/1")), { rate: "25", steady: true });
    // A rate of 90000 a second is the time base of a file whose pictures come at any time: it is not one to make a video at.
    assert.deepEqual(rateOf(rates("90000/1", "2997/100")), { rate: "2997/100", steady: true });
    assert.deepEqual(rateOf(rates("0/0", "0/0")), { rate: "30", steady: true });
    assert.deepEqual(rateOf(rates(undefined, undefined)), { rate: "30", steady: true });
  });
  it("is none for a file with no picture, a cover picture passed over, or what cannot be read", () => {
    assert.deepEqual(rateOf(printedOf({ picture: null })), { rate: "", steady: true });
    const cover = printedOf({ picture: { disposition: { attached_pic: 1 } } });
    assert.deepEqual(rateOf(cover), { rate: "", steady: true });
    assert.deepEqual(rateOf("{"), { rate: "", steady: true });
    assert.deepEqual(rateOf(""), { rate: "", steady: true });
  });
});

describe("the size of a working copy", () => {
  it("makes the longer side 1920 at most and the other side an even number, whatever way up the picture is", () => {
    assert.deepEqual(workCopySize({ width: 3840, height: 2160 }), { width: 1920, height: 1080 });
    assert.deepEqual(workCopySize({ width: 2160, height: 3840 }), { width: 1080, height: 1920 });
    // 2160 of 4096 is 1012.5 of 1920.
    assert.deepEqual(workCopySize({ width: 4096, height: 2160 }), { width: 1920, height: 1012 });
    assert.deepEqual(workCopySize({ width: 2400, height: 2400 }), { width: 1920, height: 1920 });
  });
  it("never makes a picture larger: one that is small enough keeps its size, and an odd side is made one less", () => {
    assert.deepEqual(workCopySize({ width: 1280, height: 720 }), { width: 1280, height: 720 });
    assert.deepEqual(workCopySize({ width: 1920, height: 1080 }), { width: 1920, height: 1080 });
    assert.deepEqual(workCopySize({ width: 1080, height: 1920 }), { width: 1080, height: 1920 });
    assert.deepEqual(workCopySize({ width: 1919, height: 1081 }), { width: 1918, height: 1080 });
  });
  it("lets the longer side be 3840 with the 4K switch, and no more", () => {
    assert.deepEqual(workCopySize({ width: 3840, height: 2160 }, true), { width: 3840, height: 2160 });
    assert.deepEqual(workCopySize({ width: 2160, height: 3840 }, true), { width: 2160, height: 3840 });
    assert.deepEqual(workCopySize({ width: 7680, height: 4320 }, true), { width: 3840, height: 2160 });
    assert.deepEqual(workCopySize({ width: 1280, height: 720 }, true), { width: 1280, height: 720 });
  });
  it("is nothing for a file with no picture", () => {
    assert.deepEqual(workCopySize({ width: 0, height: 0 }), { width: 0, height: 0 });
  });
});

describe("HDR", () => {
  it("is a picture of BT.2020 colour with an HLG or a PQ transfer, as an iPhone writes it", () => {
    assert.equal(isHdr({ primaries: "bt2020", transfer: "arib-std-b67" }), true);
    assert.equal(isHdr({ primaries: "bt2020", transfer: "smpte2084" }), true);
  });
  it("is not standard colour, nor wide colour with an ordinary transfer, nor a picture whose colour is not known", () => {
    assert.equal(isHdr({ primaries: "bt709", transfer: "bt709" }), false);
    assert.equal(isHdr({ primaries: "bt2020", transfer: "bt2020-10" }), false);
    assert.equal(isHdr({ primaries: "bt709", transfer: "arib-std-b67" }), false);
    assert.equal(isHdr({ primaries: "", transfer: "" }), false);
    assert.equal(isHdr(null), false);
  });
});

describe("how a picture is stored: the turn it is shown with, and how deep its colour is", () => {
  const turnOf = (picture) => storedOf(printedOf({ picture })).turn;
  const withMatrix = (rotation) => ({ side_data_list: [{ side_data_type: "Display Matrix", rotation }] });
  it("is the degrees clockwise the picture is turned to be upright, which ffprobe's rotation counts the other way", () => {
    // An iPhone's upright clip: ffprobe says -90, and the picture is turned a quarter clockwise. Jason's, stored turned round, says -180.
    assert.equal(turnOf(UPRIGHT), 90);
    assert.equal(turnOf(withMatrix(-180)), 180);
    assert.equal(turnOf(withMatrix(180)), 180);
    assert.equal(turnOf(withMatrix(90)), 270);
    assert.equal(turnOf(TURNED_ROUND), 180);
    assert.equal(turnOf(withMatrix(-45)), 45);
  });
  it("is 0 for a picture with no note to turn it, or a note that says so, and for what cannot be read", () => {
    assert.equal(turnOf({}), 0);
    assert.equal(turnOf(withMatrix(0)), 0);
    assert.equal(turnOf({ side_data_list: [{ side_data_type: "DOVI configuration record" }] }), 0);
    assert.deepEqual(storedOf("{"), { turn: 0, bits: 10 });
    assert.deepEqual(storedOf(""), { turn: 0, bits: 10 });
    assert.deepEqual(storedOf(printedOf({ picture: null })), { turn: 0, bits: 10 });
  });
  it("reads the old rotate tag too, which counted clockwise already, as factsOf does for the sides", () => {
    assert.equal(turnOf({ tags: { rotate: "90" } }), 90);
    assert.equal(turnOf({ tags: { rotate: "270" } }), 270);
    assert.equal(turnOf({ tags: { rotate: "0" } }), 0);
    // The note in the side data is the newer one and wins, as it does in factsOf.
    assert.equal(turnOf({ ...withMatrix(-90), tags: { rotate: "180" } }), 90);
  });
  it("is the bits of the colour of each sample, from the pixel format: 10 for an iPhone's HDR, 8 for a plain 4:2:0", () => {
    const bitsOf = (pix_fmt) => storedOf(printedOf({ picture: { pix_fmt } })).bits;
    assert.equal(bitsOf("yuv420p10le"), 10);
    assert.equal(bitsOf("p010le"), 10);
    assert.equal(bitsOf("yuv420p12le"), 12);
    assert.equal(bitsOf("yuv420p"), 8);
    assert.equal(bitsOf("nv12"), 8);
    // Not told, it is the 10 an HDR picture is.
    assert.equal(storedOf(printedOf()).bits, 10);
  });
  it("is of the picture, and never of a cover picture or a sound", () => {
    const cover = JSON.stringify({ streams: [{ index: 0, codec_type: "video", pix_fmt: "yuv420p", disposition: { attached_pic: 1 }, ...withMatrix(-90) }, { index: 1, codec_type: "audio" }] });
    assert.deepEqual(storedOf(cover), { turn: 0, bits: 10 });
  });
});

describe("the arguments ffmpeg is given for a working copy", () => {
  it("make a wide 4K video of 30 a second, in standard colour, 1920 by 1080, with its picture and its sound mapped, and nothing cut", () => {
    assert.deepEqual(argsFor(printedOf()), [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", "/in/a b.mov",
      "-map", "0:0", "-map", "0:1",
      "-vf", "fps=30:start_time=0,scale=1920:1080,format=yuv420p",
      "-af", "aresample=async=1:first_pts=0",
      "-sn", "-dn", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart",
      "-profile:v", "high", "-g", "30",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-f", "mp4", "/out/work/key.mp4"
    ]);
  });
  it("take the picture and the sound the streams name, and not the ones ffmpeg would pick itself", () => {
    const printed = printedOf({ sounds: [{ codec_name: "apple_apac", channels: 4 }, { codec_name: "aac" }] });
    const a = argsFor(printed);
    // The picture is stream 0, the APAC sound stream 1 and the AAC stream 2: it is the AAC that is taken.
    assert.deepEqual(a.slice(a.indexOf("-map"), a.indexOf("-vf")), ["-map", "0:0", "-map", "0:2"]);
    assert.equal(a.filter((x) => x === "-map").length, 2);
  });
  it("make a picture of more than 1920 on a side 1920, never a larger one 1920, and keep the other side even", () => {
    assert.match(after(argsFor(printedOf({ picture: { width: 4096, height: 2160 } })), "-vf"), /,scale=1920:1012,/);
    assert.match(after(argsFor(printedOf({ picture: { width: 1280, height: 720 } })), "-vf"), /,scale=1280:720,/);
    assert.match(after(argsFor(printedOf({ picture: { width: 1919, height: 1081 } })), "-vf"), /,scale=1918:1080,/);
  });
  it("size an upright iPhone clip from the picture as it is shown, so 2160 by 3840 comes out 1080 by 1920", () => {
    const printed = printedOf({ picture: UPRIGHT });
    // ffprobe says 3840 by 2160 of it, and the note to turn it: factsOf gives the sides as they are shown.
    assert.deepEqual([factsOf(printed).width, factsOf(printed).height], [2160, 3840]);
    assert.match(after(argsFor(printed), "-vf"), /,scale=1080:1920,/);
  });
  it("make the longer side 3840 at most with the 4K switch, and 1920 without it", () => {
    assert.match(after(argsFor(printedOf(), { fourK: true }), "-vf"), /,scale=3840:2160,/);
    assert.match(after(argsFor(printedOf(), { fourK: false }), "-vf"), /,scale=1920:1080,/);
    assert.match(after(argsFor(printedOf({ picture: { width: 7680, height: 4320 } }), { fourK: true }), "-vf"), /,scale=3840:2160,/);
  });
  it("keep a rate of 24 a second at 24, with a keyframe every second", () => {
    const a = argsFor(printedOf({ picture: { r_frame_rate: "24/1", avg_frame_rate: "24/1" } }));
    assert.match(after(a, "-vf"), /^fps=24:start_time=0,/);
    assert.equal(after(a, "-g"), "24");
  });
  it("make a video whose two rates differ 30 a second, which the rate it is given says", () => {
    const printed = printedOf({ picture: { r_frame_rate: "60/1", avg_frame_rate: "3000/79" } });
    const a = argsFor(printed);
    assert.match(after(a, "-vf"), /^fps=30:start_time=0,/);
    assert.equal(after(a, "-g"), "30");
    // Without the rate it is told, the video is made at 30 too, which is always a rate to make a video at.
    assert.match(after(workCopyArgs("/in/a.mov", "/out/a.mp4", { ...factsFrom(printed), rate: undefined }), "-vf"), /^fps=30:start_time=0,/);
  });
  it("round a rate such as 29.97 to the whole pictures a second the keyframes are spaced by", () => {
    const a = argsFor(printedOf({ picture: { r_frame_rate: "30000/1001", avg_frame_rate: "30000/1001" } }));
    assert.match(after(a, "-vf"), /^fps=30000\/1001:start_time=0,/);
    assert.equal(after(a, "-g"), "30");
    assert.equal(after(argsFor(printedOf({ picture: { r_frame_rate: "60/1", avg_frame_rate: "60/1" } })), "-g"), "60");
  });
  it("handle the clock as the rough cut does, so that a time in the cut plan is a time in the working copy: nothing is cut", () => {
    const a = argsFor(printedOf());
    // Every picture is given a place on an even grid from 0, and the sound is put on the file's clock first, with silence where
    // it has none.
    assert.match(after(a, "-vf"), /^fps=30:start_time=0,/);
    assert.equal(after(a, "-af"), "aresample=async=1:first_pts=0");
    for (const word of ["select", "aselect", "trim", "atrim", "setpts", "-ss", "-to", "-t", "-itsoffset"]) assert.ok(!a.some((x) => String(x).includes(word)), word);
  });
  it("are H.264 High, 8-bit 4:2:0, written by quality and never at a fixed bitrate, with the sound as AAC at 48 kHz that encodeArgs asks for", () => {
    const a = argsFor(printedOf());
    const settings = encodeArgs(WORK_COPY_CRF, WORK_COPY_PRESET);
    assert.deepEqual(a.slice(a.indexOf("-c:v"), a.indexOf("-c:v") + settings.length), settings);
    assert.deepEqual([WORK_COPY_CRF, WORK_COPY_PRESET], [18, "veryfast"]);
    assert.deepEqual([after(a, "-profile:v"), after(a, "-pix_fmt"), after(a, "-c:a"), after(a, "-ar"), after(a, "-movflags")], ["high", "yuv420p", "aac", "48000", "+faststart"]);
    assert.ok(!a.includes("-b:v") && !a.includes("-maxrate"));
  });
  it("have a keyframe every second, so that a place in the video is reached quickly when it is scrubbed", () => {
    assert.equal(after(argsFor(printedOf()), "-g"), "30");
    assert.equal(after(argsFor(printedOf({ picture: { r_frame_rate: "25/1", avg_frame_rate: "25/1" } })), "-g"), "25");
  });
  it("tag the picture BT.709, limited range, whatever colour it had", () => {
    const tags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];
    for (const picture of [{}, HLG, PQ, { color_primaries: undefined, color_transfer: undefined, color_space: undefined, color_range: undefined }]) {
      const a = argsFor(printedOf({ picture }));
      assert.deepEqual(a.slice(a.indexOf("-colorspace"), a.indexOf("-colorspace") + 8), tags, JSON.stringify(picture));
    }
  });
  // An HDR video is made standard by the Mac's own hardware: VideoToolbox decodes it, sizes it and converts its colour to BT.709
  // (scale_vt), ffmpeg downloads the frames, turns them by the note the video is stored with, and writes them as 8 bits. The
  // look of it is for Jason's eye (plan, PR 3, step 5); these tests pin what ffmpeg is asked to do.
  const SCALE_VT = (w, h) => `scale_vt=w=${w}:h=${h}:color_matrix=bt709:color_primaries=bt709:color_transfer=bt709`;
  const HARDWARE = ["-noautorotate", "-display_rotation", "0", "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld"];
  it("decode an iPhone's HLG video with VideoToolbox, before its input, and turn ffmpeg's own turning of the picture off", () => {
    const a = argsFor(printedOf({ picture: HLG }));
    assert.deepEqual(a.slice(0, 14), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...HARDWARE, "-i", "/in/a b.mov"]);
    // The picture and the sound are mapped by their numbers, as they are for any video.
    assert.deepEqual(a.slice(14, 18), ["-map", "0:0", "-map", "0:1"]);
  });
  it("size an HLG video and make its colour BT.709 in VideoToolbox, download it as 10 bits, and write it as 8-bit 4:2:0", () => {
    const a = argsFor(printedOf({ picture: HLG }));
    assert.equal(after(a, "-vf"), `fps=30:start_time=0,${SCALE_VT(1920, 1080)},hwdownload,format=p010le,format=yuv420p`);
    // What is written is tagged BT.709, limited range, as any working copy is.
    assert.deepEqual(a.slice(a.indexOf("-colorspace"), a.indexOf("-colorspace") + 8), ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]);
    assert.deepEqual([after(a, "-pix_fmt"), after(a, "-profile:v")], ["yuv420p", "high"]);
  });
  it("end in 8 bits last, after the picture is turned and nothing else is done to its colour, so that it is ffmpeg's scaler that drops the 10 bits, which dithers", () => {
    // VideoToolbox makes the colour standard in 10 bits. The step to 8 is ffmpeg's own, the chain's last, and the scaler adds an
    // ordered dither whenever it drops from more than 8 bits to 8, where the software chain dithered by error diffusion. That a
    // smooth gradient comes out unbanded is checked for real in workcopy-real.test.js.
    for (const picture of [HLG, PQ, TURNED_ROUND, { ...HLG, ...UPRIGHT }]) {
      const pieces = after(argsFor(printedOf({ picture })), "-vf").split(",");
      assert.equal(pieces.at(-1), "format=yuv420p");
      assert.equal(pieces.filter((p) => p.startsWith("format=")).length, 2);
      assert.equal(pieces.indexOf("hwdownload"), pieces.findIndex((p) => p.startsWith("scale_vt=")) + 1);
      assert.equal(pieces[pieces.indexOf("hwdownload") + 1], "format=p010le");
    }
  });
  it("make a PQ video the same way: VideoToolbox reads the transfer from the picture's own tags", () => {
    assert.equal(after(argsFor(printedOf({ picture: PQ })), "-vf"), after(argsFor(printedOf({ picture: HLG })), "-vf"));
  });
  it("size an upright HDR clip from the picture as it is shown, and ask VideoToolbox for the size it is stored at, for the turn to come after", () => {
    // Shown 1080 by 1920 (stored on its side as 1920 by 1080 after the size is made): VideoToolbox makes it 1920 by 1080, and
    // ffmpeg then turns it a quarter clockwise.
    const a = argsFor(printedOf({ picture: { ...HLG, ...UPRIGHT } }));
    assert.equal(after(a, "-vf"), `fps=30:start_time=0,${SCALE_VT(1920, 1080)},hwdownload,format=p010le,transpose=clock,format=yuv420p`);
    assert.deepEqual([a.includes("-noautorotate"), after(a, "-display_rotation")], [true, "0"]);
  });
  it("turn a clip stored turned round by a half turn, and one turned the other way a quarter the other way", () => {
    assert.equal(after(argsFor(printedOf({ picture: TURNED_ROUND })), "-vf"), `fps=30:start_time=0,${SCALE_VT(1920, 1080)},hwdownload,format=p010le,hflip,vflip,format=yuv420p`);
    const left = { ...HLG, side_data_list: [{ side_data_type: "Display Matrix", rotation: 90 }] };
    assert.equal(after(argsFor(printedOf({ picture: left })), "-vf"), `fps=30:start_time=0,${SCALE_VT(1920, 1080)},hwdownload,format=p010le,transpose=cclock,format=yuv420p`);
  });
  it("turn a picture stored at an odd angle as ffmpeg's own turning would, by that angle", () => {
    const odd = { ...HLG, width: 1920, height: 1080, side_data_list: [{ side_data_type: "Display Matrix", rotation: -45 }] };
    assert.match(after(argsFor(printedOf({ picture: odd })), "-vf"), /,hwdownload,format=p010le,rotate=45\*PI\/180,format=yuv420p$/);
  });
  it("leave a picture that is not turned alone, whether it says so or says nothing", () => {
    for (const picture of [HLG, { ...HLG, side_data_list: [{ side_data_type: "Display Matrix", rotation: 0 }] }]) {
      assert.match(after(argsFor(printedOf({ picture })), "-vf"), /,hwdownload,format=p010le,format=yuv420p$/);
    }
  });
  it("download an 8-bit HDR picture as the 8 bits VideoToolbox gives it, which is not the 10-bit format", () => {
    assert.match(after(argsFor(printedOf({ picture: { ...HLG, pix_fmt: "yuv420p" } })), "-vf"), /,hwdownload,format=nv12,format=yuv420p$/);
  });
  it("make a 4K HDR copy 3840 on its longer side with the 4K switch, and never larger than the picture", () => {
    assert.match(after(argsFor(printedOf({ picture: HLG }), { fourK: true }), "-vf"), new RegExp(`,${SCALE_VT(3840, 2160)},`));
    assert.match(after(argsFor(printedOf({ picture: { ...HLG, width: 1280, height: 720 } }), { fourK: true }), "-vf"), new RegExp(`,${SCALE_VT(1280, 720)},`));
  });
  it("keep the clock of the picture as any copy does: every picture on an even grid from 0, at the rate it is made at", () => {
    assert.match(after(argsFor(printedOf({ picture: TURNED_ROUND })), "-vf"), /^fps=30:start_time=0,scale_vt=/);
    const slow = { ...HLG, r_frame_rate: "24/1", avg_frame_rate: "24/1" };
    const a = argsFor(printedOf({ picture: slow }));
    assert.match(after(a, "-vf"), /^fps=24:start_time=0,scale_vt=/);
    assert.equal(after(a, "-g"), "24");
    assert.equal(after(a, "-af"), "aresample=async=1:first_pts=0");
  });
  it("leave no note to turn the picture in the file: ffmpeg's own turning is off and the note it would pass on is set to nothing", () => {
    // Both are input options, so both come before -i. Without the second, ffmpeg passes the stored note on to the file, and a
    // player would turn a picture that has been turned already.
    const a = argsFor(printedOf({ picture: { ...HLG, ...UPRIGHT } }));
    const input = a.indexOf("-i");
    for (const flag of ["-noautorotate", "-display_rotation", "-hwaccel", "-hwaccel_output_format"]) assert.ok(a.indexOf(flag) > -1 && a.indexOf(flag) < input, flag);
    assert.equal(a.filter((x) => x === "-display_rotation").length, 1);
    assert.ok(!a.includes("-autorotate"));
  });
  it("are refused when an HDR picture is not told how it is stored, rather than made without the turn it needs", () => {
    const printed = printedOf({ picture: { ...HLG, ...UPRIGHT } });
    assert.throws(() => workCopyArgs("/in/a.mov", "/out/a.mp4", { facts: factsOf(printed), streams: streamsOf(printed), colour: colourOf(printed), rate: "30" }), /stored/);
    // A video in standard colour has no need of it.
    assert.ok(workCopyArgs("/in/a.mov", "/out/a.mp4", { ...factsFrom(printedOf()), stored: undefined }));
  });
  it("do not touch a video in standard colour: no hardware, no VideoToolbox, no turning by hand, whatever way up it is stored", () => {
    for (const picture of [{}, UPRIGHT, { color_primaries: "bt2020", color_transfer: "bt2020-10" }, { color_primaries: undefined, color_transfer: undefined }]) {
      const a = argsFor(printedOf({ picture }));
      const vf = after(a, "-vf");
      assert.ok(!/scale_vt|hwdownload|p010le|transpose|flip|rotate/.test(vf), vf);
      assert.match(vf, /,format=yuv420p$/);
      for (const flag of ["-hwaccel", "-hwaccel_output_format", "-noautorotate", "-display_rotation", "-autorotate"]) assert.ok(!a.includes(flag), flag);
      assert.deepEqual(a.slice(0, 7), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", "/in/a b.mov"]);
    }
  });
  it("have no filter whose arguments hold a comma, which ffmpeg would take for the start of the next filter", () => {
    // Every piece of the chain, cut at its commas, begins with a filter's name: none is the end of an expression such as min(a,b).
    const odd = { ...HLG, width: 1920, height: 1080, side_data_list: [{ side_data_type: "Display Matrix", rotation: -45 }] };
    for (const picture of [{}, HLG, PQ, UPRIGHT, { ...HLG, ...UPRIGHT }, TURNED_ROUND, odd, { ...HLG, pix_fmt: "yuv420p" }]) {
      for (const fourK of [false, true]) {
        const pieces = after(argsFor(printedOf({ picture }), { fourK }), "-vf").split(",");
        for (const piece of pieces) assert.match(piece, /^(fps|scale|scale_vt|hwdownload|format|transpose|hflip|vflip|rotate)(=|$)/, piece);
      }
    }
  });
  it("end with the file told to be an mp4, so that it can be written under another name and given its own when it is whole", () => {
    const a = argsFor(printedOf());
    assert.deepEqual(a.slice(-3), ["-f", "mp4", "/out/work/key.mp4"]);
    assert.deepEqual(a.slice(0, 7), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", "/in/a b.mov"]);
  });
  it("leave out the sound, and map only the picture, for a video that has none", () => {
    const a = argsFor(printedOf({ sounds: [] }));
    assert.deepEqual(a.slice(a.indexOf("-map"), a.indexOf("-vf")), ["-map", "0:0"]);
    assert.ok(a.includes("-an") && !a.includes("-af"));
    assert.ok(!a.includes("-map") || a.filter((x) => x === "-map").length === 1);
  });
  it("are none for a video that cannot be made into one: no picture, only sound this Mac cannot read, no length", () => {
    assert.equal(argsFor(printedOf({ picture: null })), null);
    assert.equal(argsFor(printedOf({ sounds: [{ codec_name: "apple_apac" }] })), null);
    assert.equal(argsFor(printedOf({ duration: "0" })), null);
    assert.equal(workCopyArgs("/in/a.mov", "/out/a.mp4", { facts: null, streams: null, colour: null, rate: "30" }), null);
  });
});

describe("a video that cannot be made into a working copy", () => {
  const good = () => ({ ...factsFrom(printedOf()), filters: "", freeBytes: 500e9, rawBytes: 1e9 });
  it("has no fault when it can: a wide 4K video, an iPhone clip with APAC beside its AAC, and an upright one", () => {
    assert.equal(workCopyFault(good()), null);
    assert.equal(workCopyFault({ ...good(), ...factsFrom(printedOf({ sounds: [{ codec_name: "apple_apac" }, { codec_name: "aac" }] })) }), null);
    assert.equal(workCopyFault({ ...good(), ...factsFrom(printedOf({ picture: UPRIGHT })) }), null);
  });
  it("says in words when no length can be read, which is when ffprobe wrote nothing that can be read", () => {
    assert.equal(workCopyFault({ ...good(), ...factsFrom("{") }), "it could not be read as a video");
    assert.equal(workCopyFault({ ...good(), ...factsFrom(printedOf({ duration: "0" })) }), "it could not be read as a video");
    assert.equal(workCopyFault({ ...good(), facts: null }), "it could not be read as a video");
  });
  it("says in words when there is no picture, and a cover picture is none", () => {
    assert.equal(workCopyFault({ ...good(), ...factsFrom(printedOf({ picture: null })) }), "there is no picture in it");
    assert.equal(workCopyFault({ ...good(), ...factsFrom(printedOf({ picture: { disposition: { attached_pic: 1 } } })) }), "there is no picture in it");
  });
  it("says in words when its only sound is in a form this Mac cannot read, and not when it has no sound at all", () => {
    assert.equal(workCopyFault({ ...good(), ...factsFrom(printedOf({ sounds: [{ codec_name: "apple_apac" }] })) }), "its sound is in a form this Mac can't read");
    assert.equal(workCopyFault({ ...good(), ...factsFrom(printedOf({ sounds: [] })) }), null);
  });
  it("refuses an HDR video on a Mac whose ffmpeg lacks the filter that sizes and converts it in VideoToolbox, and says so in words", () => {
    const hdr = { ...good(), ...factsFrom(printedOf({ picture: HLG })), hwaccels: WITH_VIDEOTOOLBOX };
    const said = "it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason";
    // Today's Mac Studio: tonemap, colorspace and the like, but not the filter, and a name that only begins as it does is not it.
    assert.equal(workCopyFault({ ...hdr, filters: filtersOf9("tonemap", "colorspace", "scale", "zscale") }), said);
    assert.equal(workCopyFault({ ...hdr, filters: filtersOf9("scale_vaapi", "scale_cuda", "scale_vt_x", "transpose_vt") }), said);
    assert.equal(workCopyFault({ ...hdr, filters: "" }), said);
    assert.equal(workCopyFault({ ...hdr, filters: undefined }), said);
    assert.equal(workCopyFault({ ...hdr, filters: WITH_SCALE_VT }), null);
    // In either width of the column of flags ffmpeg prints.
    assert.equal(workCopyFault({ ...hdr, filters: filtersOf("scale_vt") }), null);
  });
  it("refuses an HDR video on a Mac whose ffmpeg has no VideoToolbox to decode it with, in the same words", () => {
    const hdr = { ...good(), ...factsFrom(printedOf({ picture: PQ })), filters: WITH_SCALE_VT };
    const said = "it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason";
    assert.equal(workCopyFault({ ...hdr, hwaccels: hwaccelsOf() }), said);
    assert.equal(workCopyFault({ ...hdr, hwaccels: hwaccelsOf("vaapi", "cuda", "videotoolbox_x") }), said);
    assert.equal(workCopyFault({ ...hdr, hwaccels: "" }), said);
    assert.equal(workCopyFault({ ...hdr, hwaccels: undefined }), said);
    assert.equal(workCopyFault({ ...hdr, hwaccels: hwaccelsOf("vaapi", "videotoolbox") }), null);
    assert.equal(workCopyFault({ ...hdr, hwaccels: WITH_VIDEOTOOLBOX }), null);
  });
  it("does not let that touch a video in standard colour", () => {
    assert.equal(workCopyFault({ ...good(), filters: "", hwaccels: "" }), null);
    assert.equal(workCopyFault({ ...good(), filters: filtersOf(), hwaccels: hwaccelsOf() }), null);
    assert.equal(workCopyFault({ ...good(), ...factsFrom(printedOf({ picture: UPRIGHT })), filters: undefined, hwaccels: undefined }), null);
  });
  it("refuses a video when less than twice its size is free on the disk, and says how much is wanted and how much there is", () => {
    const sized = (freeBytes) => workCopyFault({ ...good(), rawBytes: 3 * 1024 ** 3, freeBytes });
    assert.equal(sized(5.5 * 1024 ** 3), "there is not enough room on this Mac to make it: 6.0 GB must be free, and 5.5 GB is");
    assert.equal(sized(0), "there is not enough room on this Mac to make it: 6.0 GB must be free, and 0 bytes is");
    // Exactly twice is enough, and a byte under it is not.
    assert.equal(sized(6 * 1024 ** 3), null);
    assert.match(sized(6 * 1024 ** 3 - 1), /^there is not enough room on this Mac to make it: /);
  });
  it("does not refuse a video for room it cannot measure: a full disk is found out when the copy is written", () => {
    assert.equal(workCopyFault({ ...good(), freeBytes: Number.NaN }), null);
    assert.equal(workCopyFault({ ...good(), freeBytes: undefined }), null);
    assert.equal(workCopyFault({ ...good(), rawBytes: undefined, freeBytes: 10 }), null);
  });
  it("tells the first thing that is wrong: what cannot be read, the picture, the sound, the colour, then the room", () => {
    const bad = { ...factsFrom(printedOf({ picture: HLG, sounds: [{ codec_name: "apple_apac" }] })), filters: "", hwaccels: "", freeBytes: 1, rawBytes: 1e9 };
    assert.equal(workCopyFault(bad), "its sound is in a form this Mac can't read");
    assert.equal(workCopyFault({ ...bad, ...factsFrom(printedOf({ picture: HLG })) }), "it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason");
    assert.match(workCopyFault({ ...bad, ...factsFrom(printedOf({ picture: HLG })), filters: WITH_SCALE_VT, hwaccels: WITH_VIDEOTOOLBOX }), /^there is not enough room/);
    assert.equal(workCopyFault({ ...bad, ...factsFrom(printedOf({ picture: null })) }), "there is no picture in it");
    assert.equal(workCopyFault({ ...bad, facts: null }), "it could not be read as a video");
  });
  it("is said with no path, no flag and no command name in it, whatever the fault", () => {
    const faults = [
      workCopyFault({ ...factsFrom("{"), filters: "", freeBytes: 1e12, rawBytes: 1 }),
      workCopyFault({ ...factsFrom(printedOf({ picture: null })), filters: "", freeBytes: 1e12, rawBytes: 1 }),
      workCopyFault({ ...factsFrom(printedOf({ sounds: [{ codec_name: "apple_apac" }] })), filters: "", freeBytes: 1e12, rawBytes: 1 }),
      workCopyFault({ ...factsFrom(printedOf({ picture: HLG })), filters: "", freeBytes: 1e12, rawBytes: 1 }),
      workCopyFault({ ...factsFrom(printedOf()), filters: "", freeBytes: 10, rawBytes: 1e9 })
    ];
    for (const fault of faults) assert.ok(fault && plain(canNotBeUsed(fault)), String(fault));
  });
});

describe("which filters a Mac's ffmpeg has", () => {
  it("is read from what ffmpeg prints for -filters, by the whole name of each: a name that only begins as another does is not it", () => {
    assert.equal(hasFilters(WITH_SCALE_VT, ["scale_vt"]), true);
    assert.equal(hasFilters(WITH_SCALE_VT, ["scale_vt", "tonemap"]), true);
    assert.equal(hasFilters(filtersOf("tonemap_opencl", "tonemap_vaapi", "zscale"), ["zscale", "tonemap"]), false);
    assert.equal(hasFilters(filtersOf("tonemap"), ["zscale", "tonemap"]), false);
    assert.equal(hasFilters(filtersOf("zscale"), ["zscale"]), true);
    assert.equal(hasFilters(filtersOf9("scale_vaapi", "scale_cuda", "transpose_vt"), ["scale_vt"]), false);
  });
  it("reads the two characters of flags ffmpeg 9.0.2 prints before each name, which the Mac Studio's does: three were once the rule", () => {
    // Lines as that ffmpeg prints them, under a legend that still shows three: with a column of three characters alone, no filter
    // of this Mac was ever found, and every HDR video would have been refused with the filter in place.
    const real = `Filters:
  T.. = Timeline support
  .S. = Slice threading
  A = Audio input/output
  V = Video input/output
  N = Dynamic number and/or type of input/output
  | = Source or sink filter
  ------
 TS colorspace        V->V       Convert between colorspaces.
 .. hwdownload        V->V       Download a hardware frame to a normal frame
 .. scale_vt          V->V       Scale Videotoolbox frames
 .S tonemap           V->V       Conversion to/from different dynamic ranges.
 T. vflip             V->V       Flip the input video vertically.
 .. yuvtestsrc        |->V       Generate YUV test pattern.
`;
    assert.equal(hasFilters(real, ["scale_vt"]), true);
    assert.equal(hasFilters(real, ["scale_vt", "hwdownload", "tonemap", "colorspace", "vflip"]), true);
    assert.equal(hasFilters(real, ["zscale"]), false);
    assert.equal(hasFilters(real, ["scale"]), false);
    assert.equal(hasFilters(filtersOf9("scale_vt"), ["scale_vt"]), true);
  });
  it("reads a column of flags a letter wider than today's, which a newer ffmpeg may print", () => {
    assert.equal(hasFilters(" .SC. zscale            V->V       Apply resizing.\n .S.. tonemap           V->V       Conversion.\n", ["zscale", "tonemap"]), true);
  });
  it("does not take the legend, or a word in a description, for a filter", () => {
    const text = "Filters:\n  T.. = Timeline support\n ... fps               V->V       Applies zscale and tonemap to nothing.\n";
    assert.equal(hasFilters(text, ["zscale"]), false);
    assert.equal(hasFilters(text, ["tonemap"]), false);
    assert.equal(hasFilters("", ["zscale"]), false);
    assert.equal(hasFilters(undefined, ["zscale"]), false);
    // Nor the legend or a description in the narrower column of flags.
    const narrow = "Filters:\n  T.. = Timeline support\n  A = Audio input/output\n  ------\n .. fps               V->V       Applies scale_vt to nothing.\n TS ab               A->A       See scale_vt V->V here.\n";
    assert.equal(hasFilters(narrow, ["scale_vt"]), false);
    for (const word of ["T", "A", "=", "Timeline", "See", "Applies", "V->V"]) assert.equal(hasFilters(narrow, [word]), false, word);
    assert.equal(hasFilters(narrow, ["fps", "ab"]), true);
  });
});

describe("which hardware decoders a Mac's ffmpeg has", () => {
  it("is read from what ffmpeg prints for -hwaccels, a method to a line, by the whole name", () => {
    assert.equal(hasHwaccel(hwaccelsOf("videotoolbox"), "videotoolbox"), true);
    assert.equal(hasHwaccel(hwaccelsOf("vaapi", "cuda", "videotoolbox"), "videotoolbox"), true);
    assert.equal(hasHwaccel(hwaccelsOf("vaapi", "cuda"), "videotoolbox"), false);
    assert.equal(hasHwaccel(hwaccelsOf("videotoolbox_x", "xvideotoolbox"), "videotoolbox"), false);
    assert.equal(hasHwaccel(hwaccelsOf(), "videotoolbox"), false);
  });
  it("is read as the Mac Studio's ffmpeg prints it, with the line that says what the list is above it and a blank line below", () => {
    assert.equal(hasHwaccel("Hardware acceleration methods:\nvideotoolbox\n\n", "videotoolbox"), true);
    assert.equal(hasHwaccel("Hardware acceleration methods:\r\nvideotoolbox\r\n", "videotoolbox"), true);
  });
  it("does not take the line that says what the list is, or a word in a sentence, for a method", () => {
    assert.equal(hasHwaccel("Hardware acceleration methods:\n", "videotoolbox"), false);
    assert.equal(hasHwaccel("Hardware acceleration methods:\n", "Hardware"), false);
    assert.equal(hasHwaccel("Hardware acceleration methods: videotoolbox\n", "videotoolbox"), false);
    assert.equal(hasHwaccel("videotoolbox is not here\n", "videotoolbox"), false);
    assert.equal(hasHwaccel("", "videotoolbox"), false);
    assert.equal(hasHwaccel(undefined, "videotoolbox"), false);
  });
});

describe("the key and the places of a working copy", () => {
  it("is made of the raw file's size and its time, the same for the same file", () => {
    assert.equal(workCopyKey({ bytes: 4831432, mtimeMs: 1760000000123 }), "4831432-1760000000123");
    assert.equal(workCopyKey({ bytes: 4831432, mtimeMs: 1760000000123 }), workCopyKey({ bytes: 4831432, mtimeMs: 1760000000123 }));
  });
  it("changes when either does", () => {
    const key = workCopyKey({ bytes: 4831432, mtimeMs: 1760000000123 });
    assert.notEqual(workCopyKey({ bytes: 4831433, mtimeMs: 1760000000123 }), key);
    assert.notEqual(workCopyKey({ bytes: 4831432, mtimeMs: 1760000000124 }), key);
  });
  it("takes a time to the millisecond, as a file's time is read: a fraction of one is not another file", () => {
    assert.equal(workCopyKey({ bytes: 10, mtimeMs: 1760000000123.4 }), workCopyKey({ bytes: 10, mtimeMs: 1760000000123.0 }));
  });
  it("is different for a 4K copy, so that asking for 4K after a copy of 1080 is made makes another", () => {
    const key = workCopyKey({ bytes: 4831432, mtimeMs: 1760000000123 });
    assert.equal(workCopyKey({ bytes: 4831432, mtimeMs: 1760000000123, fourK: true }), `${key}-4k`);
    assert.equal(workCopyKey({ bytes: 4831432, mtimeMs: 1760000000123, fourK: false }), key);
  });
  it("is safe to be a file's name, and is none when the size or the time cannot be", () => {
    assert.match(workCopyKey({ bytes: 4831432, mtimeMs: 1760000000123, fourK: true }), /^[0-9a-z-]+$/);
    for (const bad of [{ bytes: -1, mtimeMs: 5 }, { bytes: 1.5, mtimeMs: 5 }, { bytes: Number.NaN, mtimeMs: 5 }, { bytes: 5, mtimeMs: -3 }, { bytes: 5, mtimeMs: Infinity }, { bytes: "5", mtimeMs: 5 }, { bytes: 5 }, {}, null, undefined]) {
      assert.equal(workCopyKey(bad), "", JSON.stringify(bad));
    }
  });
  it("is where the finished video goes, in the episode's own folder in BRIMM Video Work, with its facts beside it", () => {
    assert.deepEqual(workCopyPaths("/Users/sallie", "2026-10-27 Pricing talk", "4831432-1760000000123"), {
      dir: "/Users/sallie/BRIMM Video Work/2026-10-27 Pricing talk/working copy",
      video: "/Users/sallie/BRIMM Video Work/2026-10-27 Pricing talk/working copy/4831432-1760000000123.mp4",
      facts: "/Users/sallie/BRIMM Video Work/2026-10-27 Pricing talk/working copy/4831432-1760000000123.json"
    });
  });
  it("refuses a key that is not safe to be a file's name, so that no path leaves the folder", () => {
    for (const bad of ["", "../x", "a/b", "a b", ".hidden", "4831432-1760000000123.mp4", "KEY", undefined, 5]) {
      assert.throws(() => workCopyPaths("/Users/sallie", "E", bad), /key/, String(bad));
    }
  });
  it("refuses an episode folder that is not one folder's name, for the same reason", () => {
    for (const bad of ["", ".", "..", "../Other", "a/b", "/etc", "a\0b", undefined, null, 5]) {
      assert.throws(() => workCopyPaths("/Users/sallie", bad, "4831432-1760000000123"), /folder/, String(bad));
    }
    // A name with spaces, dots and accents is one folder's name, as every episode's is.
    assert.equal(workCopyPaths("/Users/sallie", "2026-10-27 Café v1.2", "5-6").dir, "/Users/sallie/BRIMM Video Work/2026-10-27 Café v1.2/working copy");
  });
});

describe("the facts of a working copy", () => {
  it("are its length, its rate, the size of its picture as it is shown, and its size on disk, read from what ffprobe printed of it", () => {
    const printed = printedOf({ picture: { width: 1920, height: 1080, r_frame_rate: "30000/1001", avg_frame_rate: "30000/1001" }, duration: "23.4234" });
    assert.deepEqual(workCopyFacts(printed, 18276541), { seconds: 23.423, fps: 29.97, width: 1920, height: 1080, bytes: 18276541 });
  });
  it("are none when the file has no length, no picture, or cannot be read", () => {
    assert.equal(workCopyFacts("{", 5), null);
    assert.equal(workCopyFacts(printedOf({ picture: null }), 5), null);
    assert.equal(workCopyFacts(printedOf({ duration: "0" }), 5), null);
    assert.equal(workCopyFacts("", 5), null);
  });
});

describe("what a working copy is made under", () => {
  const GB = 1024 ** 3;
  it("is the memory and the time the watchdog allows: 4 GB, and five minutes with twenty seconds more for every second of video", () => {
    assert.deepEqual(workCopyLimits(0), { most: 4 * GB, limit: 300000 });
    assert.deepEqual(workCopyLimits(300), { most: 4 * GB, limit: 6300000 });
    assert.deepEqual(workCopyLimits(23.4234), { most: 4 * GB, limit: 768468 });
  });
  it("allows twice the memory for a copy of 4K, whose frames are four times the size", () => {
    assert.deepEqual(workCopyLimits(23.4234, true), { most: 8 * GB, limit: 768468 });
    assert.deepEqual(workCopyLimits(23.4234, false), workCopyLimits(23.4234));
  });
  it("is given a length even when none is known, since the watchdog never runs a program without both limits", () => {
    for (const seconds of [undefined, null, Number.NaN, -5]) {
      const limits = workCopyLimits(seconds);
      assert.ok(limits.most > 0 && limits.limit >= 300000, String(seconds));
    }
  });
});

describe("the words said of a working copy", () => {
  it("are one step, which the progress panel shows", () => {
    assert.equal(WORK_COPY_STEP, "Making the video for HyperFrames");
    assert.deepEqual(WORK_COPY_STEPS, ["Making the video for HyperFrames"]);
  });
  it("are \"Done\" when it is made, and \"It can't be used: \" and the reason when it cannot be", () => {
    assert.equal(WORK_COPY_DONE, "Done");
    assert.equal(canNotBeUsed("there is no picture in it"), "It can't be used: there is no picture in it.");
    assert.equal(canNotBeUsed("it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason"), "It can't be used: it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason.");
  });
  it("say that a video was made steady, when its rate was not, and that its HDR colours were made standard", () => {
    assert.deepEqual(workCopyNotes({ steady: false, rate: "30", hdr: false }), ["its speed made steady at 30 pictures a second"]);
    assert.deepEqual(workCopyNotes({ steady: true, rate: "30", hdr: true }), ["its HDR colours made standard"]);
    assert.deepEqual(workCopyNotes({ steady: false, rate: "30", hdr: true }), ["its speed made steady at 30 pictures a second", "its HDR colours made standard"]);
    assert.deepEqual(workCopyNotes({ steady: true, rate: "24", hdr: false }), []);
  });
  it("hold no path, no flag and no command name", () => {
    for (const text of [WORK_COPY_STEP, WORK_COPY_DONE, canNotBeUsed("there is no picture in it"), ...workCopyNotes({ steady: false, rate: "30", hdr: true })]) {
      assert.ok(plain(text), text);
    }
  });
});

// --- The job: making the copy, in the run's own folder, and putting it in place only when it is whole ---

/** The moment the job is run at, which names the run's own folder, and the raw video's own time. */
const NOW = 1760000000123;
/** What ffprobe says of the raw video, and of the copy the stand-ins make of it: 1920 by 1080, and a little longer than the raw
    video, as the sound of an AAC file is. */
const SOURCE = printedOf();
const copyOf = ({ duration = "23.436000", picture = { codec_name: "h264", width: 1920, height: 1080 }, sounds = [{ codec_name: "aac", sample_rate: "48000" }] } = {}) => printedOf({ picture, sounds, duration });

/** Every file under a folder, by its path in it, sorted: directories are not counted. */
const filesUnder = (root) => {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else found.push(relative(root, join(dir, entry.name)));
    }
  };
  if (existsSync(root)) walk(root);
  return found.sort();
};
const entries = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : []);
/** A rename that fails the `n`th time it is asked, as a move between two disks fails, and moves the file every other time. */
const failingRename = (n, code = "EXDEV") => {
  let asked = 0;
  return (from, to) => {
    asked += 1;
    if (asked === n) throw Object.assign(new Error(`${code}: the move could not be made`), { code });
    renameSync(from, to);
  };
};

/** A folder for one test, with the raw video in it, a home folder of its own, and what the job is given: stand-ins for ffprobe and
    ffmpeg that write what the real ones do, and a recorder for the progress panel. `script` says what they find, or which of
    them fails: `source` is what ffprobe says of the raw video, `copy` what it says of the copy (and "" for nothing it can read),
    `ffmpeg` is how ffmpeg ends ("works", "fail", "memory", "time", "killed", "nothing", "empty" or "throw"), `filters` what it
    prints for -filters and `hwaccels` what it prints for -hwaccels (by default a Mac that can make an HDR video standard),
    `free` the room on the disk, `bytes` the raw video's size, `fourK` the 4K switch, `deps` more for the job to be given, and
    `defaultProbe` has the job read the video through `run` as it does when it is given no probe. The home folder is not made
    here: the job makes what it needs in it. */
function setup(script = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-workcopy-"));
  const home = join(dir, "home");
  const folder = "2026-10-27 Pricing talk";
  const episode = episodeWork(home, folder);
  const video = join(dir, "Pricing talk.mov");
  writeFileSync(video, Buffer.alloc(script.bytes ?? 4096, 1));
  utimesSync(video, new Date(NOW), new Date(NOW));
  const raw = statSync(video);
  const key = workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs, fourK: Boolean(script.fourK) });
  const paths = workCopyPaths(home, folder, key);
  const runFolder = join(runsFolder(home), `workcopy-${process.pid}-${NOW}`);
  const calls = [];
  const guarded = [];
  const probed = [];
  const logs = [];
  const events = [];
  const seen = [];
  // The programs that run outside the watchdog: ffprobe, which writes what it knows of the file asked about into the file asked
  // for, and ffmpeg when it is asked which filters or which hardware decoders it has, which it prints.
  const run = async (cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "FFPROBE") {
      probed.push(args[args.length - 1]);
      writeFileSync(args[args.indexOf("-o") + 1], args[args.length - 1] === video ? script.source ?? SOURCE : script.copy ?? copyOf());
      return { code: 0, stderr: "" };
    }
    return { code: 0, stderr: "", stdout: args.includes("-hwaccels") ? script.hwaccels ?? WITH_VIDEOTOOLBOX : script.filters ?? WITH_SCALE_VT };
  };
  const probe = async (file) => {
    probed.push(file);
    return file === video ? script.source ?? SOURCE : script.copy ?? copyOf();
  };
  // What runs under the watchdog (guard.js), as the real runGuarded resolves it. What the episode's own folder and the folder of
  // the copies held, as ffmpeg began, is kept: it is what a half-written copy would be found in.
  const runGuarded = async (cmd, args, limits) => {
    // As the watchdog itself does: it never runs a program without both a memory cap and a time limit.
    if (!(limits && limits.most > 0 && limits.limit > 0)) throw new Error("A guarded program needs a memory cap and a time limit.");
    guarded.push({ cmd, args, limits });
    seen.push({ episode: existsSync(episode) ? readdirSync(episode).sort() : null, copies: existsSync(paths.dir) ? readdirSync(paths.dir).sort() : null });
    const output = args[args.length - 1];
    const how = script.ffmpeg || "works";
    const ended = { code: 0, signal: null, stderr: "", overMemory: false, outOfTime: false, peak: 0, stopped: "" };
    if (how === "throw") throw Object.assign(new Error("spawn EAGAIN"), { code: "EAGAIN" });
    if (how === "nothing") return ended;
    if (how === "empty" || how === "works") {
      writeFileSync(output, how === "works" ? script.content ?? "THE WORKING COPY" : "");
      return ended;
    }
    // When ffmpeg stops part-way it leaves the part it had written.
    writeFileSync(output, "half a working copy");
    if (how === "fail") return { ...ended, code: 1, stderr: "Error while encoding: Cannot allocate memory\n" };
    if (how === "memory") return { ...ended, code: null, signal: "SIGKILL", overMemory: true, peak: 4.5 * 1024 ** 3, stopped: "it took more than 4 GB of memory, so it was stopped" };
    if (how === "time") return { ...ended, code: null, signal: "SIGKILL", outOfTime: true, stopped: "it ran for more than 354.234 seconds, so it was stopped" };
    return { ...ended, code: null, signal: "SIGTERM" };
  };
  // The progress panel's reporter, as a list of what it was told.
  const progress = {
    begin: (name) => events.push(["begin", name]),
    length: (seconds) => events.push(["length", seconds]),
    steps: (names) => events.push(["steps", names]),
    step: (name) => events.push(["step", name]),
    fraction() {},
    encoding: (seconds) => {
      events.push(["encoding", seconds]);
      return { args: ["-progress", "/progress/1.ffmpeg.txt"], stop: () => events.push(["stop"]) };
    },
    end: (finished) => events.push(["end", finished])
  };
  const deps = {
    run, runGuarded, tools: script.tools ?? { ffmpeg: "FFMPEG", ffprobe: "FFPROBE" }, ...(script.defaultProbe ? {} : { probe }),
    freeBytes: () => script.free ?? 500e9, progress, log: (line) => logs.push(line), now: () => NOW, ...(script.deps || {})
  };
  const job = (more = {}) => makeWorkCopy({ home, folder, video, name: "Pricing talk", fourK: Boolean(script.fourK), ...more }, deps);
  /** Every file in BRIMM Video Work, by its path in it: what a run leaves there. */
  const inWork = () => filesUnder(workFolder(home));
  /** A file in the folder of the copies, made before the job runs. */
  const earlier = (name, text = "an earlier copy") => {
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(join(paths.dir, name), text);
  };
  const shown = (path) => relative(workFolder(home), path);
  return { dir, home, folder, episode, video, key, paths, runFolder, calls, guarded, probed, logs, events, seen, deps, job, inWork, earlier, shown, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("making the working copy", () => {
  it("has ffmpeg make it in the run's own folder under the watchdog, and puts it in the episode's folder whole, with its facts beside it", async (c) => {
    const t = setup();
    c.after(t.done);
    const result = await t.job();
    assert.deepEqual([result.ok, result.failed], [true, []]);
    // ffmpeg ran once, under the watchdog, with the limits of a video of this length, on the raw video, and wrote into the run's
    // own folder.
    assert.equal(t.guarded.length, 1);
    const { cmd, args, limits } = t.guarded[0];
    assert.equal(cmd, "FFMPEG");
    assert.deepEqual(limits, workCopyLimits(23.423, false));
    assert.equal(args[args.indexOf("-i") + 1], t.video);
    assert.equal(args[args.length - 1], join(t.runFolder, `${t.key}.mp4`));
    // The file is where it belongs, whole, and the run's own folder is gone.
    assert.equal(readFileSync(t.paths.video, "utf8"), "THE WORKING COPY");
    assert.deepEqual(JSON.parse(readFileSync(t.paths.facts, "utf8")), { seconds: 23.436, fps: 30, width: 1920, height: 1080, bytes: 16 });
    assert.deepEqual(t.inWork(), [t.shown(t.paths.facts), t.shown(t.paths.video)].sort());
    assert.deepEqual(entries(runsFolder(t.home)), []);
  });
  it("gives ffmpeg what workCopyArgs says, read from what ffprobe printed of the raw video", async (c) => {
    const t = setup({ source: printedOf({ picture: { ...UPRIGHT, r_frame_rate: "24/1", avg_frame_rate: "24/1" }, sounds: [{ codec_name: "apple_apac" }, { codec_name: "aac" }] }), fourK: true });
    c.after(t.done);
    await t.job();
    const printed = printedOf({ picture: { ...UPRIGHT, r_frame_rate: "24/1", avg_frame_rate: "24/1" }, sounds: [{ codec_name: "apple_apac" }, { codec_name: "aac" }] });
    // Behind the panel's own two arguments, which go first.
    assert.deepEqual(t.guarded[0].args.slice(2), workCopyArgs(t.video, join(t.runFolder, `${t.key}.mp4`), { ...factsFrom(printed), fourK: true }));
    assert.match(after(t.guarded[0].args, "-vf"), /^fps=24:start_time=0,scale=2160:3840,/);
    assert.deepEqual(t.guarded[0].args.slice(t.guarded[0].args.indexOf("-map")).slice(0, 4), ["-map", "0:0", "-map", "0:2"]);
  });
  it("makes the copy in a folder named for the run, so that a run that died leaves nothing clearRuns keeps", async (c) => {
    const t = setup();
    c.after(t.done);
    await t.job();
    assert.equal(t.runFolder, join(runsFolder(t.home), `workcopy-${process.pid}-${NOW}`));
    assert.match(t.guarded[0].args.at(-1), new RegExp(`/\\.runs/workcopy-${process.pid}-${NOW}/`));
    const left = join(runsFolder(t.home), "workcopy-999999-1760000000000");
    mkdirSync(left, { recursive: true });
    assert.deepEqual(clearRuns(t.home, () => false), ["workcopy-999999-1760000000000"]);
    assert.equal(existsSync(left), false);
  });
  it("puts nothing in the episode's folder while ffmpeg is at work, so that no half-written video is ever there", async (c) => {
    const t = setup();
    c.after(t.done);
    await t.job();
    assert.deepEqual(t.seen, [{ episode: null, copies: null }]);
  });
  it("puts the facts in place before the video, so a video that is there always has its facts beside it", async (c) => {
    const renames = [];
    const t = setup({ deps: { rename: (from, to) => { renames.push(basename(to)); renameSync(from, to); } } });
    c.after(t.done);
    await t.job();
    assert.deepEqual(renames, [`${t.key}.json`, `${t.key}.mp4`]);
  });
  it("tells the progress panel the one step, the video's length, and how far ffmpeg has got, and that it finished", async (c) => {
    const t = setup();
    c.after(t.done);
    await t.job();
    assert.deepEqual(t.events, [
      ["begin", "Pricing talk"], ["steps", ["Making the video for HyperFrames"]], ["step", "Making the video for HyperFrames"],
      ["length", 23.423], ["encoding", 23.423], ["stop"], ["end", true]
    ]);
    // The panel's own arguments go before the others, as the rough cut's do.
    assert.deepEqual(t.guarded[0].args.slice(0, 3), ["-progress", "/progress/1.ffmpeg.txt", "-nostdin"]);
  });
  it("names the video in the panel by its file when it is not told another", async (c) => {
    const t = setup();
    c.after(t.done);
    await t.job({ name: undefined });
    assert.deepEqual(t.events[0], ["begin", "Pricing talk.mov"]);
  });
  it("is Done when it is made, and says what was made: the video, and what was done to it that she may want to know", async (c) => {
    const t = setup();
    c.after(t.done);
    const result = await t.job();
    assert.deepEqual([result.ok, result.made, result.failed, result.next, result.words, result.key], [true, ["the video for HyperFrames"], [], "", "Done", t.key]);
    // Where it is, for whoever asked: the video and its facts, which is a file of its own.
    assert.deepEqual(result.paths, t.paths);
    // Its speed made steady, and its colours made standard, are said.
    const wandering = setup({ source: printedOf({ picture: { ...HLG, r_frame_rate: "60/1", avg_frame_rate: "3000/79" } }) });
    c.after(wandering.done);
    const both = await wandering.job();
    assert.deepEqual(both.made, ["the video for HyperFrames", "its speed made steady at 30 pictures a second", "its HDR colours made standard"]);
    assert.equal(both.words, "Done");
  });
  it("reads which filters and which hardware decoders this Mac's ffmpeg has, once each, for an HDR video, and makes it with VideoToolbox", async (c) => {
    const t = setup({ source: printedOf({ picture: HLG }) });
    c.after(t.done);
    const result = await t.job();
    assert.equal(result.ok, true);
    const listings = t.calls.filter((x) => x.cmd === "FFMPEG");
    assert.deepEqual(listings.map((x) => x.args.filter((a) => a === "-filters" || a === "-hwaccels")), [["-filters"], ["-hwaccels"]]);
    const args = t.guarded[0].args;
    assert.deepEqual(args.slice(args.indexOf("-noautorotate"), args.indexOf("-i")), ["-noautorotate", "-display_rotation", "0", "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld"]);
    assert.match(after(args, "-vf"), /^fps=30:start_time=0,scale_vt=w=1920:h=1080:color_matrix=bt709:color_primaries=bt709:color_transfer=bt709,hwdownload,format=p010le,format=yuv420p$/);
  });
  it("turns an upright HDR clip by the note it is stored with, as ffprobe says it of the raw video, and leaves the file with none", async (c) => {
    const t = setup({ source: printedOf({ picture: { ...HLG, ...UPRIGHT } }) });
    c.after(t.done);
    assert.equal((await t.job()).ok, true);
    assert.match(after(t.guarded[0].args, "-vf"), /,scale_vt=w=1920:h=1080:[^,]*,hwdownload,format=p010le,transpose=clock,format=yuv420p$/);
    assert.equal(after(t.guarded[0].args, "-display_rotation"), "0");
    const stored = setup({ source: printedOf({ picture: TURNED_ROUND }) });
    c.after(stored.done);
    assert.equal((await stored.job()).ok, true);
    assert.match(after(stored.guarded[0].args, "-vf"), /,hwdownload,format=p010le,hflip,vflip,format=yuv420p$/);
  });
  it("does not ask which filters or hardware decoders it has for a video in standard colour", async (c) => {
    const t = setup();
    c.after(t.done);
    await t.job();
    assert.deepEqual(t.calls.filter((x) => x.cmd === "FFMPEG"), []);
    assert.ok(!t.guarded[0].args.includes("-hwaccel"));
  });
  it("makes a video in standard colour on a Mac whose ffmpeg has neither VideoToolbox nor its filter, and refuses an HDR one in words", async (c) => {
    const sdr = setup({ filters: filtersOf9(), hwaccels: hwaccelsOf() });
    c.after(sdr.done);
    assert.equal((await sdr.job()).ok, true);
    const said = ["It can't be used: it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason."];
    // Today's Mac Studio has tonemap and VideoToolbox but not zscale: with no filter to size and convert in VideoToolbox, it is
    // refused, and so it is with the filter but no hardware decoder, and with neither.
    for (const [what, script] of [
      ["no scale_vt", { filters: filtersOf9("tonemap", "colorspace", "transpose_vt") }],
      ["no videotoolbox", { hwaccels: hwaccelsOf() }],
      ["neither", { filters: filtersOf("tonemap_opencl"), hwaccels: hwaccelsOf("vaapi") }]
    ]) {
      const hdr = setup({ source: printedOf({ picture: HLG }), ...script });
      c.after(hdr.done);
      const result = await hdr.job();
      assert.deepEqual([result.ok, result.failed], [false, said], what);
      assert.deepEqual(hdr.guarded, [], what);
      assert.deepEqual(hdr.inWork(), [], what);
      assert.ok(hdr.logs.some((line) => line.includes("could not be made")), what);
    }
  });
  it("refuses an HDR video in words when ffmpeg cannot say which filters or hardware decoders it has, and says why in the log", async (c) => {
    for (const [what, flag] of [["filters", "-filters"], ["decoders", "-hwaccels"]]) {
      // The video is read through the stand-in probe; this `run` is asked only the two questions about ffmpeg, and fails one.
      const run = async (cmd, args) => (args.includes(flag) ? { code: 1, stderr: "Unrecognized option\n" } : { code: 0, stderr: "", stdout: args.includes("-hwaccels") ? WITH_VIDEOTOOLBOX : WITH_SCALE_VT });
      const t = setup({ source: printedOf({ picture: HLG }), deps: { run } });
      c.after(t.done);
      const result = await t.job();
      assert.deepEqual([result.ok, result.failed], [false, ["It can't be used: it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason."]], what);
      assert.ok(t.logs.some((line) => line.includes("could not say which") && line.includes("Unrecognized option")), `${what}: ${t.logs.join("\n")}`);
      assert.deepEqual(t.guarded, [], what);
    }
  });
  it("refuses in words, and runs no ffmpeg, a video with no picture, one whose only sound it cannot read, and one with no length", async (c) => {
    const cases = [
      [printedOf({ picture: null }), "there is no picture in it"],
      [printedOf({ sounds: [{ codec_name: "apple_apac" }] }), "its sound is in a form this Mac can't read"],
      [printedOf({ duration: "0" }), "it could not be read as a video"],
      ["{", "it could not be read as a video"]
    ];
    for (const [source, reason] of cases) {
      const t = setup({ source });
      c.after(t.done);
      const result = await t.job();
      assert.deepEqual([result.ok, result.made, result.failed, result.words], [false, [], [canNotBeUsed(reason)], canNotBeUsed(reason)], reason);
      assert.deepEqual(t.guarded, [], reason);
      assert.deepEqual(t.inWork(), [], reason);
    }
  });
  it("refuses in words, and runs no ffmpeg, when less than twice the video's size is free, and goes on when twice is", async (c) => {
    const short = setup({ bytes: 4096, free: 6144 });
    c.after(short.done);
    const result = await short.job();
    assert.equal(result.ok, false);
    assert.equal(result.failed[0], "It can't be used: there is not enough room on this Mac to make it: 8.0 KB must be free, and 6.0 KB is.");
    assert.deepEqual([short.guarded, short.inWork()], [[], []]);
    // A byte under twice is not enough, and twice is.
    const almost = setup({ bytes: 4096, free: 8191 });
    c.after(almost.done);
    assert.equal((await almost.job()).ok, false);
    const enough = setup({ bytes: 4096, free: 8192 });
    c.after(enough.done);
    assert.equal((await enough.job()).ok, true);
  });
  it("measures the room on the disk the copy is made on, and goes on when that cannot be measured", async (c) => {
    const asked = [];
    const t = setup({ deps: { freeBytes: (path) => { asked.push(path); return 1e12; } } });
    c.after(t.done);
    await t.job();
    assert.deepEqual(asked, [t.runFolder]);
    const unknown = setup({ deps: { freeBytes: () => { throw Object.assign(new Error("EIO"), { code: "EIO" }); } } });
    c.after(unknown.done);
    assert.equal((await unknown.job()).ok, true);
  });
  it("refuses in words when this Mac has no ffmpeg or no ffprobe to make it with, or the video is not on this Mac", async (c) => {
    for (const tools of [{ ffmpeg: "", ffprobe: "FFPROBE" }, { ffmpeg: "FFMPEG", ffprobe: "" }, {}]) {
      const t = setup({ tools });
      c.after(t.done);
      const result = await t.job();
      assert.deepEqual(result.failed, ["It can't be used: this Mac has no program to make it with: ask Jason."]);
      assert.deepEqual([t.calls, t.guarded, t.inWork()], [[], [], []]);
    }
    const gone = setup();
    c.after(gone.done);
    const result = await gone.job({ video: join(gone.dir, "not there.mov") });
    assert.deepEqual([result.ok, result.failed], [false, ["It can't be used: it isn't on this Mac."]]);
    assert.deepEqual([gone.calls, gone.guarded, gone.inWork()], [[], [], []]);
  });
  it("makes a copy of 4K under its own key, and takes away the copy of 1080 once it is whole", async (c) => {
    const t = setup({ fourK: true });
    c.after(t.done);
    const small = workCopyPaths(t.home, t.folder, t.key.replace(/-4k$/, ""));
    t.earlier(basename(small.video));
    t.earlier(basename(small.facts), "{}");
    assert.match(t.key, /-4k$/);
    assert.equal((await t.job()).ok, true);
    assert.match(after(t.guarded[0].args, "-vf"), /,scale=3840:2160,/);
    assert.deepEqual(t.guarded[0].limits, workCopyLimits(23.423, true));
    assert.deepEqual(entries(t.paths.dir), [basename(t.paths.facts), basename(t.paths.video)].sort());
  });
  it("does not make a copy again that is there whole, and says Done", async (c) => {
    const t = setup();
    c.after(t.done);
    t.earlier(basename(t.paths.video), "THE COPY MADE BEFORE");
    t.earlier(basename(t.paths.facts), "{}");
    const result = await t.job();
    assert.deepEqual([result.ok, result.made, result.failed, result.words, result.key], [true, [], [], "Done", t.key]);
    assert.deepEqual([t.guarded, t.calls, t.events], [[], [], []]);
    assert.equal(readFileSync(t.paths.video, "utf8"), "THE COPY MADE BEFORE");
  });
  it("makes it again when only one of its two files is there: a video with no facts, or facts whose video went into a project", async (c) => {
    for (const only of ["video", "facts"]) {
      const t = setup();
      c.after(t.done);
      t.earlier(basename(t.paths[only]), "left");
      const result = await t.job();
      assert.equal(result.ok, true, only);
      assert.equal(t.guarded.length, 1, only);
      assert.equal(readFileSync(t.paths.video, "utf8"), "THE WORKING COPY", only);
      assert.equal(JSON.parse(readFileSync(t.paths.facts, "utf8")).width, 1920, only);
    }
  });
  it("reads the video through ffprobe, in the run's own folder, when it is given no probe: the raw video, and then what was made", async (c) => {
    const t = setup({ defaultProbe: true });
    c.after(t.done);
    const result = await t.job();
    assert.equal(result.ok, true);
    const asked = t.calls.filter((x) => x.cmd === "FFPROBE");
    assert.equal(asked.length, 2);
    assert.deepEqual(t.probed, [t.video, join(t.runFolder, `${t.key}.mp4`)]);
    for (const { args } of asked) {
      assert.deepEqual(args.slice(0, 6), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams"]);
      assert.equal(args[args.indexOf("-o") + 1].startsWith(`${t.runFolder}/`), true);
    }
  });
  it("refuses in words when ffprobe cannot read the raw video, when it is not given a probe", async (c) => {
    const t = setup({ defaultProbe: true, deps: { run: async () => ({ code: 1, stderr: "moov atom not found\n" }) } });
    c.after(t.done);
    const result = await t.job();
    assert.deepEqual(result.failed, ["It can't be used: it could not be read as a video."]);
    assert.deepEqual(t.inWork(), []);
  });
});

describe("a working copy that is not made", () => {
  const rows = [
    ["ffmpeg ends with an error, and leaves half a file", { ffmpeg: "fail" }, "it could not be converted"],
    ["the watchdog stops ffmpeg for the memory it takes", { ffmpeg: "memory" }, "it needed more of this Mac's memory than it may use"],
    ["the watchdog stops ffmpeg for the time it takes", { ffmpeg: "time" }, "it was taking too long, so it was stopped"],
    ["ffmpeg is killed by something else", { ffmpeg: "killed" }, "it was stopped before it was done"],
    ["ffmpeg ends well and writes no file", { ffmpeg: "nothing" }, "it could not be converted"],
    ["ffmpeg ends well and writes an empty file", { ffmpeg: "empty" }, "it could not be converted"],
    ["ffmpeg cannot be started", { ffmpeg: "throw" }, "the work stopped part-way"],
    ["ffprobe cannot read what was made", { copy: "" }, "what was made could not be read back"],
    ["what was made has no picture", { copy: copyOf({ picture: null }) }, "what was made could not be read back"],
    ["what was made is a second and a bit shorter than the raw video", { copy: copyOf({ duration: "22.4" }) }, "what was made came out the wrong length"],
    ["what was made is a second and a bit longer than the raw video", { copy: copyOf({ duration: "24.5" }) }, "what was made came out the wrong length"],
    ["what was made has lost its sound", { copy: copyOf({ sounds: [] }) }, "what was made has no sound"],
    ["its facts cannot be written", { deps: { write: () => { throw Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" }); } } }, "it could not be put in place"],
    ["its facts cannot be put in place", { deps: { rename: failingRename(1) } }, "it could not be put in place"],
    ["its video cannot be put in place, after its facts were", { deps: { rename: failingRename(2) } }, "it could not be put in place"],
    ["its video cannot be moved, since the folders are on different disks", { deps: { rename: failingRename(2, "EXDEV") } }, "it could not be put in place"],
    ["the run's own folder cannot be made", { deps: { mkdir: () => { throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }); } } }, "the work stopped part-way"],
    ["the raw video cannot be looked at", { deps: { stat: () => { throw Object.assign(new Error("EIO"), { code: "EIO" }); } } }, "the work stopped part-way"]
  ];
  for (const [what, script, reason] of rows) {
    it(`leaves nothing in the work folder, and says why in words, when ${what}`, async (c) => {
      const t = setup(script);
      c.after(t.done);
      const result = await t.job();
      assert.deepEqual([result.ok, result.made, result.failed, result.next, result.words], [false, [], [canNotBeUsed(reason)], "", canNotBeUsed(reason)]);
      // Nothing is left in BRIMM Video Work: no copy, no facts, no half-written file, no folder of the copies, and no folder of
      // the run's own.
      assert.deepEqual(t.inWork(), []);
      assert.equal(existsSync(t.paths.dir), false);
      assert.deepEqual(entries(runsFolder(t.home)), []);
      // The panel is told it did not finish, and ffmpeg's own progress is let go of whatever came of it.
      assert.equal(t.events.filter(([name]) => name === "begin").length, t.events.filter(([name]) => name === "end").length);
      assert.ok(t.events.filter(([name]) => name === "end").every(([, finished]) => finished === false));
      assert.equal(t.events.filter(([name]) => name === "encoding").length, t.events.filter(([name]) => name === "stop").length);
      assert.ok(plain(result.words), result.words);
    });
  }
  it("says what went wrong, in ffmpeg's own words, in the log, which Sallie does not read", async (c) => {
    const t = setup({ ffmpeg: "fail" });
    c.after(t.done);
    await t.job();
    assert.ok(t.logs.some((line) => line.includes("Pricing talk") && line.includes("Cannot allocate memory")), t.logs.join("\n"));
    const stopped = setup({ ffmpeg: "memory" });
    c.after(stopped.done);
    await stopped.job();
    assert.ok(stopped.logs.some((line) => line.includes("it took more than 4 GB of memory, so it was stopped")), stopped.logs.join("\n"));
  });
  it("keeps the copy made for the raw video before, and its facts, when the new one cannot be made", async (c) => {
    for (const script of [{ ffmpeg: "fail" }, { ffmpeg: "memory" }, { copy: "" }, { deps: { rename: failingRename(2) } }]) {
      const t = setup(script);
      c.after(t.done);
      t.earlier("111-222.mp4", "THE OLD COPY");
      t.earlier("111-222.json", "{\"seconds\": 1}");
      const before = t.inWork();
      assert.equal((await t.job()).ok, false);
      assert.deepEqual(t.inWork(), before);
      assert.equal(readFileSync(join(t.paths.dir, "111-222.mp4"), "utf8"), "THE OLD COPY");
    }
  });
});

describe("a working copy that replaces another", () => {
  it("is put in place whole before the copy for another key is taken away, which ffmpeg's own time sees there", async (c) => {
    const t = setup();
    c.after(t.done);
    t.earlier("111-222.mp4", "THE OLD COPY");
    t.earlier("111-222.json", "{}");
    t.earlier("333-444-4k.mp4", "AN OLD 4K COPY");
    t.earlier("333-444-4k.json", "{}");
    const removed = [];
    t.deps.rm = (path, options) => {
      removed.push([basename(path), existsSync(t.paths.video), existsSync(t.paths.facts)]);
      rmSync(path, options);
    };
    const result = await t.job();
    assert.equal(result.ok, true);
    // While ffmpeg wrote the new copy, the old ones were still there, and nothing of the new one was.
    assert.deepEqual(t.seen[0].copies, ["111-222.json", "111-222.mp4", "333-444-4k.json", "333-444-4k.mp4"]);
    // Each is taken away only when the new video and its facts are both in place.
    const gone = removed.filter(([name]) => /^\d+-\d+(-4k)?\.(mp4|json)$/.test(name));
    assert.deepEqual(gone.map(([name]) => name).sort(), ["111-222.json", "111-222.mp4", "333-444-4k.json", "333-444-4k.mp4"]);
    assert.ok(gone.every(([, video, facts]) => video && facts));
    assert.deepEqual(entries(t.paths.dir), [basename(t.paths.facts), basename(t.paths.video)].sort());
  });
  it("leaves alone what is in the folder that is not a working copy's file: no pattern is ever swept", async (c) => {
    const t = setup();
    c.after(t.done);
    for (const name of ["notes.txt", ".DS_Store", "111-222.mp4.writing", "111-222.mov", "x111-222.mp4", "111-222-8k.mp4", "111-222.json.bak", "111-.mp4"]) t.earlier(name);
    t.earlier("111-222.mp4");
    assert.equal((await t.job()).ok, true);
    assert.deepEqual(entries(t.paths.dir), [".DS_Store", "111-222-8k.mp4", "111-222.json.bak", "111-222.mov", "111-222.mp4.writing", "111-.mp4", basename(t.paths.facts), basename(t.paths.video), "notes.txt", "x111-222.mp4"].sort());
  });
  it("is made all the same when the old copy cannot be taken away, and says so in the log", async (c) => {
    const t = setup();
    c.after(t.done);
    t.earlier("111-222.mp4", "THE OLD COPY");
    t.earlier("111-222.json", "{}");
    t.deps.rm = (path, options) => {
      if (basename(path) === "111-222.mp4") throw Object.assign(new Error("EBUSY: resource busy"), { code: "EBUSY" });
      rmSync(path, options);
    };
    const result = await t.job();
    assert.deepEqual([result.ok, result.failed, result.words], [true, [], "Done"]);
    assert.equal(readFileSync(t.paths.video, "utf8"), "THE WORKING COPY");
    assert.ok(t.logs.some((line) => line.includes("111-222.mp4") && line.includes("EBUSY")), t.logs.join("\n"));
    assert.equal(existsSync(join(t.paths.dir, "111-222.json")), false);
  });
  it("is made all the same when the folder of the copies cannot be listed", async (c) => {
    const t = setup({ deps: { readDir: () => { throw Object.assign(new Error("EIO"), { code: "EIO" }); } } });
    c.after(t.done);
    const result = await t.job();
    assert.equal(result.ok, true);
    assert.equal(readFileSync(t.paths.video, "utf8"), "THE WORKING COPY");
  });
});

describe("the words of the job", () => {
  it("hold no path, no flag and no command name, whatever goes wrong, and are one of the three: the step, Done, or why it can't be used", async (c) => {
    const scripts = [
      {}, { source: printedOf({ picture: HLG }) }, { ffmpeg: "fail" }, { ffmpeg: "memory" }, { ffmpeg: "time" }, { ffmpeg: "killed" }, { ffmpeg: "throw" },
      { source: "{" }, { source: printedOf({ picture: null }) }, { free: 1 }, { filters: "", source: printedOf({ picture: HLG }) },
      { deps: { rename: failingRename(2) } }, { tools: {} }, { copy: copyOf({ duration: "3" }) }
    ];
    for (const script of scripts) {
      const t = setup(script);
      c.after(t.done);
      const result = await t.job();
      for (const line of [...result.made, ...result.failed, result.next, result.words]) assert.ok(plain(line), `${JSON.stringify(script)}: ${line}`);
      assert.ok(result.words === "Done" || /^It can't be used: .+\.$/.test(result.words), result.words);
      assert.deepEqual(result.failed, result.ok ? [] : [result.words]);
      for (const [name, said] of t.events) if (name === "step") assert.equal(said, "Making the video for HyperFrames");
    }
  });
  it("never throws, whatever it is asked: no video, no folder, no home", async () => {
    // Only the raw video is there, and nothing is written anywhere: the stand-ins for the disk make nothing.
    const noProgram = async () => { throw new Error("no program is run in this test"); };
    const deps = { tools: { ffmpeg: "FFMPEG", ffprobe: "FFPROBE" }, run: noProgram, runGuarded: noProgram, stat: (path) => (path === "/nowhere/a.mov" ? { size: 5, mtimeMs: 5 } : undefined), probe: async () => "", mkdir: () => {}, rm: () => {} };
    for (const asked of [{ video: undefined }, { video: null }, { video: "" }, { folder: undefined }, { folder: "../x" }, { home: undefined }]) {
      const result = await makeWorkCopy({ home: "/nowhere", folder: "E", video: "/nowhere/a.mov", ...asked }, deps);
      assert.equal(result.ok, false, JSON.stringify(asked));
      assert.deepEqual(result.failed, [result.words]);
      assert.ok(plain(result.words), result.words);
    }
  });
  it("never throws, whatever the Mac does: a failing ffmpeg, a failing disk, a failing panel", async (c) => {
    const fails = (code) => () => { throw Object.assign(new Error(`${code}: it failed`), { code }); };
    const scripts = [
      { ffmpeg: "throw" }, { deps: { rm: fails("EBUSY") } }, { deps: { readDir: fails("EIO"), rename: fails("EIO") } }, { deps: { probe: fails("EPIPE") } },
      { deps: { freeBytes: fails("EIO"), mkdir: fails("EACCES") } }, { deps: { run: fails("EAGAIN") }, source: printedOf({ picture: HLG }) }
    ];
    for (const script of scripts) {
      const t = setup(script);
      c.after(t.done);
      const result = await t.job();
      assert.equal(typeof result.ok, "boolean", JSON.stringify(Object.keys(script)));
      assert.deepEqual(result.failed, result.ok ? [] : [result.words]);
    }
  });
});

describe("asking for the working copy", () => {
  const FOLDER = "2026-10-27 Pricing talk";
  /** What edit.js gives a command: this Mac's home folder, how a run is known to be alive, how a program is started detached, and
      the checkout the programs are run from. `alive` says which processes are running. */
  const asking = (c, alive = () => false) => {
    const home = mkdtempSync(join(tmpdir(), "brimm-workcopy-ask-"));
    c.after(() => rmSync(home, { recursive: true, force: true }));
    const started = [];
    return { home, started, ctx: { home, alive, start: (cmd, args) => started.push([cmd, args]), settings: { checkout: "/checkout" } } };
  };
  /** A run of `command` at work on the episode: the working copy's run takes the working copy's own lock, and every other the
      episode's. */
  const atWork = (home, command) => {
    mkdirSync(episodeWork(home, FOLDER), { recursive: true });
    const lock = command === "workcopy" ? workCopyLockOf(home, FOLDER) : lockOf(home, FOLDER);
    assert.equal(takeEpisodeLock(lock, command, () => true).taken, true);
  };
  it("has a lock of its own, beside the episode's", () => {
    assert.equal(workCopyLockOf("/Users/sallie", FOLDER), join(episodeWork("/Users/sallie", FOLDER), "workcopy.lock"));
    assert.notEqual(workCopyLockOf("/Users/sallie", FOLDER), lockOf("/Users/sallie", FOLDER));
  });
  it("starts the detached run of the episode when none is at work on it, and returns at once", (c) => {
    const { ctx, started } = asking(c);
    assert.deepEqual(requestWorkCopy(ctx, { folder: FOLDER }), { started: true, running: "" });
    assert.deepEqual(started, [[process.execPath, ["/checkout/tool/edit.js", "workcopy", "--now", FOLDER]]]);
  });
  it("starts none for a second request while the first one runs", (c) => {
    const { ctx, home, started } = asking(c, (pid) => pid === process.pid);
    assert.equal(requestWorkCopy(ctx, { folder: FOLDER }).started, true);
    // The run takes the working copy's lock as it begins.
    atWork(home, "workcopy");
    assert.deepEqual(requestWorkCopy(ctx, { folder: FOLDER }), { started: false, running: "workcopy" });
    assert.deepEqual(requestWorkCopy(ctx, { folder: FOLDER, fourK: true }), { started: false, running: "workcopy" });
    assert.equal(started.length, 1);
  });
  it("starts the run beside the reading and every other command at work on the episode: it writes no record", (c) => {
    for (const command of ["read", "bring", "finish", "ask"]) {
      const { ctx, home, started } = asking(c, (pid) => pid === process.pid);
      atWork(home, command);
      assert.deepEqual(requestWorkCopy(ctx, { folder: FOLDER }), { started: true, running: "" }, command);
      assert.equal(started.length, 1, command);
    }
  });
  it("starts the run when the lock was left by a run that died, as every command does", (c) => {
    const { ctx, home, started } = asking(c, () => false);
    atWork(home, "workcopy");
    assert.deepEqual(requestWorkCopy(ctx, { folder: FOLDER }), { started: true, running: "" });
    assert.equal(started.length, 1);
  });
  it("starts the run for another episode while one runs for this one: the lock is each episode's own", (c) => {
    const { ctx, home, started } = asking(c, (pid) => pid === process.pid);
    atWork(home, "workcopy");
    assert.equal(requestWorkCopy(ctx, { folder: "2026-10-28 Another talk" }).started, true);
    assert.deepEqual(started[0][1].slice(1), ["workcopy", "--now", "2026-10-28 Another talk"]);
  });
  it("passes the 4K switch on to the run", (c) => {
    const { ctx, started } = asking(c);
    requestWorkCopy(ctx, { folder: FOLDER, fourK: true });
    assert.deepEqual(started[0][1], ["/checkout/tool/edit.js", "workcopy", "--now", FOLDER, "--4k"]);
  });
  it("asks for a Reel's video with its number (plan PR 5), and a Reel's is never of 4K", (c) => {
    const { ctx, started } = asking(c);
    assert.deepEqual(requestWorkCopy(ctx, { folder: FOLDER, reel: 2 }), { started: true, running: "" });
    requestWorkCopy(ctx, { folder: FOLDER, reel: 12, fourK: true });
    assert.deepEqual(started.map(([, args]) => args), [["/checkout/tool/edit.js", "workcopy", "--now", FOLDER, "--reel", "2"], ["/checkout/tool/edit.js", "workcopy", "--now", FOLDER, "--reel", "12"]]);
  });
  it("starts none for a Reel's video while a copy is made, and none for the video while a Reel's is: they share the lock, one copy at a time", (c) => {
    const { ctx, home, started } = asking(c, (pid) => pid === process.pid);
    atWork(home, "workcopy");
    assert.deepEqual(requestWorkCopy(ctx, { folder: FOLDER, reel: 2 }), { started: false, running: "workcopy" });
    assert.deepEqual(requestWorkCopy(ctx, { folder: FOLDER }), { started: false, running: "workcopy" });
    assert.deepEqual(started, []);
  });
});

// --- A Reel's copy: the working copy's chain and checks on a stretch of the recording (plan PR 5; architecture 4.3 and 5.7) ---

describe("the arguments ffmpeg is given for a Reel's stretch of the recording", () => {
  const STRETCH = { start: 312.4, end: 340.15 };
  /** The arguments without one flag and its value. */
  const without = (args, flag) => {
    const at = args.indexOf(flag);
    return [...args.slice(0, at), ...args.slice(at + 2)];
  };
  it("seek to the stretch's start before the input, and stop at its length after the picture and the sound are made", () => {
    const a = argsFor(printedOf(), { stretch: STRETCH });
    assert.deepEqual(a.slice(0, 9), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-ss", "312.4", "-i", "/in/a b.mov"]);
    assert.equal(after(a, "-t"), "27.75");
    assert.ok(a.indexOf("-t") > a.indexOf("-color_range") && a.indexOf("-t") < a.indexOf("-f"), a.join(" "));
    assert.deepEqual(a.slice(-3), ["-f", "mp4", "/out/work/key.mp4"]);
  });
  it("are the whole copy's arguments but for those two, whatever the video is: the chain, the maps, the tags and an HDR video's VideoToolbox are the working copy's own", () => {
    const odd = { ...HLG, width: 1920, height: 1080, side_data_list: [{ side_data_type: "Display Matrix", rotation: -45 }] };
    for (const printed of [printedOf(), printedOf({ picture: HLG }), printedOf({ picture: PQ }), printedOf({ picture: UPRIGHT }), printedOf({ picture: { ...HLG, ...UPRIGHT } }), printedOf({ picture: TURNED_ROUND }), printedOf({ picture: odd }), printedOf({ picture: { ...HLG, pix_fmt: "yuv420p" } }), printedOf({ sounds: [{ codec_name: "apple_apac" }, { codec_name: "aac" }] }), printedOf({ sounds: [] })]) {
      assert.deepEqual(without(without(argsFor(printed, { stretch: STRETCH }), "-ss"), "-t"), argsFor(printed));
    }
    assert.deepEqual(without(without(argsFor(printedOf(), { stretch: STRETCH, fourK: true }), "-ss"), "-t"), argsFor(printedOf(), { fourK: true }));
    assert.deepEqual(without(without(argsFor(printedOf({ picture: HLG }), { stretch: STRETCH, fourK: true }), "-ss"), "-t"), argsFor(printedOf({ picture: HLG }), { fourK: true }));
    // A made-up colour chain would show: an HDR video's is the working copy's own, made standard on the hardware, and one in standard
    // colour has none of it.
    assert.match(after(argsFor(printedOf({ picture: HLG }), { stretch: STRETCH }), "-vf"), /^fps=30:start_time=0,scale_vt=w=1920:h=1080:color_matrix=bt709:color_primaries=bt709:color_transfer=bt709,hwdownload,format=p010le,format=yuv420p$/);
    assert.doesNotMatch(after(argsFor(printedOf(), { stretch: STRETCH }), "-vf"), /scale_vt|hwdownload|tonemap|zscale/);
    assert.ok(!argsFor(printedOf(), { stretch: STRETCH }).includes("-hwaccel"));
  });
  // An HDR recording's Reel is made with VideoToolbox, as the whole copy is (the working copy's HDR change, PR #9): the hardware's
  // options go before the input, and so does the stretch's start, which is an input option as they are. Where the start stands
  // among them changes nothing in what ffmpeg does; it stands after them, last before the input.
  const HARDWARE = ["-noautorotate", "-display_rotation", "0", "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld"];
  const SCALE_VT = (w, h) => `scale_vt=w=${w}:h=${h}:color_matrix=bt709:color_primaries=bt709:color_transfer=bt709`;
  it("put the start of an HDR recording's stretch among the input options the hardware has, last before the input, and its length after the picture and the sound are made", () => {
    const a = argsFor(printedOf({ picture: HLG }), { stretch: STRETCH });
    assert.deepEqual(a.slice(0, 16), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...HARDWARE, "-ss", "312.4", "-i", "/in/a b.mov"]);
    assert.equal(a.filter((x) => x === "-ss").length, 1);
    assert.equal(after(a, "-t"), "27.75");
    assert.ok(a.indexOf("-t") > a.indexOf("-color_range") && a.indexOf("-t") < a.indexOf("-f"), a.join(" "));
    assert.deepEqual(a.slice(-3), ["-f", "mp4", "/out/work/key.mp4"]);
  });
  it("carry the VideoToolbox chain and the turn an upright HDR recording is stored with, and the stretch changes nothing in the chain", () => {
    const upright = printedOf({ picture: { ...HLG, ...UPRIGHT } });
    const a = argsFor(upright, { stretch: STRETCH });
    // Stored on its side as 1920 by 1080 and shown 1080 by 1920: VideoToolbox makes it the size it is stored at, and the turn, by hand,
    // comes after the colour is standard.
    assert.equal(after(a, "-vf"), `fps=30:start_time=0,${SCALE_VT(1920, 1080)},hwdownload,format=p010le,transpose=clock,format=yuv420p`);
    assert.equal(after(a, "-vf"), after(argsFor(upright), "-vf"));
    assert.deepEqual([after(a, "-display_rotation"), a.includes("-noautorotate"), after(a, "-ss"), after(a, "-t")], ["0", true, "312.4", "27.75"]);
    // Every one of the input options, the start among them, is before the input; the length is not.
    const input = a.indexOf("-i");
    for (const flag of ["-noautorotate", "-display_rotation", "-hwaccel", "-hwaccel_output_format", "-ss"]) assert.ok(a.indexOf(flag) > -1 && a.indexOf(flag) < input, flag);
    assert.ok(a.indexOf("-t") > input);
    assert.equal(a.filter((x) => x === "-display_rotation").length, 1);
  });
  it("turn a recording stored turned round by a half turn, and one turned the other way a quarter the other way, with the stretch as without it", () => {
    const left = { ...HLG, side_data_list: [{ side_data_type: "Display Matrix", rotation: 90 }] };
    assert.equal(after(argsFor(printedOf({ picture: TURNED_ROUND }), { stretch: STRETCH }), "-vf"), `fps=30:start_time=0,${SCALE_VT(1920, 1080)},hwdownload,format=p010le,hflip,vflip,format=yuv420p`);
    assert.equal(after(argsFor(printedOf({ picture: left }), { stretch: STRETCH }), "-vf"), `fps=30:start_time=0,${SCALE_VT(1920, 1080)},hwdownload,format=p010le,transpose=cclock,format=yuv420p`);
  });
  it("are refused for an HDR recording not told how it is stored, with a stretch as without one: a Reel must not come out on its side", () => {
    const printed = printedOf({ picture: { ...HLG, ...UPRIGHT } });
    assert.throws(() => workCopyArgs("/in/a.mov", "/out/a.mp4", { facts: factsOf(printed), streams: streamsOf(printed), colour: colourOf(printed), rate: "30", stretch: STRETCH }), /stored/);
    // A video in standard colour has no need of it, and its stretch is cut as it was.
    assert.ok(workCopyArgs("/in/a.mov", "/out/a.mp4", { ...factsFrom(printedOf()), stored: undefined, stretch: STRETCH }));
  });
  it("write a start and a length ffmpeg can read, to the thousandth of a second, whatever the sums leave", () => {
    const a = argsFor(printedOf(), { stretch: { start: 0.1 + 0.2, end: 5 } });
    assert.equal(after(a, "-ss"), "0.3");
    assert.equal(after(a, "-t"), "4.7");
    assert.equal(after(argsFor(printedOf(), { stretch: { start: 0, end: 1e-4 + 2 } }), "-ss"), "0");
  });
  it("are none, as for a whole video, for a video that cannot be made into a copy", () => {
    assert.equal(workCopyArgs("/in/a.mov", "/out/a.mp4", { facts: null, streams: null, stretch: STRETCH }), null);
    assert.equal(argsFor(printedOf({ picture: null }), { stretch: STRETCH }), null);
  });
  it("refuse a stretch that is not one: it ends where it starts or before, starts before 0, or is not times", () => {
    for (const stretch of [{ start: 5, end: 5 }, { start: 6, end: 5 }, { start: -1, end: 4 }, { start: NaN, end: 4 }, { start: 1, end: "x" }, { start: 1 }, {}, 7]) {
      assert.throws(() => argsFor(printedOf(), { stretch }), /stretch/, JSON.stringify(stretch));
    }
  });
});

describe("the key and the places of a Reel's copy", () => {
  const RAW = { bytes: 3300000000, mtimeMs: 1760000000123.7 };
  const STRETCH = { start: 312.4, end: 340.15 };
  it("is the raw file's size and time and the stretch's two ends in milliseconds: the same stretch of the same file is the same copy", () => {
    assert.equal(reelCopyKey(RAW, STRETCH), "3300000000-1760000000123-312400-340150");
    assert.equal(reelCopyKey({ ...RAW }, { ...STRETCH }), reelCopyKey(RAW, STRETCH));
    // Sums leave a stretch's ends a hair off: they are taken to the millisecond.
    assert.equal(reelCopyKey(RAW, { start: 0.1 + 0.2, end: 5 }), "3300000000-1760000000123-300-5000");
  });
  it("changes when the file does, or either end of the stretch", () => {
    const key = reelCopyKey(RAW, STRETCH);
    for (const other of [reelCopyKey({ ...RAW, bytes: RAW.bytes + 1 }, STRETCH), reelCopyKey({ ...RAW, mtimeMs: RAW.mtimeMs + 1 }, STRETCH), reelCopyKey(RAW, { ...STRETCH, start: 312.401 }), reelCopyKey(RAW, { ...STRETCH, end: 340.151 })]) {
      assert.notEqual(other, key);
      assert.match(other, /^\d+-\d+-\d+-\d+$/);
    }
  });
  it("is none for a file or a stretch that is not one", () => {
    for (const [file, stretch] of [[null, STRETCH], [{ bytes: -1, mtimeMs: 5 }, STRETCH], [{ bytes: 5, mtimeMs: NaN }, STRETCH], [RAW, null], [RAW, {}], [RAW, { start: 5, end: 5 }], [RAW, { start: -1, end: 5 }], [RAW, { start: 1, end: Infinity }]]) {
      assert.equal(reelCopyKey(file, stretch), "", JSON.stringify([file, stretch]));
    }
  });
  it("is where the finished video goes, beside the working copy's, named for the Reel, with its facts and its faces", () => {
    const key = reelCopyKey(RAW, STRETCH);
    const copies = workCopyPaths("/Users/sallie", "2026-10-27 Pricing talk", "1-1");
    const paths = reelCopyPaths("/Users/sallie", "2026-10-27 Pricing talk", 2, key);
    assert.deepEqual(paths, { dir: copies.dir, video: join(copies.dir, `reel-2-${key}.mp4`), facts: join(copies.dir, `reel-2-${key}.json`), faces: join(copies.dir, `reel-2-${key}.faces.json`) });
    assert.notEqual(paths.video, workCopyPaths("/Users/sallie", "2026-10-27 Pricing talk", "3300000000-1760000000123").video);
  });
  it("refuses a number that is not a whole number from 1, a key that is not safe, and an episode folder that is not one folder's name", () => {
    const key = reelCopyKey(RAW, STRETCH);
    for (const n of [0, -1, 1.5, "2", null, undefined, NaN]) assert.throws(() => reelCopyPaths("/Users/sallie", "E", n, key), /Reel/, String(n));
    for (const bad of ["", "../../x", "1-1", "1-1-4k", "1-2-3-4/5", "a-b-c-d", undefined, null]) assert.throws(() => reelCopyPaths("/Users/sallie", "E", 2, bad), /key/, String(bad));
    for (const folder of ["", ".", "..", "a/b", undefined]) assert.throws(() => reelCopyPaths("/Users/sallie", folder, 2, key), /folder|episode/, String(folder));
  });
});

describe("a Reel's video, made from the recording", () => {
  const REEL = { n: 2, start: 5, end: 12 };
  /** The made-up recording is 23.423 seconds long, and what ffmpeg makes of a stretch of 7 of them is a little longer, as AAC is. */
  const reelSetup = (script = {}) => setup({ copy: copyOf({ duration: "7.020000" }), ...script });
  const reelPaths = (t, reel = REEL) => {
    const raw = statSync(t.video);
    return reelCopyPaths(t.home, t.folder, reel.n, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, reel));
  };
  const job = (t, more = {}) => t.job({ name: "Pricing talk, Reel 2", reel: REEL, ...more });
  it("has ffmpeg cut it under the watchdog with the working copy's limits for the stretch's seconds, and puts it, with its facts, beside the working copy's place", async (c) => {
    const t = reelSetup();
    c.after(t.done);
    const result = await job(t);
    assert.deepEqual([result.ok, result.failed, result.words], [true, [], "Done"]);
    const paths = reelPaths(t);
    assert.equal(t.guarded.length, 1);
    const { args, limits } = t.guarded[0];
    assert.deepEqual(limits, workCopyLimits(7, false));
    assert.deepEqual(args.slice(args.indexOf("-nostdin")).slice(0, 8), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-ss", "5", "-i"]);
    assert.equal(after(args, "-t"), "7");
    assert.equal(args.at(-1), join(t.runFolder, basename(paths.video)));
    assert.equal(readFileSync(paths.video, "utf8"), "THE WORKING COPY");
    assert.deepEqual(JSON.parse(readFileSync(paths.facts, "utf8")), { seconds: 7.02, fps: 30, width: 1920, height: 1080, bytes: 16, stretch: { start: 5, end: 12 } });
    // Nothing else is in the folder of the copies, and nothing is left of the run.
    assert.deepEqual(t.inWork(), [t.shown(paths.facts), t.shown(paths.video)].sort());
    assert.deepEqual(entries(runsFolder(t.home)), []);
    assert.deepEqual(result.paths, paths);
  });
  it("is the working copy's own work: the same arguments but for the stretch, read from what ffprobe printed of the recording, an HDR one's turn included", async (c) => {
    const slow = { r_frame_rate: "24/1", avg_frame_rate: "24/1" };
    for (const printed of [
      printedOf({ picture: { ...UPRIGHT, ...slow }, sounds: [{ codec_name: "apple_apac" }, { codec_name: "aac" }] }),
      // An HDR recording stored on its side, and one stored turned round: the turn is read from the recording, whichever stretch is cut.
      printedOf({ picture: { ...HLG, ...UPRIGHT, ...slow } }),
      printedOf({ picture: TURNED_ROUND })
    ]) {
      const t = reelSetup({ source: printed });
      c.after(t.done);
      await job(t);
      assert.deepEqual(t.guarded[0].args.slice(2), workCopyArgs(t.video, join(t.runFolder, basename(reelPaths(t).video)), { ...factsFrom(printed), stretch: { start: 5, end: 12 } }));
    }
  });
  it("says what was made in its own words: the video for the Reel, and what was done to it that she may want to know", async (c) => {
    const t = reelSetup({ source: printedOf({ picture: { ...HLG, r_frame_rate: "60/1", avg_frame_rate: "3000/79" } }) });
    c.after(t.done);
    const result = await job(t);
    assert.deepEqual(result.made, ["the video for Reel 2", "its speed made steady at 30 pictures a second", "its HDR colours made standard"]);
    assert.ok(t.logs.some((line) => line.includes("Reel 2")), t.logs.join("\n"));
  });
  it("holds the end of the stretch to the video's length: a stretch that runs past the end is cut at the end, and the facts say where", async (c) => {
    const t = reelSetup({ copy: copyOf({ duration: "3.440000" }) });
    c.after(t.done);
    const reel = { n: 2, start: 20, end: 40 };
    const result = await job(t, { reel });
    assert.deepEqual([result.ok, result.failed], [true, []]);
    assert.equal(after(t.guarded[0].args, "-ss"), "20");
    assert.equal(after(t.guarded[0].args, "-t"), "3.423");
    // Its copy is named for the stretch as it was asked for, so that asking again finds it.
    assert.equal(result.key, reelCopyKey({ bytes: statSync(t.video).size, mtimeMs: statSync(t.video).mtimeMs }, reel));
    assert.deepEqual(JSON.parse(readFileSync(reelPaths(t, reel).facts, "utf8")).stretch, { start: 20, end: 23.423 });
  });
  it("refuses in words, and runs no ffmpeg, a stretch that is not in the video: one past its end, or in its last picture", async (c) => {
    for (const reel of [{ n: 2, start: 30, end: 40 }, { n: 2, start: 23.4, end: 30 }, { n: 2, start: 23.423, end: 30 }]) {
      const t = reelSetup();
      c.after(t.done);
      const result = await job(t, { reel });
      assert.deepEqual([result.ok, result.made, result.failed, result.words], [false, [], ["It can't be used: Reel 2 is not in the video."], "It can't be used: Reel 2 is not in the video."], JSON.stringify(reel));
      assert.deepEqual([t.guarded, t.inWork(), entries(runsFolder(t.home))], [[], [], []], JSON.stringify(reel));
    }
  });
  it("refuses in words a Reel that is not a Reel, or a stretch that is not one, and runs no ffmpeg", async (c) => {
    for (const reel of [{ n: 0, start: 5, end: 12 }, { n: 2, start: 12, end: 5 }, { n: 2, start: -1, end: 5 }, { n: 2, start: "x", end: 5 }, { n: 2 }, 7]) {
      const t = reelSetup();
      c.after(t.done);
      const result = await job(t, { reel });
      assert.equal(result.ok, false, JSON.stringify(reel));
      assert.deepEqual([t.guarded, t.inWork()], [[], []], JSON.stringify(reel));
      assert.ok(plain(result.words), result.words);
    }
  });
  it("asks for twice the stretch's share of the raw video's size to be free, and not twice the whole video's", async (c) => {
    // The raw video is 4096 bytes and the stretch is 7 of its 23.423 seconds: 1224 bytes, and twice that is 2448.
    const enough = reelSetup({ free: 3000 });
    c.after(enough.done);
    assert.equal((await job(enough)).ok, true);
    const short = reelSetup({ free: 2000 });
    c.after(short.done);
    const refused = await job(short);
    assert.equal(refused.ok, false);
    assert.match(refused.words, /^It can't be used: there is not enough room on this Mac to make it: .+ must be free, and .+ is\.$/);
    assert.deepEqual(short.guarded, []);
    // The whole video's copy, with the same room, is refused: it needs twice 4096.
    const whole = setup({ free: 3000 });
    c.after(whole.done);
    assert.equal((await whole.job()).ok, false);
  });
  it("checks the length of what it made against the stretch's, and not the video's", async (c) => {
    const long = reelSetup({ copy: copyOf({ duration: "23.436000" }) });
    c.after(long.done);
    assert.deepEqual((await job(long)).failed, ["It can't be used: what was made came out the wrong length."]);
    const short = reelSetup({ copy: copyOf({ duration: "5.9" }) });
    c.after(short.done);
    assert.deepEqual((await job(short)).failed, ["It can't be used: what was made came out the wrong length."]);
    assert.deepEqual([long.inWork(), short.inWork()], [[], []]);
  });
  it("makes an HDR recording's Reel as the whole copy is made: with VideoToolbox, the turn the recording is stored with and the stretch, after asking which filters and which hardware decoders this Mac has, once each", async (c) => {
    const t = reelSetup({ source: printedOf({ picture: { ...HLG, ...UPRIGHT } }) });
    c.after(t.done);
    const result = await job(t);
    assert.deepEqual([result.ok, result.failed], [true, []]);
    const listings = t.calls.filter((x) => x.cmd === "FFMPEG");
    assert.deepEqual(listings.map((x) => x.args.filter((a) => a === "-filters" || a === "-hwaccels")), [["-filters"], ["-hwaccels"]]);
    const { args } = t.guarded[0];
    // The hardware's input options, then the start of the stretch, then the input; and the length after the picture is made.
    assert.deepEqual(args.slice(args.indexOf("-noautorotate"), args.indexOf("-i") + 1), ["-noautorotate", "-display_rotation", "0", "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld", "-ss", "5", "-i"]);
    assert.match(after(args, "-vf"), /^fps=30:start_time=0,scale_vt=w=1920:h=1080:color_matrix=bt709:color_primaries=bt709:color_transfer=bt709,hwdownload,format=p010le,transpose=clock,format=yuv420p$/);
    assert.deepEqual([after(args, "-display_rotation"), after(args, "-t")], ["0", "7"]);
    // Its facts say the stretch that was cut, and the words say the colours were made standard.
    assert.deepEqual(result.made, ["the video for Reel 2", "its HDR colours made standard"]);
    assert.deepEqual(JSON.parse(readFileSync(reelPaths(t).facts, "utf8")).stretch, { start: 5, end: 12 });
  });
  it("does not ask which filters or hardware decoders it has for a Reel of a recording in standard colour, and gives ffmpeg no hardware", async (c) => {
    const t = reelSetup({ filters: filtersOf9(), hwaccels: hwaccelsOf() });
    c.after(t.done);
    assert.equal((await job(t)).ok, true);
    assert.deepEqual(t.calls.filter((x) => x.cmd === "FFMPEG"), []);
    assert.ok(!t.guarded[0].args.includes("-hwaccel"));
    assert.match(after(t.guarded[0].args, "-vf"), /^fps=30:start_time=0,scale=1920:1080,format=yuv420p$/);
  });
  it("refuses an HDR recording's Reel on a Mac without VideoToolbox's decoder or its filter, in the working copy's own words, and runs no ffmpeg", async (c) => {
    const said = [canNotBeUsed("it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason")];
    for (const [what, script] of [
      ["no scale_vt", { filters: filtersOf9("tonemap", "colorspace", "transpose_vt") }],
      ["no videotoolbox", { hwaccels: hwaccelsOf() }],
      ["neither", { filters: filtersOf("tonemap_opencl"), hwaccels: hwaccelsOf("vaapi") }]
    ]) {
      const hdr = reelSetup({ source: printedOf({ picture: HLG }), ...script });
      c.after(hdr.done);
      const result = await job(hdr);
      assert.deepEqual([result.ok, result.failed, result.words], [false, said, said[0]], what);
      assert.deepEqual([hdr.guarded, hdr.inWork(), entries(runsFolder(hdr.home))], [[], [], []], what);
      assert.ok(plain(result.words), result.words);
    }
    // The same Mac makes a Reel of a recording in standard colour.
    const sdr = reelSetup({ filters: filtersOf9(), hwaccels: hwaccelsOf() });
    c.after(sdr.done);
    assert.equal((await job(sdr)).ok, true);
  });
  it("tells the progress panel the stretch's length and the one step, and its two when it is to look for faces", async (c) => {
    const alone = reelSetup();
    c.after(alone.done);
    await job(alone);
    assert.deepEqual(alone.events, [
      ["begin", "Pricing talk, Reel 2"], ["steps", WORK_COPY_STEPS], ["step", WORK_COPY_STEP], ["length", 7], ["encoding", 7], ["stop"], ["end", true]
    ]);
    const finding = reelSetup({ deps: { faces: async () => ({ why: "none" }) } });
    c.after(finding.done);
    await job(finding);
    assert.deepEqual(finding.events, [
      ["begin", "Pricing talk, Reel 2"], ["steps", REEL_COPY_STEPS], ["step", WORK_COPY_STEP], ["length", 7], ["encoding", 7], ["stop"], ["step", FACES_STEP], ["end", true]
    ]);
    assert.deepEqual(REEL_COPY_STEPS, ["Making the video for HyperFrames", "Finding the faces"]);
  });
  it("does not make a copy again that is there whole, and says Done", async (c) => {
    const t = reelSetup();
    c.after(t.done);
    const paths = reelPaths(t);
    t.earlier(basename(paths.video), "THE REEL MADE BEFORE");
    t.earlier(basename(paths.facts), "{}");
    const result = await job(t);
    assert.deepEqual([result.ok, result.made, result.words, result.key], [true, [], "Done", basename(paths.video).replace(/^reel-2-/, "").replace(/\.mp4$/, "")]);
    assert.deepEqual([t.guarded, t.calls, t.events], [[], [], []]);
    assert.equal(readFileSync(paths.video, "utf8"), "THE REEL MADE BEFORE");
  });
  it("takes away the same Reel's copies for other stretches or files once it is whole, and nothing else: not the working copy, not another Reel's, not what is no copy", async (c) => {
    const t = reelSetup();
    c.after(t.done);
    const mine = ["reel-2-4096-9-1000-2000.mp4", "reel-2-4096-9-1000-2000.json", "reel-2-4096-9-1000-2000.faces.json"];
    const stays = [basename(workCopyPaths(t.home, t.folder, t.key).video), basename(workCopyPaths(t.home, t.folder, t.key).facts), "reel-3-4096-9-1000-2000.mp4", "reel-3-4096-9-1000-2000.json", "reel-12-4096-9-1000-2000.mp4", "reel-2.mp4", "reel-2-4096-9-1000-2000.mov", "reel-2-4096-9-1000-2000.mp4.writing", "reel-2-x-1000-2000.mp4", "reel-2-4096-9-1000-2000.json.bak", "notes.txt"];
    for (const name of [...mine, ...stays]) t.earlier(name);
    const removed = [];
    t.deps.rm = (path, options) => {
      removed.push([basename(path), existsSync(reelPaths(t).video), existsSync(reelPaths(t).facts)]);
      rmSync(path, options);
    };
    assert.equal((await job(t)).ok, true);
    const gone = removed.filter(([name]) => /^reel-/.test(name));
    assert.deepEqual(gone.map(([name]) => name).sort(), [...mine].sort());
    assert.ok(gone.every(([, video, facts]) => video && facts), "each went only once the new video and its facts were in place");
    assert.deepEqual(entries(t.paths.dir), [basename(reelPaths(t).video), basename(reelPaths(t).facts), ...stays].sort());
  });
  it("is not what the working copy's job takes away: a working copy made beside a Reel's leaves the Reel's files", async (c) => {
    const t = setup();
    c.after(t.done);
    for (const name of ["reel-2-4096-9-1000-2000.mp4", "reel-2-4096-9-1000-2000.json", "reel-2-4096-9-1000-2000.faces.json"]) t.earlier(name);
    assert.equal((await t.job()).ok, true);
    assert.deepEqual(entries(t.paths.dir), ["reel-2-4096-9-1000-2000.faces.json", "reel-2-4096-9-1000-2000.json", "reel-2-4096-9-1000-2000.mp4", basename(t.paths.facts), basename(t.paths.video)].sort());
  });
  it("leaves nothing in the work folder, and says why in words, when it cannot be made: as the whole copy's rows have it", async (c) => {
    const rows = [
      [{ ffmpeg: "fail" }, "it could not be converted"], [{ ffmpeg: "memory" }, "it needed more of this Mac's memory than it may use"], [{ ffmpeg: "time" }, "it was taking too long, so it was stopped"],
      [{ ffmpeg: "killed" }, "it was stopped before it was done"], [{ copy: "" }, "what was made could not be read back"], [{ deps: { rename: failingRename(2) } }, "it could not be put in place"],
      [{ copy: copyOf({ sounds: [], duration: "7.02" }) }, "what was made has no sound"]
    ];
    for (const [script, reason] of rows) {
      const t = reelSetup(script);
      c.after(t.done);
      const result = await job(t);
      assert.deepEqual([result.ok, result.made, result.failed], [false, [], [canNotBeUsed(reason)]], JSON.stringify(Object.keys(script)));
      assert.deepEqual([t.inWork(), entries(runsFolder(t.home))], [[], []]);
      assert.ok(plain(result.words), result.words);
    }
  });
});

describe("the faces looked for in a Reel's video (architecture 4.3; plan PR 5)", () => {
  const REEL = { n: 2, start: 5, end: 12 };
  const BOX = { x: 0.41, y: 0.22, w: 0.18, h: 0.3 };
  const FOUND = { stills: [{ file: "0001.jpg", faces: [] }, { file: "0002.jpg", faces: [BOX] }] };
  const reelSetup = (script = {}) => setup({ copy: copyOf({ duration: "7.020000" }), ...script });
  const pathsOf = (t) => {
    const raw = statSync(t.video);
    return reelCopyPaths(t.home, t.folder, REEL.n, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, REEL));
  };
  const job = (t) => t.job({ name: "Pricing talk, Reel 2", reel: REEL });
  it("are asked of the video once it is in place, with the run's own folder to work in, and kept beside it when the finder found a face", async (c) => {
    const asked = [];
    const t = reelSetup({ deps: { faces: async (video, work) => (asked.push({ video, work, there: existsSync(video) && readFileSync(video, "utf8") }), FOUND) } });
    c.after(t.done);
    const renames = [];
    t.deps.rename = (from, to) => (renames.push(basename(to)), renameSync(from, to));
    const result = await job(t);
    const paths = pathsOf(t);
    assert.deepEqual([result.ok, result.failed, result.words], [true, [], "Done"]);
    assert.deepEqual(asked, [{ video: paths.video, work: t.runFolder, there: "THE WORKING COPY" }]);
    assert.deepEqual(JSON.parse(readFileSync(paths.faces, "utf8")), { every: STILL_EVERY, stills: FOUND.stills });
    // The facts first and the video last, as always; the faces after, since they are a thing the copy can do without.
    assert.deepEqual(renames, [basename(paths.facts), basename(paths.video), basename(paths.faces)]);
    assert.deepEqual(t.inWork(), [t.shown(paths.faces), t.shown(paths.facts), t.shown(paths.video)].sort());
    assert.deepEqual(entries(runsFolder(t.home)), []);
  });
  it("leave the copy, and no file, when the finder finds no face, says why, fails or throws: the copy is Done all the same", async (c) => {
    const finders = [
      async () => ({ stills: [{ file: "0001.jpg", faces: [] }] }), async () => ({ stills: [] }), async () => ({ why: "swift, which finds the faces, is not installed" }),
      async () => { throw new Error("the finder fell over"); }, async () => undefined, async () => "faces", async () => ({ stills: "none" })
    ];
    for (const faces of finders) {
      const t = reelSetup({ deps: { faces } });
      c.after(t.done);
      const result = await job(t);
      const paths = pathsOf(t);
      assert.deepEqual([result.ok, result.failed, result.words], [true, [], "Done"], String(faces));
      assert.equal(existsSync(paths.faces), false, String(faces));
      assert.equal(readFileSync(paths.video, "utf8"), "THE WORKING COPY", String(faces));
      assert.deepEqual(t.inWork(), [t.shown(paths.facts), t.shown(paths.video)].sort(), String(faces));
    }
  });
  it("say in the log, which Sallie does not read, why none were found when the finder says", async (c) => {
    const t = reelSetup({ deps: { faces: async () => ({ why: "the face finder stopped (it was killed)" }) } });
    c.after(t.done);
    await job(t);
    assert.ok(t.logs.some((line) => line.includes("faces") && line.includes("the face finder stopped (it was killed)")), t.logs.join("\n"));
  });
  it("leave the copy when the file of faces cannot be put in place", async (c) => {
    const t = reelSetup({ deps: { faces: async () => FOUND, rename: failingRename(3) } });
    c.after(t.done);
    const result = await job(t);
    const paths = pathsOf(t);
    assert.deepEqual([result.ok, result.failed], [true, []]);
    assert.equal(readFileSync(paths.video, "utf8"), "THE WORKING COPY");
    assert.equal(existsSync(paths.faces), false);
    assert.ok(t.logs.some((line) => line.includes("faces")), t.logs.join("\n"));
  });
  it("are never looked for in the working copy of the whole video, however the finder is given", async (c) => {
    const asked = [];
    const t = setup({ deps: { faces: async () => (asked.push(1), FOUND) } });
    c.after(t.done);
    assert.equal((await t.job()).ok, true);
    assert.deepEqual(asked, []);
    assert.deepEqual(t.events.filter(([name]) => name === "steps"), [["steps", WORK_COPY_STEPS]]);
  });
  it("are not looked for, and no step is told, when no finder is given", async (c) => {
    const t = reelSetup();
    c.after(t.done);
    assert.equal((await job(t)).ok, true);
    assert.ok(!t.events.some(([, said]) => said === FACES_STEP));
    assert.equal(existsSync(pathsOf(t).faces), false);
  });
  it("is not asked of a copy made already: the faces were looked for when it was made", async (c) => {
    const asked = [];
    const t = reelSetup({ deps: { faces: async () => (asked.push(1), FOUND) } });
    c.after(t.done);
    t.earlier(basename(pathsOf(t).video), "MADE BEFORE");
    t.earlier(basename(pathsOf(t).facts), "{}");
    assert.equal((await job(t)).words, "Done");
    assert.deepEqual(asked, []);
  });
});
