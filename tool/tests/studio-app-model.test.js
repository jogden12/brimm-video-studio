// The move to Applications and Uninstall, from tool/studio-app/Sources/Mover.swift and Uninstall.swift, asked through studio-check
// (Phase 6, Task 12). Each test works in a folder of its own. The move uses the real ditto and xattr; Uninstall starts only the
// temp app's own stand-in node and install.sh, never the real ones. The app's model, AppModel.swift, is checked by a typecheck of all
// the sources and by its text (Task 13), and by hand in its windows.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODULES, check, checkerPath, noChecker } from "./studio-app-check.js";

const APP_NAME = "BRIMM Video Studio.app";
const NOT_MOVED = "BRIMM Video Studio could not be moved to your Applications folder. Drag it there in Finder, then open it again.";
const CANNOT_TELL = "BRIMM Video Studio could not tell whether it is at work, so nothing was stopped.";
const NOT_STOPPED = "BRIMM Video Studio could not stop its background job. Open it again and choose Repair.";

/** studio-check's answer to `command` with `args`, which must have ended with 0. */
function ask(command, args = [], options) {
  const ran = check(command, args, options);
  assert.equal(ran.status, 0, `studio-check ${command} ${args.join(" ")} ended with ${ran.status}: ${ran.stderr}`);
  return ran.json;
}

/** A new folder for one test. */
const folder = () => mkdtempSync(join(tmpdir(), "brimm-studio-model-"));

/** A BRIMM Video Studio.app in `parent` that holds one file, `Contents/marker`, with `text` in it. */
function makeBundle(parent, text) {
  const app = join(parent, APP_NAME);
  mkdirSync(join(app, "Contents"), { recursive: true });
  writeFileSync(join(app, "Contents", "marker"), text);
  return app;
}

/** Whether `path` carries the quarantine flag, asked of the real xattr. */
const quarantined = (path) => spawnSync("/usr/bin/xattr", ["-p", "com.apple.quarantine", path], { encoding: "utf8" }).status === 0;

// The first test may wait for the compile, which has its own 180-second limit.
before(() => {
  if (!noChecker) checkerPath();
}, { timeout: 200000 });

describe("the move to Applications", { skip: noChecker }, () => {
  it("the app is copied into the folder and loses its quarantine flag", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const marked = spawnSync("/usr/bin/xattr", ["-w", "com.apple.quarantine", "0081;0;Safari;", source]);
    assert.equal(marked.status, 0);
    assert.ok(quarantined(source));
    const target = join(here, "Applications");
    mkdirSync(target);
    assert.equal(ask("move", [source, target, join(here, "Trash")]), null);
    const moved = join(target, APP_NAME);
    assert.equal(readFileSync(join(moved, "Contents", "marker"), "utf8"), "new");
    assert.equal(quarantined(moved), false);
    assert.ok(existsSync(join(source, "Contents", "marker")));
  });

  it("a folder that is not there is made", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const target = join(here, "home", "Applications");
    assert.equal(ask("move", [source, target, join(here, "Trash")]), null);
    assert.equal(readFileSync(join(target, APP_NAME, "Contents", "marker"), "utf8"), "new");
  });

  it("an older copy goes to the Trash, and the new one takes its place", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const target = join(here, "Applications");
    makeBundle(target, "old");
    const trash = join(here, "Trash");
    mkdirSync(trash);
    assert.equal(ask("move", [source, target, trash]), null);
    assert.equal(readFileSync(join(trash, APP_NAME, "Contents", "marker"), "utf8"), "old");
    assert.equal(readFileSync(join(target, APP_NAME, "Contents", "marker"), "utf8"), "new");
    assert.deepEqual(readdirSync(target), [APP_NAME]);
  });

  it("a move that fails leaves nothing half-made", () => {
    const here = folder();
    const target = join(here, "Applications");
    mkdirSync(target);
    assert.equal(ask("move", [join(here, "Downloads", APP_NAME), target, join(here, "Trash")]), NOT_MOVED);
    assert.deepEqual(readdirSync(target), []);
  });
});

/**
 * A new temp app whose node and install.sh are stand-in scripts. Each writes its arguments as one line into `ran` and then runs
 * its body: `node` and `install` are the bodies, such as "exit 0". The checker's home is the folder's own `home`.
 */
function makeApp({ node = "exit 0", install = "exit 0" } = {}) {
  const here = folder();
  const app = join(here, APP_NAME);
  const bin = join(app, "Contents", "Resources", "node", "bin");
  const studio = join(app, "Contents", "Resources", "Studio");
  mkdirSync(bin, { recursive: true });
  mkdirSync(join(studio, "tool"), { recursive: true });
  mkdirSync(join(here, "home"));
  const ran = join(here, "ran");
  const script = (body) => ["#!/bin/sh", `printf '%s\\n' "$*" >> '${ran}'`, body, ""].join("\n");
  writeFileSync(join(bin, "node"), script(node));
  chmodSync(join(bin, "node"), 0o755);
  writeFileSync(join(studio, "tool", "install.sh"), script(install));
  const env = { HOME: join(here, "home"), PATH: "/usr/bin:/bin" };
  return { app, studio, ran, env };
}

/** The lines of the `ran` file, or none when it is not there. */
const ranLines = (path) => (existsSync(path) ? readFileSync(path, "utf8").replace(/\n$/, "").split("\n") : []);

/** studio-check uninstall for `made`, with `fake` yes or no. */
const uninstall = (made, fake = "no") => ask("uninstall", [made.app, fake], { env: made.env });

describe("Uninstall", { skip: noChecker }, () => {
  it("Uninstall asks whether this Mac is at work, then stops the job, and starts nothing else", () => {
    const made = makeApp();
    assert.equal(uninstall(made), "removed");
    assert.deepEqual(ranLines(made.ran), [`${made.studio}/tool/busy.js idle-why`, "--remove"]);
  });

  it("a Mac at work is told so, and nothing is stopped", () => {
    const line = "An import is at work: it holds its lock (process 5).";
    const made = makeApp({ node: `printf '%s\\n' '${line}'\nexit 1` });
    assert.deepEqual(uninstall(made), { notice: line });
    assert.ok(!ranLines(made.ran).includes("--remove"));
  });

  it("a refusal on stderr is the notice when stdout is empty", () => {
    const line = "busy.js could not read the lock.";
    const made = makeApp({ node: `printf '%s\\nmore\\n' '${line}' >&2\nexit 2` });
    assert.deepEqual(uninstall(made), { notice: line });
    assert.ok(!ranLines(made.ran).includes("--remove"));
  });

  it("with neither, the fallback sentence", () => {
    const made = makeApp({ node: "exit 2" });
    assert.deepEqual(uninstall(made), { notice: CANNOT_TELL });
    assert.ok(!ranLines(made.ran).includes("--remove"));
  });

  it("a job that cannot be stopped says to choose Repair", () => {
    const made = makeApp({ install: "exit 1" });
    assert.deepEqual(uninstall(made), { notice: NOT_STOPPED });
    assert.deepEqual(ranLines(made.ran).slice(1), ["--remove"]);
  });

  it("a stand-in build's Uninstall starts no program", () => {
    const made = makeApp();
    assert.equal(uninstall(made, "yes"), "removed");
    assert.equal(existsSync(made.ran), false);
  });
});

const SOURCES = fileURLToPath(new URL("../studio-app/Sources/", import.meta.url));

/** The names of the Swift files in Sources/. */
const swiftFiles = () => readdirSync(SOURCES).filter((name) => name.endsWith(".swift")).sort();

/** The text of the Sources/ file `name`. */
const source = (name) => readFileSync(join(SOURCES, name), "utf8");

describe("the app's sources", () => {
  it("the app's sources typecheck", { skip: noChecker, timeout: 180000 }, () => {
    mkdirSync(MODULES, { recursive: true });
    const flags = ["-typecheck", "-swift-version", "5", "-target", "arm64-apple-macos13.0", "-module-cache-path", MODULES];
    const ran = spawnSync("/usr/bin/swiftc", [...flags, ...swiftFiles().map((name) => join(SOURCES, name))], { encoding: "utf8", timeout: 180000 });
    assert.equal(ran.status, 0, `swiftc -typecheck ended with ${ran.status}:\n${(ran.stderr ?? "").split("\n").slice(-20).join("\n")}`);
  });

  it("the app's sources never log", () => {
    for (const name of swiftFiles()) {
      for (const word of ["print(", "NSLog", "os_log", "Logger(", "dump("]) {
        assert.ok(!source(name).includes(word), `${name} holds ${word}`);
      }
    }
  });

  it("no source splits lines with FileHandle's own reader", () => {
    for (const name of swiftFiles()) {
      for (const word of [".bytes.lines", ".lines {"]) {
        assert.ok(!source(name).includes(word), `${name} holds ${word}`);
      }
    }
  });

  it("the model asks nextFromStatus, shouldCheck and quitRule, and stops nothing off the status screen", () => {
    const text = source("AppModel.swift");
    for (const name of ["nextFromStatus(", "shouldCheck(", "quitRule("]) assert.ok(text.includes(name), `AppModel.swift never asks ${name}`);
    assert.match(text, /func uninstall\(\)\s*\{\s*guard screen == \.status\b/);
  });
});
