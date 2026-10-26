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
//   8. the subagent tool (its limits are the never list's), SendUserFile, and the web tools: held until this Mac opens them, and
//      WebFetch never to a numeric, local or privately answering address (fetchable.js);
//   9. the card, the task list and ToolSearch: no answer, left to Claude Code (the card must stay so);
//  10. anything else: deny.
// Steps 1, 2 and 5 are not here yet: until they are, Bash falls to step 10.
//
// Step 4 takes every path-like string of the tool's input, at any depth (places.js pathsIn), but what Write writes and what Edit
// changes, which are a file's words, not paths; and judges each by what it is (gatedIndex), a link to a file by its real path too.
// A Read may reach this call's own carve-outs: the chat's tool-results and tasks folders, its words folder, and the folders of the
// skills this folder allows; each is given as a gated place's real path with the rest after it, so that a link on the way opens
// nothing. Write and Edit go only into the workshop, through no link, and never to a CLAUDE.md, CLAUDE.local.md, .mcp.json or a
// .claude folder there.
import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { isConnector, neverCaught } from "./never.js";
import { fetchWhy } from "./fetchable.js";
import { pathsIn, realOf, searchRoot } from "./places.js";
import { SESSION_ID } from "./scan.js";
import { wordsFolder } from "./held.js";
import { skillFolders } from "./loosened.js";
import { workshopFolder } from "./studio.js";

export const NEVER_REFUSED = "That is never done from this folder: nothing here posts, sends, publishes or shares, or works the screen, the browser or another session. Ask Jason.";
export const NOT_NAMED = "That is not among the tools and skills this folder allows. Ask Jason.";
export const WEB_HELD = "The web is not turned on for this folder yet: ask Jason.";
export const GATED_REFUSED = "That is one of the places only brimm-video reads or writes. Ask for it through brimm-video, or ask Jason.";
export const WRITE_REFUSED = "Claude writes files here only in the workshop, ~/BRIMM Video Workshop, and never a CLAUDE.md, a .mcp.json or a .claude folder.";

/** The tools left to Claude Code's own rules (step 9): its card, its list of what it is doing and ToolSearch, which only loads a
    tool that then meets this guard. The card must stay so: an answer of the guard's would answer it without her. */
const LEFT_TO_CLAUDE_CODE = new Set(["AskUserQuestion", "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch"]);
/** The tools with a rule of their own, which no `tool` entry of the allowlist speaks for. */
const OWN_RULES = new Set(["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Skill", "Agent", "Task", "SendUserFile", "WebFetch", "WebSearch", ...LEFT_TO_CLAUDE_CODE]);

/** The tools step 4 lets through once no path of theirs is in a gated place. */
const FILE_TOOLS = new Set(["Read", "Write", "Edit", "Glob", "Grep"]);
/** The names Write and Edit never write, in any letter case. */
const NEVER_WRITTEN = new Set(["claude.md", "claude.local.md", ".mcp.json"]);

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const fold = (text) => text.toLowerCase();

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

/** Whether Write or Edit may write `filePath`: a path inside the workshop, found by the identity of the workshop folder itself, with
    no part below it a link (the last part included, dangling or not), no `.claude` part, and a name that is not CLAUDE.md,
    CLAUDE.local.md or .mcp.json, in any letter case; one that is there must have its real path inside the workshop. */
function writable(filePath, cwd, home) {
  if (typeof filePath !== "string" || filePath === "") return false;
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
    default's and this Mac's entries), `web` "held" or "open", and `resolve` the look-up of a name, giving its addresses. Gives
    { decision: "allow"|"deny"|"pass", reason }. */
export async function openDecision(input, ctx) {
  const name = isObject(input) ? input.tool_name : undefined;
  const given = isObject(input) && isObject(input.tool_input) ? input.tool_input : {};
  const named = (type, what) => Array.isArray(ctx.allow) && ctx.allow.some((entry) => isObject(entry) && entry.type === type && entry.name === what);

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
  if (name === "Skill") return typeof given.skill === "string" && named("skill", given.skill) ? allow("a skill this folder allows") : deny(NOT_NAMED);
  if (!OWN_RULES.has(name) && named("tool", name)) return allow("a tool this folder allows");
  if (name.startsWith("mcp__")) return isConnector(name) && named("mcp-tool", name) ? allow("a connector's tool this Mac allows") : deny(NOT_NAMED);
  if (name === "Agent" || name === "Task") return allow("a subagent of Claude Code's own");
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
