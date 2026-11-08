// Every module of the tool loads alone (L5, ruling 30; B0-F15): an import cycle that makes a module fail at load, when it is the first one loaded, shows here.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tool = fileURLToPath(new URL("..", import.meta.url));
const modules = readdirSync(tool).filter((name) => name.endsWith(".js")).sort();

describe("each module of the tool loads as the first one", () => {
  it("loads every tool/*.js alone", () => {
    const failed = [];
    for (const name of modules) {
      const ran = spawnSync(process.execPath, ["--input-type=module", "-e", `await import("./${name}")`], { cwd: tool, encoding: "utf8", timeout: 20000 });
      if (ran.status !== 0) failed.push(`${name}: ${String(ran.stderr).split("\n").slice(0, 3).join(" | ")}`);
    }
    assert.deepEqual(failed, []);
  });
});
