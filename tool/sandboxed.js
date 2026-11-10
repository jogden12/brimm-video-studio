// edit.js's own check that it is not inside Claude Code's sandbox (design 2026-10-26, section 1, "brimm-video's own command, outside
// the sandbox", item 3; C24, C40). The guard lets edit.js run only in the one spelling her folder's settings exclude from the sandbox,
// but a spelling that slips past it, or the app's --settings dropping the folder's entry (C7), would run edit.js inside, where it
// would fail partway through a command. So it refuses at its start: when SANDBOX_RUNTIME=1, which Claude Code gives every sandboxed
// command (C24), and, since a command can take that away (`env -u SANDBOX_RUNTIME`), when `ps` of its own process cannot be started
// or prints no process id: the sandbox refuses to start `ps` at all, which is setuid root, and Node then gets a spawn error (EPERM),
// not a message (C40). `ps` is asked about edit.js's own process, which is always there, never its parent: Node reads its parent's id
// once, at start, and a detached run outlives the edit.js that started it (startDetached), so `ps` of that id would fail at random.
import { spawnSync } from "node:child_process";
import { saidHere } from "./build.js";

export const SANDBOXED = "BRIMM Video Studio was run inside Claude Code's sandbox: ask Jason.";

/** SANDBOXED when edit.js is run inside Claude Code's sandbox, else "": `env` is its environment, `pid` its own process's id, and
    `spawn` spawnSync or a test's stand-in. A spawn that throws, gives an error of any kind, ends with anything but 0, or prints
    anything but one process id, says the sandbox. `build` is this Mac's build: an installed Mac, where no Jason is at hand, is sent to
    the support contact its build names (build.js saidHere). */
export function sandboxedWhy({ env = {}, pid, spawn = spawnSync, build }) {
  const inside = saidHere(SANDBOXED, build);
  if (env.SANDBOX_RUNTIME === "1") return inside;
  try {
    const ran = spawn("/bin/ps", ["-o", "ppid=", "-p", String(pid)], { encoding: "utf8", timeout: 5000 });
    if (!ran || ran.error || ran.status !== 0 || typeof ran.stdout !== "string" || !/^\s*\d+\s*$/.test(ran.stdout)) return inside;
    return "";
  } catch (e) {
    return inside;
  }
}
