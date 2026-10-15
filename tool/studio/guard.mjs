// Sallie's session may run one program: brimm-video's edit.js, from this Mac's checkout. This hook answers every tool call
// before Claude Code asks anyone, in whatever mode the session is in: yes to edit.js, nothing (Claude Code's own rules) for
// reads inside her folder, and no to everything else. The checkout is the one this file is in, node the one the installer
// found and the folder the one settings.js wrote, both of which guard.sh is given.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { guardDecision } from "../studio.js";

const answer = (decision, reason) =>
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason } }));
try {
  const node = process.argv[2];
  const checkout = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
  const { decision, reason } = guardDecision(JSON.parse(readFileSync(0, "utf8") || "{}"), { checkout, node, folder: process.argv[3] || "" });
  if (decision !== "pass") answer(decision, reason);
} catch {
  answer("deny", "brimm-video's guard could not check this. Ask Jason.");
}
