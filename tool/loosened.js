// The one check of her folder's lock for Claude (design 2026-10-26, section 6, "One check of the lock, made by both"): what on this
// Mac has loosened it, as the lines `behind` says under LOCK_CHANGED for Jason, each in parentheses and none holding a word of any
// file. It is PR #40's check (spec 2026-10-22, section 7), moved here from edit.js unchanged, so that the guard can make it too
// under the open lock. edit.js says LOCK_CHANGED from here.
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { lockBroken, studioFolder } from "./studio.js";

/** What `behind` says first when the lock on her folder for Claude has been loosened on this Mac (lockLoosened). Her skill listens
    for these words (tests/studio.test.js). */
export const LOCK_CHANGED = "This folder's lock is changed on this Mac: ask Jason before going on.";

/** Where Claude Code reads this Mac's managed settings (a Mac's folder: managed-settings.json, and managed-settings.d/*.json beside it,
    read in the order of their names). A test gives another, as `managedDir` in its deps. */
const MANAGED_DIR = "/Library/Application Support/ClaudeCode";

/** Where Claude Code reads this Mac's managed preferences, as its 2.1.308 binary says: the user's, <user>/com.anthropic.claudecode.plist,
    then the Mac's, com.anthropic.claudecode.plist, each made JSON by plutil. A test gives another folder, as `managedPrefs` in its deps. */
const MANAGED_PREFS = "/Library/Managed Preferences";
const PREFS_FILE = "com.anthropic.claudecode.plist";

/** A managed preferences file as the object Claude Code reads from it, or null: it is not there, or plutil cannot make it a JSON
    object (it is not a property list, holds a date or data, or is not a dictionary). Claude Code takes none of such a file. */
function prefsObject(file) {
  if (!lstatSync(file, { throwIfNoEntry: false })) return null;
  const made = spawnSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", "--", file], { encoding: "utf8", timeout: 5000 });
  if (made.status !== 0) return null;
  try {
    const settings = JSON.parse(made.stdout);
    return settings !== null && typeof settings === "object" && !Array.isArray(settings) ? settings : null;
  } catch (e) {
    return null;
  }
}

/** A settings file as the object Claude Code reads from it, or null: it is not there, cannot be read, is not JSON (a byte-order mark,
    a comment and a comma at the end are not JSON) or is not an object. Claude Code leaves such a file out. */
export function settingsObject(file) {
  try {
    const settings = JSON.parse(readFileSync(file, "utf8"));
    return settings !== null && typeof settings === "object" && !Array.isArray(settings) ? settings : null;
  } catch (e) {
    return null;
  }
}

/** `behind`: whether the lock on her folder for Claude has been loosened on this Mac (spec 2026-10-22, section 7), as the lines
    `behind` says under LOCK_CHANGED, for Jason, each in parentheses and none holding a word of any file; [] when it holds. The lock
    rests on a guard hook (studio.js), which these can turn off, so these files are looked at, and no other, and the folder the
    session runs in, where Claude Code reads the guard from; nothing is written.
    `home` and `deps` are the command's (deps.env, deps.managedDir, deps.managedPrefs, deps.user and deps.cwd are a test's own), and
    `checkout` is the one the guard is run from. In this order:
    - the folder the session runs in, which her skill runs `behind` in, as Claude Code runs every command, and which a locked session
      cannot change, since the guard lets only edit.js run: when this Mac has her folder, it must be that folder itself, by its real
      path. Claude Code reads .claude/settings.json only from the session's own folder, but her CLAUDE.md and her skill from the
      folders above it too, so a session in Pictures, or in a folder above hers, looks like hers and has no lock. Which folder it is
      is not said: its name may be a client's;
    - her folder's .claude/settings.local.json: anything of that name there is one, a file, a folder or a link to nowhere, and so is
      anything that cannot be looked at (a folder that may not be searched), since then it is not known that there is none;
    - her folder's own .claude/settings.json (studio.js lockBroken): it is not there, cannot be read, or is not an object; or it says
      disableAllHooks is true (absent, as main wrote the folder, it turns no hook off), no longer has the guard hook settingsOf
      writes, or no longer turns Bypass and Auto mode off. Every other difference from what is written there is only "out of date" (studioStale);
    - the user's settings, ~/.claude/settings.json, or $CLAUDE_CONFIG_DIR/settings.json when that is set (Claude Code's own): when it
      is a JSON object with disableAllHooks true, whether or not she has a folder, since hooks off would defeat the lock of one made
      later. A file that is not that is left out by Claude Code, so it turns nothing off;
    - this Mac's managed settings (MANAGED_DIR): managed-settings.json, then the files of managed-settings.d that end in .json and do
      not begin with a dot (a file or a link), in the order of their names; then its managed preferences (MANAGED_PREFS), the user's,
      then the Mac's; then the server-managed settings Claude Code keeps beside the user settings, remote-settings.json. Each when it
      sets disableAllHooks true, or allowManagedHooksOnly true, which lets only managed hooks run, and the guard is not one. Claude
      Code takes its managed settings from one of these only, but which one is not looked into: any of them is said. */
export function lockLoosened({ home, checkout, deps = {} }) {
  const why = [];
  let folder = null;
  try {
    folder = realpathSync.native(studioFolder(home));
  } catch (e) {
    // She has no folder for Claude on this Mac, so nothing in it can be there.
  }
  if (folder) {
    let cwd = null;
    try {
      cwd = realpathSync.native(deps.cwd || process.cwd());
    } catch (e) {
      // A folder not there any more is not hers.
    }
    if (cwd !== folder) {
      const where = cwd && cwd.startsWith(folder + "/") ? "a folder inside her folder for Claude, not in the folder itself," : "a folder other than her folder for Claude,";
      why.push(`(Jason: this session runs in ${where} and Claude Code reads the folder's lock only in the folder itself. Start her sessions on ~/BRIMM Video Studio itself.)`);
    }
    try {
      if (lstatSync(join(folder, ".claude", "settings.local.json"), { throwIfNoEntry: false })) why.push("(Jason: her folder has a .claude/settings.local.json of its own, which can loosen the lock. Its contents are not shown here.)");
    } catch (e) {
      if (e.code !== "ENOTDIR") why.push("(Jason: her folder's .claude/settings.local.json could not be looked for, so it is not known that there is none.)");
    }
    const own = settingsObject(join(folder, ".claude", "settings.json"));
    if (own === null) why.push("(Jason: her folder's .claude/settings.json is not there, or could not be read as a JSON object, so it is not known that the guard is on. Its contents are not shown here.)");
    else {
      const broken = lockBroken(own, { checkout, folder });
      if (broken.includes("hooks")) why.push("(Jason: her folder's .claude/settings.json turns hooks off (disableAllHooks), and the lock rests on them. Its contents are not shown here.)");
      if (broken.includes("guard")) why.push("(Jason: her folder's .claude/settings.json no longer has the guard hook this brimm-video writes for it. Its contents are not shown here.)");
      const modes = [broken.includes("bypass") && "does not disable Bypass mode (disableBypassPermissionsMode)", broken.includes("auto") && "does not disable Auto mode (disableAutoMode)"].filter(Boolean);
      if (modes.length) why.push(`(Jason: her folder's .claude/settings.json ${modes.join(" and ")}. Its contents are not shown here.)`);
    }
  }
  const [[userLabel, user], ...managed] = sources({ home, deps });
  if (user && user.disableAllHooks === true) why.push(`(Jason: ${userLabel} turns hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)`);
  for (const [label, set] of managed) {
    if (!set) continue;
    if (set.disableAllHooks === true) why.push(`(Jason: ${label}, turn hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)`);
    if (set.allowManagedHooksOnly === true) why.push(`(Jason: ${label}, allow only managed hooks (allowManagedHooksOnly), so the guard hook, which is not a managed one, does not run. Its contents are not shown here.)`);
  }
  return why;
}

/** The settings Claude Code reads on this Mac beside her folder's own, each as [label, the object read from it, or null when Claude
    Code would take none of it (settingsObject, prefsObject)], the label as `behind`'s lines name it: first the user's settings,
    "this Mac's ~/.claude/settings.json" (or $CLAUDE_CONFIG_DIR/settings.json when that is set); then each of this Mac's managed
    settings, "this Mac's managed settings, <file>": managed-settings.json and its drop-ins in MANAGED_DIR, the managed preferences in
    MANAGED_PREFS (the user's, then the Mac's), and the server-managed settings Claude Code keeps beside the user settings. */
export function sources({ home, deps = {} }) {
  const config = (deps.env || process.env).CLAUDE_CONFIG_DIR;
  const managed = deps.managedDir || MANAGED_DIR;
  let dropIns = [];
  try {
    dropIns = readdirSync(join(managed, "managed-settings.d"), { withFileTypes: true })
      .filter((e) => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith(".json") && !e.name.startsWith(".")).map((e) => `managed-settings.d/${e.name}`).sort();
  } catch (e) {
    // No drop-ins.
  }
  const prefs = deps.managedPrefs || MANAGED_PREFS;
  const account = deps.user || userInfo().username;
  const of = (file) => `this Mac's managed settings, ${file}`;
  return [
    [`this Mac's ${config ? "$CLAUDE_CONFIG_DIR" : "~/.claude"}/settings.json`, settingsObject(config ? join(config, "settings.json") : join(home, ".claude", "settings.json"))],
    ...["managed-settings.json", ...dropIns].map((file) => [of(file), settingsObject(join(managed, file))]),
    ...[join(account, PREFS_FILE), PREFS_FILE].map((file) => [of(`Managed Preferences/${file}`), prefsObject(join(prefs, file))]),
    [of(`the server-managed ones Claude Code keeps in ${config ? "$CLAUDE_CONFIG_DIR" : "~/.claude"}/remote-settings.json`), settingsObject(config ? join(config, "remote-settings.json") : join(home, ".claude", "remote-settings.json"))]
  ];
}
