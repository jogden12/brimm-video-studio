// The looks of words and pictures until The BRIMM's templates exist: the preset's lists, the stand-in face, the captions'
// and titles' looks, and where a picture goes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JOBS, CAPTION_STYLES, LOOKS, defaultPreset, presetFault, faceOnThisMac, captionLook, titleLook, placeOf, lookFor, LOOK_MIX } from "../styles.js";

const UPRIGHT = { width: 1080, height: 1920 };
const WIDE = { width: 1920, height: 1080 };

describe("the preset's lists", () => {
  it("are the research's five jobs, five caption styles and four looks", () => {
    assert.deepEqual(Object.keys(JOBS), ["full-episode", "solo-clip", "interview-clip", "teaching-clip", "as-filmed"]);
    assert.deepEqual(Object.keys(CAPTION_STYLES), ["file-only", "plain", "boxed", "bold", "signature"]);
    assert.deepEqual(Object.keys(LOOKS), ["natural", "bright", "warm", "moody"]);
  });
  it("give an episode's main video the full episode, a short video as filmed, and a Reel a solo clip", () => {
    assert.deepEqual(defaultPreset("episode", "main"), { job: "full-episode", captions: "file-only", look: "natural" });
    assert.deepEqual(defaultPreset("short video", "main"), { job: "as-filmed", captions: "plain", look: "natural" });
    assert.deepEqual(defaultPreset("episode", { reel: 2 }), { job: "solo-clip", captions: "plain", look: "natural" });
  });
  it("say which word is not on its list, and what is", () => {
    assert.equal(presetFault({ job: "solo-clip", captions: "plain", look: "natural" }), "");
    assert.equal(presetFault({ job: "solo-clip", captions: "fancy", look: "natural" }), '"fancy" is not a caption style. The caption styles are: file only, plain, boxed, bold, signature.');
  });
});

describe("the stand-in face", () => {
  it("is Varela when its file is in a font folder, and Lucida Grande otherwise, said", () => {
    assert.deepEqual(faceOnThisMac(["Avenir.ttc", "Varela-Regular.ttf"]), { face: "Varela", told: "" });
    assert.deepEqual(faceOnThisMac(["VarelaRound-Regular.ttf", "LucidaGrande.ttc"]), { face: "Lucida Grande", told: "Varela is not installed on this Mac, so the words are in Lucida Grande. Jason installs Varela with Font Book." });
  });
});

describe("a size, as Final Cut draws it (by-hand check 1)", () => {
  it("is of a 1080-line frame, whatever the frame's height: the same at 720 lines as at 1080, and upright 1080/1920 of the frame's own", () => {
    // Font size 69 drew capitals 87 px tall in a 1920-line upright frame, where 48 were asked for; 34 drew them 16 px at 720.
    const plain = (frame) => captionLook({ style: "plain", job: "as-filmed", frame, face: "Varela" }).fontSize;
    assert.deepEqual([plain({ width: 1280, height: 720 }), plain(WIDE), plain(UPRIGHT)], [51, 51, 39]);
    assert.deepEqual(titleLook("name", { style: "plain", frame: { width: 1280, height: 720 }, face: "Varela" }).lines.map((l) => l.fontSize), [51, 39]);
    // Its lowest edge stays where it was asked for: Final Cut's move is of the frame's height, and its size of 1080 lines.
    assert.equal(captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face: "Varela" }).position, "0 -12.83");
  });
});

describe("the running captions' look", () => {
  it("is Plain upright: capitals 2.5% of the height, one line of 19 characters in Varela, 4 words at most, 65% down", () => {
    assert.deepEqual(captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face: "Varela" }), { draws: true, caps: false, lines: 1, most: 4, chars: 19, fontSize: 39, shadow: { color: "0 0 0 0.65", blur: 10 }, alignment: "center", position: "0 -12.83", told: "" });
  });
  it("is Bold in capitals on two lines upright", () => {
    const bold = captionLook({ style: "bold", job: "solo-clip", frame: UPRIGHT, face: "Lucida Grande" });
    assert.deepEqual([bold.caps, bold.lines, bold.chars, bold.fontSize], [true, 2, 9, 53]);
  });
  it("draws none on a wide full episode, and says so when a drawn style was picked (rule 9)", () => {
    assert.deepEqual(captionLook({ style: "file-only", job: "full-episode", frame: WIDE, face: "Varela" }), { draws: false, told: "" });
    assert.deepEqual(captionLook({ style: "bold", job: "full-episode", frame: WIDE, face: "Varela" }), { draws: false, told: "Bold was picked, but a full episode goes to YouTube with its caption file, so no captions are drawn into the picture." });
  });
  it("draws Plain for file only where no caption file is taken (rule 2), for Boxed until its box, and for Signature without its fade", () => {
    assert.equal(captionLook({ style: "file-only", job: "solo-clip", frame: UPRIGHT, face: "Varela" }).told, "File only was picked, but this goes where no caption file is taken, so Plain captions are drawn.");
    const boxed = captionLook({ style: "boxed", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
    assert.deepEqual([boxed.caps, boxed.chars, boxed.told], [false, 19, "Boxed's box is not drawn yet, so Plain captions are drawn."]);
    const signature = captionLook({ style: "signature", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
    assert.deepEqual([signature.caps, signature.chars, signature.told], [false, 19, "Signature's captions fade in line by line, which is not drawn yet, so they are drawn Plain, without the fade."]);
  });
  it("draws a title Plain under Boxed and Signature, and says what is not drawn", () => {
    assert.equal(titleLook("hook", { style: "signature", frame: UPRIGHT, face: "Varela" }).told, "Signature's navy block behind a title is not drawn yet, so titles are drawn Plain.");
    assert.equal(titleLook("name", { style: "boxed", frame: WIDE, face: "Varela" }).told, "Boxed's box behind a title is not drawn yet, so titles are drawn Plain.");
    assert.equal(titleLook("name", { style: "bold", frame: WIDE, face: "Varela" }).told, "");
  });
  it("is wide Plain for a wide short video: 8 words, the research's stored 42 characters whatever the face, 90% down", () => {
    const wide = captionLook({ style: "plain", job: "as-filmed", frame: WIDE, face: "Varela" });
    assert.deepEqual([wide.most, wide.chars, wide.fontSize, wide.position], [8, 42, 51, "0 -37.17"]);
    assert.equal(captionLook({ style: "plain", job: "as-filmed", frame: WIDE, face: "Lucida Grande" }).chars, 42);
  });
});

describe("a title's look", () => {
  it("puts a Reel's hook in the top band, two lines of 13 characters in Varela", () => {
    assert.deepEqual(titleLook("hook", { style: "plain", frame: UPRIGHT, face: "Varela" }), { template: "title", caps: false, lines: [{ fontSize: 54, shadow: { color: "0 0 0 0.65", blur: 10 }, alignment: "center" }, { fontSize: 54, shadow: { color: "0 0 0 0.65", blur: 10 }, alignment: "center" }], chars: 13, position: "0 27.5", told: "" });
  });
  it("puts a name over a role in the top band upright, and on the Basic Lower Third wide", () => {
    const up = titleLook("name", { style: "plain", frame: UPRIGHT, face: "Varela" });
    assert.deepEqual([up.template, up.lines.map((l) => l.fontSize), up.position], ["title", [39, 29], "0 27.5"]);
    const wide = titleLook("name", { style: "bold", frame: WIDE, face: "Varela" });
    assert.deepEqual([wide.template, wide.caps, wide.lines.map((l) => l.fontSize), wide.position], ["lower-third", true, [51, 39], "0 0"]);
    // The lower third's lines keep its own place at the left: none is centred.
    assert.deepEqual(wide.lines.map((l) => l.alignment), [undefined, undefined]);
    assert.deepEqual(up.lines.map((l) => l.alignment), ["center", "center"]);
  });
});

describe("where a picture goes", () => {
  const chart = { width: 1600, height: 900 };
  it("fills the frame when full", () => {
    assert.deepEqual(placeOf("full", { frame: UPRIGHT, picture: chart }), { position: "0 0", scale: 1, fill: true });
  });
  it("is half the fitted size in the top right corner", () => {
    assert.deepEqual(placeOf("corner", { frame: WIDE, picture: chart }), { position: "39.11 20", scale: 0.5, fill: false });
  });
  it("is the logo at 15% of an upright frame's width, top right, 15% down and 6% in", () => {
    assert.deepEqual(placeOf("logo", { frame: UPRIGHT, picture: { width: 600, height: 300 } }), { position: "20.53 32.89", scale: 0.15, fill: false });
  });
  it("is fitted into the lower third, its lowest edge 85% down when wide", () => {
    assert.deepEqual(placeOf("lower", { frame: WIDE, picture: chart }), { position: "0 -25", scale: 0.2, fill: false });
  });
});

describe("a look", () => {
  it("is nothing for natural", () => {
    assert.deepEqual(lookFor({ look: "natural", height: 1080 }), { effect: null, told: "" });
  });
  it("is Final Cut's Color Adjustments with its preset's settings, then its Mix, as Jason's exports of the three showed (by-hand check 2)", () => {
    const bright = lookFor({ look: "bright", height: 1080 }).effect;
    assert.deepEqual([bright.name, bright.uid], ["Color Adjustments", "FxPlug:7E2022A5-202B-4EEB-A311-AC2B585D01B0"]);
    // The plug-in's version, as Final Cut wrote it in every one: an archived dictionary, pluginVersion 3.
    assert.deepEqual(bright.data, [{ key: "effectConfig", value: "YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGlCwwVFhdVJG51bGzTDQ4PEBIUV05TLmtleXNaTlMub2JqZWN0c1YkY2xhc3OhEYACoROAA4AEXXBsdWdpblZlcnNpb24QA9IYGRobWiRjbGFzc25hbWVYJGNsYXNzZXNfEBNOU011dGFibGVEaWN0aW9uYXJ5oxocHVxOU0RpY3Rpb25hcnlYTlNPYmplY3QIERokKTI3SUxRU1lfZm55gIKEhoiKmJqfqrPJzdoAAAAAAAABAQAAAAAAAAAeAAAAAAAAAAAAAAAAAAAA4w==" }]);
    // Its params in Final Cut's order, each with its key. The two long ones Final Cut writes too are left out: each holds its default.
    assert.deepEqual(bright.params.map((p) => `${p.name} ${p.key}`), ["Control Range 19", "trigger Enhance 18", "Exposure 3", "Contrast 17", "Brightness 2", "Highlights 7", "Black Point 1", "Shadows 4", "Super Highlights 25", "Saturation 16", "Highlights Warmth 10", "Highlights Tint 11", "Midtones Warmth 12", "Midtones Tint 13", "Shadows Warmth 14", "Shadows Tint 15", "Mix 99990"]);
    const values = (look) => lookFor({ look, height: 1080 }).effect.params.map((p) => p.value);
    assert.deepEqual(values("bright"), ["0 (SDR)", "6", "-95", "49", "-36", "0", "82", "-28", "0", "53", "-35", "-32", "47", "27", "-54", "-39", "0.25"]);
    assert.deepEqual(values("warm"), ["0 (SDR)", "6", "-76", "-54", "0", "18", "0", "-73", "0", "29", "63", "36", "-16", "-8", "-39", "-27", "0.25"]);
    assert.deepEqual(values("moody"), ["0 (SDR)", "6", "-37", "33", "-43", "-100", "-29", "-21", "0", "-27", "49", "5", "100", "26", "-6", "-7", "0.5"]);
  });
  it("is weaker on a small recording (rule 6), none on HDR (rule 7), and recorded only until its preset is known", () => {
    assert.deepEqual(lookFor({ look: "moody", height: 720 }).effect.params.at(-1), { name: "Mix", key: "99990", value: "0.375" });
    assert.deepEqual(lookFor({ look: "moody", height: 360 }).told, "Moody was applied at 50% strength: the recording has 360 lines.");
    assert.deepEqual(lookFor({ look: "moody", height: 2160, hdr: true }), { effect: null, told: "This recording is HDR: Final Cut converts its colours for the timeline, and how well is not yet checked. Moody was not applied: its colours are made for ordinary video." });
    assert.deepEqual(lookFor({ look: "natural", height: 2160, hdr: true }), { effect: null, told: "This recording is HDR: Final Cut converts its colours for the timeline, and how well is not yet checked." });
    assert.deepEqual(lookFor({ look: "bright", height: 1080 }, {}), { effect: null, told: "Bright is recorded. Final Cut's colour preset for it is applied once Jason has checked how Final Cut takes one." });
    assert.deepEqual(LOOK_MIX.bright, ["Clean Whites with Lifted Blacks", 0.25]);
  });
});
