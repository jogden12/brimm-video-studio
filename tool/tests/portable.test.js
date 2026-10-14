// A Final Cut file as it is kept in an episode's folder, and as it is handed to Final Cut on one Mac. The file kept in Dropbox
// names its video by an address from its own folder and names no library, so it reads the same from either Mac. The copy handed
// to Final Cut names this Mac's paths, this Mac's library for the episode, and how Final Cut is to take it in. Every file here is
// made by the tool's own writer, so the shapes are real ones. Nothing touches a disk and Final Cut Pro is not run. One test asks
// Final Cut Pro's own definition of the format whether the files are right, on a Mac that has it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fcpxml, checkFcpxml, fileUrl } from "../fcpxml.js";
import { relativeMedia, localMedia, withImportOptions, retitle, mediaIn } from "../portable.js";

/** One episode's folder as each Mac reaches it through Dropbox. Each Mac's path into Dropbox is its own. */
const STUDIO = "/Users/jasonogden/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video/Episodes/2026-10-14 Pricing talk";
const LAPTOP = "/Users/sallie/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video/Episodes/2026-10-14 Pricing talk";
/** Where the import keeps its Final Cut file, in the episode's folder. */
const KEPT = "edit/main.v0.fcpxml";
/** This Mac's library for the episode, on its own disk. */
const LIB = "/Users/sallie/BRIMM Video Work/2026-10-14 Pricing talk/2026-10-14 Pricing talk.fcpbundle";
/** What ffprobe says of the video: five minutes at 30 frames a second. */
const FACTS = { duration: 300, frameRate: "30/1", width: 1920, height: 1080, hasAudio: true, audioRate: 48000, audioChannels: 2 };

/** A Final Cut file as the tool's own writer makes it for the episode's video in `episode`: two pieces kept, a caption and a
    note, as the import's own file has. */
const written = (episode, over = {}) => fcpxml({
  video: join(episode, "Pricing talk.mp4"),
  facts: FACTS,
  ranges: [{ start: 2, end: 10, name: "Hello" }, { start: 12, end: 40, name: "The first point" }],
  captions: [{ start: 3, end: 5, text: "Hello, and welcome." }],
  markers: [{ at: 11, text: "Cut 0:10 to 0:12: a cough" }],
  ...over
});
/** The import's file as it is kept in the episode's folder on the Mac Studio. */
const kept = () => relativeMedia(written(STUDIO), { from: join(STUDIO, KEPT), to: join(STUDIO, KEPT), episode: STUDIO }).xml;
/** Where each medium is, as the file writes it. */
const srcs = (xml) => [...xml.matchAll(/<media-rep [^>]*src="([^"]*)"/g)].map((m) => m[1]);
/** Each import option, as "key=value". */
const options = (xml) => [...xml.matchAll(/<option key="([^"]*)" value="([^"]*)"\/>/g)].map((m) => `${m[1]}=${m[2]}`);
/** The text with one piece of it changed. The piece has to be there to change. */
const swapped = (text, from, to) => {
  assert.ok(text.includes(from), from);
  return text.replace(from, to);
};

describe("the Final Cut file kept in an episode's folder", () => {
  it("names the episode's video by an address from the folder it is kept in, and nothing else in it changes", () => {
    const made = relativeMedia(written(STUDIO), { from: join(STUDIO, KEPT), to: join(STUDIO, KEPT), episode: STUDIO });
    assert.deepEqual(made, { xml: written(STUDIO, { src: "../Pricing%20talk.mp4" }), outside: [] });
    assert.deepEqual(checkFcpxml(made.xml, FACTS), []);
  });
  it("is the same file whichever Mac made it, since it names no Mac's path and no library", () => {
    const on = (episode) => relativeMedia(written(episode), { from: join(episode, KEPT), to: join(episode, KEPT), episode }).xml;
    assert.equal(on(LAPTOP), on(STUDIO));
    assert.doesNotMatch(on(STUDIO), /file:|import-options/);
  });
  it("writes each folder's name and the file's with every awkward character as %xx, and reads back as the same path", () => {
    const name = "Sallie's talk #1 & 100% <done>?.mov";
    const made = relativeMedia(written(STUDIO, { video: join(STUDIO, "media", name) }), { from: join(STUDIO, KEPT), to: join(STUDIO, KEPT), episode: STUDIO });
    assert.deepEqual(srcs(made.xml), ["../media/Sallie's%20talk%20%231%20%26%20100%25%20%3Cdone%3E%3F.mov"]);
    assert.deepEqual(mediaIn(made.xml, join(STUDIO, KEPT)), [join(STUDIO, "media", name)]);
  });
  it("names media from the folder of the file it is to be kept as, wherever the text was read from", () => {
    const moved = (to) => srcs(relativeMedia(kept(), { from: join(STUDIO, KEPT), to: join(STUDIO, to), episode: STUDIO }).xml);
    assert.deepEqual(moved("edit/main.v1.mac-studio.fcpxml"), ["../Pricing%20talk.mp4"]);
    assert.deepEqual(moved("Pricing talk.fcpxml"), ["Pricing%20talk.mp4"]);
    assert.deepEqual(moved("edit/old/main.v0.fcpxml"), ["../../Pricing%20talk.mp4"]);
  });
  it("leaves media outside the episode's folder as it is, and lists it", () => {
    const where = { from: join(STUDIO, KEPT), to: join(STUDIO, KEPT), episode: STUDIO };
    const elsewhere = written(STUDIO, { video: "/Users/jasonogden/Movies/Pricing talk.mp4" });
    assert.deepEqual(relativeMedia(elsewhere, where), { xml: elsewhere, outside: ["/Users/jasonogden/Movies/Pricing talk.mp4"] });
    // A folder whose name only starts with the episode's is another folder.
    const beside = written(STUDIO, { video: `${STUDIO} (Mac Studio)/Pricing talk.mp4` });
    assert.deepEqual(relativeMedia(beside, where), { xml: beside, outside: [`${STUDIO} (Mac Studio)/Pricing talk.mp4`] });
    // What is not a file on this Mac is listed as it is written.
    const online = written(STUDIO, { src: "https://example.com/Pricing%20talk.mp4?from=1&to=2" });
    assert.deepEqual(relativeMedia(online, where), { xml: online, outside: ["https://example.com/Pricing%20talk.mp4?from=1&to=2"] });
  });
});

describe("the copy of the kept file handed to Final Cut on this Mac", () => {
  it("names each medium by its whole path on this Mac, as the writer would have written it here", () => {
    assert.deepEqual(localMedia(kept(), { from: join(LAPTOP, KEPT), episode: LAPTOP }), { xml: written(LAPTOP), outside: [] });
    assert.deepEqual(localMedia(kept(), { from: join(STUDIO, KEPT), episode: STUDIO }), { xml: written(STUDIO), outside: [] });
  });
  it("goes there and back without losing an awkward character", () => {
    const xml = written(STUDIO, { video: join(STUDIO, "media", `Épisode #12 – Q&A "live" 100%?.mov`) });
    const there = relativeMedia(xml, { from: join(STUDIO, KEPT), to: join(STUDIO, KEPT), episode: STUDIO }).xml;
    assert.notEqual(there, xml);
    assert.equal(localMedia(there, { from: join(STUDIO, KEPT), episode: STUDIO }).xml, xml);
  });
  it("leaves a whole path as it is, and lists every medium outside the episode's folder, by either kind of address", () => {
    const away = join(dirname(STUDIO), "2026-10-01 Another talk", "Another talk.mp4");
    const next = localMedia(written(STUDIO, { src: "../../2026-10-01 Another talk/Another%20talk.mp4" }), { from: join(STUDIO, KEPT), episode: STUDIO });
    assert.deepEqual([srcs(next.xml), next.outside], [[fileUrl(away)], [away]]);
    // A whole path is not written again, even where Final Cut would have written it another way.
    const whole = written(STUDIO, { src: "file:///Users/jasonogden/Movies/Sallie%27s%20talk.mp4" });
    assert.deepEqual(localMedia(whole, { from: join(STUDIO, KEPT), episode: STUDIO }), { xml: whole, outside: ["/Users/jasonogden/Movies/Sallie's talk.mp4"] });
    assert.deepEqual(localMedia(written(STUDIO), { from: join(LAPTOP, KEPT), episode: STUDIO }), { xml: written(STUDIO), outside: [] });
    // The other Mac's whole path to the episode is outside this Mac's: carrying the other Mac's exports over is a later phase.
    assert.deepEqual(localMedia(written(STUDIO), { from: join(LAPTOP, KEPT), episode: LAPTOP }).outside, [join(STUDIO, "Pricing talk.mp4")]);
  });
});

describe("how Final Cut is to take the copy in", () => {
  it("names this Mac's library for the episode, links the media where they are, and asks nothing, first in the file", () => {
    const xml = withImportOptions(written(LAPTOP), { library: LIB, copyAssets: false, suppressWarnings: true });
    assert.deepEqual(xml.split("\n").slice(3, 10), [
      `<fcpxml version="1.10">`,
      `    <import-options>`,
      `        <option key="library location" value="file:///Users/sallie/BRIMM%20Video%20Work/2026-10-14%20Pricing%20talk/2026-10-14%20Pricing%20talk.fcpbundle"/>`,
      `        <option key="copy assets" value="0"/>`,
      `        <option key="suppress warnings" value="1"/>`,
      `    </import-options>`,
      `    <resources>`
    ]);
    assert.equal(xml.split("\n").filter((line, i) => i < 4 || i > 8).join("\n"), written(LAPTOP));
    assert.deepEqual(checkFcpxml(xml, FACTS), []);
  });
  it("replaces the import options a file has already, and copies media in or warns only when it is told to", () => {
    const right = withImportOptions(written(LAPTOP), { library: LIB, copyAssets: false, suppressWarnings: true });
    assert.equal(withImportOptions(written(LAPTOP, { library: "/Users/sallie/BRIMM Video Work/BRIMM rough cuts.fcpbundle" }), { library: LIB }), right);
    assert.equal(withImportOptions(withImportOptions(written(LAPTOP), { library: "/Users/sallie/Other.fcpbundle", copyAssets: true }), { library: LIB }), right);
    assert.equal(withImportOptions(written(LAPTOP), { library: LIB + "/" }), right);
    assert.deepEqual(options(withImportOptions(written(LAPTOP), { library: LIB, copyAssets: true, suppressWarnings: false })).slice(1), ["copy assets=1", "suppress warnings=0"]);
  });
  it("refuses a library that is not the whole path of one, as the writer does", () => {
    for (const library of ["2026-10-14 Pricing talk.fcpbundle", "/Users/sallie/BRIMM Video Work/2026-10-14 Pricing talk"]) {
      assert.throws(() => withImportOptions(written(LAPTOP), { library }), { message: `The library must be given by its whole path, with a name ending .fcpbundle: ${library}` });
    }
  });
});

describe("the names in a file", () => {
  it("are the first event's and the first project's, written as the writer would have, whatever characters are in them", () => {
    const named = { event: `Q&A "live" <1>`, project: `Q&A "live" <1> main v2` };
    assert.equal(retitle(written(LAPTOP), named), written(LAPTOP, named));
    assert.equal(retitle(`<event name="A"><project name="B"/></event><event name="C"><project name="D"/></event>`, { event: "E", project: "F" }), `<event name="E"><project name="F"/></event><event name="C"><project name="D"/></event>`);
  });
  it("lose a uid on the event or the project, and every other attribute and every other uid stays as it is", () => {
    const named = { event: "Pricing talk", project: "Pricing talk main v2" };
    let exported = swapped(written(LAPTOP), `<event name="Rough cuts">`, `<event name="Rough cuts" uid="4C1E2F3A-0000-4000-8000-000000000001">`);
    exported = swapped(exported, `<project name="Pricing talk rough cut">`, `<project name="Pricing talk rough cut" uid="4C1E2F3A-0000-4000-8000-000000000002" modDate="2026-10-14 12:00:00 +0100">`);
    exported = swapped(exported, `<asset id="r2" name="Pricing talk"`, `<asset id="r2" name="Pricing talk" uid="9A8B7C6D5E4F"`);
    let wanted = swapped(written(LAPTOP, named), `<project name="Pricing talk main v2">`, `<project name="Pricing talk main v2" modDate="2026-10-14 12:00:00 +0100">`);
    wanted = swapped(wanted, `<asset id="r2" name="Pricing talk"`, `<asset id="r2" name="Pricing talk" uid="9A8B7C6D5E4F"`);
    assert.equal(retitle(exported, named), wanted);
  });
});

describe("the media a file names", () => {
  it("are given by their whole paths, with an address from the file read from the file's folder", () => {
    assert.deepEqual(mediaIn(written(STUDIO), join(LAPTOP, KEPT)), [join(STUDIO, "Pricing talk.mp4")]);
    assert.deepEqual(mediaIn(kept(), join(LAPTOP, KEPT)), [join(LAPTOP, "Pricing talk.mp4")]);
    // A file older than version 1.9 of the format names its medium on the asset.
    const older = `<fcpxml version="1.8">\n    <resources>\n        <asset id="r2" name="a" src="../media/a%20b.mov" start="0s" duration="10s"/>\n    </resources>\n</fcpxml>\n`;
    assert.deepEqual(mediaIn(older, join(LAPTOP, KEPT)), [join(LAPTOP, "media", "a b.mov")]);
    // What is not a file on this Mac is no path, and is left out.
    assert.deepEqual(mediaIn(written(STUDIO, { src: "https://example.com/a.mp4" }), join(LAPTOP, KEPT)), []);
  });
});

describe("Final Cut Pro's own definition of the format", () => {
  // The definition comes with Final Cut Pro. xmllint takes where it is as a file:// address, and fails on the plain path.
  const DTD = "file:///Applications/Final%20Cut%20Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_10.dtd";
  /** Why the files cannot be checked on this machine. Nothing, when they can. */
  const cannot = !existsSync(fileURLToPath(DTD)) ? "Final Cut Pro is not on this machine, so its definition of the format is not here to check a file against"
    : spawnSync("xmllint", ["--version"]).error ? "xmllint is not on this machine, so a file cannot be checked against Final Cut Pro's definition of the format"
      : false;
  it("passes the file kept in the episode's folder, and the copy handed to Final Cut with its import options and new names", { skip: cannot }, () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-portable-"));
    try {
      const local = withImportOptions(retitle(localMedia(kept(), { from: join(LAPTOP, KEPT), episode: LAPTOP }).xml, { event: `Q&A "live"`, project: `Q&A "live" main v1` }), { library: LIB });
      for (const [name, xml] of [["kept.fcpxml", kept()], ["local.fcpxml", local]]) {
        writeFileSync(join(dir, name), xml);
        const checked = spawnSync("xmllint", ["--noout", "--dtdvalid", DTD, join(dir, name)], { encoding: "utf8" });
        assert.equal(checked.status, 0, `${name}: ${checked.stderr}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
