// The background job, from tool/studio-app/Sources/Agent.swift, run through studio-check's agent command (Phase 6, Task 5). Each test
// makes an app folder whose node is a shell script that writes down how it was started.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkerPath, noChecker } from "./studio-app-check.js";

/** The folders this file has made, each removed when the file ends. */
const folders = [];
after(() => {
  for (const dir of folders) rmSync(dir, { recursive: true, force: true });
});

/**
 * A new app folder whose Contents/Resources/node/bin/node is a shell script that writes its arguments, one a line, then
 * $XPC_SERVICE_NAME and $PATH into `ran`, and its own process number into `pid`, and then runs `body`. The `ran` file is written
 * under another name and renamed, so it is whole once it is there. `body` may be a function of the folder's `got` and `ready` files'
 * paths. With `node: false` there is no node at all.
 */
function makeApp(body = "exit 0", { node = true } = {}) {
  const folder = mkdtempSync(join(tmpdir(), "brimm-studio-agent-"));
  folders.push(folder);
  const app = join(folder, "BRIMM Video Studio.app");
  const bin = join(app, "Contents", "Resources", "node", "bin");
  const tool = join(app, "Contents", "Resources", "Studio", "tool");
  mkdirSync(bin, { recursive: true });
  mkdirSync(tool, { recursive: true });
  writeFileSync(join(tool, "unedited.js"), "");
  const ran = join(folder, "ran");
  const pid = join(folder, "pid");
  const got = join(folder, "got");
  const ready = join(folder, "ready");
  if (node) {
    const script = [
      "#!/bin/sh",
      `printf '%s\\n' "$$" > '${pid}'`,
      `for word in "$@"; do printf '%s\\n' "$word"; done > '${ran}.part'`,
      `printf '%s\\n%s\\n' "$XPC_SERVICE_NAME" "$PATH" >> '${ran}.part'`,
      `mv '${ran}.part' '${ran}'`,
      typeof body === "function" ? body(got, ready) : body,
      ""
    ].join("\n");
    writeFileSync(join(bin, "node"), script);
    chmodSync(join(bin, "node"), 0o755);
  }
  return { app, ran, pid, got, ready, tool };
}

/** The lines of the `ran` file, without the last line feed. */
const lines = (path) => readFileSync(path, "utf8").replace(/\n$/, "").split("\n");

/** studio-check agent with `args`, waited for. Its stdout is never JSON, so check() is not used. */
function agent(args, env = process.env) {
  return spawnSync(checkerPath(), ["agent", ...args], { env, encoding: "utf8", timeout: 30000 });
}

/** Whether process `pid` is still there. */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Waits until `test()` is true, checking every 20 milliseconds, for at most `limit` milliseconds. */
async function until(test, limit = 10000) {
  const end = Date.now() + limit;
  while (!test()) {
    if (Date.now() > end) throw new Error("waited too long");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Starts the agent on a node that traps `name`, sends `name` to the agent once node's trap is set (node writes `ready` after its
    trap line), and gives the agent's status. */
async function signalled(name) {
  const made = makeApp((got, ready) => `trap 'printf "got ${name}\\n" >> "${got}"; exit 9' ${name}\n: > '${ready}'\nwhile :; do sleep 0.1; done`);
  const child = spawn(checkerPath(), ["agent", made.app], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const ended = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));
  let node = null;
  let timer;
  try {
    await until(() => existsSync(made.ready));
    node = Number(readFileSync(made.pid, "utf8"));
    child.kill(`SIG${name}`);
    const end = await Promise.race([ended, new Promise((resolve) => (timer = setTimeout(() => resolve(null), 10000)))]);
    return { end, stderr, got: readFileSync(made.got, "utf8"), node };
  } finally {
    clearTimeout(timer);
    // Nothing of the test is left running, whatever happened above.
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    if (node && alive(node)) process.kill(node, "SIGKILL");
  }
}

// The first test may wait for the compile, which has its own 180-second limit.
before(() => {
  if (!noChecker) checkerPath();
}, { timeout: 200000 });

describe("the background job", { skip: noChecker }, () => {
  it("the job runs the app's own node on unedited.js with what follows --agent", () => {
    const made = makeApp();
    const ran = agent([made.app, "--watch", "/a b", "--rules-only"]);
    assert.equal(ran.status, 0, ran.stderr);
    assert.equal(ran.stdout, "");
    assert.deepEqual(lines(made.ran).slice(0, 4), [join(made.tool, "unedited.js"), "--watch", "/a b", "--rules-only"]);
  });

  it("the job's environment is the app's own", () => {
    const made = makeApp();
    const ran = agent([made.app], { XPC_SERVICE_NAME: "com.thebrimm.claude-check", PATH: "/x:/usr/bin:/bin" });
    assert.equal(ran.status, 0, ran.stderr);
    assert.deepEqual(lines(made.ran), [join(made.tool, "unedited.js"), "com.thebrimm.claude-check", "/x:/usr/bin:/bin"]);
  });

  it("the job ends with node's status", () => {
    assert.equal(agent([makeApp("exit 7").app]).status, 7);
    assert.equal(agent([makeApp("exit 0").app]).status, 0);
    assert.equal(agent([makeApp("kill -9 $$").app]).status, 137);
  });

  it("a TERM, INT or HUP sent to the agent reaches node, and the agent ends with node's status", async () => {
    for (const name of ["TERM", "INT", "HUP"]) {
      const { end, stderr, got, node } = await signalled(name);
      assert.deepEqual(end, { code: 9, signal: null }, `after ${name}: ${stderr}`);
      assert.equal(got, `got ${name}\n`);
      assert.equal(alive(node), false);
    }
  });

  it("a job whose node is not there says so and ends with 1", () => {
    const made = makeApp("", { node: false });
    const ran = agent([made.app, "--check-claude"]);
    assert.equal(ran.status, 1);
    assert.equal(ran.stdout, "");
    assert.match(ran.stderr, /^BRIMM Video Studio could not start its background job: [^\n]*[^.\n]\.\n$/);
  });
});
