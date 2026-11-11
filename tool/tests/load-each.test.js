// Every module of the tool loads alone (L5, ruling 30; B0-F15): an import cycle that makes a module fail at load, when it is the first one loaded, shows here.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tool = fileURLToPath(new URL("..", import.meta.url));
const modules = readdirSync(tool).filter((name) => name.endsWith(".js")).sort();
const setupFolder = new URL("../setup/", import.meta.url);
const setupModules = existsSync(setupFolder) ? readdirSync(setupFolder).filter((name) => name.endsWith(".js")).sort() : [];
const studioAppFolder = new URL("../studio-app/", import.meta.url);
const studioAppModules = existsSync(studioAppFolder) ? readdirSync(studioAppFolder).filter((name) => name.endsWith(".js")).sort() : [];

describe("each module of the tool loads as the first one", () => {
  it("loads every tool/*.js alone", () => {
    const failed = [];
    for (const name of modules) {
      const ran = spawnSync(process.execPath, ["--input-type=module", "-e", `await import("./${name}")`], { cwd: tool, encoding: "utf8", timeout: 20000 });
      if (ran.status !== 0) failed.push(`${name}: ${String(ran.stderr).split("\n").slice(0, 3).join(" | ")}`);
    }
    assert.deepEqual(failed, []);
  });

  it("loads every tool/setup/*.js alone", () => {
    assert.ok(setupModules.length > 0);
    const failed = [];
    for (const name of setupModules) {
      const ran = spawnSync(process.execPath, ["--input-type=module", "-e", `await import("./setup/${name}")`], { cwd: tool, encoding: "utf8", timeout: 20000 });
      if (ran.status !== 0) failed.push(`setup/${name}: ${String(ran.stderr).split("\n").slice(0, 3).join(" | ")}`);
    }
    assert.deepEqual(failed, []);
  });

  it("loads every tool/studio-app/*.js alone", () => {
    assert.ok(studioAppModules.length > 0);
    const failed = [];
    for (const name of studioAppModules) {
      const ran = spawnSync(process.execPath, ["--input-type=module", "-e", `await import("./studio-app/${name}")`], { cwd: tool, encoding: "utf8", timeout: 20000 });
      if (ran.status !== 0) failed.push(`studio-app/${name}: ${String(ran.stderr).split("\n").slice(0, 3).join(" | ")}`);
    }
    assert.deepEqual(failed, []);
  });
});
