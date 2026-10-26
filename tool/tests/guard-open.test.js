// The open guard (open-lock.js; design 2026-10-26, section 6, "The guard's decision, in order"): what her chat may do under the open
// lock, step by step. Every test is on a made-up open-lock Mac (open-world.js) with a stand-in for the look-up of names, so that no
// test asks this Mac's resolver, reads its settings or runs `ps`.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NEVER_REFUSED, NOT_NAMED, WEB_HELD, openDecision } from "../open-lock.js";
import { DRAWING, neverCaught } from "../never.js";
import { LOCAL_ADDRESS } from "../fetchable.js";
import { gatedIndex, gatedPlaces, realOf } from "../places.js";
import { SESSION, openWorld } from "./open-world.js";

const CONNECTOR = "mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__";

/** A look-up from a table: a name in it answers its addresses, any other is not found. */
const resolver = (table) => async (host) => {
  if (Object.hasOwn(table, host)) return table[host];
  throw Object.assign(new Error(`${host} not found`), { code: "ENOTFOUND" });
};
const PUBLIC = resolver({ "example.com": ["93.184.215.14"], "www.example.com": ["93.184.215.14"], "private.example.com": ["10.0.0.5"] });

describe("the open guard, I: what is never, named or left to Claude Code", () => {
  let w;
  let ctx;
  before(() => {
    w = openWorld();
    ctx = { checkout: w.checkout, node: w.node, folder: w.folder, home: w.home, uid: w.uid, tmp: w.tmp, index: gatedIndex(gatedPlaces(w.facts), [join(realOf(w.root), "Assets")]), allow: w.facts.allow, web: "held", resolve: PUBLIC, loosened: false, held: false };
  });
  after(() => w.done());
  /** What the open guard answers to `name` with `input`, in a chat of her folder, `more` changing the context. */
  const decide = (name, input, more = {}) => openDecision({ session_id: SESSION, transcript_path: join(w.home, ".claude", "projects", "x", `${SESSION}.jsonl`), cwd: w.folder, hook_event_name: "PreToolUse", tool_name: name, tool_input: input }, { ...ctx, ...more });

  it("refuses every never entry, fed the Code tab's real tool list", async () => {
    const { tools } = JSON.parse(readFileSync(new URL("./fixtures/code-tab-tools.json", import.meta.url), "utf8"));
    const never = tools.filter((n) => neverCaught(n));
    assert.ok(never.length > 50);
    for (const name of never) assert.deepEqual(await decide(name, {}), { decision: "deny", reason: NEVER_REFUSED }, name);
    assert.deepEqual(await decide("Bash", { command: "date", dangerouslyDisableSandbox: true }), { decision: "deny", reason: NEVER_REFUSED });
    assert.deepEqual(await decide("Agent", { prompt: "x", isolation: "worktree" }), { decision: "deny", reason: NEVER_REFUSED });
  });
  it("leaves the card, the task list and ToolSearch to Claude Code; the subagent tool named Task is not among them", async () => {
    for (const name of ["AskUserQuestion", "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch"]) assert.deepEqual(await decide(name, {}), { decision: "pass", reason: "" }, name);
    assert.equal((await decide("Task", { prompt: "x" })).decision, "allow");
  });
  it("refuses Monitor and a tool it does not know", async () => {
    assert.deepEqual(await decide("Monitor", { command: "tail -f x" }), { decision: "deny", reason: NEVER_REFUSED });
    for (const name of ["SomeToolAddedLater", "CronCreate", "Workflow", "NotebookRead", undefined]) assert.equal((await decide(name, {})).decision, "deny", String(name));
    assert.deepEqual(await decide("SomeToolAddedLater", {}), { decision: "deny", reason: NOT_NAMED });
  });
  it("allows a named skill and refuses another", async () => {
    for (const skill of ["brimm-edit", "frontend-design", "theme-factory", "brimm-graphics"]) assert.equal((await decide("Skill", { skill })).decision, "allow", skill);
    for (const skill of ["canva-creator", "superpowers:brainstorming", "", undefined]) assert.deepEqual(await decide("Skill", { skill }), { decision: "deny", reason: NOT_NAMED }, String(skill));
    assert.equal((await decide("Skill", { skill: "canva-creator" }, { allow: [...ctx.allow, { type: "skill", name: "canva-creator" }] })).decision, "allow");
  });
  it("allows a connector's tool only when this Mac names it exactly, and never a local extension's or a posting one", async () => {
    const allow = [...ctx.allow, { type: "mcp-tool", name: `${CONNECTOR}list_designs` }, { type: "mcp-tool", name: "mcp__PDF_Tools__read_pdf_content" }, { type: "mcp-tool", name: `${CONNECTOR}send_invoice` }, { type: "skill", name: `${CONNECTOR}list_other` }];
    assert.deepEqual(await decide(`${CONNECTOR}list_designs`, {}, { allow }), { decision: "allow", reason: "a connector's tool this Mac allows" });
    assert.deepEqual(await decide(`${CONNECTOR}list_other`, {}, { allow }), { decision: "deny", reason: NOT_NAMED });
    assert.deepEqual(await decide(`${CONNECTOR}list_designs`, {}), { decision: "deny", reason: NOT_NAMED });
    assert.deepEqual(await decide("mcp__PDF_Tools__read_pdf_content", {}, { allow }), { decision: "deny", reason: NEVER_REFUSED });
    assert.deepEqual(await decide(`${CONNECTOR}send_invoice`, {}, { allow }), { decision: "deny", reason: NEVER_REFUSED });
  });
  it("allows the subagent tool as Agent and as Task with no isolation, no cwd and a built-in agent, and refuses it otherwise", async () => {
    for (const name of ["Agent", "Task"]) {
      for (const input of [{ prompt: "x" }, { prompt: "x", subagent_type: "general-purpose" }, { prompt: "x", subagent_type: "Explore" }, { prompt: "x", subagent_type: "Plan" }]) assert.equal((await decide(name, input)).decision, "allow", `${name} ${JSON.stringify(input)}`);
      for (const input of [{ prompt: "x", isolation: "remote" }, { prompt: "x", cwd: "/tmp" }, { prompt: "x", subagent_type: "code-review:reviewer" }]) assert.deepEqual(await decide(name, input), { decision: "deny", reason: NEVER_REFUSED }, `${name} ${JSON.stringify(input)}`);
    }
  });
  it("refuses WebFetch and WebSearch while the web tools are held", async () => {
    assert.deepEqual(await decide("WebFetch", { url: "https://example.com/", prompt: "x" }), { decision: "deny", reason: WEB_HELD });
    assert.deepEqual(await decide("WebSearch", { query: "x" }), { decision: "deny", reason: WEB_HELD });
  });
  it("allows WebSearch and a public WebFetch once the web tools are opened, and refuses a numeric or local one", async () => {
    const open = { web: "open" };
    assert.equal((await decide("WebSearch", { query: "x" }, open)).decision, "allow");
    assert.equal((await decide("WebFetch", { url: "https://example.com/a", prompt: "x" }, open)).decision, "allow");
    for (const url of ["http://127.0.0.1:47321/", "http://192.168.1.1/", "http://localhost/", "http://router/", "https://private.example.com/"]) assert.deepEqual(await decide("WebFetch", { url, prompt: "x" }, open), { decision: "deny", reason: LOCAL_ADDRESS }, url);
    assert.equal((await decide("WebFetch", { url: "https://unknown.example.org/", prompt: "x" }, open)).decision, "deny");
    assert.equal((await decide("WebFetch", { prompt: "x" }, open)).decision, "deny");
  });
  it("allows the drawing tools and PushNotification by the default allowlist, the drawing tools though they are MCP tools no mcp-tool entry names", async () => {
    for (const name of DRAWING) assert.deepEqual((await decide(name, {})).decision, "allow", name);
    assert.equal((await decide("PushNotification", { message: "x" })).decision, "allow");
    assert.deepEqual(await decide("mcp__visualize__show_widget", {}, { allow: [] }), { decision: "deny", reason: NOT_NAMED });
  });
  it("lets no per-Mac tool entry speak for a tool with a rule of its own: the web tools, the card and the subagent tool", async () => {
    const allow = [...ctx.allow, ...["WebFetch", "WebSearch", "AskUserQuestion", "Agent"].map((name) => ({ type: "tool", name }))];
    assert.deepEqual(await decide("WebFetch", { url: "https://example.com/", prompt: "x" }, { allow }), { decision: "deny", reason: WEB_HELD });
    assert.deepEqual(await decide("WebSearch", { query: "x" }, { allow }), { decision: "deny", reason: WEB_HELD });
    assert.deepEqual(await decide("AskUserQuestion", { questions: [] }, { allow }), { decision: "pass", reason: "" });
    assert.deepEqual(await decide("Agent", { prompt: "x", isolation: "remote" }, { allow }), { decision: "deny", reason: NEVER_REFUSED });
  });
  it("allows the Cron tools and Workflow only when this Mac names them", async () => {
    const allow = [...ctx.allow, { type: "tool", name: "CronCreate" }];
    assert.equal((await decide("CronCreate", {}, { allow })).decision, "allow");
    assert.deepEqual(await decide("CronDelete", {}, { allow }), { decision: "deny", reason: NOT_NAMED });
  });
});
