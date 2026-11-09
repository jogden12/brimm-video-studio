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

/** What an installed Mac is when its build.json says nothing that can be used. */
const BROKEN = { mode: "installed", version: "", build: 0, commit: "", short: "unknown", feed: "", channel: "stable", support: "", broken: true };

const HEX40 = /^[0-9a-f]{40}$/;
const SHORT = /^[0-9a-f]{7,40}$/;
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** The feed address as given, if it is an https address with nothing after the path but the path itself. Otherwise "". */
function feedOf(feed) {
  if (typeof feed !== "string") return "";
  try {
    const url = new URL(feed);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash ? feed : "";
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
