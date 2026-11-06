// The reference folder (design 2026-11-03, section 7; PR H3): a folder in Dropbox, next to Episodes, of screenshots and pictures of post
// styles that Sallie names when she wants one followed. Studio only ever reads it. These are the module's own functions, which read a
// folder and say nothing: what a command says of it is tests/edit-refs.test.js's. No test runs sips, the app or Claude.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REFERENCE_KINDS, findReference, listReferences, lookingFolder, projectNameOf, referencesAsked, refNamesOf, sameName } from "../references.js";
import { referencesFolder } from "../settings.js";
import { studioFolder } from "../studio.js";

/** A folder for one test, with these files in it (each holding its own name), and a way to take it away. */
function folderWith(names = []) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-references-"));
  const folder = join(dir, "References");
  mkdirSync(folder);
  for (const name of names) writeFileSync(join(folder, name), name);
  return { dir, folder, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the reference folder's place", () => {
  it("is References, in BRIMM Video, beside Episodes and the drop folders", () => {
    assert.equal(referencesFolder("/Users/sallie/Dropbox/The BRIMM DB/BRIMM Video"), "/Users/sallie/Dropbox/The BRIMM DB/BRIMM Video/References");
  });
  it("has its Looking folder beside her Pictures folder, inside her BRIMM Video Studio folder", () => {
    assert.equal(lookingFolder("/Users/sallie"), "/Users/sallie/BRIMM Video Studio/Looking");
    assert.equal(lookingFolder("/Users/sallie"), join(studioFolder("/Users/sallie"), "Looking"));
  });
});

describe("REFERENCE_KINDS", () => {
  it("are the eight kinds of picture a person has: PNG, JPEG, HEIC, WebP, GIF and TIFF", () => {
    assert.deepEqual(REFERENCE_KINDS, [".png", ".jpg", ".jpeg", ".heic", ".webp", ".gif", ".tif", ".tiff"]);
  });
});

describe("listReferences", () => {
  it("gives null when there is no folder, and when what is there is not a folder", () => {
    const w = folderWith();
    assert.equal(listReferences(join(w.dir, "Nowhere")), null);
    writeFileSync(join(w.dir, "a file"), "x");
    assert.equal(listReferences(join(w.dir, "a file")), null);
    w.done();
  });
  it("gives no pictures and no others for a folder with nothing in it", () => {
    const w = folderWith();
    assert.deepEqual(listReferences(w.folder), { pictures: [], others: [] });
    w.done();
  });
  it("tells a picture from any other file by its extension, in any case, and keeps the others apart", () => {
    const w = folderWith(["a.PNG", "b.JpEg", "c.heic", "d.webp", "e.GIF", "f.tif", "g.TIFF", "h.jpg", "launch.mov", "notes.pdf", "no extension", "photo.png.mov"]);
    assert.deepEqual(listReferences(w.folder), {
      pictures: ["a.PNG", "b.JpEg", "c.heic", "d.webp", "e.GIF", "f.tif", "g.TIFF", "h.jpg"],
      others: ["launch.mov", "no extension", "notes.pdf", "photo.png.mov"]
    });
    w.done();
  });
  it("leaves out the dot files, which Dropbox and Finder keep in a folder, whatever they are named", () => {
    const w = folderWith([".DS_Store", ".dropbox", ".hidden.png", "shown.png"]);
    assert.deepEqual(listReferences(w.folder), { pictures: ["shown.png"], others: [] });
    w.done();
  });
  it("sorts the names without minding their case, the same way on every Mac", () => {
    const w = folderWith(["title style.heic", "Quote card.jpg", "blue carousel.png", "Blue carousel 2.png", "apple.png", "Zebra.png"]);
    // By the stem in lower case, then by the extension, as Finder puts a name before its numbered copy: "carousel.png" before "carousel 2.png".
    assert.deepEqual(listReferences(w.folder).pictures, ["apple.png", "blue carousel.png", "Blue carousel 2.png", "Quote card.jpg", "title style.heic", "Zebra.png"]);
    w.done();
  });
  it("lists files only: a folder inside it, even one named like a picture, and a link, are not files of it", () => {
    const w = folderWith(["real.png"]);
    mkdirSync(join(w.folder, "Old styles"));
    mkdirSync(join(w.folder, "folder.png"));
    writeFileSync(join(w.folder, "Old styles", "inside.png"), "x");
    symlinkSync(join(w.folder, "real.png"), join(w.folder, "link.png"));
    assert.deepEqual(listReferences(w.folder), { pictures: ["real.png"], others: [] });
    w.done();
  });
  it("only reads: the folder's own time is what it was", () => {
    const w = folderWith(["a.png", "b.mov"]);
    const before = statSync(w.folder).mtimeMs;
    listReferences(w.folder);
    findReference(w.folder, "a");
    assert.equal(statSync(w.folder).mtimeMs, before);
    w.done();
  });
});

describe("findReference", () => {
  const NAMES = ["blue carousel.png", "blue carousel 2.png", "quote card.jpg", "title style.heic", "launch.mov"];
  it("takes the name whose stem is what she said, whatever its case, before any name that only holds those words", () => {
    const w = folderWith(NAMES);
    assert.deepEqual(findReference(w.folder, "blue carousel"), { file: "blue carousel.png" });
    assert.deepEqual(findReference(w.folder, "Blue CAROUSEL"), { file: "blue carousel.png" });
    assert.deepEqual(findReference(w.folder, "blue carousel 2"), { file: "blue carousel 2.png" });
    w.done();
  });
  it("takes the whole name too, with its extension, since that is how it is listed", () => {
    const w = folderWith(NAMES);
    assert.deepEqual(findReference(w.folder, "blue carousel.png"), { file: "blue carousel.png" });
    assert.deepEqual(findReference(w.folder, "QUOTE CARD.JPG"), { file: "quote card.jpg" });
    assert.deepEqual(findReference(w.folder, "title style.heic"), { file: "title style.heic" });
    w.done();
  });
  it("takes the only stem that holds what she said, when no stem is it", () => {
    const w = folderWith(NAMES);
    assert.deepEqual(findReference(w.folder, "quote"), { file: "quote card.jpg" });
    assert.deepEqual(findReference(w.folder, "STYLE"), { file: "title style.heic" });
    w.done();
  });
  it("says which, in order, when several stems hold it, or several names have the stem", () => {
    const w = folderWith(["red carousel.png", "blue carousel 2.png", "quote card.jpg"]);
    assert.deepEqual(findReference(w.folder, "carousel"), { several: ["blue carousel 2.png", "red carousel.png"] });
    w.done();
    const same = folderWith(["blue carousel.png", "blue carousel.jpg", "other.png"]);
    assert.deepEqual(findReference(same.folder, "blue carousel"), { several: ["blue carousel.jpg", "blue carousel.png"] });
    same.done();
  });
  it("says there is none, with the pictures there are, in order, when no name fits", () => {
    const w = folderWith(NAMES);
    assert.deepEqual(findReference(w.folder, "blue carusel"), { none: true, pictures: ["blue carousel.png", "blue carousel 2.png", "quote card.jpg", "title style.heic"] });
    w.done();
  });
  it("looks among the pictures only: a stem that is not a picture's is none", () => {
    const w = folderWith(NAMES);
    assert.deepEqual(findReference(w.folder, "launch"), { none: true, pictures: ["blue carousel.png", "blue carousel 2.png", "quote card.jpg", "title style.heic"] });
    assert.deepEqual(findReference(w.folder, "launch.mov").none, true);
    w.done();
  });
  it("reads a name however its accents and spaces are written", () => {
    const w = folderWith(["café menu.png", "blue  carousel.png"]);
    assert.deepEqual(findReference(w.folder, "CAFÉ"), { file: "café menu.png" });
    assert.deepEqual(findReference(w.folder, "  blue   carousel "), { file: "blue  carousel.png" });
    w.done();
  });
  it("finds nothing for no words at all, and nothing in a folder that is not there", () => {
    const w = folderWith(NAMES);
    for (const said of ["", "   ", undefined, null]) assert.equal(findReference(w.folder, said).none, true, String(said));
    assert.deepEqual(findReference(join(w.dir, "Nowhere"), "blue"), { none: true, pictures: [] });
    w.done();
  });
});

describe("sameName", () => {
  it("is whether two names are one for a person: the same, whatever the case, the accents' spelling and the spaces", () => {
    assert.ok(sameName("Blue Carousel.PNG", "blue carousel.png"));
    assert.ok(sameName("café.png", "CAFÉ.png"));
    assert.ok(sameName(" a  b.png", "a b.png "));
    assert.ok(!sameName("a.png", "a.jpg"));
    assert.ok(!sameName("a.png", ""));
  });
});

describe("projectNameOf: the file as Claude and a project can read it", () => {
  it("keeps the name of a PNG, JPEG, WebP or GIF, which Claude reads as they are", () => {
    for (const name of ["a.png", "b.jpg", "c.JPEG", "d.webp", "e.gif", "no extension", "has.many.dots.png"]) assert.equal(projectNameOf(name), name);
  });
  it("makes a HEIC, TIFF or TIF picture a JPEG of the same stem, whatever the case of its extension", () => {
    assert.equal(projectNameOf("title style.heic"), "title style.jpg");
    assert.equal(projectNameOf("scan.TIF"), "scan.jpg");
    assert.equal(projectNameOf("scan.tiff"), "scan.jpg");
    assert.equal(projectNameOf("A.B.HEIC"), "A.B.jpg");
  });
});

describe("refNamesOf: the pictures a list of cues names", () => {
  const cue = (style) => ({ n: 1, words: "x", kind: "graphic", show: "y", seconds: 4, style });
  it("is the file name of each style that is a ref, once each (a name that is the same for a person, as the first is spelled), in the order the cues come", () => {
    assert.deepEqual(refNamesOf([cue({ ref: "b.png" }), cue(null), cue({ ref: "a.png" }), cue({ ref: "b.png" }), cue({ ref: "B.PNG" })]), ["b.png", "a.png"]);
  });
  it("leaves out a style that names an inspiration or a link, no style, and anything that is not a cue", () => {
    assert.deepEqual(refNamesOf([cue({ inspiration: "a" }), cue({ link: "https://example.com/post" }), cue(null), cue(undefined), { n: 2 }, null, "text", 7, cue({ ref: "" }), cue({ ref: 3 })]), []);
  });
  it("is nothing for no cues, and for what is not a list", () => {
    for (const given of [[], undefined, null, "text", {}]) assert.deepEqual(refNamesOf(given), []);
  });
});

describe("referencesAsked: what `refs` is told", () => {
  it("is the list with no words", () => {
    assert.deepEqual(referencesAsked([]), { form: "list" });
  });
  it("is look with one name", () => {
    assert.deepEqual(referencesAsked(["look", "blue carousel"]), { form: "look", name: "blue carousel" });
  });
  it("is use with an episode and a name, and then a Reel's number when it is given", () => {
    assert.deepEqual(referencesAsked(["use", "Pricing talk", "blue carousel"]), { form: "use", episode: "Pricing talk", name: "blue carousel", reel: null });
    assert.deepEqual(referencesAsked(["use", "Pricing talk", "blue carousel", "reel", "2"]), { form: "use", episode: "Pricing talk", name: "blue carousel", reel: 2 });
    assert.deepEqual(referencesAsked(["use", "Pricing talk", "reel", "reel", "10"]), { form: "use", episode: "Pricing talk", name: "reel", reel: 10 });
  });
  it("is nothing for anything else, which is the help", () => {
    for (const rest of [["look"], ["look", ""], ["look", "a", "b"], ["use"], ["use", "Pricing talk"], ["use", "", "a"], ["use", "Pricing talk", ""], ["use", "Pricing talk", "a", "reel"], ["use", "Pricing talk", "a", "reel", "0"], ["use", "Pricing talk", "a", "reel", "two"],
      ["use", "Pricing talk", "a", "scene", "2"], ["use", "Pricing", "talk", "blue", "carousel"], ["list"], ["--help"], ["blue carousel"]]) assert.equal(referencesAsked(rest), null, JSON.stringify(rest));
  });
});
