// The reference folder (design 2026-11-03, section 7; PR H3): one folder in Dropbox, References, in BRIMM Video, of screenshots and
// pictures of post styles that Sallie adds to from her laptop, the Mac Studio or her phone, and names when she wants one followed.
// It is a style reference and not a source: Claude looks at a picture and writes its look into what it makes, and nothing of someone
// else's post is copied into hers. HyperFrames analyses posts itself, and Studio does not do that again.
//
// STUDIO ONLY READS THE FOLDER. It lists it, finds a picture in it by the name she says, and copies a picture out of it: to Looking/,
// inside her BRIMM Video Studio folder, for Claude to look at (`refs look`), and into an episode's HyperFrames project on this Mac as
// brimm/references/<file> (`refs use`, and a project made from cues that name a picture). Nothing is written into the folder, or
// renamed, moved or deleted in it, and nothing is made in it: a copy is made in a folder of this Mac's own and moved into place. The
// folder is in Dropbox, so a file in it may be there only as a placeholder: it is read to its end first (a little while, as `bring`
// does for an episode's files), and a file that is not whole yet is not used.
//
// Claude reads only PNG, JPEG, GIF and WebP pictures. A HEIC or TIFF picture is copied as a JPEG of the same stem, made with macOS's
// own sips (never written over the original: `--out` is always given), whether it goes to Looking/ or into a project. The copy is
// made whole before it is moved into place, so a copy that fails leaves nothing in the place it was for, and a picture of the same
// name there is replaced by a move, never written into.
//
// edit.js is only the wiring (refs); this module says what the command says, and does what it does. What it says goes into her chat,
// so it holds no path, no flag and no name of a command. The exceptions are the line that is for Claude, `Picture to look at: <path>`,
// which her skill tells Claude never to repeat to her, and the words she is to say in HyperFrames, which name the picture in the
// project.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { readThrough } from "./dropbox.js";
import { runProgram } from "./run.js";
import { referencesFolder, workFolder } from "./settings.js";
import { studioFolder } from "./studio.js";

/** The kinds of file that are pictures in the reference folder. Anything else in it is left alone, and listed as a file Studio does not
    use (a video, a note, a PDF). */
export const REFERENCE_KINDS = Object.freeze([".png", ".jpg", ".jpeg", ".heic", ".webp", ".gif", ".tif", ".tiff"]);
/** The kinds Claude cannot read as they are: they are copied as a JPEG (projectNameOf). */
const TURNED_KINDS = Object.freeze([".heic", ".tif", ".tiff"]);
/** macOS's own picture program, which makes the JPEG, and how long it may take over one picture: a minute. */
export const SIPS = "/usr/bin/sips";
const SIPS_MS = 60 * 1000;
/** How long a read that asks Dropbox to bring a picture down may go with nothing coming: a picture is small, so 20 seconds. */
const BRING_MS = 20 * 1000;

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

/** What `said` names among the pictures of a listing (listReferences'): { file }, { several: [names] }, or { none: true, pictures }. */
function choose(listed, said) {
  const found = pick(listed.pictures, said);
  return found.none ? { none: true, pictures: listed.pictures } : found;
}

/** The picture of the reference folder `folder` that `said` names: { file }, { several: [names] } when more than one fits, or { none:
    true, pictures } when none does, `pictures` being all there are. Only pictures are looked among, so the stem of a video is none
    (the command tells her it is no picture, from the listing's `others`). */
export function findReference(folder, said) {
  return choose(listReferences(folder) ?? { pictures: [], others: [] }, said);
}

/** The name a picture of the reference folder has once Claude can read it, in Looking/ and in a project: a HEIC or TIFF picture is a
    JPEG of the same stem, and every other keeps its name. */
export function projectNameOf(file) {
  const kind = extname(file).toLowerCase();
  return TURNED_KINDS.includes(kind) ? `${file.slice(0, file.length - kind.length)}.jpg` : file;
}

/** The pictures that a list of graphic cues names by a `ref` in their style (graphic-cues.js), by the names the cues give them, each once (a
    name that is the same for a person, as sameName says, counts once, in the first spelling) and in the order the cues come. Anything that
    is not a cue, or whose style names an inspiration or a link, or none, names none. */
export function refNamesOf(cues) {
  const names = [];
  for (const cue of Array.isArray(cues) ? cues : []) {
    const ref = cue?.style?.ref;
    if (typeof ref === "string" && ref !== "" && !names.some((name) => sameName(name, ref))) names.push(ref);
  }
  return names;
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

// --- What is said ---

/** What `refs` says when this Mac has no reference folder (the installer makes it, on Jason's yes), and what it says of an empty one. */
export const NO_FOLDER = "There's no reference folder on this Mac yet: ask Jason.";
const ADD = "Add screenshots or pictures to References, in the BRIMM Video folder in Dropbox.";
export const EMPTY = `The reference folder is empty. ${ADD}`;
/** What is said of a picture that is online only in Dropbox and has not come down. */
export const COMING = "It's still coming down from Dropbox. Say it again in a minute.";
/** What is said of a picture Studio could not turn into one Claude can read. */
export const cannotUse = (file) => `It can't be used: Studio couldn't turn ${file} into a picture it can read.`;

/** Things as they are said in a row: "a", "a and b", "a, b and c" (with `word` "or", "a or b"). */
const joined = (things, word = "and") => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} ${word} ${things[things.length - 1]}`);
/** A count with its noun: "1 picture", "3 pictures". */
const counted = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};

// --- Reading a picture out of the folder ---

/** `refs`: what is in the reference folder, and the files in it that are not pictures. Ends with 0, or with 1 when there is no folder. */
export function sayReferences(ctx) {
  const listed = listReferences(referencesFolder(ctx.root));
  if (!listed) return refuse(ctx, NO_FOLDER);
  const { pictures, others } = listed;
  if (!pictures.length && !others.length) {
    ctx.say(EMPTY);
    return 0;
  }
  ctx.say(pictures.length ? `The reference folder has ${counted(pictures.length, "picture", "pictures")}: ${joined(pictures)}.` : `The reference folder has no pictures yet. ${ADD}`);
  if (others.length) ctx.say(`${pictures.length ? "It also holds" : "It holds"} ${counted(others.length, "file that isn't a picture", "files that aren't pictures")}, which Studio doesn't use: ${joined(others)}.`);
  return 0;
}

/** The picture of the reference folder that `said` names: { folder, file }, or { code } when it is none, having said why: there is no
    folder, which one it is (several fit), that the file she named is no picture, or that there is no such picture and which there are. */
function pictureNamed(ctx, said) {
  const folder = referencesFolder(ctx.root);
  const listed = listReferences(folder);
  if (!listed) return { code: refuse(ctx, NO_FOLDER) };
  const found = choose(listed, said);
  if (found.file) return { folder, file: found.file };
  if (found.several) return { code: refuse(ctx, `Which one? ${joined(found.several, "or")}`) };
  const other = pick(listed.others, said);
  const files = other.file ? [other.file] : other.several ?? [];
  if (files.length) return { code: refuse(ctx, `${joined(files)} ${files.length === 1 ? "isn't a picture" : "aren't pictures"}, so Studio doesn't use ${files.length === 1 ? "it" : "them"}.`) };
  return { code: refuse(ctx, found.pictures.length ? `There's no "${said}" in the reference folder. It has: ${joined(found.pictures)}.` : `There's no "${said}" in the reference folder, which has no pictures yet.`) };
}

/** Whether the picture at `path` is here whole. One that is online only in Dropbox is read to its end first, for up to BRING_MS with
    nothing coming, which has Dropbox bring all of it down (`bring` does so for an episode's files), and is looked at again. `ctx.deps.readAll`
    is a test's stand-in for the read. */
async function brought(ctx, path) {
  if (ctx.isWhole(path)) return true;
  try {
    await (ctx.deps.readAll || readThrough)(path, { quietMs: BRING_MS });
  } catch (e) {
    // Dropbox did not bring it in that time, or it cannot be read: it is still coming, and she is told so.
  }
  return ctx.isWhole(path);
}

// --- Making a picture Claude can read ---

/** A folder of this Mac's own, in BRIMM Video Work, to make a copy in before it is moved into place: so a copy that fails leaves nothing
    where it was for. The caller takes it away. */
function stagingFolder(ctx) {
  mkdirSync(workFolder(ctx.home), { recursive: true });
  return mkdtempSync(join(workFolder(ctx.home), ".reference-"));
}

/** The picture `from` of the reference folder, made one Claude can read in the folder `stage`, under projectNameOf its name: { name,
    path }, or { cannot: true } when sips could not turn it into a JPEG (it failed, wrote nothing or ran out of time), or { error }, the
    code of what stopped a copy. A PNG, JPEG, GIF or WebP is copied as it is; a HEIC or TIFF picture is made a JPEG by sips, told with
    --out where to write, so that the original is never written over. Nothing is written in the reference folder. `ctx.deps.run` and
    `ctx.deps.tools.sips` are the Mac's own unless a test gives others. */
async function readableIn(ctx, from, stage) {
  const file = basename(from);
  const name = projectNameOf(file);
  const path = join(stage, name);
  try {
    if (name === file) copyFileSync(from, path);
    else {
      const ran = await (ctx.deps.run || runProgram)(ctx.deps.tools?.sips || SIPS, ["-s", "format", "jpeg", from, "--out", path], { limit: SIPS_MS });
      if (ran.code !== 0 || ran.outOfTime || !existsSync(path)) return { cannot: true };
    }
  } catch (e) {
    return { error: e.code || "an error" };
  }
  return { name, path };
}

/** The picture `from` of the reference folder, made one Claude can read (readableIn) and put in the folder `dir` under that name, made if
    it is not there, a picture of that name there replaced by a move: { name }, or { cannot: true } or { error } as readableIn has it, in
    which case `dir` is as it was (but for a folder made for it). */
async function readableCopy(ctx, from, dir) {
  let stage;
  try {
    stage = stagingFolder(ctx);
    const made = await readableIn(ctx, from, stage);
    if (made.name === undefined) return made;
    mkdirSync(dir, { recursive: true });
    renameSync(made.path, join(dir, made.name));
    return { name: made.name };
  } catch (e) {
    return { error: e.code || "an error" };
  } finally {
    if (stage) rmSync(stage, { recursive: true, force: true });
  }
}

/** `refs look "<name>"`: the picture of that name copied into Looking/, in her BRIMM Video Studio folder, for Claude to look at, and the
    one line that says where, for Claude: `Picture to look at: <path>`. Her skill tells Claude to look at the picture and never to repeat
    the path to her. Ends with 0, or with 1, having said why: no folder, no such picture or which one, no picture, still coming down from
    Dropbox, or one that could not be turned into a JPEG. */
export async function lookAt(ctx, said) {
  const named = pictureNamed(ctx, said);
  if (named.code !== undefined) return named.code;
  const from = join(named.folder, named.file);
  if (!(await brought(ctx, from))) return refuse(ctx, COMING);
  const looking = lookingFolder(ctx.home);
  const made = await readableCopy(ctx, from, looking);
  if (made.cannot) return refuse(ctx, cannotUse(named.file));
  if (made.error) return refuse(ctx, `${named.file} could not be copied for Claude to look at (${made.error}).`);
  ctx.say(`Picture to look at: ${join(looking, made.name)}`);
  return 0;
}

/** `refs use` once edit.js has found the project: the picture of that name copied into the project folder `dir` as brimm/references/
    <file>, and what she is to say in HyperFrames to have it followed. `who` names the project as her words do: "<episode>" or "Reel 2 of
    <episode>". Only that one file is made, replacing one of the same name; no other file of the project is touched, and nothing asks
    whether the app has the project open. Ends with 0, or with 1, having said why, as `refs look` does. */
export async function useIn(ctx, { dir, who }, said) {
  const named = pictureNamed(ctx, said);
  if (named.code !== undefined) return named.code;
  const from = join(named.folder, named.file);
  if (!(await brought(ctx, from))) return refuse(ctx, COMING);
  const made = await readableCopy(ctx, from, join(dir, "brimm", "references"));
  if (made.cannot) return refuse(ctx, cannotUse(named.file));
  if (made.error) return refuse(ctx, `${named.file} could not be copied into the HyperFrames project (${made.error}).`);
  const stem = made.name.slice(0, made.name.length - extname(made.name).length);
  ctx.say(`The ${stem} is in the HyperFrames project for ${who}. In HyperFrames, say "Use brimm/references/${made.name} as the style for the graphics".`);
  return 0;
}

// --- A project made from cues that name a picture ---

/** What is said, when a project is made, of a picture its cues name that the project does not have: the cue keeps its style, and she is told. */
const projectHasNone = {
  noFolder: (ref) => `There's no reference folder on this Mac yet, so the project has no copy of "${ref}": ask Jason.`,
  notThere: (ref) => `"${ref}" isn't in the reference folder, so the project has no copy of it.`,
  coming: (file) => `"${file}" is still coming down from Dropbox, so the project has no copy of it yet: once it is here, say "use ${file} from the reference folder as a style reference".`,
  error: (file, code) => `"${file}" could not be copied for the project (${code}), so the project has no copy of it.`
};

/** Make a project that has the pictures its cues name (PR H3): `names` are those the cues name (refNamesOf), each looked for in the reference
    folder by its name as the cue spells it (the same for a person, as sameName says; not a part of a name), brought if it is online only,
    and made one Claude can read in a folder of this Mac's own. Then `make(references)` is called, with [{ name, path }] for each picture
    that is there (name the file's, path the file made), as projectFiles takes them, while those files are still there; and they are taken
    away after, whatever `make` does. What `make` gives back is given back. A picture that is not there (no folder, not in it, still coming
    down from Dropbox, one that could not be turned into a JPEG or copied) is left out and said, once, in her words: the cue keeps its style.
    With no names there is nothing to look for and nothing is said or touched. Nothing is written in the reference folder. */
export async function withReferences(ctx, names, make) {
  if (!names.length) return make([]);
  let stage;
  try {
    stage = stagingFolder(ctx);
  } catch (e) {
    for (const ref of names) ctx.say(projectHasNone.error(ref, e.code || "an error"));
    return make([]);
  }
  try {
    const folder = referencesFolder(ctx.root);
    const listed = listReferences(folder);
    const references = [];
    for (const ref of names) {
      const file = listed?.pictures.find((picture) => sameName(picture, ref));
      if (!listed) ctx.say(projectHasNone.noFolder(ref));
      else if (!file) ctx.say(projectHasNone.notThere(ref));
      else if (!(await brought(ctx, join(folder, file)))) ctx.say(projectHasNone.coming(file));
      else {
        const made = await readableIn(ctx, join(folder, file), stage);
        if (made.cannot) ctx.say(cannotUse(file));
        else if (made.error) ctx.say(projectHasNone.error(file, made.error));
        else references.push({ name: file, path: made.path });
      }
    }
    return await make(references);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
