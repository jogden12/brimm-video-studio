// Studio's own home folder (BRIMM_VIDEO_HOME), for by-hand checks: where Studio keeps its settings, work folder, runs, pendings,
// progress and log. HOME itself stays the real one, so every program Studio starts runs as it does. Every test writes only in
// temp folders; the command lines run here are Studio's own, stopped before they reach any program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { homeRefusal, programHome, studioHome } from "../home.js";
import { settingsFile, readSettings, writeSettings, workFolder, runsFolder, downloadsFolder, pendingFolder } from "../settings.js";
import { progressFolder } from "../progress.js";
import { contextFor } from "../edit.js";
import { depsFor } from "../unedited.js";
import { spawnDetached } from "../detached.js";
import { guardDecision } from "../studio.js";
import { openDecision } from "../open-lock.js";
import { gatedIndex, gatedPlaces } from "../places.js";
import { openWorld, SESSION } from "./open-world.js";

const tool = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const refusal = (given) => `BRIMM_VIDEO_HOME must be a whole path: ${given}.`;
/** Two made-up folders: the real home, and the scratch home a check gives Studio. */
function homes() {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-studio-home-")));
  return { real: join(dir, "real"), scratch: join(dir, "scratch"), dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}
/** Run one of Studio's command lines with only the environment given. */
const run = (name, args, env) => spawnSync(process.execPath, [tool(name), ...args], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8", timeout: 20000 });

describe("Studio's own home", () => {
  it("is BRIMM_VIDEO_HOME when that is set, else HOME, else the Mac's own word for it", () => {
    assert.equal(studioHome({ BRIMM_VIDEO_HOME: "/scratch/home", HOME: "/real/home" }), "/scratch/home");
    assert.equal(studioHome({ HOME: "/real/home" }), "/real/home");
    assert.equal(studioHome({}), homedir());
    assert.equal(studioHome({ HOME: "" }), homedir());
  });
  it("is never quietly the real home when BRIMM_VIDEO_HOME is set but is not a whole path", () => {
    for (const given of ["", "scratch/home", "~/home", "./home", " "]) {
      assert.throws(() => studioHome({ BRIMM_VIDEO_HOME: given, HOME: "/real/home" }), { message: refusal(given) }, JSON.stringify(given));
      assert.equal(homeRefusal({ BRIMM_VIDEO_HOME: given, HOME: "/real/home" }), refusal(given));
    }
    assert.equal(homeRefusal({ BRIMM_VIDEO_HOME: "/scratch/home" }), "");
    assert.equal(homeRefusal({ HOME: "/real/home" }), "");
  });
  it("leaves the programs Studio starts the real HOME, and the given home when BRIMM_VIDEO_HOME is not set", () => {
    assert.equal(programHome("/given/home", { BRIMM_VIDEO_HOME: "/scratch/home", HOME: "/real/home" }), "/real/home");
    assert.equal(programHome("/given/home", { HOME: "/real/home" }), "/given/home");
    assert.equal(programHome("/given/home", {}), "/given/home");
  });
});

describe("a command line given BRIMM_VIDEO_HOME that is not a whole path", () => {
  for (const [name, args] of [["edit.js", ["episodes"]], ["settings.js", ["show"]], ["unedited.js", ["--watch", "/nonexistent-brimm-folder"]]]) {
    it(`${name} says so and ends with 2`, () => {
      const t = homes();
      try {
        for (const given of ["", "relative/home"]) {
          const ran = run(name, args, { HOME: t.real, BRIMM_VIDEO_HOME: given });
          assert.equal(ran.status, 2, `${name} ${JSON.stringify(given)}: ${ran.stdout}${ran.stderr}`);
          assert.ok(ran.stdout.includes(refusal(given)), `${name} ${JSON.stringify(given)}: ${ran.stdout}`);
        }
      } finally {
        t.done();
      }
    });
  }
});

describe("with BRIMM_VIDEO_HOME set", () => {
  it("settings.js reads and writes its settings in it, and none under HOME", () => {
    const t = homes();
    try {
      writeSettings(t.scratch, { machine: "Mac Studio", root: "/x/BRIMM Video", checkout: "/x/checkout" });
      const env = { HOME: t.real, BRIMM_VIDEO_HOME: t.scratch };
      const shown = run("settings.js", ["show"], env);
      assert.equal(shown.status, 0, shown.stdout + shown.stderr);
      assert.ok(shown.stdout.includes(`in ${settingsFile(t.scratch)}:`), shown.stdout);
      assert.ok(shown.stdout.includes(`Work folder:  ${workFolder(t.scratch)}`), shown.stdout);
      const set = run("settings.js", ["set", "--import", "light"], env);
      assert.equal(set.status, 0, set.stdout + set.stderr);
      assert.equal(readSettings(t.scratch).settings.import, "light");
      assert.equal(existsSync(t.real), false, "nothing was made under HOME");
    } finally {
      t.done();
    }
  });
  it("settings.js with only HOME set is as it was", () => {
    const t = homes();
    try {
      writeSettings(t.real, { machine: "Mac Studio", root: "/x/BRIMM Video", checkout: "/x/checkout" });
      const shown = run("settings.js", ["show"], { HOME: t.real });
      assert.equal(shown.status, 0, shown.stdout + shown.stderr);
      assert.ok(shown.stdout.includes(`in ${settingsFile(t.real)}:`), shown.stdout);
    } finally {
      t.done();
    }
  });
  it("edit.js reads this Mac's settings from it, and works in its folders", () => {
    const t = homes();
    const before = { home: process.env.HOME, own: process.env.BRIMM_VIDEO_HOME };
    try {
      writeSettings(t.scratch, { machine: "Mac Studio", root: "/x/BRIMM Video", checkout: "/x/checkout" });
      process.env.HOME = t.real;
      process.env.BRIMM_VIDEO_HOME = t.scratch;
      const ctx = contextFor({ say: () => {} });
      assert.equal(ctx.why, undefined);
      assert.equal(ctx.home, t.scratch);
      assert.equal(ctx.settings.machine, "Mac Studio");
      delete process.env.BRIMM_VIDEO_HOME;
      assert.ok(contextFor({ say: () => {} }).why, "with HOME alone there are no settings");
    } finally {
      process.env.HOME = before.home;
      if (before.own === undefined) delete process.env.BRIMM_VIDEO_HOME;
      else process.env.BRIMM_VIDEO_HOME = before.own;
      t.done();
    }
  });
  it("the import's deps put its settings, work, runs, Downloads, pendings and progress under it, and none under HOME", () => {
    const t = homes();
    try {
      writeSettings(t.scratch, { machine: "Mac Studio", root: "/x/BRIMM Video", checkout: "/x/checkout" });
      const deps = depsFor({ model: "m", swift: "" }, () => {}, { HOME: t.real, BRIMM_VIDEO_HOME: t.scratch });
      assert.equal(deps.home, t.scratch);
      assert.equal(deps.settings.machine, "Mac Studio");
      for (const path of [workFolder(deps.home), runsFolder(deps.home), downloadsFolder(deps.home), pendingFolder(deps.home), progressFolder(deps.home)]) {
        assert.ok(path.startsWith(`${t.scratch}/`), path);
        assert.ok(!path.startsWith(`${t.real}/`), path);
      }
      const plain = depsFor({ model: "m", swift: "" }, () => {}, { HOME: t.real });
      assert.equal(plain.home, t.real);
      assert.equal(plain.settings, null);
    } finally {
      t.done();
    }
  });
  it("a detached run's log is under it, and the run keeps BRIMM_VIDEO_HOME and the real HOME in its environment", () => {
    const t = homes();
    try {
      const started = [];
      const child = { on() {}, unref() {} };
      const env = { HOME: t.real, BRIMM_VIDEO_HOME: t.scratch, CLAUDECODE: "1", PATH: "/usr/bin" };
      spawnDetached("node", ["unedited.js"], { env, spawn: (cmd, args, options) => { started.push(options); return child; } });
      assert.ok(existsSync(join(t.scratch, "Library", "Logs", "brimm-video.log")), "the log is under the scratch home");
      assert.equal(existsSync(join(t.real, "Library")), false, "nothing under HOME");
      assert.equal(started[0].env.BRIMM_VIDEO_HOME, t.scratch);
      assert.equal(started[0].env.HOME, t.real);
      assert.equal(started[0].env.CLAUDECODE, undefined);
    } finally {
      t.done();
    }
  });
  it("a detached run's log stays under HOME when BRIMM_VIDEO_HOME is not set", () => {
    const t = homes();
    try {
      spawnDetached("node", [], { env: { HOME: t.real }, spawn: () => ({ on() {}, unref() {} }) });
      assert.ok(existsSync(join(t.real, "Library", "Logs", "brimm-video.log")));
    } finally {
      t.done();
    }
  });
});

describe("Claude can never set BRIMM_VIDEO_HOME in her folder", () => {
  const CHECKOUT = "/Users/sallie/Claude Code/BRIMM video";
  const NODE = "/opt/homebrew/bin/node";
  /** Every way to set it in front of, or before, a command that names `edit`. */
  const forms = (edit) => [
    `BRIMM_VIDEO_HOME=/tmp/x ${edit} episodes`,
    `BRIMM_VIDEO_HOME="/tmp/x" ${edit} episodes`,
    `HOME=/tmp/x BRIMM_VIDEO_HOME=/tmp/x ${edit} episodes`,
    `env BRIMM_VIDEO_HOME=/tmp/x ${edit} episodes`,
    `/usr/bin/env BRIMM_VIDEO_HOME=/tmp/x ${edit} episodes`,
    `export BRIMM_VIDEO_HOME=/tmp/x; ${edit} episodes`,
    `export BRIMM_VIDEO_HOME=/tmp/x && ${edit} episodes`,
    `declare -x BRIMM_VIDEO_HOME=/tmp/x; ${edit} episodes`,
    `(BRIMM_VIDEO_HOME=/tmp/x; ${edit} episodes)`,
    `sh -c 'BRIMM_VIDEO_HOME=/tmp/x ${edit} episodes'`,
    `${edit} episodes; BRIMM_VIDEO_HOME=/tmp/x`
  ];
  it("today's guard refuses each form, with edit.js or without", () => {
    const edit = `"${NODE}" "${CHECKOUT}/tool/edit.js"`;
    for (const command of [...forms(edit), "BRIMM_VIDEO_HOME=/tmp/x date", "export BRIMM_VIDEO_HOME=/tmp/x", "env BRIMM_VIDEO_HOME=/tmp/x"]) {
      assert.equal(guardDecision({ tool_name: "Bash", tool_input: { command } }, { checkout: CHECKOUT, node: NODE }).decision, "deny", command);
    }
  });
  it("the open guard refuses each form that names edit.js or Studio's tool folder", async () => {
    const w = openWorld();
    try {
      const ctx = { checkout: w.checkout, node: w.node, folder: w.folder, home: w.home, uid: w.uid, tmp: w.tmp, index: gatedIndex(gatedPlaces(w.facts), []), allow: w.facts.allow, web: "held", resolve: async () => ["93.184.215.14"], loosened: false, held: false };
      const bash = (command) => openDecision({ session_id: SESSION, transcript_path: join(w.home, ".claude", "projects", "x", `${SESSION}.jsonl`), cwd: w.folder, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command, description: "x" } }, ctx);
      const edit = `"${w.node}" "${w.checkout}/tool/edit.js"`;
      const commands = [
        ...forms(edit),
        `BRIMM_VIDEO_HOME=/tmp/x ${w.node} "${w.checkout}/tool/settings.js" show`,
        `BRIMM_VIDEO_HOME=/tmp/x ${w.node} "${w.checkout}/tool/unedited.js"`,
        `env BRIMM_VIDEO_HOME=/tmp/x ${w.node} ${w.checkout}/tool/settings.js show`
      ];
      for (const command of commands) assert.equal((await bash(command)).decision, "deny", command);
    } finally {
      w.done();
    }
  });
});
