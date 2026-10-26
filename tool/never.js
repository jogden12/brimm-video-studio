// The never list (design 2026-10-26, section 1, "The never list"): the tools her chat may never use under the open lock, whatever
// a setting or a per-Mac entry says. It is in code, not in her folder's settings, so that nothing written there changes it.
//
// A tool is on it by name (studio/never.json's `tools`: the tools that read an MCP server's resources, since the server they name
// may be a local extension's, and Workflow, which runs scripts whose agents' options, their kind and where they run, the guard
// cannot see, so that it gets around the limits put on the subagent tool), by kind (every local extension's MCP tool, which runs
// outside the sandbox, and every tool of the app's own, `mcp__ccd_*`), or by word: any MCP tool whose own name (after
// `mcp__<server>__`) holds one of NEVER_WORDS, so that a connector added later is caught too. The subagent tool, under either of
// its names, is on it when sent elsewhere or given an agent other than Claude Code's built-in ones, and Bash when it asks to run
// outside the sandbox.
//
// studio/never.json also holds what the settings deny for it (neverDenyRules): each local MCP server of the Code tab's tool list
// whole, and each connector tool the words catch by its exact name, since a connector's family cannot be denied whole (a deny
// beats the allow a named tool of it may get). tests/never.test.js runs every rule over that tool list
// (tests/fixtures/code-tab-tools.json), recorded on the Mac Studio; a connector added since is held by the guard alone until the
// list and never.json are recorded again.
import { readFileSync } from "node:fs";

const NEVER = JSON.parse(readFileSync(new URL("./studio/never.json", import.meta.url), "utf8"));

/** The words that, in an MCP tool's own name, mark a tool that posts, publishes, sends, shares, schedules, uploads or deletes, or
    deploys, submits, comments or responds. Stricter is closed: "comment" takes a tool that reads comments too. */
export const NEVER_WORDS = ["send", "post", "publish", "share", "schedule", "upload", "forward", "reply", "invite", "delete", "trash", "remove", "deploy", "submit", "comment", "respond"];
/** Claude Code's built-in agents, the only ones the subagent tool may be given (R15). */
export const BUILT_IN_AGENTS = ["general-purpose", "Explore", "Plan"];
/** The drawing tools, the app's own MCP tools that are not on the never list. */
export const DRAWING = ["mcp__visualize__show_widget", "mcp__visualize__read_me"];
/** The tools the settings deny unless this Mac's settings name them as a `tool` entry (R16): the Cron tools. Nothing on the never
    list is among them. */
const DENIED_UNLESS_NAMED = ["CronCreate", "CronDelete", "CronList"];

const CONNECTOR = /^mcp__[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}__/;
const MCP = /^mcp__(.+?)__(.+)$/;

/** Whether a tool is a claude.ai connector's, whose server the app names by an id. */
export const isConnector = (name) => typeof name === "string" && CONNECTOR.test(name);

/** Whether a tool is a local extension's (or one of the app's own): an `mcp__<server>__` tool that is not a connector's and not
    one of the drawing tools by its exact name. Such a tool runs outside the sandbox. */
export const isLocalExtension = (name) => typeof name === "string" && MCP.test(name) && !isConnector(name) && !DRAWING.includes(name);

/** Whether an MCP tool's own name holds a never word, in any letter case. */
const caughtByWord = (name) => {
  const own = name.match(MCP)[2].toLowerCase();
  return NEVER_WORDS.some((word) => own.includes(word));
};

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Whether the never list catches a tool call: its name, and for the subagent tool and Bash its input. */
export function neverCaught(name, input = {}) {
  if (typeof name !== "string") return true;
  const given = isObject(input) ? input : {};
  if (NEVER.tools.includes(name)) return true;
  if (name.startsWith("mcp__")) {
    if (!MCP.test(name)) return true;
    return isLocalExtension(name) || caughtByWord(name);
  }
  if (name === "Agent" || name === "Task") {
    if (Object.hasOwn(given, "isolation") || Object.hasOwn(given, "cwd")) return true;
    return Object.hasOwn(given, "subagent_type") && !BUILT_IN_AGENTS.includes(given.subagent_type);
  }
  if (name === "Bash") return Boolean(given.dangerouslyDisableSandbox);
  return false;
}

/** The settings' deny entries for the never list: its tools by name, each local MCP server of the Code tab's tool list whole, each
    connector tool its words catch by its exact name, and the Cron tools unless `allowed` names them as a `tool`. */
export function neverDenyRules(allowed = []) {
  const named = (tool) => Array.isArray(allowed) && allowed.some((a) => isObject(a) && a.type === "tool" && a.name === tool);
  return [
    ...NEVER.tools,
    ...NEVER.servers.map((server) => `mcp__${server}__*`),
    ...NEVER.connectorTools,
    ...DENIED_UNLESS_NAMED.filter((tool) => !named(tool)),
  ];
}
