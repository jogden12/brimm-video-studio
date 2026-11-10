// What kind of BRIMM Video Studio is at work: an installed Mac's (Phase 3 of the Mac app), or a git checkout (dev mode). An installed Mac
// has a build.json beside tool/, written by the app's build; a checkout has none. Anything at <checkout>/build.json means installed, even a
// file that cannot be read and even with a .git beside it: a Mac without Xcode's tools must never be sent to git by a bad file.
// This file imports only node:fs and node:path, so that every module can use it.
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export const BUILD_FILE = "build.json";

/** What to tell a Mac to do when its build file is no good. */
export const REPAIR = "Open BRIMM Video Studio and choose Repair.";
/** What to tell an installed Mac to do to get a newer BRIMM Video Studio. */
export const UPDATE_SAY = 'Say "update Studio" to update this Mac.';

/** Whether `build` (what buildOf gave) is an installed Mac's. Nothing at all counts as dev mode. */
export const isInstalled = (build) => build?.mode === "installed";

/** REPAIR, and who to ask if that does not help, when build.json names someone. */
export const repairLine = (build) => (build.support ? `${REPAIR} If that does not help, ask ${build.support}.` : REPAIR);

/** The line for a Mac whose build.json cannot be read. */
export const brokenLine = (build) => `This Mac's BRIMM Video Studio cannot read its own build file. ${repairLine(build)}`;

/** What an installed Mac is told when an episode's record was written by a newer BRIMM Video Studio than its own. */
export const NEWER_SAY = `the episode was written by a newer BRIMM Video Studio. ${UPDATE_SAY}`;

/** A failed record write's error `e`, as this Mac is to hear it. episode.js knows no build, so its NEWER error asks for Jason; on an
    installed Mac, where no Jason is at hand, that error is given again in the update's words, with its code kept. Every other error,
    and every error on a checkout, comes back as it is. Whoever prints a failed write's own message passes it through here first. */
export const forThisMac = (e, build) => (e && e.code === "NEWER" && isInstalled(build) ? Object.assign(new Error(NEWER_SAY), { code: "NEWER" }) : e);

/** The words that send a person to Jason, `dev`, as this Mac says them. On a checkout they are as they are. On an installed Mac, where no
    Jason is at hand, the support contact its build.json names stands in his place; where it names none, `bare` stands in place of the
    words (nothing, unless given), so that the line ends as a sentence. `dev` is a line's own fixed words, never a name, a path or anything
    else a person or a file gave: every "Jason" in it is changed. */
export const askWords = (build, dev, bare = "") => (!isInstalled(build) ? dev : build.support ? dev.replaceAll("Jason", build.support) : bare);

/** How a line that sends a person to Jason ends, and how an installed Mac ends it: [the checkout's last words, what stands for them where
    build.json names no support contact, what stands for them where it names one (left out where the contact simply takes Jason's place)].
    The longest come first, so that a line is taken by the most of it that fits. */
const ASK_ENDS = [
  ["; if it still says a file is not whole, a conflict needs Jason: tell him the episode's name.", ".", (support) => `; if it still says a file is not whole, a conflict needs ${support}: tell them the episode's name.`],
  [" If it is still not here later, a conflict needs Jason: tell him the episode's name.", "", (support) => ` If it is still not here later, a conflict needs ${support}: tell them the episode's name.`],
  [" than the one Jason checked: ask Jason.", " than the one that was checked.", (support) => ` than the one that was checked: ask ${support}.`],
  [" A conflict needs Jason: tell him the episode's name.", "", (support) => ` A conflict needs ${support}: tell them the episode's name.`],
  [" Tell Jason: the episode needs him.", "", (support) => ` Tell ${support}: the episode needs help.`],
  [" Jason removes it by hand if he wants.", " It can be removed there by hand.", () => " It can be removed there by hand."],
  ["; if it still says a file is not whole, tell Jason the episode's name.", "."],
  [": ask Jason to check the training setting again.", "."],
  [": ask Jason, or choose the transcript only.", ": choose the transcript only."],
  [", or ask Jason. Nothing was written.", ". Nothing was written."],
  [": ask Jason. Nothing was written.", ". Nothing was written."],
  [" Ask Jason. Nothing was written.", " Nothing was written."],
  [" If that is not what you want, tell Jason.", ""],
  [" If it says this again, tell Jason.", ""],
  ["; if it says this again, ask Jason.", "."],
  [", and ask Jason what to do with it.", "."],
  [" If it is still missing, tell Jason.", ""],
  [" If it does not come, tell Jason.", ""],
  [" If it still won't, tell Jason.", ""],
  [" Ask Jason for anything else.", ""],
  [": ask Jason to put it back.", "."],
  [", and tell Jason.", "."],
  [" and tell Jason.", "."],
  [", or ask Jason.", "."],
  [": tell Jason.", "."],
  [": ask Jason.", "."],
  [" If not, tell Jason.", ""],
  [" Tell Jason.", ""],
  [" Ask Jason.", ""]
];

/** A line this Mac's own code made, `line`, as this Mac says it. A checkout says it as it is. An installed Mac, where no Jason is at hand,
    says a line that ends by sending the person to Jason (ASK_ENDS) with the support contact its build.json names in his place, and with
    those last words left out where it names none. Only the line's last words are looked at, and they are the code's own: a name, a path or
    a sentence a person said, earlier in the line, is never changed. So this is for the lines the code makes, not for a transcript's or any
    other words it shows. Whoever says such a line passes it through here first, as a failed write's error goes through forThisMac. */
export function saidHere(line, build) {
  if (typeof line !== "string" || !isInstalled(build)) return line;
  const end = ASK_ENDS.find(([dev]) => line.endsWith(dev));
  if (!end) return line;
  const [dev, bare, named] = end;
  return line.slice(0, -dev.length) + (build.support ? (named ? named(build.support) : askWords(build, dev)) : bare);
}

/** What an installed Mac is when its build.json says nothing that can be used. */
const BROKEN = { mode: "installed", version: "", build: 0, commit: "", short: "unknown", feed: "", channel: "stable", support: "", broken: true };

const HEX40 = /^[0-9a-f]{40}$/;
const SHORT = /^[0-9a-f]{7,40}$/;
/** The form of a version: 1.2.3, or 1.2.3-beta.1. */
export const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** The feed address as given, if it is an https address with nothing after the path but the path itself. Otherwise "". */
function feedOf(feed) {
  if (typeof feed !== "string") return "";
  try {
    const url = new URL(feed);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && !/[?#]/.test(feed) ? feed : "";
  } catch (e) {
    return "";
  }
}

/** The support contact, trimmed, if it is a string of at most 200 characters with no control character. Otherwise "". */
function supportOf(support) {
  if (typeof support !== "string") return "";
  const text = support.trim();
  return text.length <= 200 && !/[\u0000-\u001f\u007f-\u009f]/.test(text) ? text : "";
}

/** Which kind of BRIMM Video Studio the folder `checkout` holds. { mode: "dev" } where it has no build.json (or is no whole path). Otherwise
    { mode: "installed", version, build, commit, short, feed, channel, support, broken }, each field checked on its own and emptied when it will
    not do; `broken` is true when the file could not be read as an object, or when version, build, short or feed fell back. Never throws. */
export function buildOf(checkout) {
  if (typeof checkout !== "string" || checkout === "" || !isAbsolute(checkout)) return { mode: "dev" };
  const file = join(checkout, BUILD_FILE);
  try {
    lstatSync(file);
  } catch (e) {
    return e && (e.code === "ENOENT" || e.code === "ENOTDIR") ? { mode: "dev" } : { ...BROKEN };
  }
  let given;
  try {
    given = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { ...BROKEN };
  }
  if (given === null || typeof given !== "object" || Array.isArray(given)) return { ...BROKEN };
  const version = typeof given.version === "string" && VERSION.test(given.version) ? given.version : "";
  const build = Number.isSafeInteger(given.build) && given.build > 0 ? given.build : 0;
  const commit = typeof given.commit === "string" && HEX40.test(given.commit) ? given.commit : "";
  const short = typeof given.short === "string" && SHORT.test(given.short) && (commit === "" || commit.startsWith(given.short)) ? given.short : "unknown";
  const feed = feedOf(given.feed);
  const channel = given.channel === "beta" ? "beta" : "stable";
  const support = supportOf(given.support);
  return { mode: "installed", version, build, commit, short, feed, channel, support, broken: version === "" || build === 0 || short === "unknown" || feed === "" };
}
