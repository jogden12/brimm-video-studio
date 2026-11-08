// Loads each module alone: a cycle that fails at load shows here (L5, ruling 30).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const names = ["filing", "finish", "finish-check", "finish-ended", "late-wait", "unedited", "switch", "edit", "guide", "detached", "reading", "dropbox", "put-here", "originals", "where", "workcopy", "app", "app-reel", "free", "plan-project"];
let bad = 0;
for (const name of names) {
  const ran = spawnSync(process.execPath, ["--input-type=module", "-e", `await import("./${name}.js")`], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
  if (ran.status !== 0) {
    bad += 1;
    console.log(`FAIL ${name}: ${ran.stderr.split("\n").slice(0, 3).join(" | ")}`);
  }
}
console.log(bad ? `${bad} failed` : "all load");
