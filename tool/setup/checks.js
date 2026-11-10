// What the setup engine can tell about this Mac and its own copy of BRIMM Video Studio: whether the copy is whole, and which kind
// of Mac this is (fresh, takeover, installed, dev, or one whose settings cannot be read). It reads, and runs only ffmpeg's lists and
// codesign's check; it writes nothing.
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { buildOf, isInstalled } from "../build.js";
import { devMarked, readSettings, sameFolder, settingsFile } from "../settings.js";
import { HELPERS } from "../helpers.js";
import { hasFilters, hasHwaccel } from "../workcopy.js";

/** The programs the app carries in its tools folder (--tools): install.sh's TOOLS_PROGRAMS, then each of Studio's compiled helpers. */
export const PROGRAMS = ["node", "npm", "ffmpeg", "ffprobe", "whisper-cli", ...HELPERS.map((name) => `brimm-${name}`)];

/** What a person is told of a copy that is not whole: install.sh's DAMAGED. */
export const DAMAGED = "This copy of BRIMM Video Studio may be damaged: download it again, then open it and choose Repair.";

/** Whether `file` is a regular file that may be run. */
function runnable(file) {
  try {
    if (!statSync(file).isFile()) return false;
    accessSync(file, constants.X_OK);
    return true;
  } catch (e) {
    return false;
  }
}

/** What ffmpeg prints for one list, asked as install.sh asks. */
const listOf = (ffmpeg, flag) => {
  const ran = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", flag], { encoding: "utf8", timeout: 30000 });
  return ran.status === 0 ? String(ran.stdout) : "";
};

/** What is wrong with this copy of the app, in a few plain words that name the thing and never a path in the home, or "" when
    nothing is. In this order, the first fault stopping the look: the build file, each program, ffmpeg's ability to make an HDR video
    standard, and, when `deep`, the app's signature (a slow check, which the start of a run leaves out). `programs.codesign` is the
    program that checks the signature. */
export function copyFault({ app, tools, checkout, programs, deep = true }) {
  const build = buildOf(checkout);
  if (!isInstalled(build)) return "build.json is missing";
  if (build.broken) return "build.json cannot be read";
  for (const name of PROGRAMS) {
    const file = join(tools, name);
    if (!existsSync(file) || !statSync(file).isFile()) return `${name} is missing`;
    if (!runnable(file)) return `${name} cannot be run`;
  }
  const ffmpeg = join(tools, "ffmpeg");
  if (!hasHwaccel(listOf(ffmpeg, "-hwaccels"), "videotoolbox")) return "ffmpeg cannot make an HDR video standard (videotoolbox)";
  if (!hasFilters(listOf(ffmpeg, "-filters"), ["scale_vt"])) return "ffmpeg cannot make an HDR video standard (scale_vt)";
  if (deep) {
    const signed = spawnSync(programs.codesign, ["--verify", "--deep", "--strict", app], { encoding: "utf8", timeout: 120000 });
    if (signed.status !== 0) return "the signature does not verify";
  }
  return "";
}

/** Which kind of Mac this is, from its settings and the checkout of the copy that is running:
    fresh (no settings), unusable (settings that cannot be read, with `why` in their own words), dev (marked as Jason's development Mac,
    whatever its checkout), installed (the settings' checkout is an app's copy: this one, or `moved`, another), or takeover (anything
    else: a git clone, or a folder that is gone). */
export function kindOf({ home, checkout }) {
  if (!existsSync(settingsFile(home))) return { kind: "fresh" };
  const read = readSettings(home);
  if (read.why) return { kind: "unusable", why: read.why };
  const { settings } = read;
  if (devMarked(settings)) return { kind: "dev", settings };
  if (sameFolder(settings.checkout, checkout)) return { kind: "installed", settings, moved: false };
  if (/\.app\/Contents\/Resources\/Studio\/?$/.test(settings.checkout)) return { kind: "installed", settings, moved: true };
  return { kind: "takeover", settings };
}
