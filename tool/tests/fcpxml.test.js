// The writer of Final Cut Pro project files: the shape of the file, its times as whole frames, where a caption or a note lands once
// pieces of the video are cut out, and our own checks of a file. No video is needed and Final Cut Pro is not run. One test asks
// Final Cut Pro's own definition of the format whether a file is right, on a Mac that has it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fcpxml, checkFcpxml } from "../fcpxml.js";

const VIDEO = "/Users/sallie/Movies/Episode 12.mp4";
/** What ffprobe says of a video: one of 60 seconds at 30 frames a second, and one of 3,600 frames at 29.97. */
const AT_30 = { duration: 60, frameRate: "30/1", width: 1920, height: 1080, hasAudio: true, audioRate: 48000, audioChannels: 2 };
const AT_2997 = { ...AT_30, duration: 120.12, frameRate: "30000/1001" };
/** Two pieces kept, with five seconds cut out between them. */
const TWO = [{ start: 0, end: 5, name: "One" }, { start: 10, end: 20, name: "Two" }];
const make = (over = {}) => fcpxml({ video: VIDEO, facts: AT_30, ranges: TWO, ...over });
/** A library in the home folder itself, which no cloud drive syncs. */
const LIBRARY = "/Users/sallie/BRIMM Video Work/BRIMM rough cuts.fcpbundle";

/** A cut with a bit of everything in it: pieces taken from the opening, the middle and the end of a video at 29.97 frames a second,
    captions that lie in a cut and over a join, notes on what was cut, and awkward characters wherever words go. */
const RICH = {
  video: "/Users/sallie/Movies/The Sallie Ogden Show/Épisode #12 – 100% \"final\" & <done>?.mp4",
  facts: AT_2997,
  ranges: [
    { start: 4.2, end: 31.7, name: "Hello & welcome" },
    { start: 40.04, end: 58.9, name: "\"Why now?\" <the first point>" },
    { start: 59.3, end: 59.305, name: "Too short to keep" },
    { start: 75, end: 500, name: "The close" }
  ],
  captions: [
    { start: 1, end: 3, text: "Cut out with the opening." },
    { start: 4.2, end: 6.9, text: " You want to make more money,\nbut you can't keep taking on more work." },
    { start: 30, end: 33.5, text: "Tom & Jerry <said> \"hello\"…" },
    { start: 39, end: 42, text: "It began before the cut ended." },
    { start: 76, end: 79, text: "So how do you grow from here? \u{1F600}\u0007" }
  ],
  markers: [
    { at: 0, text: "Cut 0:00 to 0:04: setting up the camera" },
    { at: 31.7, text: "Cut 0:31 to 0:40: a false start & a cough" },
    { at: 35, text: "Cut: \"um\" <twice>" },
    { at: 60, text: "Cut 0:58 to 1:15: the phone rang" },
    { at: 80, text: "Check the sound here\u0000" }
  ],
  project: "Episode 12 – rough cut & notes",
  event: "The Sallie Ogden Show"
};

/** The attributes of every tag of one name in a file, in the order they come. */
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))]
  .map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
/** Where each clip sits and what it shows, as "offset start duration". */
const cuts = (xml) => tags(xml, "asset-clip").map((c) => `${c.offset} ${c.start} ${c.duration}`);
/** Each clip as its own piece of the file, with the space before each line taken off. */
const clips = (xml) => xml.match(/<asset-clip[^>]*\/>|<asset-clip[\s\S]*?<\/asset-clip>/g).map((clip) => clip.replace(/\n +/g, "\n"));
/** Where each caption sits and how long it shows, as "offset duration". */
const shown = (xml) => tags(xml, "caption").map((c) => `${c.offset} ${c.duration}`);

describe("the file's shape", () => {
  it("is a project of one video, with the pieces kept set one after another on its timeline", () => {
    const xml = make({
      ranges: [{ start: 2, end: 10.5, name: "Hello" }, { start: 20, end: 31, name: "The first point" }],
      project: "Episode 12 cut", event: "The Sallie Ogden Show"
    });
    assert.equal(xml, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>

<fcpxml version="1.10">
    <resources>
        <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1920" height="1080"/>
        <asset id="r2" name="Episode 12" start="0s" duration="60s" hasVideo="1" format="r1" videoSources="1" hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000">
            <media-rep kind="original-media" src="file:///Users/sallie/Movies/Episode%2012.mp4"/>
        </asset>
    </resources>
    <event name="The Sallie Ogden Show">
        <project name="Episode 12 cut">
            <sequence format="r1" duration="585/30s" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
                <spine>
                    <asset-clip ref="r2" offset="0s" name="Hello" start="2s" duration="255/30s"/>
                    <asset-clip ref="r2" offset="255/30s" name="The first point" start="20s" duration="11s"/>
                </spine>
            </sequence>
        </project>
    </event>
</fcpxml>
`);
  });
  it("gives the format a name only when it is one of Final Cut's own", () => {
    const format = (facts) => tags(make({ facts: { ...AT_30, ...facts } }), "format")[0];
    assert.equal(format({ frameRate: "30000/1001" }).name, "FFVideoFormat1080p2997");
    assert.equal(format({ frameRate: "25/1" }).name, "FFVideoFormat1080p25");
    assert.equal(format({ width: 1280, height: 720, frameRate: "60000/1001" }).name, "FFVideoFormat720p5994");
    assert.equal(format({ width: 3840, height: 2160, frameRate: "24000/1001" }).name, "FFVideoFormat3840x2160p2398");
    assert.deepEqual(format({ width: 1080, height: 1920 }), { id: "r1", frameDuration: "1/30s", width: "1080", height: "1920" });
    assert.deepEqual(format({ frameRate: "15/1" }), { id: "r1", frameDuration: "1/15s", width: "1920", height: "1080" });
  });
  it("says nothing of sound for a video that has none", () => {
    const xml = make({ facts: { ...AT_30, hasAudio: false, audioRate: undefined, audioChannels: undefined } });
    assert.deepEqual(tags(xml, "asset")[0], { id: "r2", name: "Episode 12", start: "0s", duration: "60s", hasVideo: "1", format: "r1", videoSources: "1" });
    assert.deepEqual(tags(xml, "sequence")[0], { format: "r1", duration: "15s", tcStart: "0s", tcFormat: "NDF" });
  });
  it("says of the sound what ffprobe says of it: how many channels, and at what rate", () => {
    const xml = make({ facts: { ...AT_30, audioChannels: 1, audioRate: 44100 } });
    assert.deepEqual(tags(xml, "asset")[0], { id: "r2", name: "Episode 12", start: "0s", duration: "60s", hasVideo: "1", format: "r1", videoSources: "1", hasAudio: "1", audioSources: "1", audioChannels: "1", audioRate: "44100" });
  });
  it("leaves off what it was not told, and does not write it empty", () => {
    const xml = make({ facts: { ...AT_30, audioChannels: undefined, audioRate: null } });
    assert.deepEqual(tags(xml, "asset")[0], { id: "r2", name: "Episode 12", start: "0s", duration: "60s", hasVideo: "1", format: "r1", videoSources: "1", hasAudio: "1", audioSources: "1" });
  });
  it("writes where the video is as a file:// address, with every awkward character as %xx", () => {
    const src = (video) => tags(make({ video }), "media-rep")[0].src;
    assert.equal(src("/Volumes/Work Drive/The Sallie Ogden Show/Épisode #12 100%?.mp4"), "file:///Volumes/Work%20Drive/The%20Sallie%20Ogden%20Show/%C3%89pisode%20%2312%20100%25%3F.mp4");
    assert.equal(src("/in/Q&A \"final\" <2>.mov"), "file:///in/Q%26A%20%22final%22%20%3C2%3E.mov");
    assert.equal(src("/in/録画.mp4"), "file:///in/%E9%8C%B2%E7%94%BB.mp4");
  });
  it("has names for the project and its event when it is given none, and gives a piece with no name the video's", () => {
    const xml = make({ ranges: [{ start: 0, end: 5 }] });
    assert.equal(tags(xml, "project")[0].name, "Episode 12 rough cut");
    assert.equal(tags(xml, "event")[0].name, "Rough cuts");
    assert.equal(tags(xml, "asset-clip")[0].name, "Episode 12");
    // A name that is given but empty is no name either.
    for (const none of ["", null]) {
      const unnamed = make({ project: none, event: none });
      assert.equal(tags(unnamed, "project")[0].name, "Episode 12 rough cut", String(none));
      assert.equal(tags(unnamed, "event")[0].name, "Rough cuts", String(none));
    }
  });
});

describe("the library the project goes into", () => {
  it("is named straight after the file's first tag and before anything else, when one is given, and nothing else in the file changes", () => {
    const xml = make({ library: LIBRARY });
    assert.deepEqual(xml.split("\n").slice(3, 8), [
      `<fcpxml version="1.10">`,
      `    <import-options>`,
      `        <option key="library location" value="file:///Users/sallie/BRIMM%20Video%20Work/BRIMM%20rough%20cuts.fcpbundle"/>`,
      `    </import-options>`,
      `    <resources>`
    ]);
    assert.equal(xml.split("\n").filter((line, i) => i < 4 || i > 6).join("\n"), make());
  });
  // The one file that was opened in Final Cut Pro 12.4, written by hand, named its library with no slash at the end, and was
  // imported with no question. So that is the form written here: nobody has tried the other.
  it("is written as a file:// address with no slash at its end, as it was in the file that was tried, with every awkward character as %xx", () => {
    const value = (library) => tags(make({ library }), "option")[0].value;
    assert.equal(value("/Volumes/Work Drive/Épisodes #1/Q&A 100%.fcpbundle"), "file:///Volumes/Work%20Drive/%C3%89pisodes%20%231/Q%26A%20100%25.fcpbundle");
    // Given with a slash on it, it is written without.
    assert.equal(value(LIBRARY + "/"), "file:///Users/sallie/BRIMM%20Video%20Work/BRIMM%20rough%20cuts.fcpbundle");
  });
  it("is not named when none is given, and Final Cut then asks where the project is to go", () => {
    for (const none of [undefined, null, ""]) assert.doesNotMatch(make({ library: none }), /import-options|<option/, String(none));
  });
  it("is refused when it is not the whole path of a library, which is a name ending .fcpbundle", () => {
    for (const library of ["BRIMM rough cuts.fcpbundle", "~/BRIMM Video Work/BRIMM rough cuts.fcpbundle", "/Users/sallie/BRIMM Video Work", "/Users/sallie/BRIMM rough cuts.fcpbundle.zip", "/Users/sallie/.fcpbundle"]) {
      assert.throws(() => make({ library }), { message: `The library must be given by its whole path, with a name ending .fcpbundle: ${library}` });
    }
  });
});

describe("time", () => {
  it("is a whole number of frames written as a fraction of a second, and whole seconds are written plainly", () => {
    const xml = make({ facts: AT_2997, ranges: [{ start: 10.01, end: 20.02, name: "Ten seconds in" }, { start: 30.03, end: 60.06, name: "Thirty" }] });
    assert.equal(tags(xml, "format")[0].frameDuration, "1001/30000s");
    assert.deepEqual(cuts(xml), ["0s 300300/30000s 300300/30000s", "300300/30000s 900900/30000s 900900/30000s"]);
    assert.equal(tags(xml, "sequence")[0].duration, "1201200/30000s");
    assert.equal(tags(xml, "asset")[0].duration, "3603600/30000s");
    // 30,000 frames at 29.97 come to 1,001 seconds exactly.
    assert.deepEqual(cuts(make({ facts: { ...AT_2997, duration: 2000 }, ranges: [{ start: 0, end: 1001 }] })), ["0s 0s 1001s"]);
    assert.deepEqual(cuts(make({ ranges: [{ start: 3, end: 6 + 1 / 30 }] })), ["0s 3s 91/30s"]);
  });
  it("puts each end of a piece on the nearest frame", () => {
    // At 30 frames a second 1.02 seconds is 30.6 frames in, and 2.51 seconds is 75.3.
    assert.deepEqual(cuts(make({ ranges: [{ start: 1.02, end: 2.51 }] })), ["0s 31/30s 44/30s"]);
    // At 29.97, 4.2 seconds is 125.87 frames in and 31.7 seconds is 950.05.
    assert.deepEqual(cuts(make({ facts: AT_2997, ranges: [{ start: 4.2, end: 31.7 }] })), ["0s 126126/30000s 824824/30000s"]);
  });
  it("sets the pieces end to end, so that each begins on the frame after the one before it ends", () => {
    const ranges = [0.1, 7.3, 15.9, 33.33, 61.007, 90.5].map((start, i) => ({ start, end: start + 3.7 + i * 0.1 }));
    const xml = make({ facts: AT_2997, ranges });
    /** A time from the file as a count of frames at 29.97 frames a second. */
    const frames = (time) => {
      const [top, bottom = 1] = time.slice(0, -1).split("/").map(Number);
      return (top * 30000) / (bottom * 1001);
    };
    let next = 0;
    for (const clip of tags(xml, "asset-clip")) {
      assert.equal(frames(clip.offset), next, clip.offset);
      assert.ok(Number.isInteger(frames(clip.start)) && Number.isInteger(frames(clip.duration)), `${clip.start} ${clip.duration}`);
      next += frames(clip.duration);
    }
    assert.equal(tags(xml, "asset-clip").length, 6);
    assert.equal(frames(tags(xml, "sequence")[0].duration), next);
    assert.equal(next, 111 + 114 + 116 + 120 + 123 + 126);
  });
  it("leaves out a piece that comes to no frames at all", () => {
    const xml = make({ ranges: [{ start: 0, end: 5, name: "One" }, { start: 7.001, end: 7.004, name: "A blink" }, { start: 9, end: 9, name: "Nothing" }, { start: 12, end: 11, name: "Backwards" }, { start: 10, end: 20, name: "Two" }] });
    assert.deepEqual(tags(xml, "asset-clip").map((c) => c.name), ["One", "Two"]);
    assert.deepEqual(cuts(xml), ["0s 0s 5s", "5s 10s 10s"]);
    assert.equal(tags(xml, "sequence")[0].duration, "15s");
  });
  it("never lets a piece run past the end of the video, or start before it does", () => {
    const xml = make({ ranges: [{ start: -3, end: 2, name: "Early" }, { start: 50, end: 75, name: "The close" }, { start: 70, end: 80, name: "Past the end" }] });
    assert.deepEqual(tags(xml, "asset-clip").map((c) => c.name), ["Early", "The close"]);
    assert.deepEqual(cuts(xml), ["0s 0s 2s", "2s 50s 10s"]);
  });
  it("takes the video to be as long as the whole frames it holds", () => {
    const frames = (duration) => tags(make({ facts: { ...AT_2997, duration }, ranges: [{ start: 0, end: 999 }] }), "asset-clip")[0].duration;
    assert.equal(frames(10.01), "300300/30000s");
    // Part of a frame at the end is not a frame: 10 seconds is 299.7 of them, and 10.02 seconds is 300.3.
    assert.equal(frames(10), "299299/30000s");
    assert.equal(frames(10.02), "300300/30000s");
    // ffprobe gives the length to a millionth of a second, so 301 frames (10.0433666... seconds) come as 10.043366.
    assert.equal(frames(10.043366), "301301/30000s");
    assert.equal(tags(make({ facts: { ...AT_2997, duration: 10 } }), "asset")[0].duration, "299299/30000s");
  });
  it("reads the frame rate as ffprobe gives it, and says so when it cannot", () => {
    assert.equal(make({ facts: { ...AT_30, frameRate: "60000/2002" } }), make({ facts: { ...AT_30, frameRate: "30000/1001" } }));
    assert.equal(make({ facts: { ...AT_30, frameRate: "30" } }), make());
    for (const frameRate of ["0/0", "30/0", "", "fast", undefined]) assert.throws(() => make({ facts: { ...AT_30, frameRate } }), /frame rate/, String(frameRate));
  });
  it("says so when it cannot tell how long the video is, or the video is shorter than one frame", () => {
    for (const duration of [undefined, "N/A", 0, -5, 0.01]) assert.throws(() => make({ facts: { ...AT_30, duration } }), /The video's length cannot be read/, String(duration));
    assert.equal(tags(make({ facts: { ...AT_30, duration: "60.000000" } }), "asset")[0].duration, "60s");
  });
  it("says so when a piece starts before the one before it ends, since the pieces are kept in the order of the video", () => {
    const refused = (ranges, n) => assert.throws(() => make({ ranges }), { message: `The pieces to keep must follow one another in the video: piece ${n} starts before the one before it ends.` });
    // One piece laid over the next, as pieces with a little added to each end would be: 9.8 to 10.2 seconds would play twice.
    refused([{ start: 0, end: 10.2 }, { start: 9.8, end: 20 }], 2);
    // A piece kept twice, and pieces out of the video's order. A caption or a note could not tell which of them it belongs on.
    refused([{ start: 30, end: 33, name: "Hook" }, { start: 0, end: 60, name: "Whole" }], 2);
    refused([{ start: 30, end: 40 }, { start: 0, end: 5 }, { start: 10, end: 20 }], 2);
    refused([TWO[0], TWO[1], { start: 19.9, end: 30 }], 3);
    // A piece that comes to no frames is not one of those kept, so the piece after it is held against the last one that was.
    refused([{ start: 10, end: 20 }, { start: 3, end: 3 }, { start: 15, end: 25 }], 3);
    // Two pieces that meet on one frame only touch: at 30 frames a second 5.01 and 4.99 seconds are both frame 150.
    assert.deepEqual(cuts(make({ ranges: [{ start: 0, end: 5.01 }, { start: 4.99, end: 10 }] })), ["0s 0s 5s", "5s 5s 5s"]);
  });
  it("says so when the time of a piece, a caption or a note cannot be read, and leaves none of them out without a word", () => {
    const HELLO = { start: 12, end: 14, text: "Hello there." };
    for (const time of ["0:31", "soon", undefined, null, "", " ", NaN]) {
      const refused = (over, what) => assert.throws(() => make(over), { message: `The ${what} cannot be read: ${time}` }, `${what}: ${time}`);
      refused({ ranges: [{ start: time, end: 5 }, TWO[1]] }, "start of piece 1");
      refused({ ranges: [TWO[0], { start: 10, end: time }] }, "end of piece 2");
      refused({ captions: [HELLO, { ...HELLO, start: time }] }, "start of caption 2");
      refused({ captions: [{ ...HELLO, end: time }] }, "end of caption 1");
      refused({ markers: [{ at: 2.5, text: "Check the sound here" }, { at: time, text: "No moment" }] }, "moment of note 2");
    }
    // A number written out as text is still a number.
    assert.deepEqual(cuts(make({ ranges: [{ start: "10", end: "20.5" }] })), ["0s 10s 315/30s"]);
  });
});

describe("captions", () => {
  const HELLO = { start: 12, end: 14, text: "Hello there." };
  it("sit in the clip they belong to, above the picture, at the video's own time and not the timeline's", () => {
    const xml = make({ captions: [HELLO] });
    assert.deepEqual(clips(xml), [`<asset-clip ref="r2" offset="0s" name="One" start="0s" duration="5s"/>`, `<asset-clip ref="r2" offset="5s" name="Two" start="10s" duration="10s">
<caption lane="1" offset="12s" name="Hello there." duration="2s" role="iTT?captionFormat=ITT.en">
<text placement="bottom">
<text-style ref="ts1">Hello there.</text-style>
</text>
<text-style-def id="ts1">
<text-style font=".AppleSystemUIFont" fontSize="13" fontFace="Regular" fontColor="1 1 1 1" backgroundColor="0 0 0 1"/>
</text-style-def>
</caption>
</asset-clip>`]);
  });
  it("are left out when they lie wholly in a piece that was cut out", () => {
    const xml = make({ captions: [{ start: 5, end: 7, text: "Cut out." }, { start: 7.5, end: 10, text: "Cut out, up to the frame the next piece starts on." }, HELLO, { start: 20, end: 22, text: "After the last piece." }] });
    assert.deepEqual(tags(xml, "caption").map((c) => c.name), ["Hello there."]);
  });
  it("are shortened to end where their piece ends, and are not written again on the next piece", () => {
    const xml = make({ captions: [{ start: 3, end: 8, text: "It ran on into the cut." }, { start: 18.5, end: 30, text: "And this one past the last piece." }] });
    assert.deepEqual(shown(xml), ["3s 2s", "555/30s 45/30s"]);
    const across = make({ captions: [{ start: 4, end: 12, text: "It ran right across the cut." }] });
    assert.deepEqual(shown(across), ["4s 1s"]);
    assert.match(clips(across)[0], /<caption /);
  });
  it("begin where the next kept piece begins when they start in a piece that was cut out and run on into the next", () => {
    const xml = make({ captions: [{ start: 8, end: 12, text: "It began before the cut ended." }] });
    assert.deepEqual(shown(xml), ["10s 2s"]);
    assert.match(clips(xml)[1], /<caption /);
  });
  it("start and end on a frame", () => {
    // At 29.97, 1.5 seconds is 44.96 frames in and 4.25 seconds is 127.37.
    const xml = make({ facts: AT_2997, ranges: [{ start: 0, end: 60 }], captions: [{ start: 1.5, end: 4.25, text: "On a frame." }] });
    assert.deepEqual(shown(xml), ["45045/30000s 82082/30000s"]);
  });
  it("keep a line break as a line break, and lose the space around each line", () => {
    const xml = make({ captions: [{ start: 1, end: 3, text: " You want to make more money,\r\nbut you can't keep taking on more work. \n" }] });
    assert.ok(xml.includes(`<text-style ref="ts1">You want to make more money,\nbut you can't keep taking on more work.</text-style>`), xml);
    assert.equal(tags(xml, "caption")[0].name, "You want to make more money, but you can't keep taking on more work.");
  });
  it("each have a style under a name of its own", () => {
    const xml = make({ captions: [{ start: 1, end: 2, text: "One." }, { start: 2, end: 3, text: "Two." }, { start: 12, end: 13, text: "Three." }] });
    assert.deepEqual(tags(xml, "text-style-def").map((def) => def.id), ["ts1", "ts2", "ts3"]);
    assert.deepEqual(tags(xml, "text-style").map((style) => style.ref).filter(Boolean), ["ts1", "ts2", "ts3"]);
  });
  it("are left out when they have no words, or come to no frames", () => {
    const xml = make({ captions: [{ start: 1, end: 2, text: "  \n " }, { start: 2, end: 3 }, { start: 3, end: 3.01, text: "A blink." }, { start: 4.99, end: 6, text: "It starts on the first frame that was cut." }] });
    assert.deepEqual(tags(xml, "caption"), []);
  });
});

describe("notes for the editor", () => {
  /** The markers on each clip of a file, each as "start value". */
  const notes = (xml) => clips(xml).map((clip) => tags(clip, "marker").map((m) => `${m.start} ${m.value}`));
  it("are markers one frame long on the kept piece that holds the moment, at the video's own time", () => {
    const xml = make({ markers: [{ at: 2.5, text: "Check the sound here" }, { at: 19.97, text: "The last frame kept" }] });
    assert.deepEqual(clips(xml), [
      `<asset-clip ref="r2" offset="0s" name="One" start="0s" duration="5s">\n<marker start="75/30s" duration="1/30s" value="Check the sound here"/>\n</asset-clip>`,
      `<asset-clip ref="r2" offset="5s" name="Two" start="10s" duration="10s">\n<marker start="599/30s" duration="1/30s" value="The last frame kept"/>\n</asset-clip>`
    ]);
    // At 29.97, 4.2 seconds is 125.87 frames in.
    const fine = make({ facts: AT_2997, ranges: [{ start: 0, end: 60 }], markers: [{ at: 4.2, text: "On a frame" }] });
    assert.deepEqual(tags(fine, "marker"), [{ start: "126126/30000s", duration: "1001/30000s", value: "On a frame" }]);
  });
  it("go to the start of the next kept piece, which is the join, when the moment was cut out", () => {
    const xml = make({
      ranges: [{ start: 2, end: 5, name: "One" }, TWO[1]],
      markers: [{ at: 0, text: "Cut 0:00 to 0:02: setting up the camera" }, { at: 5, text: "Cut 0:05 to 0:10: a false start" }]
    });
    assert.deepEqual(notes(xml), [["2s Cut 0:00 to 0:02: setting up the camera"], ["10s Cut 0:05 to 0:10: a false start"]]);
  });
  it("go on the last frame kept when the moment comes after everything that was kept", () => {
    const xml = make({ markers: [{ at: 42, text: "Cut 0:20 to the end: the goodbye, said twice" }] });
    assert.deepEqual(notes(xml), [[], ["599/30s Cut 0:20 to the end: the goodbye, said twice"]]);
  });
  it("become one marker when two of them land on the same frame, so that neither is lost", () => {
    const xml = make({ markers: [{ at: 6, text: "Cut: a cough" }, { at: 12, text: "Check the sound here" }, { at: 7, text: " " }, { at: 8, text: "Cut: a false start" }] });
    assert.deepEqual(notes(xml), [[], ["10s Cut: a cough / Cut: a false start", "12s Check the sound here"]]);
  });
  it("come after the captions in a clip, which is the order Final Cut's definition asks for, and in the order of the video", () => {
    const xml = make({ markers: [{ at: 14, text: "Later" }, { at: 11, text: "Sooner" }], captions: [{ start: 12, end: 14, text: "Hello there." }] });
    assert.deepEqual([...clips(xml)[1].matchAll(/<(caption|marker) /g)].map((m) => m[1]), ["caption", "marker", "marker"]);
    assert.deepEqual(notes(xml)[1], ["11s Sooner", "14s Later"]);
  });
  it("are left out when no piece was kept to put them on", () => {
    assert.deepEqual(tags(make({ ranges: [], markers: [{ at: 3, text: "Nothing to mark" }] }), "marker"), []);
  });
});

describe("what came from outside", () => {
  it("is written so that the file still reads: & < > everywhere, and quotation marks in a name", () => {
    const xml = make({
      video: "/in/Tom & Jerry's \"best\" <cut>.mp4",
      ranges: [{ start: 0, end: 5, name: "Q&A <part 1> \"live\"" }],
      captions: [{ start: 1, end: 3, text: "Tom & Jerry said \"a < b > c\"." }],
      markers: [{ at: 2, text: "Cut: \"um\" & <a cough>" }],
      project: "Q&A \"final\"", event: "<The Show> & friends"
    });
    assert.equal(tags(xml, "asset")[0].name, "Tom &amp; Jerry's &quot;best&quot; &lt;cut&gt;");
    assert.equal(tags(xml, "asset-clip")[0].name, "Q&amp;A &lt;part 1&gt; &quot;live&quot;");
    assert.equal(tags(xml, "project")[0].name, "Q&amp;A &quot;final&quot;");
    assert.equal(tags(xml, "event")[0].name, "&lt;The Show&gt; &amp; friends");
    assert.equal(tags(xml, "marker")[0].value, "Cut: &quot;um&quot; &amp; &lt;a cough&gt;");
    assert.equal(tags(xml, "caption")[0].name, "Tom &amp; Jerry said &quot;a &lt; b &gt; c&quot;.");
    assert.ok(xml.includes(`<text-style ref="ts1">Tom &amp; Jerry said "a &lt; b &gt; c".</text-style>`), xml);
  });
  it("loses the characters XML does not allow, and keeps every other one", () => {
    const odd = "A\u0000B\u0008C\u000BD\u001FE\u{FFFE}F\u{D800}G \u{1F600} é 録画";
    const kept = "ABCDEFG \u{1F600} é 録画";
    const xml = make({ ranges: [{ start: 0, end: 5, name: odd }], captions: [{ start: 1, end: 3, text: odd }], markers: [{ at: 2, text: odd }], project: odd, event: odd });
    assert.deepEqual([tags(xml, "asset-clip")[0].name, tags(xml, "project")[0].name, tags(xml, "event")[0].name, tags(xml, "marker")[0].value, tags(xml, "caption")[0].name], [kept, kept, kept, kept, kept]);
    assert.ok(xml.includes(`<text-style ref="ts1">${kept}</text-style>`), xml);
    assert.doesNotMatch(xml, /[^\t\n\r\x20-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/u);
  });
  it("is put on one line where it is a name", () => {
    const xml = make({ ranges: [{ start: 0, end: 5, name: " The first\npoint " }], markers: [{ at: 2, text: "Cut 0:05 to 0:10:\r\n\ta false start" }], project: "Episode 12\nrough cut" });
    assert.deepEqual([tags(xml, "asset-clip")[0].name, tags(xml, "marker")[0].value, tags(xml, "project")[0].name], ["The first point", "Cut 0:05 to 0:10: a false start", "Episode 12 rough cut"]);
  });
});

describe("our own checks of a file", () => {
  /** A file that is right: the two pieces, with a note on the first and a caption on the second. */
  const good = make({ captions: [{ start: 12, end: 14, text: "Hello there." }], markers: [{ at: 2.5, text: "Check the sound here" }] });
  /** The file with one thing in it changed. The thing has to be there to change. */
  const changed = (from, to) => {
    assert.ok(good.includes(from), from);
    return good.replace(from, to);
  };
  it("find nothing wrong with a file this module wrote", () => {
    assert.deepEqual(checkFcpxml(good, AT_30), []);
    assert.deepEqual(checkFcpxml(fcpxml(RICH), RICH.facts), []);
  });
  it("find nothing wrong with a file that names its library", () => {
    assert.match(make({ library: LIBRARY }), /<option key="library location"/);
    assert.deepEqual(checkFcpxml(make({ library: LIBRARY }), AT_30), []);
    assert.deepEqual(checkFcpxml(fcpxml({ ...RICH, library: LIBRARY }), RICH.facts), []);
  });
  it("find a time that is not a whole number of frames", () => {
    assert.deepEqual(checkFcpxml(changed('duration="1/30s" value=', 'duration="1/48000s" value='), AT_30), ["One marker has the duration 1/48000s, which is not a whole number of frames."]);
    assert.deepEqual(checkFcpxml(changed('offset="12s"', 'offset="12.5"'), AT_30), ["One caption has the offset 12.5, which is not a whole number of frames."]);
    assert.deepEqual(checkFcpxml(changed('<marker start="75/30s"', '<marker start="2.5s"'), AT_30), ["One marker has the start 2.5s, which is not a whole number of frames."]);
    // Five seconds is a whole number of frames at 30 a second, and 149.85 of them at 29.97.
    const slower = checkFcpxml(good, { ...AT_30, frameRate: "30000/1001" });
    assert.ok(slower.includes("One asset-clip has the offset 5s, which is not a whole number of frames."), slower.join("\n"));
  });
  it("say a clip's bad time once, and add nothing up from it", () => {
    // With no length for the first clip there is no telling where the second should start, or how long the timeline should be.
    assert.deepEqual(checkFcpxml(changed('start="0s" duration="5s"', 'start="0s" duration="151/31s"'), AT_30), ["One asset-clip has the duration 151/31s, which is not a whole number of frames."]);
  });
  it("find a gap between two clips, and a clip laid over the one before it", () => {
    assert.deepEqual(checkFcpxml(changed('offset="5s" name="Two"', 'offset="6s" name="Two"'), AT_30), ["There is a gap of 30 frames before clip 2."]);
    assert.deepEqual(checkFcpxml(changed('offset="5s" name="Two"', 'offset="149/30s" name="Two"'), AT_30), ["Clip 2 overlaps what comes before it by 1 frame."]);
    assert.deepEqual(checkFcpxml(changed('offset="0s" name="One"', 'offset="1s" name="One"'), AT_30), ["There is a gap of 30 frames before clip 1.", "Clip 2 overlaps what comes before it by 30 frames."]);
  });
  it("take the first clip to start where the timeline's own clock starts, which need not be nought", () => {
    const later = changed('tcStart="0s"', 'tcStart="1s"');
    assert.deepEqual(checkFcpxml(later, AT_30), ["Clip 1 overlaps what comes before it by 30 frames."]);
    assert.deepEqual(checkFcpxml(later.replace('offset="0s" name="One"', 'offset="1s" name="One"').replace('offset="5s" name="Two"', 'offset="6s" name="Two"'), AT_30), []);
  });
  it("find a clip that runs outside the video", () => {
    assert.deepEqual(checkFcpxml(good, { ...AT_30, duration: 19.9 }), ["Clip 2 runs outside the video."]);
    assert.deepEqual(checkFcpxml(good, { ...AT_30, duration: 20 }), []);
    assert.deepEqual(checkFcpxml(changed('name="One" start="0s"', 'name="One" start="-1s"'), AT_30), ["Clip 1 runs outside the video."]);
  });
  it("find a timeline whose length is not the sum of its clips", () => {
    assert.deepEqual(checkFcpxml(changed('duration="15s" tcStart', 'duration="16s" tcStart'), AT_30), ["The timeline is said to be 480 frames long, and its clips come to 450 frames."]);
  });
  it("find a clip, a format or a caption's style that points at nothing, or at the wrong kind of thing", () => {
    assert.deepEqual(checkFcpxml(changed('ref="r2" offset="5s"', 'ref="r7" offset="5s"'), AT_30), [`The asset-clip points at "r7", and the file holds no asset of that name.`]);
    assert.deepEqual(checkFcpxml(changed('ref="r2" offset="5s"', 'ref="r1" offset="5s"'), AT_30), [`The asset-clip points at "r1", and the file holds no asset of that name.`]);
    assert.deepEqual(checkFcpxml(changed('<sequence format="r1"', '<sequence format="r2"'), AT_30), [`The sequence points at "r2", and the file holds no format of that name.`]);
    assert.deepEqual(checkFcpxml(changed('<text-style ref="ts1">', '<text-style ref="ts2">'), AT_30), [`The text-style points at "ts2", and the file holds no text-style-def of that name.`]);
  });
  it("find anything else that points at a part of the file that is not there", () => {
    /** The file with a title at the end of its timeline, or a picture laid over its first clip. This module writes neither, and
        what kind of thing each should point at is not known here, only that it has to be in the file. */
    const titled = (ref) => changed("</spine>", `<title ref="${ref}" offset="15s" name="Lower third" duration="2s"/></spine>`).replace('duration="15s" tcStart', 'duration="17s" tcStart');
    const laidOver = (ref) => changed("<marker ", `<video ref="${ref}" lane="1" offset="1s" duration="1s"/><marker `);
    assert.deepEqual(checkFcpxml(titled("r9"), AT_30), [`The title points at "r9", and the file holds nothing of that name.`]);
    assert.deepEqual(checkFcpxml(laidOver("r9"), AT_30), [`The video points at "r9", and the file holds nothing of that name.`]);
    assert.deepEqual(checkFcpxml(titled("r1"), AT_30), []);
    assert.deepEqual(checkFcpxml(laidOver("r2"), AT_30), []);
  });
  it("find a caption or a note that lies outside its clip", () => {
    assert.deepEqual(checkFcpxml(changed('offset="12s" name="Hello there."', 'offset="2s" name="Hello there."'), AT_30), ["A caption on clip 2 lies outside the clip."]);
    assert.deepEqual(checkFcpxml(changed('offset="12s" name="Hello there."', 'offset="19s" name="Hello there."'), AT_30), ["A caption on clip 2 lies outside the clip."]);
    assert.deepEqual(checkFcpxml(changed('<marker start="75/30s"', '<marker start="5s"'), AT_30), ["A marker on clip 1 lies outside the clip."]);
  });
  it("say so when the text is not a project at all", () => {
    assert.deepEqual(checkFcpxml("", AT_30), ["The file has no timeline."]);
    assert.deepEqual(checkFcpxml("1\n00:00:00,000 --> 00:00:02,400\nYou want to make more money,\n", AT_30), ["The file has no timeline."]);
    assert.deepEqual(checkFcpxml(`<spine><asset-clip offset="0s" duration="5s"/></spine>`, AT_30), ["The file has no timeline."]);
  });
  it("say so, and give back no list, when the video's frame rate or its length cannot be read", () => {
    assert.throws(() => checkFcpxml(good, { ...AT_30, frameRate: "fast" }), { message: "The video's frame rate cannot be read: fast" });
    assert.throws(() => checkFcpxml(good, { ...AT_30, duration: "N/A" }), { message: "The video's length cannot be read: N/A" });
  });
});

describe("Final Cut Pro's own definition of the format", () => {
  // The definition comes with Final Cut Pro. xmllint takes where it is as a file:// address, and fails on the plain path.
  const DTD = "file:///Applications/Final%20Cut%20Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_10.dtd";
  /** Why the file cannot be checked on this machine. Nothing, when it can. */
  const cannot = !existsSync(fileURLToPath(DTD)) ? "Final Cut Pro is not on this machine, so its definition of the format is not here to check a file against"
    : spawnSync("xmllint", ["--version"]).error ? "xmllint is not on this machine, so a file cannot be checked against Final Cut Pro's definition of the format"
      : false;
  it("passes a file with several pieces, captions, notes, awkward characters and a path with spaces in it", { skip: cannot }, () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-fcpxml-"));
    try {
      const check = (name, xml) => {
        writeFileSync(join(dir, name), xml);
        return spawnSync("xmllint", ["--noout", "--dtdvalid", DTD, join(dir, name)], { encoding: "utf8" });
      };
      const xml = fcpxml(RICH);
      assert.deepEqual([tags(xml, "asset-clip").length, tags(xml, "caption").length, tags(xml, "marker").length], [3, 4, 4]);
      const right = check("right.fcpxml", xml);
      assert.equal(right.status, 0, right.stderr);
      // The same file with a note moved ahead of the captions of its clip does not pass, so the check is a real one.
      const lines = xml.split("\n");
      lines.splice(lines.findIndex((line) => line.includes("<caption ")), 0, ...lines.splice(lines.findIndex((line) => line.includes("<marker ")), 1));
      const wrong = check("wrong.fcpxml", lines.join("\n"));
      assert.notEqual(wrong.status, 0);
      assert.match(wrong.stderr, /asset-clip content does not follow the DTD/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("passes a file that names its library, and not one that names it anywhere but first", { skip: cannot }, () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-fcpxml-"));
    try {
      const check = (name, xml) => {
        writeFileSync(join(dir, name), xml);
        return spawnSync("xmllint", ["--noout", "--dtdvalid", DTD, join(dir, name)], { encoding: "utf8" });
      };
      const xml = fcpxml({ ...RICH, library: "/Users/sallie/BRIMM Video Work/Rough cuts & <more>.fcpbundle" });
      assert.equal(tags(xml, "option").length, 1);
      const right = check("right.fcpxml", xml);
      assert.equal(right.status, 0, right.stderr);
      // The same file with the library named after the video does not pass.
      const lines = xml.split("\n");
      const named = lines.splice(lines.findIndex((line) => line.includes("<import-options>")), 3);
      lines.splice(lines.findIndex((line) => line.includes("</resources>")) + 1, 0, ...named);
      const wrong = check("wrong.fcpxml", lines.join("\n"));
      assert.notEqual(wrong.status, 0);
      assert.match(wrong.stderr, /fcpxml content does not follow the DTD/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
