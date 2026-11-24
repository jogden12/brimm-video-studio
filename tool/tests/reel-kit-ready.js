// What makes a made-up Mac's Reel Kit ready to run a job (reel-kit-install.js reelKitReady), as a whole install leaves it: the pin's
// kit with its new.py, Reel Kit's Python, `.setup-version` of the pin's version, and the venv's `reel-kit.pth` naming the kit's pipeline.
// A test that makes its own kit and Python calls this after.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PIN, kitDir, reelKitHome } from "../reel-kit.js";

export function markReady(home) {
  mkdirSync(join(kitDir(home), "pipeline"), { recursive: true });
  writeFileSync(join(kitDir(home), "pipeline", "new.py"), "# made up\n", { flag: "a" });
  const rkh = reelKitHome(home);
  mkdirSync(rkh, { recursive: true });
  writeFileSync(join(rkh, ".setup-version"), `${PIN.version}\n`);
  const site = join(rkh, ".venv", "lib", `python${PIN.python.split(".").slice(0, 2).join(".")}`, "site-packages");
  mkdirSync(site, { recursive: true });
  writeFileSync(join(site, "reel-kit.pth"), `${join(kitDir(home), "pipeline")}\n`);
}
