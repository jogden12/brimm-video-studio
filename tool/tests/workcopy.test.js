// The working copy of a raw video (workcopy.js): the video HyperFrames is given to edit. What it is made as, the words said when
// a video cannot be used, the key and the places of the copy are all decided from what ffprobe printed, so the arguments and the
// words are tested here with no video. The job is tested with stand-ins for ffprobe and ffmpeg, which write the files the real
// programs would. No test runs ffmpeg or ffprobe, and none touches the real Final Cut Pro, HyperFrames or Claude.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { factsOf, streamsOf, colourOf, encodeArgs } from "../cuts.js";
import { lockOf, takeEpisodeLock } from "../detached.js";
import { clearRuns } from "../filing.js";
import { episodeWork, runsFolder, workFolder } from "../settings.js";
import {
  rateOf, workCopySize, isHdr, workCopyArgs, workCopyFault, workCopyKey, workCopyPaths, workCopyFacts, workCopyLimits, workCopyNotes,
  canNotBeUsed, hasFilters, makeWorkCopy, requestWorkCopy, workCopyLockOf, WORK_COPY_STEP, WORK_COPY_STEPS, WORK_COPY_DONE, WORK_COPY_CRF, WORK_COPY_PRESET
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
/** The colour of an iPhone's HDR video, and of one in PQ. */
const HLG = { color_primaries: "bt2020", color_transfer: "arib-std-b67", color_space: "bt2020nc" };
const PQ = { color_primaries: "bt2020", color_transfer: "smpte2084", color_space: "bt2020nc" };
/** An iPhone's clip, turned on its side: coded 3840 by 2160, with a note to turn it a quarter. */
const UPRIGHT = { side_data_list: [{ side_data_type: "Display Matrix", rotation: -90 }] };

/** Everything the module decides from what ffprobe printed, as the job asks for it. */
const factsFrom = (printed) => ({ facts: factsOf(printed), streams: streamsOf(printed), colour: colourOf(printed), rate: rateOf(printed).rate });
const argsFor = (printed, more = {}, input = "/in/a b.mov", output = "/out/work/key.mp4") => workCopyArgs(input, output, { ...factsFrom(printed), ...more });
const after = (args, flag) => args[args.indexOf(flag) + 1];

/** What ffmpeg prints for -filters, with the filters given among the others: a source, and the names that merely begin as the
    ones looked for do, as tonemap_opencl does. */
const filtersOf = (...names) => `Filters:
  T.. = Timeline support
  .S. = Slice threading
  ..C = Command support
  A = Audio input/output
  V = Video input/output
  N = Dynamic number and/or type of input/output
  | = Source or sink filter
 ... aresample         A->A       Resample audio data.
 ... fps               V->V       Force constant framerate.
${names.map((name) => ` .S. ${name.padEnd(17)} V->V       A filter.`).join("\n")}
 ... yuvtestsrc        |->V       Generate YUV test pattern.
`;
const WITH_BOTH = filtersOf("tonemap", "tonemap_opencl", "zscale");

/** Words Sallie reads hold no path, no flag and no command name. */
const plain = (text) => !/[/\\]/.test(text) && !/(^|\s)--?[A-Za-z]/.test(text) && !/ffmpeg|ffprobe|zscale|tonemap|x264|libx|\.mp4|\.json|\.js\b|workcopy|node\b/i.test(text);

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
  it("tone-map an iPhone's HLG video to standard BT.709 colour, after it is made smaller, and write it as 8-bit 4:2:0", () => {
    const a = argsFor(printedOf({ picture: HLG }));
    assert.equal(after(a, "-vf"), "fps=30:start_time=0,scale=1920:1080,"
      + "zscale=pin=bt2020:tin=arib-std-b67:min=bt2020nc:rin=tv:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,"
      + "zscale=t=bt709:m=bt709:r=tv:dither=error_diffusion,format=yuv420p");
    assert.deepEqual(a.slice(a.indexOf("-colorspace"), a.indexOf("-colorspace") + 8), ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]);
  });
  it("tone-map a PQ video the same way, from its own transfer", () => {
    const vf = after(argsFor(printedOf({ picture: PQ })), "-vf");
    assert.match(vf, /,zscale=pin=bt2020:tin=smpte2084:min=bt2020nc:rin=tv:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv:dither=error_diffusion,format=yuv420p$/);
  });
  it("tone-map an upright HDR clip at the size it is shown, and use the curve it is told to", () => {
    const vf = after(argsFor(printedOf({ picture: { ...HLG, ...UPRIGHT } }), { toneMap: "mobius" }), "-vf");
    assert.match(vf, /,scale=1080:1920,zscale=pin=bt2020:tin=arib-std-b67:/);
    assert.match(vf, /,tonemap=tonemap=mobius:desat=0,/);
  });
  it("refuse a curve the tonemap filter does not have, rather than ask ffmpeg for it", () => {
    assert.throws(() => argsFor(printedOf({ picture: HLG }), { toneMap: "filmic" }), /filmic/);
    assert.throws(() => argsFor(printedOf({ picture: HLG }), { toneMap: "none" }), /none/);
  });
  it("do not touch the colour of a video in standard colour, and wide colour with an ordinary transfer is not HDR", () => {
    for (const picture of [{}, { color_primaries: "bt2020", color_transfer: "bt2020-10" }, { color_primaries: undefined, color_transfer: undefined }]) {
      const vf = after(argsFor(printedOf({ picture })), "-vf");
      assert.ok(!/zscale|tonemap|gbrpf32le/.test(vf), vf);
      assert.match(vf, /,format=yuv420p$/);
    }
  });
  it("have no filter whose arguments hold a comma, which ffmpeg would take for the start of the next filter", () => {
    // Every piece of the chain, cut at its commas, begins with a filter's name: none is the end of an expression such as min(a,b).
    for (const picture of [{}, HLG, PQ, UPRIGHT]) {
      for (const fourK of [false, true]) {
        const pieces = after(argsFor(printedOf({ picture }), { fourK }), "-vf").split(",");
        for (const piece of pieces) assert.match(piece, /^(fps|scale|format|zscale|tonemap)=/, piece);
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
  it("refuses an HDR video on a Mac whose ffmpeg lacks the filters that tone-map it, and says so in words", () => {
    const hdr = { ...good(), ...factsFrom(printedOf({ picture: HLG })) };
    const said = "it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason";
    assert.equal(workCopyFault({ ...hdr, filters: filtersOf("tonemap", "tonemap_opencl") }), said);
    assert.equal(workCopyFault({ ...hdr, filters: filtersOf("zscale", "tonemap_vaapi") }), said);
    assert.equal(workCopyFault({ ...hdr, filters: "" }), said);
    assert.equal(workCopyFault({ ...hdr, filters: WITH_BOTH }), null);
  });
  it("does not let that touch a video in standard colour", () => {
    assert.equal(workCopyFault({ ...good(), filters: "" }), null);
    assert.equal(workCopyFault({ ...good(), filters: filtersOf() }), null);
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
    const bad = { ...factsFrom(printedOf({ picture: HLG, sounds: [{ codec_name: "apple_apac" }] })), filters: "", freeBytes: 1, rawBytes: 1e9 };
    assert.equal(workCopyFault(bad), "its sound is in a form this Mac can't read");
    assert.equal(workCopyFault({ ...bad, ...factsFrom(printedOf({ picture: HLG })) }), "it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason");
    assert.match(workCopyFault({ ...bad, ...factsFrom(printedOf({ picture: HLG })), filters: WITH_BOTH }), /^there is not enough room/);
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
    assert.equal(hasFilters(WITH_BOTH, ["zscale", "tonemap"]), true);
    assert.equal(hasFilters(filtersOf("tonemap_opencl", "tonemap_vaapi", "zscale"), ["zscale", "tonemap"]), false);
    assert.equal(hasFilters(filtersOf("tonemap"), ["zscale", "tonemap"]), false);
    assert.equal(hasFilters(filtersOf("zscale"), ["zscale"]), true);
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
    prints for -filters, `free` the room on the disk, `bytes` the raw video's size, `fourK` the 4K switch, `deps` more for the
    job to be given, and `defaultProbe` has the job read the video through `run` as it does when it is given no probe. The home
    folder is not made here: the job makes what it needs in it. */
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
  // for, and ffmpeg when it is asked which filters it has, which it prints.
  const run = async (cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "FFPROBE") {
      probed.push(args[args.length - 1]);
      writeFileSync(args[args.indexOf("-o") + 1], args[args.length - 1] === video ? script.source ?? SOURCE : script.copy ?? copyOf());
      return { code: 0, stderr: "" };
    }
    return { code: 0, stderr: "", stdout: script.filters ?? WITH_BOTH };
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
  it("reads which filters this Mac's ffmpeg has, once, for an HDR video, and tone-maps it", async (c) => {
    const t = setup({ source: printedOf({ picture: HLG }) });
    c.after(t.done);
    const result = await t.job();
    assert.equal(result.ok, true);
    const listings = t.calls.filter((x) => x.cmd === "FFMPEG");
    assert.equal(listings.length, 1);
    assert.ok(listings[0].args.includes("-filters"));
    assert.match(after(t.guarded[0].args, "-vf"), /,tonemap=tonemap=hable:desat=0,/);
  });
  it("does not ask which filters it has for a video in standard colour", async (c) => {
    const t = setup();
    c.after(t.done);
    await t.job();
    assert.deepEqual(t.calls.filter((x) => x.cmd === "FFMPEG"), []);
  });
  it("makes a video in standard colour on a Mac whose ffmpeg has no tone-mapping filter, and refuses an HDR one in words", async (c) => {
    const sdr = setup({ filters: filtersOf() });
    c.after(sdr.done);
    assert.equal((await sdr.job()).ok, true);
    const hdr = setup({ source: printedOf({ picture: HLG }), filters: filtersOf("tonemap_opencl") });
    c.after(hdr.done);
    const result = await hdr.job();
    assert.deepEqual([result.ok, result.failed], [false, ["It can't be used: it is an HDR video, and this Mac can't turn HDR into standard colours: ask Jason."]]);
    assert.deepEqual(hdr.guarded, []);
    assert.deepEqual(hdr.inWork(), []);
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
});
