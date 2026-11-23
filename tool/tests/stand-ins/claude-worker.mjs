// A stand-in for `claude -p` as the Reel Kit worker runs it (reel-kit-worker.js runJob; plan Task 10), for tests: no test runs the real
// claude. It reads its arguments and its prompt (standard input), and plays a scripted run as Claude Code's stream-json prints one: an init
// event first (the model and permission mode it was given, the session it was given or resumes, no MCP server), then for each step the
// prompt's "Your steps, in order:" line names, the worker's status file (work/worker-status.json, as WORKER.md says) and an assistant event,
// then a result event.
//
// The test bakes what it wants into the small script that runs this, since the worker runs in Reel Kit's own environment, which carries no
// variable of a test's:
//   - CLAUDE_WORKER_LOG: a file it appends one JSON line to as it ends: its arguments, folder, prompt, the names and Reel Kit values of its
//     environment, the steps it ran and the hook's answers;
//   - CLAUDE_WORKER_STANDIN, the scenario: "" (every step, then success), "usage-limit" (two steps, then Claude Code's usage-limit result,
//     exit 1), "wait" (every step, but the last only once <project>/work/go-on is there), "hang" (two steps, then nothing until it is
//     killed), "needs" (CLAUDE_WORKER_NEEDS, a JSON list of {beat, text}, written with the "beats" step and after), "bad-status" (its first
//     step, then a status file far too large, and nothing more), "unsafe-init" (an init in bypassPermissions mode, then its steps),
//     "plant" (every step, having left three of Studio's own names deep in the project at its first), "stubborn" (its first step, a `sleep` of its own in its process group, its pid in work/grandchild.pid, SIGTERM ignored, then
//     nothing until it is killed),
//     "hook" (before its steps, each call of CLAUDE_WORKER_CALLS, a JSON list, handed to the PreToolUse hook its --settings file names, as
//     Claude Code does: `<command> <args…>` with the call on standard input).
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const after = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const scenario = process.env.CLAUDE_WORKER_STANDIN ?? "";
const prompt = readFileSync(0, "utf8");
const cwd = process.cwd();
const session = after("--resume") ?? after("--session-id") ?? randomUUID();
const steps = (/^Your steps, in order: (.+)\.$/m.exec(prompt)?.[1] ?? "").split(", ").filter(Boolean);
const needs = scenario === "needs" ? JSON.parse(process.env.CLAUDE_WORKER_NEEDS ?? "[]") : [];
const ran = [];
const hook = [];

const emit = (event) => process.stdout.write(`${JSON.stringify({ session_id: session, ...event })}\n`);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const status = (value) => {
  mkdirSync(join(cwd, "work"), { recursive: true });
  const file = join(cwd, "work", "worker-status.json");
  writeFileSync(`${file}.tmp`, typeof value === "string" ? value : JSON.stringify(value));
  renameSync(`${file}.tmp`, file);
};
const seen = ["REEL_KIT_HOME", "HF_HUB_OFFLINE", "PIP_NO_INDEX", "UV_OFFLINE", "HOME", "PATH", "TMPDIR", "CLAUDE_CODE_TMPDIR"];
function logged(extra = {}) {
  const env = Object.fromEntries(Object.keys(process.env).filter((k) => !k.startsWith("CLAUDE_WORKER_") && k !== "__CF_USER_TEXT_ENCODING").map((k) => [k, seen.includes(k) ? process.env[k] : "set"]));
  if (process.env.CLAUDE_WORKER_LOG) appendFileSync(process.env.CLAUDE_WORKER_LOG, `${JSON.stringify({ args, cwd, prompt, env, stepsRun: ran, hook, ...extra })}\n`);
}

/** Hand a tool call to the hook the settings file names, as Claude Code does, and say what it answered: "deny", "pass" or "blocked". */
function askHook(call) {
  const settings = JSON.parse(readFileSync(after("--settings"), "utf8"));
  const [entry] = settings.hooks.PreToolUse[0].hooks;
  const ran = spawnSync(entry.command, entry.args, { input: JSON.stringify({ hook_event_name: "PreToolUse", session_id: session, cwd, ...call }), encoding: "utf8" });
  if (ran.status !== 0) return "blocked";
  const said = ran.stdout.trim() ? JSON.parse(ran.stdout).hookSpecificOutput.permissionDecision : "pass";
  return said;
}

emit({ type: "system", subtype: "init", cwd, model: after("--model"), permissionMode: scenario === "unsafe-init" ? "bypassPermissions" : after("--permission-mode"),
  tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent"], mcp_servers: [] });
if (scenario === "hook") for (const call of JSON.parse(process.env.CLAUDE_WORKER_CALLS ?? "[]")) hook.push({ call: call.tool_name, decision: askHook(call) });

for (const [i, step] of steps.entries()) {
  if (scenario === "wait" && i === steps.length - 1) while (!existsSync(join(cwd, "work", "go-on"))) await pause(10);
  status({ step, needs: steps.indexOf("beats") !== -1 && i >= steps.indexOf("beats") ? needs : [] });
  ran.push(step);
  emit({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: `At ${step}.` }] } });
  await pause(40);
  if (scenario === "bad-status") {
    status("x".repeat(200000));
    await pause(80);
    logged();
    emit({ type: "result", subtype: "success", is_error: false, result: "Done." });
    process.exit(0);
  }
  if (scenario === "usage-limit" && i === 1) {
    logged();
    emit({ type: "result", subtype: "error_during_execution", is_error: true, result: "Claude AI usage limit reached. Your limit resets at 3pm." });
    process.exit(1);
  }
  if (scenario === "plant" && i === 0) {
    // What a worker could leave by making the names in its temp folder and moving the folder in: the moves stood in by writes.
    for (const rel of ["sub/CLAUDE.md", "cards/c1/.Claude/settings.json", "fx/f1/agents.MD"]) {
      mkdirSync(join(cwd, rel, ".."), { recursive: true });
      writeFileSync(join(cwd, rel), "planted\n");
    }
  }
  if (scenario === "stubborn" && i === 0) {
    process.on("SIGTERM", () => {});
    const child = spawn("/bin/sleep", ["30"], { stdio: "ignore" });
    writeFileSync(join(cwd, "work", "grandchild.pid"), String(child.pid));
    logged();
    for (;;) await pause(1000);
  }
  if (scenario === "hang" && i === 1) {
    logged();
    for (;;) await pause(1000);
  }
}
logged();
emit({ type: "result", subtype: "success", is_error: false, result: "Done." });
