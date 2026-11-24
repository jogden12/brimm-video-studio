// The HyperFrames app's version, read from its Info.plist, the Mac's record of the last one seen, and the one line `reelkit app` says
// when it differs from the one a project was last opened with (reel-kit-commands.js). The app updates itself about six times a day,
// and a Reel Kit project is edited against one version of it.
// Two copies of the app may be on a Mac (/Applications and ~/Applications); the first is /Applications, which macOS prefers.
// The plist is read by /usr/bin/plutil, which tests stand in (`run`). The last version seen is kept in
// Application Support, written whole (a temp file, then a rename).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const PLIST = "HyperFrames.app/Contents/Info.plist";
/** How long plutil may take for one copy: a reading that hangs never holds up `reelkit app`. */
const PLUTIL_MS = 5000;

/** The two places the app may be, /Applications first. */
export const appPlists = (home) => [join("/Applications", PLIST), join(home, "Applications", PLIST)];

/** Where the last version seen is kept, on this Mac's own disk. */
export const appVersionFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "app-version.json");

/** What each copy of the app says it is. A copy whose plist is missing or unreadable is left out. `version` and `build` are
    the first copy's; with no copy they are empty. */
export function readAppVersion({ home, run = spawnSync } = {}) {
  const copies = [];
  for (const path of appPlists(home)) {
    try {
      const r = run("/usr/bin/plutil", ["-convert", "json", "-o", "-", path], { encoding: "utf8", timeout: PLUTIL_MS });
      if (!r || r.status !== 0) continue;
      const plist = JSON.parse(String(r.stdout));
      const version = plist?.CFBundleShortVersionString, build = plist?.CFBundleVersion;
      if (typeof version !== "string" || !version) continue;
      copies.push({ path, version, build: typeof build === "string" ? build : "" });
    } catch { /* unreadable: left out */ }
  }
  return { version: copies[0]?.version ?? "", build: copies[0]?.build ?? "", copies };
}

/** Notes the version just seen. `changed` is true when an earlier one was kept and this differs; the first one ever seen is not a
    change, and nothing seen writes nothing. What is seen is kept whole, so the change is said once. */
export function noteAppVersion(home, seen) {
  if (!seen?.version) return { changed: false, was: "" };
  const file = appVersionFile(home);
  let was = "";
  try {
    const kept = JSON.parse(readFileSync(file, "utf8"));
    if (typeof kept?.version === "string") was = kept.version;
  } catch { /* none kept yet, or unreadable: as if the first */ }
  if (was === seen.version) return { changed: false, was: "" };
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.writing`;
  writeFileSync(temp, JSON.stringify({ version: seen.version, build: seen.build ?? "", at: new Date().toISOString() }, null, 2) + "\n");
  renameSync(temp, file);
  return was ? { changed: true, was } : { changed: false, was: "" };
}

/** The one line to say, or nothing: said only when there was an earlier version and there is one now. With two copies of
    different versions it names both. */
export function appVersionLine({ was, now, copies = [] }) {
  if (!was || !now) return "";
  let line = `HyperFrames was updated since this project was last opened (${was} to ${now}): check that it plays before you change it.`;
  const versions = new Set(copies.map((c) => c.version));
  if (copies.length > 1 && versions.size > 1) {
    line += ` There are two copies on this Mac: ${copies.map((c) => `${c.version} in ${c.path.startsWith("/Applications/") ? "Applications" : "your Applications folder"}`).join(" and ")}.`;
  }
  return line;
}
