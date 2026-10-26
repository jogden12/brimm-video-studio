// The open guard (design 2026-10-26, section 6, "The guard's decision, in order"): what her chat may do on a Mac whose folder has
// the open lock, answered before Claude Code asks anyone, in whatever mode the chat is in. Its steps, in order:
//   1. the lock loosened on this Mac: today's guard (guardDecision), saying the lock is changed;
//   2. a chat that holds a session's words: today's guard, with Read of its own words folder, and only a session's commands;
//   3. the never list (never.js): deny;
//   4. every path in the tool's input, by what it is (places.js): a gated place, or a write outside the workshop: deny;
//   5. Bash: edit.js in its one spelling (outside the sandbox), or any other command, which runs in the sandbox;
//   6. a skill this Mac's allowlist names: allow;
//   then a tool an exact `tool` entry names (PushNotification, the drawing tools), unless it is one with a rule of its own;
//   7. an MCP tool: allow only a claude.ai connector's tool an `mcp-tool` entry names exactly, that the never list does not catch;
//   8. the subagent tool (its limits are the never list's) and a subagent's hand-back, SendUserFile, and the web tools: held until
//      this Mac opens them, and
//      WebFetch never to a numeric, local or privately answering address (fetchable.js);
//   9. the card, the task list and ToolSearch: no answer, left to Claude Code (the card must stay so);
//  10. anything else: deny.
// Steps 1 and 2 fall back to today's guard (studio.js guardDecision). A loosened lock says so in each refusal (LOCK_CHANGED). A chat
// that holds a session's words (held.js) may also Read its own words file, answered allow, never pass: a pass would leave it to
// Claude Code, whose card for a file outside her folder offers to add the folder or always allow, either of which loosens the lock;
// and it runs only the edit.js commands a session runs (R29), so that it cannot write a session's words into a record another chat
// reads: in a loosened lock too, since such a record outlives the loosening, and in a call the guard cannot judge.
//
// guardAnswer is what the hook runs: the home folder is the one above her folder (R25); the lock in effect is this Mac's
// (effectiveLock), strict, or settings that cannot be read, being today's guard alone; on an open-lock Mac it makes the shared lock
// check (loosened.js, kept in a cache while nothing it looked at has changed) and the held check, then openDecision.
//
// Step 4 takes every path-like string of the tool's input, at any depth (places.js pathsIn), but what Write writes and what Edit
// changes, which are a file's words, not paths; and judges each by what it is (gatedIndex), a link to a file by its real path too.
// A Read may reach this call's own carve-outs: the chat's tool-results and tasks folders, its words folder, and the folders of the
// skills this folder allows; each is given as a gated place's real path with the rest after it, so that a link on the way opens
// nothing. Write and Edit go only into the workshop, through no link, and never to a CLAUDE.md, CLAUDE.local.md, .mcp.json or a
// .claude folder there.
//
// Step 5 lets edit.js through in one spelling only, the one the sandbox's excluded command takes: this Mac's node, the checkout's
// edit.js in double quotes, and one or more words (studio.js WORD), with nothing before it and nothing after; and not in the
// background, but for her skill's `guide <label> tell` (R6). Any other command naming edit.js or the checkout's tool folder is
// refused; any naming a gated place too, as a courtesy, since the sandbox holds it anyway; and any other runs in the sandbox.
import { lstatSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { isConnector, neverCaught } from "./never.js";
import { fetchWhy } from "./fetchable.js";
import { claudeDirName, fold, gatedIndex, gatedPlaces, pathsIn, realOf, searchRoot } from "./places.js";
import { SESSION_ID } from "./scan.js";
import { HELD_NARROWED, HELD_REFUSED, chatHeld, noteStrictSeen, strictSeenFile, wordsFolder } from "./held.js";
import { LOCK_CHANGED, addedWhy, beyondWhy, environmentWhy, lockLoosened, skillFolders } from "./loosened.js";
import { ALLOW_DEFAULT, OPEN_LOCK_CLAUDE, WORD, guardDecision, literally, openSettingsOf, workshopFolder } from "./studio.js";
import { TOOLS_WITH_RULES, effectiveLock, factsOf, readSettings, settingsFile, studioAllowOf, studioNodeOf } from "./settings.js";
import { UNSCOPED, SESSION_TAUGHT } from "./gate.js";
import { argsOf, chainUp, claudeAbove, processTable, readProcesses } from "./chain.js";

export const NEVER_REFUSED = "That is never done from this folder: nothing here posts, sends, publishes or shares, or works the screen, the browser or another session. Ask Jason.";
export const NOT_NAMED = "That is not among the tools and skills this folder allows. Ask Jason.";
export const WEB_HELD = "The web is not turned on for this folder yet: ask Jason.";
export const GATED_REFUSED = "That is one of the places only brimm-video reads or writes. Ask for it through brimm-video, or ask Jason.";
export const WRITE_REFUSED = "Claude writes files here only in the workshop, ~/BRIMM Video Workshop, and never a CLAUDE.md, a .mcp.json or a .claude folder.";
export const RUN_ALONE = "Run brimm-video's commands on their own, exactly as her skill says, and not in the background.";

/** The tools left to Claude Code's own rules (step 9): its card, its list of what it is doing and ToolSearch, which only loads a
    tool that then meets this guard. The card must stay so: an answer of the guard's would answer it without her. */
const LEFT_TO_CLAUDE_CODE = new Set(["AskUserQuestion", "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch"]);
/** The tools with a rule of their own, which no `tool` entry of the allowlist speaks for (settings.js refuses such an entry too). */
const OWN_RULES = new Set([...TOOLS_WITH_RULES, ...LEFT_TO_CLAUDE_CODE]);

/** The edit.js commands a chat that holds a session's words may run (R29): those a session runs, but `name` and `read`. */
const HELD_COMMANDS = [...UNSCOPED, ...SESSION_TAUGHT].filter((command) => command !== "name" && command !== "read");

/** The tools step 4 lets through once no path of theirs is in a gated place. */
const FILE_TOOLS = new Set(["Read", "Write", "Edit", "Glob", "Grep"]);
/** The names Write and Edit never write, in any letter case. */
const NEVER_WRITTEN = new Set(["claude.md", "claude.local.md", ".mcp.json"]);

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** `path` as the real path of the gated place `place` with the rest of it after, when it lies inside it; else `path` resolved; null
    when it is the place itself, which no carve-out opens whole. */
function under(place, path) {
  const rest = relative(place, path);
  if (rest === "") return null;
  return rest.startsWith("..") || isAbsolute(rest) ? resolve(path) : join(realOf(place), rest);
}

/** This call's carve-outs for Read: the chat's own tool-results and tasks folders (beside its transcript, and in Claude Code's temp
    folder under its transcript's folder's name), its own words folder, and the folders of the skills this folder allows. None for
    a chat whose id is not one. */
function carveOuts(input, ctx) {
  const id = input.session_id;
  if (typeof id !== "string" || !SESSION_ID.test(id)) return [];
  const claude = join(ctx.home, ".claude");
  const carves = [join(realOf(wordsFolder(ctx.home)), id)];
  if (typeof input.transcript_path === "string" && isAbsolute(input.transcript_path)) {
    const projects = dirname(input.transcript_path);
    carves.push(under(claude, join(projects, id, "tool-results")), join(realOf(join(ctx.tmp, `claude-${ctx.uid}`)), basename(projects), id, "tasks"));
  }
  const skills = (Array.isArray(ctx.allow) ? ctx.allow : []).filter((entry) => isObject(entry) && entry.type === "skill");
  for (const { name } of skills) for (const dir of skillFolders({ home: ctx.home, folder: ctx.folder, name })) carves.push(under(claude, dir));
  return carves.filter(Boolean);
}

/** A file or folder's own identity, a link's its own; null when it is not there. Throws for anything else it cannot look at. */
function ownIdentity(path) {
  try {
    const st = lstatSync(path);
    return { id: `${st.dev}:${st.ino}`, link: st.isSymbolicLink() };
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "ENOTDIR") return null;
    throw e;
  }
}

/** Whether Write or Edit may write `filePath`: spelled with no white space around it (which Claude Code would take off, so that the
    path written is not the path looked at), a path inside the workshop, found by the identity of the workshop folder itself, with
    no part below it a link (the last part included, dangling or not), no `.claude` part, and a name that is not CLAUDE.md,
    CLAUDE.local.md or .mcp.json, in any letter case; one that is there must have its real path inside the workshop. */
function writable(filePath, cwd, home) {
  if (typeof filePath !== "string" || filePath === "" || filePath !== filePath.trim()) return false;
  try {
    const path = filePath === "~" || filePath.startsWith("~/") ? resolve(home, filePath.slice(2)) : resolve(cwd, filePath);
    const workshop = ownIdentity(workshopFolder(home));
    if (!workshop || workshop.link) return false;
    const below = [];
    for (let at = path; ; at = dirname(at)) {
      const own = ownIdentity(at);
      if (own && own.id === workshop.id) break;
      if (own && own.link) return false;
      if (dirname(at) === at) return false;
      below.unshift(basename(at));
    }
    if (!below.length || below.some((part) => fold(part) === ".claude") || NEVER_WRITTEN.has(fold(below.at(-1)))) return false;
    if (ownIdentity(path)) {
      const real = realpathSync.native(path);
      const inside = realpathSync.native(workshopFolder(home));
      if (!real.startsWith(`${inside}/`)) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/** A command's words, split at white space, with quotes and backslashes taken off as a shell would: what a command names, for the
    courtesy of step 5. */
function wordsOf(command) {
  const words = [];
  let word = "";
  let started = false;
  let quote = null;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else word += ch;
    } else if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === "\\" && i + 1 < command.length && '"\\$`'.includes(command[i + 1])) word += command[++i];
      else word += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
    } else if (ch === "\\" && i + 1 < command.length) {
      word += command[++i];
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) words.push(word);
      word = "";
      started = false;
    } else {
      word += ch;
      started = true;
    }
  }
  if (started) words.push(word);
  return words;
}

/** What step 5 answers to the Bash command `command`, run in the background when `background`. */
function bashDecision(command, background, cwd, ctx) {
  if (typeof command !== "string") return deny(NOT_NAMED);
  const edit = `^${literally(ctx.node)} "${literally(ctx.checkout)}/tool/edit\\.js"`;
  if (new RegExp(`${edit}(?: ${WORD})+$`).test(command)) {
    if (!background || new RegExp(`${edit} guide ${WORD} tell$`).test(command)) return allow("brimm-video's own command");
    return deny(RUN_ALONE);
  }
  // The command as written, and its words with quotes and backslashes taken off, as the shell would run them.
  for (const text of [command, wordsOf(command).join(" ")]) {
    if (fold(text).includes("edit.js") || fold(text).includes(fold(`${ctx.checkout}/tool`))) return deny(RUN_ALONE);
  }
  if (pathsIn(wordsOf(command), cwd, ctx.home).some((path) => ctx.index.at(path))) return deny(GATED_REFUSED);
  return allow("a command in the sandbox");
}

/** Today's guard's answer (studio.js guardDecision) to `input`, each refusal saying `reason`. */
function todays(input, ctx, reason) {
  const answer = guardDecision(input, { checkout: ctx.checkout, node: ctx.node, folder: ctx.folder, tmp: ctx.tmp, uid: ctx.uid });
  return answer.decision === "deny" ? deny(reason) : answer;
}

/** Whether `input` is a Read of the chat's own words file: a path the gated places hold as the words folder, and let through with
    the chat's own words folder opened, by identity, a link by its real path too. */
function ownWords(input, ctx) {
  if (input.tool_name !== "Read" || !isObject(input.tool_input) || typeof input.session_id !== "string" || !SESSION_ID.test(input.session_id)) return false;
  const cwd = typeof input.cwd === "string" && isAbsolute(input.cwd) ? input.cwd : ctx.folder;
  const [path] = pathsIn([input.tool_input.file_path], cwd, ctx.home);
  if (!path) return false;
  return ctx.index.at(path)?.carve === "words" && ctx.index.at(path, [join(realOf(wordsFolder(ctx.home)), input.session_id)]) === null;
}

/** The first word after edit.js in a command today's guard allows, its quotes taken off; null when there is none. */
function firstWord(command, ctx) {
  const found = new RegExp(`^(?:node|${literally(ctx.node)}) "${literally(ctx.checkout)}/tool/edit\\.js" (${WORD})`).exec(String(command));
  if (!found) return null;
  const word = found[1];
  return word.startsWith('"') || word.startsWith("'") ? word.slice(1, -1) : word;
}

/** `answer`, today's guard's, narrowed for a chat that holds a session's words: edit.js only for the commands a session runs. */
function narrowed(answer, input, ctx) {
  const command = isObject(input) && isObject(input.tool_input) ? input.tool_input.command : undefined;
  if (answer.decision === "allow" && input.tool_name === "Bash" && !HELD_COMMANDS.includes(firstWord(command, ctx))) return deny(HELD_NARROWED);
  return answer;
}

/** Step 2: what a chat that holds a session's words may do. Today's guard, with a Read of its own words file allowed, edit.js only
    for the commands a session runs, and every refusal saying the chat is held. */
function heldDecision(input, ctx) {
  if (ownWords(input, ctx)) return allow("its own words");
  return narrowed(todays(input, ctx, HELD_REFUSED), input, ctx);
}

/** The tool's input as step 4 looks for paths in it: all of it, but what Write writes and what Edit changes. */
function pathFields(name, toolInput) {
  if (!isObject(toolInput)) return toolInput;
  const skip = name === "Write" ? ["content"] : name === "Edit" ? ["old_string", "new_string"] : [];
  return Object.fromEntries(Object.entries(toolInput).filter(([key]) => !skip.includes(key)));
}
const allow = (reason) => ({ decision: "allow", reason });
const deny = (reason) => ({ decision: "deny", reason });
const PASS = { decision: "pass", reason: "" };

/** What the open guard answers to a tool call, `input` as the PreToolUse hook is given it, in the context `ctx` (GuardCtx):
    { checkout, node, folder, home, uid, tmp, index, allow, web, resolve, loosened, held }, `allow` being the allowlist (the
    default's and this Mac's entries), `web` "held" or "open", and `resolve` the look-up of a name, giving its addresses. A loosened
    lock is today's guard, narrowed as for a held chat when `held` is true too. Gives { decision: "allow"|"deny"|"pass", reason }. */
export async function openDecision(input, ctx) {
  const name = isObject(input) ? input.tool_name : undefined;
  const given = isObject(input) && isObject(input.tool_input) ? input.tool_input : {};
  const named = (type, what) => Array.isArray(ctx.allow) && ctx.allow.some((entry) => isObject(entry) && entry.type === type && entry.name === what);

  if (ctx.loosened) return ctx.held ? narrowed(todays(input, ctx, LOCK_CHANGED), input, ctx) : todays(input, ctx, LOCK_CHANGED);
  if (ctx.held) return heldDecision(input, ctx);

  if (neverCaught(name, given)) return deny(NEVER_REFUSED);

  const cwd = typeof input.cwd === "string" && isAbsolute(input.cwd) ? input.cwd : ctx.folder;
  if ((name === "Write" || name === "Edit") && !writable(given.file_path, cwd, ctx.home)) return deny(WRITE_REFUSED);
  const carves = name === "Read" ? carveOuts(input, ctx) : [];
  for (const path of pathsIn(pathFields(name, input.tool_input), cwd, ctx.home)) if (ctx.index.at(path, carves)) return deny(GATED_REFUSED);
  if (name === "Glob" || name === "Grep") {
    const root = searchRoot(name, given, cwd, ctx.home);
    if (ctx.index.at(root) || ctx.index.holds(root)) return deny(GATED_REFUSED);
  }
  if (FILE_TOOLS.has(name)) return allow(name === "Write" || name === "Edit" ? "in the workshop" : "outside the gated places");
  if (name === "Bash") return bashDecision(given.command, Boolean(given.run_in_background), cwd, ctx);
  if (name === "Skill") return typeof given.skill === "string" && named("skill", given.skill) ? allow("a skill this folder allows") : deny(NOT_NAMED);
  if (!OWN_RULES.has(name) && named("tool", name)) return allow("a tool this folder allows");
  if (name.startsWith("mcp__")) return isConnector(name) && named("mcp-tool", name) ? allow("a connector's tool this Mac allows") : deny(NOT_NAMED);
  if (name === "Agent" || name === "Task") return allow("a subagent of Claude Code's own");
  if (name === "SubagentHandback") return allow("a subagent's report, handed back");
  if (name === "SendUserFile") return allow("a file shown to her");
  if (name === "WebSearch" || name === "WebFetch") {
    if (ctx.web !== "open") return deny(WEB_HELD);
    if (name === "WebSearch") return allow("the web, opened on this Mac");
    const why = await fetchWhy(given.url, ctx.resolve);
    return why ? deny(why) : allow("the web, opened on this Mac");
  }
  if (LEFT_TO_CLAUDE_CODE.has(name)) return PASS;
  return deny(NOT_NAMED);
}

/** How long the cached lock check is used for, at most, whatever its signature: the workshop and the proxy port's listener, which it
    does not sign, are looked at again at least this often. */
const CACHE_LIFE = 30 * 1000;
/** Where the guard keeps its last lock check, in Application Support, out of the sandbox's reach. */
const cacheFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "lock-cache.json");
/** The managed settings' folder and preferences, as loosened.js reads them, when a test gives none. */
const MANAGED_DIR = "/Library/Application Support/ClaudeCode";
const MANAGED_PREFS = "/Library/Managed Preferences";
const PREFS_FILE = "com.anthropic.claudecode.plist";

/** The entries of `dir` and of every folder inside it, by their paths, a link listed and never followed; none when it cannot be
    listed. A file added or changed in a folder inside moves that folder's own time, not `dir`'s, so each is looked at. */
function treeOf(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? [path, ...treeOf(path)] : [path];
    });
  } catch (e) {
    return [];
  }
}

/** What a file or folder is now, for the cache's signature: its size, time and inode (and, for a link, those of where it leads), or
    "missing". */
function stamp(path) {
  try {
    const own = lstatSync(path);
    const mark = [path, own.size, own.mtimeMs, own.ino];
    if (own.isSymbolicLink()) {
      try {
        const to = statSync(path);
        mark.push(to.size, to.mtimeMs, to.ino);
      } catch (e) {
        mark.push("dangling");
      }
    }
    return mark;
  } catch (e) {
    return [path, "missing"];
  }
}

/** The folders in `dir` and the links in it to folders, by their paths, since the lock check reads skills through a link to a
    plugin's folder (loosened.js skillsWhy); none when it cannot be listed. Each entry is judged by itself: a link that cannot be
    looked at (one to itself, or to a place that may not be searched) is not a folder, and hides no other entry. */
function foldersOf(dir) {
  const folder = (entry) => {
    if (entry.isDirectory()) return true;
    if (!entry.isSymbolicLink()) return false;
    try {
      return Boolean(statSync(join(dir, entry.name), { throwIfNoEntry: false })?.isDirectory());
    } catch (e) {
      return false;
    }
  };
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(folder).map((entry) => join(dir, entry.name));
  } catch (e) {
    return [];
  }
}

/** Every file and folder the lock check looks at, read, lists or looks for (loosened.js lockLoosened): this Mac's settings, her
    folder's own, the user's and the server-managed ones, the managed settings, drop-ins and preferences, the plugins and their
    hooks, the skills her folder allows, the app's --settings file and the folders it adds, the workshop, and this checkout's data the
    open shape is made from. */
function watched({ home, folder, checkout, env, deps, settings, claude }) {
  const config = env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  const agentFolders = [join(home, ".claude", "agents"), join(config, "agents"), join(folder, ".claude", "agents")];
  const managed = deps.managedDir || MANAGED_DIR;
  const prefs = deps.managedPrefs || MANAGED_PREFS;
  const plugins = join(home, ".claude", "plugins");
  // Each plugin's folder: cache/<marketplace>/<plugin>/<version>, and synced/<account>/<plugin>.
  const pluginDirs = [...foldersOf(join(plugins, "cache")).flatMap(foldersOf).flatMap(foldersOf), ...foldersOf(join(plugins, "synced")).flatMap(foldersOf)];
  const skillRoots = [join(folder, ".claude", "skills"), join(home, ".claude", "skills"), ...pluginDirs.map((dir) => join(dir, "skills"))];
  const skills = [...ALLOW_DEFAULT, ...studioAllowOf(settings)].filter((e) => isObject(e) && e.type === "skill" && typeof e.name === "string");
  let dropIns = [];
  try {
    dropIns = readdirSync(join(managed, "managed-settings.d")).map((name) => join(managed, "managed-settings.d", name));
  } catch (e) {
    // None.
  }
  const account = deps.user || userInfo().username;
  // The app's --settings, when it names a file, and the folders it adds (its notes folder, which must stay a folder of its own).
  const appPaths = claude ? argsOf(claude.args).flags.filter((f) => (f.name === "--settings" || f.name === "--add-dir") && typeof f.value === "string" && isAbsolute(f.value.trim())).map((f) => f.value.trim()) : [];
  return [
    settingsFile(home),
    folder, join(folder, ".claude"), join(folder, ".claude", "settings.json"), join(folder, ".claude", "settings.local.json"),
    config, join(config, "settings.json"), join(config, "remote-settings.json"),
    join(home, ".claude"), plugins, join(plugins, "cache"), ...foldersOf(join(plugins, "cache")), ...foldersOf(join(plugins, "cache")).flatMap(foldersOf),
    join(plugins, "synced"), ...foldersOf(join(plugins, "synced")),
    ...pluginDirs.flatMap((dir) => [dir, join(dir, "hooks"), join(dir, "hooks", "hooks.json"), join(dir, ".claude-plugin", "plugin.json"), join(dir, "skills")]),
    // The agent definitions Claude Code would load (loosened.js agentsWhy), each folder and file inside the agents folders by itself.
    ...[...agentFolders, ...pluginDirs.map((dir) => join(dir, "agents"))].flatMap((dir) => [dir, ...treeOf(dir)]),
    ...skillRoots, ...skillRoots.flatMap((root) => skills.flatMap(({ name }) => [join(root, name), join(root, name, "SKILL.md")])),
    // The note of a time her folder kept the open shape under the strict lock (held.js strictSeen). Not its folder, which the scans
    // of the chats' transcripts change at every call.
    strictSeenFile(home),
    managed, join(managed, "managed-settings.json"), join(managed, "managed-settings.d"), ...dropIns,
    prefs, join(prefs, account), join(prefs, account, PREFS_FILE), join(prefs, PREFS_FILE),
    ...appPaths,
    workshopFolder(home),
    ...["never.json", "allow.json", "environment.json", "app-flags.json"].map((name) => fileURLToPath(new URL(`./studio/${name}`, import.meta.url))),
  ];
}

/** The cache's last check, { signature, lines, at }, or null when there is none, or it is not whole. */
function readCache(home) {
  try {
    const kept = JSON.parse(readFileSync(cacheFile(home), "utf8"));
    return isObject(kept) && typeof kept.signature === "string" && Array.isArray(kept.lines) && kept.lines.every((l) => typeof l === "string") && Number.isFinite(kept.at) ? kept : null;
  } catch (e) {
    return null;
  }
}

/** Keep a check in the cache, whole: under a name of its own first, then renamed over the last one, so that a call reading it while
    another writes it sees the one or the other. One that cannot be written is left; the next call checks again. */
function writeCache(home, value) {
  const file = cacheFile(home);
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
    renameSync(temporary, file);
  } catch (e) {
    rmSync(temporary, { force: true });
  }
}

/** `lines` without one of each of `less`. */
function without(lines, less) {
  const rest = [...lines];
  for (const line of less) {
    const at = rest.indexOf(line);
    if (at >= 0) rest.splice(at, 1);
  }
  return rest;
}

/** The lock check's lines for this call (loosened.js lockLoosened), kept in the cache while its signature holds, for CACHE_LIFE at
    most. The folders added to the chat (addedWhy) are read from its transcript at every call, outside the cache, since the
    transcript grows at every call. */
function lockLines({ home, checkout, folder, node, input, deps, env, settings, facts, claude, now }) {
  const sessionId = input.session_id;
  const signature = JSON.stringify({
    checkout, node, folder, session: sessionId, transcript: deps.transcript, cwd: deps.cwd, real: realOf(String(deps.cwd)),
    there: Boolean(deps.transcript && lstatSync(deps.transcript, { throwIfNoEntry: false })?.isFile()),
    claude: claude ? [claude.pid, claude.start, claude.args] : null,
    // Where its executable really is: its version is read only from the app's own copy reached by no link (loosened.js appWhy).
    app: claude ? realOf(argsOf(claude.args).exe) : null,
    minimum: deps.minimum !== undefined ? deps.minimum : OPEN_LOCK_CLAUDE, flags: deps.appFlags || null,
    // The names, and what the check says of them: a value it reads (whether memory is turned on) is never kept, only its line.
    env: [Object.keys(env).sort(), environmentWhy(env)],
    // What the check says beyond them (loosened.js beyondWhy): whether CLAUDE_CONFIG_DIR is the very folder ~/.claude is, by device
    // and inode, and whether the strict-lock note is there. Its lines hold no value.
    beyond: beyondWhy({ env, home }),
    shape: studioNodeOf(settings) ? openSettingsOf({ checkout, node: studioNodeOf(settings), folder, facts }) : null,
    files: watched({ home, folder, checkout, env, deps, settings, claude }).map(stamp),
  });
  const added = () => addedWhy({ home, sessionId, transcriptPath: deps.transcript });
  const kept = readCache(home);
  if (kept && kept.signature === signature && now - kept.at >= 0 && now - kept.at < CACHE_LIFE) return [...kept.lines, ...added()];
  const lines = lockLoosened({ home, checkout, deps });
  writeCache(home, { signature, lines: without(lines, added()), at: now });
  return lines;
}

/** Whether her folder has the open lock's shape: its settings hold the sandbox, which only the open shape writes. */
function openShaped(folder) {
  try {
    const written = JSON.parse(readFileSync(join(folder, ".claude", "settings.json"), "utf8"));
    return isObject(written) && Object.hasOwn(written, "sandbox");
  } catch (e) {
    return false;
  }
}

/** Look a name up as WebFetch would, every address it has, within five seconds. */
function lookUp(host) {
  let timer;
  const late = new Promise((_, fail) => {
    timer = setTimeout(() => fail(Object.assign(new Error("the look-up took too long"), { code: "ETIMEOUT" })), 5000);
  });
  return Promise.race([dns.lookup(host, { all: true }).then((all) => all.map((a) => a.address)), late]).finally(() => clearTimeout(timer));
}

/** What the guard hook answers to `input`, the PreToolUse hook's input, for her folder `folder`, this `checkout` and `node`:
    { decision, reason }. `deps` stand in for this Mac in a test: env, ps, pid, lsof, resolve, now, tmp, uid, managedDir, managedPrefs,
    user, appFlags and minimum, each with today's default. The home folder is the folder above hers (R25), never HOME. A strict Mac, or
    one whose settings cannot be read, gets today's guard alone, and no `ps` or `lsof` is run. On an open-lock Mac: a call with no
    folder, no chat id that is one, no transcript or no tool_input object is loosened; so is a lock check that finds anything. The
    session is hers when its transcript is in her folder's projects folder (R30), its folder then taken as hers, whatever `cwd` says
    after a sandboxed `cd`, when that `cwd` is her folder or inside it. A chat is held by the held check (held.js), its claude the one
    above the guard. */
export async function guardAnswer(input, { checkout, node, folder, deps = {} }) {
  const today = () => guardDecision(input, { checkout, node, folder, ...(deps.tmp !== undefined ? { tmp: deps.tmp } : {}), ...(deps.uid !== undefined ? { uid: deps.uid } : {}) });
  if (typeof folder !== "string" || !isAbsolute(folder)) return today();
  const home = dirname(folder);
  const settings = readSettings(home).settings;
  if (!settings || effectiveLock(settings, deps.minimum !== undefined ? deps.minimum : OPEN_LOCK_CLAUDE) !== "open") {
    // Her folder left with the open shape while the lock in effect is strict: noted, so that the open lock is not in effect again
    // until its chats' command output is taken away (R7).
    if (openShaped(folder)) noteStrictSeen(home, deps.now ? Number(deps.now()) : Date.now());
    return today();
  }
  const facts = factsOf(home, settings, { tmp: deps.tmp, uid: deps.uid });
  const ctx = {
    checkout, node, folder, home, uid: facts.uid, tmp: facts.tmp,
    index: gatedIndex(gatedPlaces(facts), [join(realOf(facts.root), "Assets")]),
    allow: facts.allow, web: facts.web, resolve: deps.resolve || lookUp, loosened: false, held: false,
  };
  const whole = isObject(input) && typeof input.cwd === "string" && isAbsolute(input.cwd) && typeof input.session_id === "string" && SESSION_ID.test(input.session_id)
    && typeof input.transcript_path === "string" && isAbsolute(input.transcript_path) && isObject(input.tool_input);
  // A call it cannot judge is loosened, and kept to a session's commands, since whether its chat holds a session's words is not known.
  if (!whole) return openDecision(input, { ...ctx, loosened: true, held: true });
  const text = (deps.ps || readProcesses)();
  const table = typeof text === "string" ? processTable(text) : null;
  const above = table ? claudeAbove(chainUp(table, deps.pid !== undefined ? deps.pid : process.pid)) : null;
  // Her chat by its transcript's folder (R30), and by its folder being hers or inside it: Claude Code's name for a folder makes every
  // letter but a letter or a digit a dash, so a chat started in ~/BRIMM-Video-Studio keeps its transcript in her projects folder too.
  const hers = basename(dirname(input.transcript_path)) === claudeDirName(folder) && (input.cwd === folder || input.cwd.startsWith(`${folder}/`));
  const env = { ...(deps.env || process.env), CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: input.session_id };
  const check = { ...deps, settings, env, ps: () => text, cwd: hers ? folder : input.cwd, transcript: hers ? input.transcript_path : null };
  const now = deps.now ? Number(deps.now()) : Date.now();
  const lines = lockLines({ home, checkout, folder, node, input, deps: check, env, settings, facts, claude: above, now });
  const held = chatHeld({ home, sessionId: input.session_id, transcriptPath: input.transcript_path, claude: above ? { pid: above.pid, start: above.start } : "unknown" });
  return openDecision(input, { ...ctx, loosened: lines.length > 0, held });
}
