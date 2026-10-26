// The one check of her folder's lock for Claude (design 2026-10-26, section 6, "One check of the lock, made by both"): what on this
// Mac has loosened it, as the lines `behind` says under LOCK_CHANGED for Jason, each in parentheses and none holding a word of any
// file. It is PR #40's check (spec 2026-10-22, section 7), moved here from edit.js, so that the guard can make it too under the open
// lock. edit.js says LOCK_CHANGED from here.
//
// On a Mac whose lock in effect is strict it is PR #40's check, and nothing more (R18). On one whose lock in effect is open
// (settings.js effectiveLock: this Mac's settings say open and OPEN_LOCK_CLAUDE is named), it also says, after PR #40's lines, what
// else could loosen the open lock (design section 1, "Modes, and the settings that could loosen it"):
// - her folder's own settings, compared whole with what this checkout writes for this Mac (studio.js lockBroken, R17);
// - in every settings source beside them (the user's, the managed ones, and the Claude app's --settings for this chat): any sandbox
//   key but the few that only narrow, an Edit( allow rule, a WebFetch(domain:…) deny rule, memory turned on, folders added to every
//   session, and a SessionStart hook, which can change the chat's id that the marks of a session's words rest on (C24);
// - her user settings' Read deny rules for the gated places, where this Mac's settings note that `settings.js user-deny` added them;
// - the Claude app's own flags on the chat (C30), read from the Claude Code above this check, found by walking up its own processes
//   with `ps` (chain.js), and the folders added to the chat while it ran, read from its transcript a little at a time (scan.js);
// - the chat's environment, by its names alone; anything listening on her folder's proxy port; a .claude, CLAUDE.md, CLAUDE.local.md
//   or .mcp.json in the workshop; and an enabled plugin carrying hooks or a mod, or a skill her folder allows whose SKILL.md registers
//   hooks, since those run outside the sandbox (C16, C22);
// - an agent definition where Claude Code would load one, named as one of its own agents, which it would replace (and the never list
//   lets through by that name), or asking in its front matter for its own isolation, hooks, MCP servers or permission mode;
// - Claude Code keeping its settings and chats somewhere other than ~/.claude (CLAUDE_CONFIG_DIR), where no gated place holds them;
//   and a time her folder kept the open shape under the strict lock (held.js strictSeen), whose chats may have left a session's words
//   in command output, until settings.js studio writes the open lock again.
// Under Claude Code the session's folder is then judged by where its transcript is kept, not by the folder its commands run in (R30).
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { userInfo } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { ALLOW_DEFAULT, APP_FLAGS, ENVIRONMENT, OPEN_LOCK_CLAUDE, gatedReadRules, lockBroken, studioFolder, workshopFolder } from "./studio.js";
import { effectiveLock, factsOf, proxyPortOf, readSettings, studioAllowOf, studioNodeOf } from "./settings.js";
import { appVersionOf, argsOf, chainUp, claudeAbove, processTable, readProcesses } from "./chain.js";
import { claudeDirName, fold, realOf } from "./places.js";
import { BUILT_IN_AGENTS } from "./never.js";
import { SESSION_ID, scanTranscript } from "./scan.js";
import { strictSeen } from "./held.js";

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
    and, where this Mac's settings note that `settings.js user-deny` added them (userDeny), the user settings' Read deny rules;
    and the Claude app's --settings for this chat (deps.appSettings), as sourceWhy says, the app's also when it turns hooks off; the
    chat's environment (deps.env, else this process's: environmentWhy); her folder's proxy port (deps.lsof, else lsof itself); and
    the workshop (workshopWhy, deps.workshopLimit entries at most); enabled plugins (pluginsWhy); the skills her folder allows
    (skillsWhy); agent definitions (agentsWhy); the Claude app's flags on this chat (appWhy, from deps.ps, else `ps` itself, walked up from deps.pid, else this
    process, against deps.appFlags, else APP_FLAGS), its --settings among them, which deps.appSettings stands in for when given; and,
    under Claude Code (CLAUDECODE=1, or a claude above), the folders added to the chat while it ran (addedWhy, from deps.transcript,
    else the transcript of CLAUDE_CODE_SESSION_ID in her folder's projects folder); and, last, Claude Code keeping its settings and
    chats outside ~/.claude, and a time her folder kept the open shape under the strict lock (beyondWhy). On an open-lock Mac, under
    Claude Code with a chat's id, the session runs in her folder when that transcript is there and the folder it runs in is hers or one inside it (R30);
    otherwise, and on a strict Mac, when the folder it runs in is hers. */
export function lockLoosened({ home, checkout, deps = {} }) {
  const settings = deps.settings || readSettings(home).settings || null;
  const open = lockFor(settings, deps) === "open";
  const env = deps.env || process.env;
  // On an open-lock Mac, the processes above this check (chain.js), null when they could not be read, and the Claude Code among them.
  const table = open ? (deps.ps || readProcesses)() : null;
  const claude = table === null ? null : claudeAbove(chainUp(processTable(table), deps.pid !== undefined ? deps.pid : process.pid));
  // Under Claude Code by its CLAUDECODE, or by a claude above, since a command can take CLAUDECODE out of its own environment.
  const underClaude = env.CLAUDECODE === "1" || claude !== null;
  const sessionId = env.CLAUDE_CODE_SESSION_ID;
  const why = [];
  let changed = [];
  let folder = null;
  try {
    folder = realpathSync.native(studioFolder(home));
  } catch (e) {
    // She has no folder for Claude on this Mac, so nothing in it can be there.
  }
  const transcript = deps.transcript !== undefined ? deps.transcript : transcriptOf({ home, env, folder, sessionId });
  if (folder) {
    let cwd = null;
    try {
      cwd = realpathSync.native(deps.cwd || process.cwd());
    } catch (e) {
      // A folder not there any more is not hers.
    }
    // Under Claude Code on an open-lock Mac, a sandboxed `cd` may have moved the folder its commands run in (R30): the session is hers
    // when its transcript is kept in her folder's own projects folder and its commands run in her folder or a folder inside it. Both,
    // since a projects folder's name folds every letter but A-Z, a-z and 0-9 into "-" (claudeDirName): a chat started in
    // ~/BRIMM-Video-Studio keeps its transcript there too, with no guard and no sandbox.
    const inside = cwd !== null && (cwd === folder || cwd.startsWith(folder + "/"));
    const hers = open && underClaude && sessionId !== undefined ? isFile(transcript) && inside : cwd === folder;
    if (!hers) {
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
  if (settings && settings.userDeny === true && !userDenyHeld(user, factsFor(home, settings, deps))) why.push(USER_DENY_LOST);
  let app = deps.appSettings !== undefined ? deps.appSettings : null;
  if (table === null) why.push("(Jason: this chat's processes could not be read, so the Claude app's flags on it are not known.)");
  else {
    const found = appWhy({ claude, underClaude, folder, home, record: deps.appFlags || APP_FLAGS, minimum: minimumOf(deps) });
    why.push(...found.lines);
    if (deps.appSettings === undefined) app = found.settings;
  }
  if (app) {
    if (app.disableAllHooks === true) why.push(`(Jason: ${APP_LABEL} turns hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)`);
    why.push(...sourceWhy(APP_LABEL, app));
  }
  if (underClaude) why.push(...addedWhy({ home, sessionId, transcriptPath: transcript }));
  why.push(...pluginsWhy({ home, settingsList: [user, ...managed.map(([, set]) => set), app] }));
  if (folder) why.push(...skillsWhy({ home, folder, allow: [...ALLOW_DEFAULT, ...studioAllowOf(settings)] }));
  why.push(...agentsWhy({ home, folder, env: deps.env || process.env }));
  why.push(...environmentWhy(deps.env || process.env));
  const port = proxyPortOf(settings);
  if (port !== null) {
    const listening = (deps.lsof || listeners)(port);
    if (listening === null) why.push(`(Jason: whether anything listens on her folder's proxy port, ${port}, could not be checked.)`);
    else if (listening.trim()) why.push(`(Jason: something on this Mac listens on her folder's proxy port, ${port}.)`);
  }
  why.push(...workshopWhy(workshopFolder(home), deps.workshopLimit || WORKSHOP_LIMIT));
  why.push(...beyondWhy({ env, home }));
  return why;
}

/** Whether `config`, CLAUDE_CONFIG_DIR, is the very folder ~/.claude is: an absolute path, both there, and one by their identity
    (device and inode). Names are never compared: one that folds to .claude (fold) may be a folder macOS keeps apart. */
function homeClaude(config, home) {
  if (!isAbsolute(config)) return false;
  try {
    const given = statSync(config, { bigint: true });
    const own = statSync(join(home, ".claude"), { bigint: true });
    return given.dev === own.dev && given.ino === own.ino;
  } catch (e) {
    return false;
  }
}

/** What loosens the open lock beyond the checks above, as lines for Jason: Claude Code keeping this chat's settings and transcripts
    somewhere other than ~/.claude (CLAUDE_CONFIG_DIR in `env`), which no gated place holds, a folder that is not there, or ~/.claude
    itself not there, among them; and a time her folder kept the open shape under the strict lock (held.js noteStrictSeen), whose
    chats may have left a session's words in command output, until settings.js studio writes the open lock again. The environment's
    value is never said. */
export function beyondWhy({ env, home }) {
  const why = [];
  const config = (env || {}).CLAUDE_CONFIG_DIR;
  if (config && !homeClaude(config, home)) {
    why.push("(Jason: Claude Code keeps this chat's settings and transcripts outside ~/.claude (CLAUDE_CONFIG_DIR), where the lock holds nothing. Its value is not shown here.)");
  }
  if (strictSeen(home)) why.push("(Jason: her folder kept the open lock's settings for a time while this Mac's lock was strict, when a session's words could go into command output that chats with the open lock can read. Run node tool/settings.js studio again.)");
  return why;
}

/** What `behind` says when her user settings no longer hold the Read deny rules `settings.js user-deny` added to them (question 5). */
const USER_DENY_LOST = "(Jason: her user settings, ~/.claude/settings.json, no longer hold every Read deny rule brimm-video added for the places only it reads. Its contents are not shown here.)";

/** Whether her user settings, `user` (the object Claude Code reads, or null), still deny Claude's Read every gated place on the Mac
    `facts` describes, as `settings.js user-deny` added them (studio.js gatedReadRules). Looked at only where this Mac's settings note
    that they were added (userDeny), on an open-lock Mac. */
function userDenyHeld(user, facts) {
  const deny = isObject(user) && isObject(user.permissions) && Array.isArray(user.permissions.deny) ? user.permissions.deny : [];
  return gatedReadRules(facts).every((rule) => deny.includes(rule));
}

/** Where Claude Code keeps the transcript of the chat `sessionId` started in her folder, `folder` (R30): in its projects folder
    ($CLAUDE_CONFIG_DIR/projects when that is set, else ~/.claude/projects), in her folder's own subfolder of it. null when she has no
    folder, or the id is not a chat's id, which is never put into a path. */
function transcriptOf({ home, env, folder, sessionId }) {
  if (!folder || typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return null;
  const projects = env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, "projects") : join(home, ".claude", "projects");
  const file = join(projects, claudeDirName(folder), `${sessionId}.jsonl`);
  return dirname(dirname(file)) === projects ? file : null;
}

/** Whether `path` is a file that is there. */
const isFile = (path) => typeof path === "string" && Boolean(lstatSync(path, { throwIfNoEntry: false })?.isFile());

/** The app's notes folders' folder, in which the Code tab makes one folder for each session and adds it to the session (C30). */
const notesRoot = (home) => join(home, "Library", "Application Support", "Claude", "side-session-notes");

/** Whether `dir` is one of the app's notes folders: one folder directly in notesRoot, spelled by its real path, and not a link. */
function isNotes(dir, home) {
  if (typeof dir !== "string" || !isAbsolute(dir) || dirname(dir) !== notesRoot(home) || !plainName(basename(dir))) return false;
  if (lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) return false;
  return realOf(dir) === dir;
}

/** Claude Code's own option names, as its 2.1.308 binary lists the options of `claude` itself. A flag outside the record is named in
    the lines for Jason only when it is one of these: anything else after a " --" may be a word of a flag's value, as `--final` in
    `--add-dir=/x/Smith --final`, and is said without its words. */
export const KNOWN_FLAGS = [
  "--add-dir", "--advisor", "--agent", "--agent-color", "--agent-id", "--agent-name", "--agent-type", "--agents",
  "--allow-dangerously-skip-permissions", "--allow-other-models", "--allowed-tools", "--allowedTools",
  "--append-subagent-system-prompt", "--append-subagent-system-prompt-file", "--append-system-prompt", "--append-system-prompt-file",
  "--attach-serve", "--autocompact", "--await-claim", "--await-initialize", "--ax-screen-reader", "--background", "--bare",
  "--betas", "--bg", "--brief", "--channels", "--chrome", "--client-data-url", "--cloud", "--continue", "--correlation-id",
  "--dangerously-load-development-channels", "--dangerously-skip-permissions", "--debug", "--debug-file", "--debug-to-stderr",
  "--deep-link-cwd-b64", "--deep-link-last-fetch", "--deep-link-origin", "--deep-link-repo", "--desktop", "--disable-slash-commands",
  "--disallowed-tools", "--disallowedTools", "--effort", "--enable-auth-status", "--enable-auto-mode", "--environment",
  "--exclude-dynamic-system-prompt-sections", "--exec", "--fallback-model", "--fast-mode", "--file", "--fork-session",
  "--forward-home-settings", "--forward-subagent-text", "--from-pr", "--handle-uri", "--hard-fail", "--help",
  "--host-auth-is-org-sign-in", "--ide", "--include-hook-events", "--include-partial-messages", "--include-unsupported-models",
  "--inherit-permission-mode", "--init", "--init-only", "--input-format", "--json-schema", "--maintenance", "--managed-settings",
  "--max-budget-usd", "--max-thinking-tokens", "--max-turns", "--mcp-config", "--messaging-socket-path", "--model", "--name",
  "--no-chrome", "--no-session-persistence", "--on-branch", "--output-format", "--parent-session-id", "--permission-mode",
  "--permission-prompt-tool", "--permission-prompts", "--plan-mode-instructions", "--plan-mode-required", "--plugin-dir",
  "--plugin-dir-no-mcp", "--plugin-url", "--pool", "--prefill", "--prefill-b64", "--print", "--proactivity", "--project",
  "--project-config-root", "--prompt-suggestions", "--rc", "--ref", "--remote", "--remote-control",
  "--remote-control-session-name-prefix", "--replay-user-messages", "--reply-on-resume", "--restricted", "--resume",
  "--resume-drops-turn", "--resume-session-at", "--rewind-files", "--routine", "--runner-declares", "--safe-mode", "--sdk-url",
  "--session-id", "--session-mirror", "--setting-sources", "--settings", "--strict-mcp-config", "--system-prompt",
  "--system-prompt-file", "--system-prompt-snapshot", "--task-budget", "--team-name", "--teammate-mode", "--teleport", "--thinking",
  "--thinking-display", "--tmux", "--tools", "--verbose", "--version", "--watch-artifact", "--watch-artifact-no-autoreact",
  "--workload", "--worktree"
];

/** Whether the Claude Code version `version` is older than `minimum`, part by part. */
function older(version, minimum) {
  const a = version.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  }
  return false;
}

/** The app's --settings, `value`, as the object it holds, or null when it cannot be read as one: JSON when it starts with {, otherwise
    a whole path to a file of it. */
function appSettingsOf(value) {
  if (typeof value !== "string") return null;
  if (value.trim().startsWith("{")) {
    try {
      const settings = JSON.parse(value);
      return isObject(settings) ? settings : null;
    } catch (e) {
      return null;
    }
  }
  return isAbsolute(value) ? settingsObject(value) : null;
}

/** What the Claude app's own flags on this chat could loosen (C30), from `claude`, the Claude Code above the check (chain.js), or null
    when none was found: { lines, settings }, the lines for Jason, none holding a flag's value, and the app's --settings for this chat
    as the object it holds (for sourceWhy), or null. With no claude above, a check run by hand in Terminal (`underClaude` false) has
    no flags to read; under Claude Code (the guard, or `behind` with CLAUDECODE=1) one not found is loosened, as a renamed binary or
    Claude Code run as node …/cli.js would be, since its flags and version are not known (R26). Otherwise: a flag not in `record`
    (studio/app-flags.json, which the by-hand round makes); --project-config-root other than her folder, `folder`, by its real path;
    --setting-sources other than user,project,local; an --allowedTools rule that is not a connector's tool; a --settings that cannot
    be read; any --add-dir but the app's notes folder (isNotes); and, while `minimum` is named, a version older than it, or none that
    can be read from the executable's path, which must be her app's own copy in `home` (chain.js appVersionOf), by its real path. */
export function appWhy({ claude, underClaude, folder, home, record, minimum }) {
  if (!claude) return { lines: underClaude ? ["(Jason: the Claude Code above this check could not be found, so its flags and version are not known.)"] : [], settings: null };
  const { exe, flags } = argsOf(claude.args);
  const lines = [];
  const recorded = new Set(isObject(record) && Array.isArray(record.flags) ? record.flags : []);
  const unrecorded = [...new Set(flags.map((flag) => flag.name).filter((name) => !recorded.has(name)))];
  for (const name of unrecorded.filter((name) => KNOWN_FLAGS.includes(name))) lines.push(`(Jason: the Claude app started this chat with ${name}, which is not among the flags recorded for her chats.)`);
  if (unrecorded.some((name) => !KNOWN_FLAGS.includes(name))) lines.push("(Jason: the Claude app started this chat with a flag that is not among the flags recorded for her chats.)");
  const values = (name) => flags.filter((flag) => flag.name === name).map((flag) => flag.value);
  if (values("--project-config-root").some((value) => !folder || value !== folder)) lines.push("(Jason: the Claude app reads this chat's project settings from another folder (--project-config-root).)");
  if (values("--setting-sources").some((value) => value !== "user,project,local")) lines.push("(Jason: the Claude app starts this chat with other setting sources (--setting-sources).)");
  if (values("--allowedTools").some((value) => String(value ?? "").split(/[,\s]+/).filter(Boolean).some((rule) => !rule.startsWith("mcp__")))) lines.push("(Jason: the Claude app allows this chat a rule that is not a connector's tool (--allowedTools).)");
  let settings = null;
  const given = values("--settings");
  if (given.length) {
    // More than one is not what the app passes, and which of them Claude Code takes is not known.
    settings = given.length === 1 ? appSettingsOf(given[0]) : null;
    if (settings === null) lines.push("(Jason: the Claude app's --settings for this chat could not be read.)");
  }
  if (values("--add-dir").some((dir) => !isNotes(dir, home))) lines.push("(Jason: this chat has a folder added to it by the Claude app (--add-dir), which its commands could write and whose skills it would load.)");
  if (minimum) {
    // Her app's own copy, by its real path: no link on the way to it.
    const version = realOf(exe) === exe ? appVersionOf(exe, home) : null;
    if (version === null) lines.push(`(Jason: this chat's Claude Code is not the Claude app's own copy, so its version could not be checked against the ${minimum} her folder's open lock was checked on.)`);
    else if (older(version, minimum)) lines.push(`(Jason: this chat runs Claude Code ${version}, older than the ${minimum} her folder's open lock was checked on.)`);
  }
  return { lines, settings };
}

/** What a folder added to the chat while it ran could loosen (C30), as the lines for Jason: the latest environment snapshot of its
    transcript, `transcriptPath`, read a little at a time (scan.js), listing any folder but the app's notes folder; or the transcript
    that cannot be read, or a chat's id that is not one, since then it is not known. It never throws. */
export function addedWhy({ home, sessionId, transcriptPath }) {
  const unread = "(Jason: this chat's transcript could not be read, so whether a folder was added to it is not known.)";
  try {
    const scan = scanTranscript({ home, sessionId, transcriptPath });
    if (scan.unread) return [unread];
    return (scan.added || []).some((dir) => !isNotes(dir, home)) ? ["(Jason: a folder was added to this chat while it ran (/add-dir, or \"add this folder\" on a card), which its commands could write and whose skills it would load.)"] : [];
  } catch (e) {
    return [unread];
  }
}

/** What `behind` says, and goes on, when Claude Code has not trusted her folder yet: an untrusted folder drops its allow rules, so
    edit.js asks a card (C31). */
export const UNTRUSTED = "Claude Code has not trusted this folder yet: open it once and choose to trust it.";

/** UNTRUSTED when Claude Code has not trusted her folder, `folder` (its real path), else "": as Claude Code reads it, from
    ~/.claude.json ($CLAUDE_CONFIG_DIR/.claude.json when `env` sets that), its `projects` entry for her folder or any folder above it
    having hasTrustDialogAccepted true. A file that cannot be read trusts nothing. No folder, nothing to say. */
export function trustWhy({ home, folder, env = {} }) {
  if (!folder) return "";
  const config = settingsObject(env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, ".claude.json") : join(home, ".claude.json"));
  const projects = config && isObject(config.projects) ? config.projects : {};
  const above = (path) => {
    const all = [path];
    while (dirname(all[all.length - 1]) !== all[all.length - 1]) all.push(dirname(all[all.length - 1]));
    return all;
  };
  const trusted = [...above(folder), ...above(studioFolder(home))].some((path) => Object.hasOwn(projects, path) && isObject(projects[path]) && projects[path].hasTrustDialogAccepted === true);
  return trusted ? "" : UNTRUSTED;
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
    or null when it cannot be run, is refused, is stopped at its timeout, or ends otherwise. `spawn` is a test's stand-in. */
export function listeners(port, spawn = spawnSync) {
  try {
    const ran = spawn("/usr/sbin/lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { env: { LC_ALL: "C" }, encoding: "utf8", timeout: 5000 });
    if (!ran || ran.error) return null;
    if (ran.status === 0) return typeof ran.stdout === "string" ? ran.stdout : null;
    return ran.status === 1 && !ran.stdout && !ran.stderr ? "" : null;
  } catch (e) {
    return null;
  }
}

/** How many entries of the workshop are looked through, at most. */
const WORKSHOP_LIMIT = 20000;

/** The names, in any letter case, that a session started in a folder takes as its own settings, instructions or servers. A name is
    judged folded (places.js fold), since macOS keeps .mcp.jſon (a long s) for the very file .mcp.json. */
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
      if (SESSION_OWN.includes(fold(entry.name))) return ["(Jason: the workshop holds a .claude folder, a CLAUDE.md, a CLAUDE.local.md or a .mcp.json, which a session started there would take as its own.)"];
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
  const sessionStart = isObject(settings.hooks) ? settings.hooks.SessionStart : undefined;
  if (sessionStart !== undefined && !(Array.isArray(sessionStart) && sessionStart.length === 0)) why.push(`(Jason: ${label}: a SessionStart hook, which can change the id brimm-video marks chats by. Its contents are not shown here.)`);
  return why;
}

/** The folders in `dir`, by their paths: none when it is not there or cannot be read. Links to folders are not taken. */
function foldersIn(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(dir, e.name)).sort();
  } catch (e) {
    return [];
  }
}

/** Whether a name is one folder's name, and nothing that leads elsewhere. */
const plainName = (name) => typeof name === "string" && name !== "" && name !== "." && name !== ".." && !name.includes("/");

/** The folders in `dir` and the links in it to folders, by their paths: none when it is not there or cannot be read. */
function foldersThrough(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() || (e.isSymbolicLink() && isFolder(join(dir, e.name)))).map((e) => join(dir, e.name)).sort();
  } catch (e) {
    return [];
  }
}

/** Whether `path` is a folder, or a link to one. */
function isFolder(path) {
  try {
    return Boolean(statSync(path, { throwIfNoEntry: false })?.isDirectory());
  } catch (e) {
    return false;
  }
}

/** Whether `path` is a link. */
function isLink(path) {
  try {
    return Boolean(lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink());
  } catch (e) {
    return false;
  }
}

/** The folders of the plugins on this Mac, as `list` finds the folders in a folder: each in the cache
    (~/.claude/plugins/cache/<marketplace>/<plugin>/<version>), and each synced from her account
    (~/.claude/plugins/synced/<account>/<plugin>). */
function pluginFolders(home, list) {
  const plugins = join(home, ".claude", "plugins");
  return [...list(join(plugins, "cache")).flatMap(list).flatMap(list), ...list(join(plugins, "synced")).flatMap(list)];
}

/** The folders Claude Code may load skills from (R22): her folder's own skills, the user's, and each plugin's (pluginFolders), the
    plugins' as `list` finds the folders in a folder. */
function skillRoots({ home, folder }, list) {
  return [join(folder, ".claude", "skills"), join(home, ".claude", "skills"), ...pluginFolders(home, list).map((dir) => join(dir, "skills"))];
}

/** The folders Claude Code may load the skill `name` from (R22, skillRoots), those that are there, no link taken. */
export function skillFolders({ home, folder, name }) {
  if (!plainName(name)) return [];
  return skillRoots({ home, folder }, foldersIn).map((root) => join(root, name)).filter((dir) => {
    try {
      return lstatSync(dir).isDirectory();
    } catch (e) {
      return false;
    }
  });
}

/** Whether a plugin's folder carries hooks or a mod (R21): it holds hooks/hooks.json, or its .claude-plugin/plugin.json has a `hooks`
    or a `mods` key. A plugin.json that is there but cannot be read as a JSON object is taken to, since then it is not known. */
function carriesHooks(dir) {
  if (lstatSync(join(dir, "hooks", "hooks.json"), { throwIfNoEntry: false })) return true;
  const file = join(dir, ".claude-plugin", "plugin.json");
  if (!lstatSync(file, { throwIfNoEntry: false })) return false;
  const manifest = settingsObject(file);
  return manifest === null || Object.hasOwn(manifest, "hooks") || Object.hasOwn(manifest, "mods");
}

/** The links in `dir`, by their paths: none when it is not there or cannot be read. */
function linksIn(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isSymbolicLink()).map((e) => join(dir, e.name)).sort();
  } catch (e) {
    return [];
  }
}

/** What plugins on this Mac could loosen the open lock, as the lines for Jason (R21): each enabled plugin that carries hooks or a mod,
    since they run outside the sandbox (C16). A plugin is enabled when any of `settingsList` (the settings sources, each an object or
    null) says `enabledPlugins["<plugin>@<marketplace>"]` is true, and is then looked for in the cache, in every version kept there;
    every plugin synced from her account (~/.claude/plugins/synced/<account>/<plugin>) is enabled. A plugin that is enabled but has no
    version in the cache, and a version or a synced plugin or account that is a link, which is not followed, are said too, since then
    whether it carries hooks or a mod is not known. */
export function pluginsWhy({ home, settingsList }) {
  const plugins = join(home, ".claude", "plugins");
  const enabled = new Set();
  for (const set of settingsList) {
    if (!isObject(set) || !isObject(set.enabledPlugins)) continue;
    for (const [key, on] of Object.entries(set.enabledPlugins)) if (on === true) enabled.add(key);
  }
  const why = [];
  const unknown = "so whether it carries hooks or a mod, which run outside the sandbox, is not known";
  for (const key of [...enabled].sort()) {
    const at = key.lastIndexOf("@");
    const [name, marketplace] = [key.slice(0, at), key.slice(at + 1)];
    if (at < 0 || !plainName(name) || !plainName(marketplace)) continue;
    const dir = join(plugins, "cache", marketplace, name);
    const versions = foldersIn(dir);
    if (versions.some(carriesHooks)) why.push(`(Jason: the plugin ${key} carries hooks or a mod, which run outside the sandbox. Turn it off for her account.)`);
    if (linksIn(dir).length) why.push(`(Jason: the plugin ${key} is kept through a link, ${unknown}. Turn it off for her account.)`);
    else if (!versions.length) why.push(`(Jason: the plugin ${key} is turned on but is not in the plugins cache, ${unknown}. Turn it off for her account.)`);
  }
  const accounts = foldersIn(join(plugins, "synced"));
  for (const dir of accounts.flatMap(foldersIn)) {
    if (carriesHooks(dir)) why.push(`(Jason: the plugin ${basename(dir)} carries hooks or a mod, which run outside the sandbox. Turn it off for her account.)`);
  }
  if ([join(plugins, "synced"), ...accounts].some((dir) => linksIn(dir).length)) why.push(`(Jason: a plugin synced from her account is kept through a link, ${unknown}.)`);
  return why;
}

/** What skills her folder allows could loosen the open lock, as the lines for Jason: each skill of `allow` (its `skill` entries) whose
    SKILL.md, in any folder it may be loaded from (skillRoots, through links to plugins' folders), registers hooks: a `hooks:` line in
    its front matter (C22); and each that is a link in one of those folders, since then whether it registers hooks is not known. */
export function skillsWhy({ home, folder, allow }) {
  const names = [...new Set((Array.isArray(allow) ? allow : []).filter((entry) => isObject(entry) && entry.type === "skill").map((entry) => entry.name))];
  const why = [];
  for (const name of names.filter(plainName)) {
    const places = skillRoots({ home, folder }, foldersThrough).map((root) => join(root, name));
    const hooked = places.filter((dir) => !isLink(dir) && isFolder(dir)).some((dir) => {
      let text;
      try {
        // A byte-order mark before the front matter is not let hide it.
        text = readFileSync(join(dir, "SKILL.md"), "utf8").replace(/^\uFEFF/, "");
      } catch (e) {
        return false;
      }
      const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
      return Boolean(front) && /^\s*hooks\s*:/m.test(front[1]);
    });
    if (hooked) why.push(`(Jason: the skill ${name}, which her folder allows, registers hooks (hooks: in its SKILL.md).)`);
    if (places.some(isLink)) why.push(`(Jason: the skill ${name}, which her folder allows, is kept through a link, so whether it registers hooks is not known.)`);
  }
  return why;
}

/** The agent definitions in the folder `dir` and the folders inside it, as `seen` takes them: `seen.named` and `seen.asks` are set
    for a definition that has an own agent's name or asks for more (agentWhy); `seen.unknown` for one that cannot be read, a link
    (which is not followed), or a folder that cannot be looked through. A folder that is not there holds none. */
function agentsIn(dir, seen) {
  let own;
  try {
    own = lstatSync(dir);
  } catch (e) {
    if (e.code !== "ENOENT" && e.code !== "ENOTDIR") seen.unknown = true;
    return;
  }
  if (own.isSymbolicLink()) seen.unknown = true;
  if (!own.isDirectory()) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    seen.unknown = true;
    return;
  }
  for (const entry of entries) {
    const at = join(dir, entry.name);
    if (entry.isSymbolicLink()) seen.unknown = true;
    else if (entry.isDirectory()) agentsIn(at, seen);
    else if (entry.isFile() && fold(entry.name).endsWith(".md")) agentWhy(at, entry.name.slice(0, -3), seen);
  }
}

/** The keys of an agent definition's front matter that give it more than the tools it names (Claude Code's own: it runs somewhere
    else, registers hooks, brings MCP servers, or sets its own permission mode). */
const AGENT_KEYS = ["isolation", "hooks", "mcpServers", "permissionMode"];

/** What the agent definition in the file `file`, whose file name without .md is `base`, is, as `seen` takes it (agentsIn). Its front
    matter is the block between the --- lines at the top, a byte-order mark before it let through, and one never closed taken to run
    to the end of the file; it is read by lines, a key at the start of a line (indented or quoted too) followed by a colon, and a
    key of a flow mapping ({ a: 1, b: 2 }) too. */
function agentWhy(file, base, seen) {
  let text;
  try {
    text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  } catch (e) {
    seen.unknown = true;
    return;
  }
  const own = new Set(BUILT_IN_AGENTS.map(fold));
  if (own.has(fold(base))) seen.named = true;
  const front = /^---[ \t]*\r?\n([\s\S]*?)(?:\r?\n---|$)/.exec(text);
  if (!front) return;
  const keys = AGENT_KEYS.join("|");
  if (new RegExp(`^[ \\t]*["']?(?:${keys})["']?[ \\t]*:`, "im").test(front[1]) || new RegExp(`[{,][ \\t]*["']?(?:${keys})["']?[ \\t]*:`, "i").test(front[1])) seen.asks = true;
  for (const line of front[1].split(/\r?\n/)) {
    const named = /^[ \t]*["']?name["']?[ \t]*:[ \t]*(.*?)[ \t]*$/i.exec(line);
    if (named && own.has(fold(named[1].replace(/\s+#.*$/, "").replace(/^(["'])(.*)\1$/, "$2").trim()))) seen.named = true;
  }
}

/** What agent definitions on this Mac could loosen the open lock, as the lines for Jason (none holding a file's name or words): Claude
    Code loads definitions by name from ~/.claude/agents, $CLAUDE_CONFIG_DIR/agents (`env`), her folder's .claude/agents, and each
    plugin's agents folder (pluginFolders), in any folder inside them, and one named like a built-in agent (BUILT_IN_AGENTS, which the
    never list lets the subagent tool name) replaces it, by its file name without .md or its front matter's `name:`, in any letter
    case (fold); and its front matter can ask for isolation, hooks, MCP servers or a permission mode of its own (AGENT_KEYS). One
    line for each kind of finding. A definition that cannot be read, a link, in a folder or as one, which is not followed, and an
    agents folder that cannot be looked through are said too, since then it is not known. `folder` is her folder's real path, or null. */
export function agentsWhy({ home, folder, env = {} }) {
  const config = env.CLAUDE_CONFIG_DIR;
  const roots = [
    join(home, ".claude", "agents"),
    ...(typeof config === "string" && config !== "" ? [join(config, "agents")] : []),
    ...(folder ? [join(folder, ".claude", "agents")] : []),
    ...pluginFolders(home, foldersThrough).map((dir) => join(dir, "agents")),
  ];
  const seen = { named: false, asks: false, unknown: false };
  for (const root of [...new Set(roots)]) agentsIn(root, seen);
  const why = [];
  if (seen.named) why.push("(Jason: an agent definition on this Mac has the name of one of Claude Code's own agents, which it would replace. Its contents are not shown here.)");
  if (seen.asks) why.push("(Jason: an agent definition on this Mac asks for its own isolation, hooks, MCP servers or permission mode. Its contents are not shown here.)");
  if (seen.unknown) why.push("(Jason: an agent definition on this Mac could not be read, or is kept through a link, so whether it replaces one of Claude Code's own agents or asks for its own isolation, hooks, MCP servers or permission mode is not known. Its contents are not shown here.)");
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
