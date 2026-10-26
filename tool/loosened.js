// The one check of her folder's lock for Claude (design 2026-10-26, section 6, "One check of the lock, made by both"): what on this
// Mac has loosened it, as the lines `behind` says under LOCK_CHANGED for Jason, each in parentheses and none holding a word of any
// file. It is PR #40's check (spec 2026-10-22, section 7), moved here from edit.js, so that the guard can make it too under the open
// lock. edit.js says LOCK_CHANGED from here.
//
// On a Mac whose lock in effect is strict it is PR #40's check, and nothing more (R18). On one whose lock in effect is open
// (settings.js effectiveLock: this Mac's settings say open and OPEN_LOCK_CLAUDE is named), it also says, after PR #40's lines, what
// else could loosen the open lock (design section 1, "Modes, and the settings that could loosen it"): her folder's own settings
// compared whole with what this checkout writes for this Mac (studio.js lockBroken, R17), and in every settings source beside them
// (the user's, the managed ones, and the Claude app's --settings for this chat) any sandbox key but the few that only narrow, an
// Edit( allow rule, a WebFetch(domain:…) deny rule, memory turned on, and folders added to every session; the chat's environment, by
// its names alone; anything listening on her folder's proxy port; and a .claude, CLAUDE.md, CLAUDE.local.md or .mcp.json in the
// workshop, which a session started there would take as its own.
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { ENVIRONMENT, OPEN_LOCK_CLAUDE, lockBroken, studioFolder, workshopFolder } from "./studio.js";
import { effectiveLock, factsOf, proxyPortOf, readSettings, studioNodeOf } from "./settings.js";

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
      Code takes its managed settings from one of these only, but which one is not looked into: any of them is said.
    With the open lock in effect on this Mac (lockFor: this Mac's settings, deps.settings or else read, and deps.minimum, else
    OPEN_LOCK_CLAUDE), her folder's own settings are compared whole (lockBroken, for this Mac's facts and the node its settings
    recorded, R17), PR #40's four parts said as before and any other part in one line after PR #40's; then each settings source,
    and the Claude app's --settings for this chat (deps.appSettings), as sourceWhy says, the app's also when it turns hooks off; the
    chat's environment (deps.env, else this process's: environmentWhy); her folder's proxy port (deps.lsof, else lsof itself); and
    the workshop (workshopWhy, deps.workshopLimit entries at most). */
export function lockLoosened({ home, checkout, deps = {} }) {
  const settings = deps.settings || readSettings(home).settings || null;
  const open = lockFor(settings, deps) === "open";
  const why = [];
  let changed = [];
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
      const broken = open ? lockBroken(own, { checkout, folder, lock: "open", facts: factsFor(home, settings, deps), node: studioNodeOf(settings) }) : lockBroken(own, { checkout, folder });
      changed = Object.keys(OPEN_PARTS).filter((part) => broken.includes(part));
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
  if (!open) return why;
  // The open lock: what else could loosen it, after PR #40's lines.
  if (changed.length) why.push(`(Jason: her folder's .claude/settings.json no longer holds the open lock as this brimm-video writes it: ${changed.map((part) => OPEN_PARTS[part]).join(", ")}. Its contents are not shown here.)`);
  for (const [label, set] of [[userLabel, user], ...managed]) if (set) why.push(...sourceWhy(label, set));
  const app = deps.appSettings || null;
  if (app) {
    if (app.disableAllHooks === true) why.push(`(Jason: ${APP_LABEL} turns hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)`);
    why.push(...sourceWhy(APP_LABEL, app));
  }
  why.push(...environmentWhy(deps.env || process.env));
  const port = proxyPortOf(settings);
  if (port !== null) {
    const listening = (deps.lsof || listeners)(port);
    if (listening === null) why.push(`(Jason: whether anything listens on her folder's proxy port, ${port}, could not be checked.)`);
    else if (listening.trim()) why.push(`(Jason: something on this Mac listens on her folder's proxy port, ${port}.)`);
  }
  why.push(...workshopWhy(workshopFolder(home), deps.workshopLimit || WORKSHOP_LIMIT));
  return why;
}

/** The words that mark a name in the chat's environment as a secret's. */
export const SECRET_WORDS = ["TOKEN", "SECRET", "PASSWORD", "PASSWD", "KEY", "AUTH", "COOKIE", "CREDENTIAL", "EMAIL", "ACCOUNT", "ORGANIZATION", "SOCK"];

/** The names in the chat's environment that send Claude Code's memory to a server (design section 1, "Claude Code's memory"). */
const MEMORY_SERVER = ["CLAUDE_CODE_POST_TURN_MEMORY", "CLAUDE_CODE_MEMORY_API_TOKEN"];

/** What in the chat's environment, `env`, could loosen the open lock, as the lines for Jason, by names alone: no value is read into
    any of them. The memory server's names; CLAUDE_CODE_DISABLE_AUTO_MEMORY set to a value that turns memory on; and each name
    holding a SECRET_WORDS word, in any letter case, that is on neither of `list`'s lists (studio/environment.json: `deny`, the names
    taken from every sandboxed command, and `harmless`, those the by-hand round let be). */
export function environmentWhy(env, list = ENVIRONMENT) {
  const why = [];
  const names = Object.keys(env || {}).sort();
  for (const name of MEMORY_SERVER) if (names.includes(name)) why.push(`(Jason: this chat's environment has ${name}, which sends Claude Code's memory to a server. Its value is not shown here.)`);
  if (names.includes("CLAUDE_CODE_DISABLE_AUTO_MEMORY") && FALSE_WORDS.includes(String(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).trim().toLowerCase())) why.push("(Jason: this chat's environment turns Claude Code's memory on (CLAUDE_CODE_DISABLE_AUTO_MEMORY). Its value is not shown here.)");
  const listed = new Set([...(list.deny || []), ...(list.harmless || []), ...MEMORY_SERVER]);
  for (const name of names) {
    if (!listed.has(name) && SECRET_WORDS.some((word) => name.toUpperCase().includes(word))) why.push(`(Jason: this chat's environment has ${name}, which looks like a secret and is not on brimm-video's list. Its value is not shown here.)`);
  }
  return why;
}

/** What `lsof` prints of whatever listens on this Mac's TCP `port`: "" when nothing does (lsof then ends with 1 and prints nothing),
    or null when it cannot be run, is refused, or ends otherwise. */
function listeners(port) {
  try {
    const ran = spawnSync("/usr/sbin/lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { env: { LC_ALL: "C" }, encoding: "utf8", timeout: 5000 });
    if (ran.error) return null;
    if (ran.status === 0) return ran.stdout;
    return ran.status === 1 && !ran.stdout && !ran.stderr ? "" : null;
  } catch (e) {
    return null;
  }
}

/** How many entries of the workshop are looked through, at most. */
const WORKSHOP_LIMIT = 20000;

/** The names, in any letter case, that a session started in a folder takes as its own settings, instructions or servers. */
const SESSION_OWN = [".claude", "claude.md", "claude.local.md", ".mcp.json"];

/** What in the workshop, `workshop`, could loosen the open lock, as one line for Jason, or none: anything named as SESSION_OWN is,
    anywhere in it, a link among them (links are not followed); and so is more than `limit` entries, or a folder in it that cannot be
    looked through, since then it is not known that there is none. No workshop, nothing. */
export function workshopWhy(workshop, limit = WORKSHOP_LIMIT) {
  let seen = 0;
  const folders = [workshop];
  while (folders.length) {
    const at = folders.pop();
    let entries;
    try {
      entries = readdirSync(at, { withFileTypes: true });
    } catch (e) {
      if (at === workshop && e.code === "ENOENT") return [];
      return ["(Jason: the workshop holds a folder that could not be looked through for a .claude folder or a CLAUDE.md.)"];
    }
    for (const entry of entries) {
      if (SESSION_OWN.includes(entry.name.toLowerCase())) return ["(Jason: the workshop holds a .claude folder, a CLAUDE.md, a CLAUDE.local.md or a .mcp.json, which a session started there would take as its own.)"];
      if (++seen > limit) return ["(Jason: the workshop holds too much to look through for a .claude folder or a CLAUDE.md.)"];
      if (entry.isDirectory()) folders.push(join(at, entry.name));
    }
  }
  return [];
}

/** The Claude Code version the open lock was checked on, for a check given `deps`: a test's own (deps.minimum, null among them), else
    OPEN_LOCK_CLAUDE. */
const minimumOf = (deps = {}) => (deps.minimum !== undefined ? deps.minimum : OPEN_LOCK_CLAUDE);

/** The lock in effect on this Mac, from its settings (settings.js effectiveLock), for a check given `deps`. */
export const lockFor = (settings, deps = {}) => effectiveLock(settings, minimumOf(deps));

/** What her folder's open settings are written for on this Mac (settings.js factsOf), for a check given `deps`: a test gives its own
    temp folder and uid, so that this Mac's own are never looked at. */
export const factsFor = (home, settings, deps = {}) => factsOf(home, settings, { tmp: deps.tmp, uid: deps.uid });

/** How the Claude app's --settings for a chat is named in the lines for Jason. */
const APP_LABEL = "the Claude app's --settings for this chat";

/** The parts of her folder's own open settings that lockBroken can find changed beyond PR #40's four, as the line for Jason names them,
    in the order it names them. */
const OPEN_PARTS = { sandbox: "the sandbox's settings", permissions: "the allow and deny rules", memory: "memory off", "skill-shell": "skills' shell lines off", receipt: "the card's receipt hook", "other-hooks": "a hook beside the guard and the receipt", other: "settings brimm-video does not write there", node: "the node it was written with (this Mac's settings name none)" };

/** The sandbox's keys, in a settings source, that only narrow it, and so loosen nothing: more places it may not read or write, and
    `credentials.envVars` while every entry of it takes a name away (`mode` "deny"). Every other sandbox key loosens the lock. */
export const NARROWING = ["filesystem.denyRead", "filesystem.denyWrite", "credentials.envVars"];

/** The sandbox's keys whose own keys are named each with it, as `network.allowedDomains`. */
const PARENTS = ["network", "filesystem", "credentials"];

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Whether a sandbox key, by its path and what it holds, only narrows the sandbox (NARROWING). */
const narrows = (path, value) => (path === "credentials.envVars" ? Array.isArray(value) && value.every((entry) => isObject(entry) && entry.mode === "deny") : NARROWING.includes(path));

/** The values of CLAUDE_CODE_DISABLE_AUTO_MEMORY that do not turn memory off, in any letter case. */
const FALSE_WORDS = ["0", "false", "no", "off", ""];

/** What in a settings source, `settings`, named `label`, could loosen the open lock, as the lines for Jason: none holds a value. Each
    sandbox key but NARROWING's (one line each, sorted: a key under network, filesystem or credentials named with its parent, and any
    key a later version adds); an Edit( allow rule, which the sandbox merges into its writes (C3); a WebFetch(domain:…) deny rule,
    which brings the sandbox's proxy login back (C38); autoMemoryEnabled or autoDreamEnabled true, and an env that turns memory on
    (C37); and folders added to every session (permissions.additionalDirectories). */
export function sourceWhy(label, settings) {
  if (!isObject(settings)) return [];
  const why = [];
  const sandbox = settings.sandbox;
  if (sandbox !== undefined) {
    const paths = !isObject(sandbox) ? [["", sandbox]] : Object.entries(sandbox).flatMap(([key, value]) => (PARENTS.includes(key) && isObject(value) ? Object.entries(value).map(([inner, v]) => [`${key}.${inner}`, v]) : [[key, value]]));
    for (const path of paths.filter(([path, value]) => !narrows(path, value)).map(([path]) => path).sort()) why.push(`(Jason: ${label}: sandbox${path ? `.${path}` : ""}, which can open her folder's lock. Its contents are not shown here.)`);
  }
  const permissions = isObject(settings.permissions) ? settings.permissions : {};
  const rules = (list) => (Array.isArray(list) ? list.filter((rule) => typeof rule === "string") : []);
  if (rules(permissions.allow).some((rule) => rule.startsWith("Edit("))) why.push(`(Jason: ${label}: an Edit( allow rule, which lets sandboxed commands write there. Its contents are not shown here.)`);
  if (rules(permissions.deny).some((rule) => rule.startsWith("WebFetch(domain:"))) why.push(`(Jason: ${label}: a WebFetch(domain:…) deny rule, which brings the sandbox's proxy login back. Its contents are not shown here.)`);
  for (const key of ["autoMemoryEnabled", "autoDreamEnabled"]) if (settings[key] === true) why.push(`(Jason: ${label}: ${key} true, which turns Claude Code's memory on. Its contents are not shown here.)`);
  if (isObject(settings.env) && Object.hasOwn(settings.env, "CLAUDE_CODE_DISABLE_AUTO_MEMORY") && FALSE_WORDS.includes(String(settings.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).trim().toLowerCase())) why.push(`(Jason: ${label}: env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, which turns Claude Code's memory on. Its contents are not shown here.)`);
  const added = permissions.additionalDirectories;
  if (added !== undefined && !(Array.isArray(added) && added.length === 0)) why.push(`(Jason: ${label}: permissions.additionalDirectories, which adds folders to every session. Its contents are not shown here.)`);
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
