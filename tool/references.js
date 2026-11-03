// The reference folder (design 2026-11-03, section 7; PR H3): one folder in Dropbox, References, in BRIMM Video, of screenshots and
// pictures of post styles that Sallie adds to from her laptop, the Mac Studio or her phone, and names when she wants one followed.
// It is a style reference and not a source: Claude looks at a picture and writes its look into what it makes, and nothing of someone
// else's post is copied into hers. HyperFrames analyses posts itself, and Studio does not do that again.
//
// STUDIO ONLY READS THE FOLDER. It lists it, finds a picture in it by the name she says, and copies a picture out of it: to Looking/,
// inside her BRIMM Video Studio folder, for Claude to look at (`refs look`), and into an episode's HyperFrames project on this Mac as
// brimm/references/<file> (`refs use`, and a project made from cues that name a picture). Nothing is written into the folder, or
// renamed, moved or deleted in it, and nothing is made in it: a converted picture is made elsewhere. The folder is in Dropbox, so a
// file in it may be there only as a placeholder: it is read to its end first, as `bring` does for an episode's files, and a file
// that is not whole yet is not used.
//
// Claude reads only PNG, JPEG, GIF and WebP pictures. A HEIC or TIFF picture is copied as a JPEG of the same stem, made with macOS's
// own sips (never written over the original: `--out` is always given), whether it goes to Looking/ or into a project.
//
// What this module says goes into her chat, so it holds no path, no flag and no name of a command. The one exception is the line that
// is for Claude, `Picture to look at: <path>`, which her skill tells Claude never to repeat to her.
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { studioFolder } from "./studio.js";

/** The kinds of file that are pictures in the reference folder. Anything else in it is left alone, and listed as a file Studio does not
    use (a video, a note, a PDF). */
export const REFERENCE_KINDS = Object.freeze([".png", ".jpg", ".jpeg", ".heic", ".webp", ".gif", ".tif", ".tiff"]);
/** The kinds Claude cannot read as they are: they are copied as a JPEG (projectNameOf). */
const TURNED_KINDS = Object.freeze([".heic", ".tif", ".tiff"]);

/** A name, or what she said, as it is compared: composed, in lower case, with its spaces as single ones and none at its ends. */
const plainly = (text) => String(text ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
/** Whether two names are one for a person: the same whatever their case, however their accents are written, and whatever their spacing.
    A blank is no name. */
export const sameName = (a, b) => plainly(a) !== "" && plainly(a) === plainly(b);
/** Names in order: by the name as `plainly` has it, in code units and so the same on every Mac; two that are the same so are in the
    order of their own letters. */
const byName = (a, b) => {
  const [x, y] = [plainly(a), plainly(b)];
  return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
};
/** Whether a file name is a picture's. */
const isPicture = (name) => REFERENCE_KINDS.includes(extname(name).toLowerCase());

/** The files of the reference folder `folder`: { pictures, others }, each the names in order, or null when there is no folder (or it
    cannot be read). Dot files are left out, and so is anything that is not a file of the folder's own: a folder in it, and a link.
    A picture is a file of one of REFERENCE_KINDS, whatever the case of its extension. It only reads. */
export function listReferences(folder) {
  let entries;
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch (e) {
    return null;
  }
  const names = entries.filter((entry) => entry.isFile() && !entry.name.startsWith(".")).map((entry) => entry.name).sort(byName);
  return { pictures: names.filter(isPicture), others: names.filter((name) => !isPicture(name)) };
}

/** The name among `names` (in order) that `said` means, as { file }, { several: [...] } or { none: true }. The steps, each tried only
    when the one before found nothing: a name that is what she said, extension and all, as the lists give it; a name whose stem (its
    name without its extension) is what she said; the only name whose stem holds it. Two or more at a step are several, not a pick. */
function pick(names, said) {
  const word = plainly(said);
  if (!word) return { none: true };
  const stem = (name) => plainly(name.slice(0, name.length - extname(name).length));
  for (const fits of [(name) => plainly(name) === word, (name) => stem(name) === word, (name) => stem(name).includes(word)]) {
    const hits = names.filter(fits);
    if (hits.length === 1) return { file: hits[0] };
    if (hits.length > 1) return { several: hits };
  }
  return { none: true };
}

/** The picture of the reference folder `folder` that `said` names: { file }, { several: [names] } when more than one fits, or { none:
    true, pictures } when none does, `pictures` being all there are. Only pictures are looked among, so the stem of a video is none
    (listReferences' `others` are how a command tells her that it is no picture). */
export function findReference(folder, said) {
  const listed = listReferences(folder);
  const pictures = listed ? listed.pictures : [];
  const found = pick(pictures, said);
  return found.none ? { none: true, pictures } : found;
}

/** The name a picture of the reference folder has once Claude can read it, in Looking/ and in a project: a HEIC or TIFF picture is a
    JPEG of the same stem, and every other keeps its name. */
export function projectNameOf(file) {
  const kind = extname(file).toLowerCase();
  return TURNED_KINDS.includes(kind) ? `${file.slice(0, file.length - kind.length)}.jpg` : file;
}

/** Where the pictures she asked to look at are copied for Claude: Looking/, in her BRIMM Video Studio folder, beside her Pictures
    folder. A Read passes inside that folder, so the guard needs no change (studio.js guardDecision). */
export const lookingFolder = (home) => join(studioFolder(home), "Looking");

/** What `refs` is told, from its words after the command: { form: "list" }, { form: "look", name }, { form: "use", episode, name, reel
    } (reel null for the main video, else Reel n's number), or null for anything else, which is the help. A name and an episode are one
    word each, in quotes, as every command has them. */
export function referencesAsked(rest) {
  const [form, ...words] = rest;
  const said = (...these) => these.every((word) => plainly(word) !== "");
  if (form === undefined) return { form: "list" };
  if (form === "look") return words.length === 1 && said(words[0]) ? { form: "look", name: words[0] } : null;
  if (form !== "use" || !said(...words.slice(0, 2))) return null;
  if (words.length === 2) return { form: "use", episode: words[0], name: words[1], reel: null };
  if (words.length === 4 && /^reel$/i.test(words[2]) && /^[1-9]\d*$/.test(words[3])) return { form: "use", episode: words[0], name: words[1], reel: Number(words[3]) };
  return null;
}
