// Pictures for graphics and the logo (spec section 4, `graphic` and `logo`): taken only by the name of a file in
// ~/BRIMM Video Studio/Pictures/, never by a path, so words in a transcript cannot make brimm-video copy another file into
// Dropbox. A picture's size is read from its own first bytes, with no program run.
// Nothing here touches a disk or runs a program.

/** The kinds of picture taken: PNG and JPEG, which Final Cut takes as stills. */
export const PICTURE_ENDINGS = [".png", ".jpg", ".jpeg"];

/** Why a name is not the name of a picture to take, in plain words: "" when it is. Only a name is taken: one with a slash
    in it, or one that starts with a dot, is refused, and so is one of another kind. */
export function pictureNameFault(name) {
  const said = String(name ?? "");
  if (!said.trim()) return "Say the name of a picture in the Pictures folder.";
  if (said.includes("/") || said.startsWith(".")) return `"${said}" is not the name of a picture in the Pictures folder. Say only its name, as Finder shows it there.`;
  if (!PICTURE_ENDINGS.some((e) => said.toLowerCase().endsWith(e))) return `"${said}" is not a PNG or a JPEG picture. Save it as one in the Pictures folder.`;
  return "";
}

/** A JPEG's EXIF orientation, from its APP1 part at `at`: null when the part is not EXIF (XMP is an APP1 part too), and 1 when
    it says none. A phone's upright photo is stored on its side and says 6 (or 8): it is shown turned. */
function orientationOf(bytes, at) {
  if (bytes.toString("ascii", at + 4, at + 10) !== "Exif\0\0") return null;
  const tiff = at + 10;
  const little = bytes.toString("ascii", tiff, tiff + 2) === "II";
  const u16 = (o) => (little ? bytes.readUInt16LE(o) : bytes.readUInt16BE(o));
  const u32 = (o) => (little ? bytes.readUInt32LE(o) : bytes.readUInt32BE(o));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > bytes.length) return 1;
  for (let i = 0, count = u16(ifd); i < count && ifd + 14 + i * 12 <= bytes.length; i++) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return 1;
}

/** A picture's size in pixels as it is shown, { width, height }, read from its bytes: a PNG's header, or a JPEG's frame,
    turned as its EXIF orientation says (5 to 8 are a quarter turn, so its width and height swap). null when the bytes are
    neither. `bytes` is the whole file: a JPEG's frame may come after large EXIF or XMP parts. */
export function pictureSize(bytes) {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString("ascii", 12, 16) === "IHDR") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    let orientation = 1;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      const length = bytes.readUInt16BE(at + 2);
      if (marker === 0xe1) orientation = orientationOf(bytes, at) ?? orientation;
      // A frame's start, of any of the kinds a JPEG may be coded in (not 0xc4, 0xc8 or 0xcc, which are tables).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        const [width, height] = [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
        return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
      }
      at += 2 + length;
    }
  }
  return null;
}
