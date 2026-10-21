// A picture's name and size: taken only by its name in the Pictures folder, its size read from its own bytes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pictureNameFault, pictureSize } from "../pictures.js";
import { jpegOf } from "./fixtures.js";

/** The first bytes of a PNG of a size: its signature, and its header. */
const png = (width, height) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
};
/** The first bytes of a JPEG of a size: its start, an APP0 part, and a baseline frame. */
const jpeg = (width, height) => Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14),
  Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03]), Buffer.alloc(9)
]);

describe("a picture", () => {
  it("is taken by its name only, PNG or JPEG", () => {
    assert.equal(pictureNameFault("Pricing chart.png"), "");
    assert.equal(pictureNameFault("chart.JPG"), "");
    assert.equal(pictureNameFault("../.ssh/id_rsa.png"), '"../.ssh/id_rsa.png" is not the name of a picture in the Pictures folder. Say only its name, as Finder shows it there.');
    assert.equal(pictureNameFault(".hidden.png"), '".hidden.png" is not the name of a picture in the Pictures folder. Say only its name, as Finder shows it there.');
    assert.equal(pictureNameFault("notes.pdf"), '"notes.pdf" is not a PNG or a JPEG picture. Save it as one in the Pictures folder.');
    assert.equal(pictureNameFault(""), "Say the name of a picture in the Pictures folder.");
  });
  it("has its size read from a PNG's header or a JPEG's frame, and none from other bytes", () => {
    assert.deepEqual(pictureSize(png(1600, 900)), { width: 1600, height: 900 });
    assert.deepEqual(pictureSize(jpeg(1080, 1350)), { width: 1080, height: 1350 });
    assert.equal(pictureSize(Buffer.from("not a picture at all, just words")), null);
  });
  it("has a phone photo's size as it is shown: an EXIF orientation of 5 to 8 is a quarter turn", () => {
    assert.deepEqual(pictureSize(jpegOf(4032, 3024, { orientation: 6 })), { width: 3024, height: 4032 });
    assert.deepEqual(pictureSize(jpegOf(4032, 3024, { orientation: 8, little: true })), { width: 3024, height: 4032 });
    assert.deepEqual(pictureSize(jpegOf(4032, 3024, { orientation: 3 })), { width: 4032, height: 3024 });
    assert.deepEqual(pictureSize(jpegOf(4032, 3024)), { width: 4032, height: 3024 });
  });
});
