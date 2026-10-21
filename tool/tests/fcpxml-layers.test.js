// Titles and pictures on a timeline (phase 4): Final Cut's built-in titles, each naming its font and size, and stills laid
// over the picture, each written on the kept pieces it shows over.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fcpxml, checkFcpxml, TITLE_UID, LOWER_THIRD_UID } from "../fcpxml.js";

const AT_30 = { duration: 20, frameRate: "30/1", width: 1920, height: 1080, hasAudio: true, audioRate: 48000, audioChannels: 2 };
/** Each tag of a name in the text, as its attributes. */
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
const RANGES = [{ start: 0, end: 4 }, { start: 8, end: 12 }];
const LINE = { text: "Sallie Ogden", font: "Varela", fontSize: 69, alignment: "center" };
const base = { video: "/v/Pricing talk.mp4", facts: AT_30, ranges: RANGES, project: "p", event: "e" };

describe("an upright timeline's pieces", () => {
  it("may each carry a move of its own in place of a crop, as a Reel's pick wrote it", () => {
    const xml = fcpxml({ ...base, frame: { width: 1080, height: 1920 }, ranges: [{ ...RANGES[0], position: "44.4444 0" }, { ...RANGES[1], position: "-12.5 0" }] });
    assert.deepEqual(tags(xml, "adjust-transform"), [{ position: "44.4444 0" }, { position: "-12.5 0" }]);
    assert.deepEqual(checkFcpxml(xml, AT_30, { frame: { width: 1080, height: 1920 } }), []);
  });
});

describe("titles on a timeline", () => {
  it("writes a title on each kept piece it shows over, split at the join, with its template, font, size and place", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 2, end: 10, lane: 3, name: "brimm text t1 3fa9c1", role: "BRIMM titles", lines: [LINE], position: "0 -14" }] });
    assert.deepEqual(tags(xml, "effect"), [{ id: "r4", name: "Basic Title", uid: TITLE_UID }]);
    assert.deepEqual(tags(xml, "title"), [
      { ref: "r4", lane: "3", offset: "2s", name: "brimm text t1 3fa9c1", duration: "2s", role: "BRIMM titles" },
      { ref: "r4", lane: "3", offset: "8s", name: "brimm text t1 3fa9c1", duration: "2s", role: "BRIMM titles" }
    ]);
    assert.deepEqual(tags(xml, "text-style").filter((t) => t.font), [
      { font: "Varela", fontSize: "69", fontFace: "Regular", fontColor: "1 1 1 1", alignment: "center" },
      { font: "Varela", fontSize: "69", fontFace: "Regular", fontColor: "1 1 1 1", alignment: "center" }
    ]);
    assert.deepEqual(tags(xml, "adjust-transform"), [{ position: "0 -14" }, { position: "0 -14" }]);
    assert.deepEqual(checkFcpxml(xml, AT_30), []);
  });
  it("writes two lines of a Basic Title as one text, the first ending in a line break, each line with its own style", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 1, end: 3, lane: 3, name: "n", role: "BRIMM titles", lines: [LINE, { ...LINE, text: "Founder, The BRIMM", fontSize: 52 }] }] });
    assert.match(xml, /<text>\n\s*<text-style ref="ts1">Sallie Ogden\n<\/text-style>\n\s*<text-style ref="ts2">Founder, The BRIMM<\/text-style>\n\s*<\/text>/);
    assert.deepEqual(tags(xml, "text-style").filter((t) => t.font).map((t) => t.fontSize), ["69", "52"]);
  });
  it("writes each line of a Basic Lower Third in a text of its own, as Final Cut writes one, and its template once", () => {
    const lower = { start: 1, end: 3, lane: 3, name: "n", role: "BRIMM titles", template: "lower-third", lines: [LINE, { ...LINE, text: "Founder" }] };
    const xml = fcpxml({ ...base, titles: [lower, { ...lower, start: 9, end: 11 }] });
    assert.deepEqual(tags(xml, "effect"), [{ id: "r4", name: "Basic Lower Third", uid: LOWER_THIRD_UID }]);
    assert.equal(xml.match(/<text>/g).length, 4);
    assert.doesNotMatch(xml, /Sallie Ogden\n/);
    // A line that names no alignment writes none: the Basic Lower Third keeps its own place at the left (phase 0, B1). A name
    // with no role gets an empty second text, or the template would show its own words there.
    const own = fcpxml({ ...base, titles: [{ ...lower, lines: [{ text: "Sallie Ogden", font: "Varela", fontSize: 34 }] }] });
    assert.deepEqual(tags(own, "text-style").filter((t) => t.font), [0, 1].map(() => ({ font: "Varela", fontSize: "34", fontFace: "Regular", fontColor: "1 1 1 1" })));
    assert.match(own, /<text-style ref="ts1">Sallie Ogden<\/text-style>[\s\S]*<text-style ref="ts2"><\/text-style>/);
    assert.deepEqual(checkFcpxml(own, AT_30), []);
  });
  it("gives a soft shadow and letter spacing when a line asks for them", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 1, end: 3, lane: 2, name: "n", role: "BRIMM captions", lines: [{ ...LINE, shadow: { color: "0 0 0 0.65", blur: 10 }, kerning: 4 }] }] });
    assert.deepEqual(tags(xml, "text-style").find((t) => t.font), { font: "Varela", fontSize: "69", fontFace: "Regular", fontColor: "1 1 1 1", shadowColor: "0 0 0 0.65", shadowOffset: "0 0", shadowBlurRadius: "10", kerning: "4", alignment: "center" });
  });
  it("refuses a title line with no font or no size, which Final Cut would draw as Helvetica 6", () => {
    for (const line of [{ ...LINE, font: "" }, { ...LINE, fontSize: 0 }, { text: "x" }]) assert.throws(() => fcpxml({ ...base, titles: [{ start: 1, end: 3, lane: 3, name: "n", role: "r", lines: [line] }] }), { message: "Title 1 must name a font and a size for every line." });
  });
  it("leaves out a title wholly in what was cut out, and writes nothing new when given no titles or pictures", () => {
    const plain = fcpxml(base);
    assert.equal(fcpxml({ ...base, titles: [{ start: 5, end: 7, lane: 3, name: "n", role: "r", lines: [LINE] }] }), plain);
    assert.equal(fcpxml({ ...base, titles: [], stills: [] }), plain);
  });
});

describe("pictures on a timeline", () => {
  const still = { start: 1, end: 3, lane: 4, name: "brimm graphic g1 3fa9c1", role: "BRIMM titles", src: "../media/chart.png", width: 1600, height: 900 };
  it("writes each picture once, as a still's format and asset, and shows it as a connected video with its move and size", () => {
    const xml = fcpxml({ ...base, stills: [{ ...still, position: "40 -20", scale: 0.5 }, { ...still, start: 9, end: 10 }] });
    assert.deepEqual(tags(xml, "format").slice(1), [{ id: "r4", name: "FFVideoFormatRateUndefined", width: "1600", height: "900" }]);
    assert.deepEqual(tags(xml, "asset")[1], { id: "r5", name: "chart", start: "0s", duration: "0s", hasVideo: "1", format: "r4", videoSources: "1" });
    assert.deepEqual(tags(xml, "media-rep")[1], { kind: "original-media", src: "../media/chart.png" });
    assert.deepEqual(tags(xml, "video"), [
      { ref: "r5", lane: "4", offset: "1s", name: "brimm graphic g1 3fa9c1", duration: "2s", role: "BRIMM titles" },
      { ref: "r5", lane: "4", offset: "9s", name: "brimm graphic g1 3fa9c1", duration: "1s", role: "BRIMM titles" }
    ]);
    assert.deepEqual(tags(xml, "adjust-transform"), [{ position: "40 -20", scale: "0.5 0.5" }]);
    assert.deepEqual(checkFcpxml(xml, AT_30), []);
  });
  it("fills the frame with a picture shown full", () => {
    const xml = fcpxml({ ...base, stills: [{ ...still, fill: true }] });
    assert.deepEqual(tags(xml, "adjust-conform"), [{ type: "fill" }]);
  });
  it("gives the templates their ids before the pictures", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 1, end: 2, lane: 3, name: "n", role: "r", lines: [LINE] }], stills: [still] });
    assert.deepEqual(tags(xml, "effect").map((e) => e.id), ["r4"]);
    assert.deepEqual(tags(xml, "asset").map((a) => a.id), ["r2", "r6"]);
  });
});

describe("a look", () => {
  const LOOK = { name: "Clean Whites with Lifted Blacks", uid: "FFColorGradingPreset.Clean Whites", params: [{ name: "Mix", key: "9999/1", value: "0.25" }] };
  it("is a built-in colour preset on every clip, after its notes, with its Mix, and its effect once", () => {
    const xml = fcpxml({ ...base, markers: [{ at: 1, text: "a note" }], look: LOOK });
    assert.deepEqual(tags(xml, "effect"), [{ id: "r4", name: LOOK.name, uid: LOOK.uid }]);
    assert.deepEqual(tags(xml, "filter-video"), [{ ref: "r4", name: LOOK.name }, { ref: "r4", name: LOOK.name }]);
    assert.deepEqual(tags(xml, "param"), [{ name: "Mix", key: "9999/1", value: "0.25" }, { name: "Mix", key: "9999/1", value: "0.25" }]);
    assert.match(xml, /<marker [^>]*\/>\n\s*<filter-video/);
    assert.deepEqual(checkFcpxml(xml, AT_30), []);
  });
  it("has its plug-in's data before its params, as Final Cut writes them", () => {
    const xml = fcpxml({ ...base, look: { ...LOOK, data: [{ key: "effectConfig", value: "YnBsaXN0MDA=" }] } });
    assert.match(xml, /<filter-video ref="r4" name="Clean Whites with Lifted Blacks">\n\s*<data key="effectConfig">YnBsaXN0MDA=<\/data>\n\s*<param name="Mix"/);
    assert.deepEqual(checkFcpxml(xml, AT_30), []);
  });
});

describe("the check of a file with titles and pictures", () => {
  it("finds a title that runs off the end of its clip", () => {
    const xml = fcpxml({ ...base, titles: [{ start: 1, end: 3, lane: 3, name: "n", role: "r", lines: [LINE] }] }).replace('offset="1s" name="n" duration="2s"', 'offset="1s" name="n" duration="5s"');
    assert.deepEqual(checkFcpxml(xml, AT_30), ["A title on clip 1 lies outside the clip."]);
  });
});

describe("Final Cut's definition of the format", { skip: !existsSync("/Applications/Final Cut Pro.app") || spawnSync("xmllint", ["--version"]).error ? "Final Cut Pro or xmllint is not on this machine" : false }, () => {
  const DTD = "file:///Applications/Final%20Cut%20Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_10.dtd";
  it("holds a wide and an upright project with titles of both kinds and pictures", () => {
    const dir = mkdtempSync(join(tmpdir(), "layers-"));
    try {
      const layered = { look: { name: "Clean Whites with Lifted Blacks", uid: "FFColorGradingPreset.Clean Whites", data: [{ key: "effectConfig", value: "YnBsaXN0MDA=" }], params: [{ name: "Mix", key: "9999/1", value: "0.25" }] }, titles: [{ start: 1, end: 10, lane: 3, name: "t", role: "BRIMM titles", lines: [LINE, { ...LINE, text: "two" }], position: "0 -14" }, { start: 2, end: 3, lane: 3, name: "l", role: "BRIMM titles", template: "lower-third", lines: [LINE] }], stills: [{ start: 1, end: 3, lane: 4, name: "s", role: "BRIMM titles", src: "../media/chart.png", width: 1600, height: 900, fill: true, position: "10 0", scale: 0.5 }] };
      const wide = fcpxml({ ...base, ...layered });
      const upright = fcpxml({ ...base, ...layered, frame: { width: 1080, height: 1920 }, ranges: RANGES.map((r) => ({ ...r, crop: { x: 657, y: 0, w: 606, h: 1080 } })) });
      for (const [name, text] of [["wide.fcpxml", wide], ["upright.fcpxml", upright]]) {
        writeFileSync(join(dir, name), text);
        const checked = spawnSync("xmllint", ["--noout", "--dtdvalid", DTD, join(dir, name)], { encoding: "utf8" });
        assert.equal(checked.status, 0, checked.stderr);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
