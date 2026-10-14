// A Final Cut file as it is kept in an episode's folder in Dropbox, and as it is handed to Final Cut on one Mac. Each Mac reaches
// Dropbox by its own path, so a file that names a video by one Mac's whole path shows it as missing on the other. So the file
// kept in the episode's folder names its media by an address from its own folder, such as "../Pricing%20talk.mp4", and names no
// library. The copy handed to Final Cut is written on this Mac's own disk. It names each medium by this Mac's whole path, this
// Mac's library for the episode, and how Final Cut is to take it in: the media linked where they are and not copied into the
// library, and no questions asked. Media outside the episode's folder is left as it is and listed, so that the person can be
// asked to copy it into media/. Only where the media are, the import options and the names of the event and the project are
// changed: nothing else in a file is touched. Carrying over a file Final Cut exported on the other Mac (its paths, bookmarks,
// library and uids) is a later phase.
// Phase 0 on Final Cut Pro 12.4, 2026-10-14: a relative address is read from the file's own folder, so a kept file opens as
// it is. Still to be settled by hand: whether `copy assets` 0 is honoured whatever Final Cut's Import setting says, and
// whether `library location` may end in a slash. The copy's library is written with no slash at its end, as the files Final
// Cut Pro 12.4 has opened were.
// Nothing here touches a disk or runs a program. It takes text and gives back text.
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { attribute, fileUrl, libraryUrl, relativeUrl } from "./fcpxml.js";

/** Every place a file names a medium: the src of a media-rep, and the src of an asset, which is where a file older than version
    1.9 of the format names it. */
const SRC = /(<(?:media-rep|asset)\b[^>]*?\ssrc=")([^"]*)(")/g;

/** An address that names a file by its whole path. */
const WHOLE = /^file:/i;

/** An attribute's value as it was before it was written into the file. */
const unescaped = (value) => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Where an address in a file points, as a whole path on this Mac: a file:// address read as one, and an address from the file's
    own folder read from `folder`. null for what is neither, such as a web address, and for one that cannot be read. */
function pathOf(src, folder) {
  const value = unescaped(src);
  try {
    if (WHOLE.test(value)) return fileURLToPath(value);
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
    return resolve(folder, value.split("/").map(decodeURIComponent).join("/"));
  } catch (e) {
    return null;
  }
}

/** Whether `path` is inside the folder `folder`, at any depth. A folder whose name only starts with the same letters is another
    folder. */
const inside = (path, folder) => {
  const from = relative(folder, path);
  return from.split(sep)[0] !== ".." && !isAbsolute(from);
};

/** The file with each medium it names written again. `rewrite(path, inEpisode, src)` gives the new address for the medium at
    `path` (null when it is no file on this Mac), or null to leave it as it is. Addresses from the file are read from `folder`.
    The media outside the episode's folder `episode` are listed: by their whole paths, or as they are written when they are no
    file on this Mac. */
function rewritten(xml, { folder, episode }, rewrite) {
  const outside = [];
  const text = xml.replace(SRC, (all, head, src, tail) => {
    const path = pathOf(src, folder);
    const inEpisode = path !== null && inside(path, episode);
    if (!inEpisode) outside.push(path ?? unescaped(src));
    const address = rewrite(path, inEpisode, unescaped(src));
    return address == null ? all : head + attribute(address) + tail;
  });
  return { xml: text, outside };
}

/** The file as it is to be kept in the episode's folder at `to`: each medium in the episode's folder `episode` named by an
    address from the folder of `to`, with every awkward character as %xx. `from` is the file the text was read from, or is to
    be read as, and an address from the file is read from its folder. Media outside the episode is left as it is and listed in
    `outside`. Gives back { xml, outside }. */
export const relativeMedia = (xml, { from, to, episode }) =>
  rewritten(xml, { folder: dirname(from), episode }, (path, inEpisode) => (inEpisode ? relativeUrl(relative(dirname(to), path)) : null));

/** The file as it is handed to Final Cut on this Mac: every address from the file, read from the folder of `from`, the kept file
    it came from, written as this Mac's whole path, as Final Cut writes one. A whole path is left as it is. Every medium outside
    the episode's folder `episode` is listed in `outside`, by either kind of address. Gives back { xml, outside }. */
export const localMedia = (xml, { from, episode }) =>
  rewritten(xml, { folder: dirname(from), episode }, (path, inEpisode, src) => (path === null || WHOLE.test(src) ? null : fileUrl(path)));

/** The whole paths of the media a file names, in the order it names them, with an address from the file read from the folder
    of `from`. What is no file on this Mac, such as a web address, is left out. */
export const mediaIn = (xml, from) => [...xml.matchAll(SRC)].map((m) => pathOf(m[2], dirname(from))).filter((path) => path !== null);

/** The import options a file has already, wherever they are, with the space before them. */
const IMPORT_OPTIONS = /(?:\n[ \t]*)?<import-options\b[^>]*?(?:\/>|>[\s\S]*?<\/import-options>)/g;

/** The file with import options, first in it, as Final Cut's definition of the format asks: the library the project goes into,
    `library`, as a file:// address with no slash at its end, the one form Final Cut Pro 12.4 has opened so far; whether Final Cut copies the media into the library, `copyAssets`, or
    links them where they are, which is what is wanted, so that the raw video is never copied into a library; and whether it
    asks no questions, `suppressWarnings`. Any import options the file had are replaced. The library is refused, as the writer
    refuses it, when it is not the whole path of a name ending .fcpbundle. */
export function withImportOptions(xml, { library, copyAssets = false, suppressWarnings = true }) {
  const options = [["library location", libraryUrl(library)], ["copy assets", copyAssets ? "1" : "0"], ["suppress warnings", suppressWarnings ? "1" : "0"]]
    .map(([key, value]) => `\n        <option key="${key}" value="${attribute(value)}"/>`).join("");
  return xml.replace(IMPORT_OPTIONS, "").replace(/<fcpxml\b[^>]*>/, (head) => `${head}\n    <import-options>${options}\n    </import-options>`);
}

/** The file with its first event named `event` and its first project named `project`, written as the writer writes a name.
    Final Cut's uid on either is taken off, so that Final Cut takes the project as a new one. Nothing else is changed. */
export function retitle(xml, { event, project }) {
  const named = (text, tag, name) => text.replace(new RegExp(`<${tag}(?=[\\s/>])[^>]*>`), (head) =>
    head.replace(/\suid="[^"]*"/g, "").replace(/(\sname=")[^"]*(")/, (all, before, after) => before + attribute(name) + after));
  return named(named(xml, "event", event), "project", project);
}
