// The Reel Kit worker's PreToolUse hook (plan Task 10, Decision 4): it answers every tool call of the worker and of its helper agents by
// reel-kit-worker-tools.js workerDecision, the table its permission lists come from too. It is given the project, the kit, REEL_KIT_HOME and
// its tools/bin by worker-guard.sh, and the call on standard input. A call the table allows gets no answer (the permission lists, which allow
// the same, decide); any other is refused, and so is anything that goes wrong here. Once it has answered it ends.
import { readFileSync } from "node:fs";
import { workerDecision } from "../reel-kit-worker-tools.js";

const end = (text) => (text ? process.stdout.write(text, () => process.exit(0)) : process.exit(0));
const deny = (reason) =>
  end(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
try {
  const [project, kit, rkHome, bin] = process.argv.slice(2);
  if (![project, kit, rkHome, bin].every((path) => typeof path === "string" && path.startsWith("/"))) throw new Error("the guard's folders");
  const { decision, reason } = workerDecision(JSON.parse(readFileSync(0, "utf8")), { project, kit, rkHome, bin });
  if (decision === "pass") end("");
  else deny(reason);
} catch {
  deny("Studio's Reel Kit guard could not check this.");
}
