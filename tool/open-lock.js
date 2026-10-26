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
// Steps 1, 2, 4 and 5 are not here yet: until they are, Bash, Read, Write and Edit fall to step 10.
import { isConnector, neverCaught } from "./never.js";
import { fetchWhy } from "./fetchable.js";

export const NEVER_REFUSED = "That is never done from this folder: nothing here posts, sends, publishes or shares, or works the screen, the browser or another session. Ask Jason.";
export const NOT_NAMED = "That is not among the tools and skills this folder allows. Ask Jason.";
export const WEB_HELD = "The web is not turned on for this folder yet: ask Jason.";

/** The tools left to Claude Code's own rules (step 9): its card, its list of what it is doing and ToolSearch, which only loads a
    tool that then meets this guard. The card must stay so: an answer of the guard's would answer it without her. */
const LEFT_TO_CLAUDE_CODE = new Set(["AskUserQuestion", "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch"]);
/** The tools with a rule of their own, which no `tool` entry of the allowlist speaks for. */
const OWN_RULES = new Set(["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Skill", "Agent", "Task", "SendUserFile", "WebFetch", "WebSearch", ...LEFT_TO_CLAUDE_CODE]);

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
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
