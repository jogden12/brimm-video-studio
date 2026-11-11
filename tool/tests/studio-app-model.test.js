// The move to Applications and Uninstall, from tool/studio-app/Sources/Mover.swift and Uninstall.swift, asked through studio-check
// (Phase 6, Task 12). Each test works in a folder of its own. The move uses the real ditto and xattr; Uninstall starts only the
// temp app's own stand-in node and install.sh, never the real ones. The app's model, AppModel.swift, is checked by a typecheck of all
// the sources and by its text (Task 13), and by hand in its windows.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

/** The folders this file has made, each removed when the file ends. */
const folders = [];
after(() => {
  for (const dir of folders) rmSync(dir, { recursive: true, force: true });
});

/** A new folder for one test. */
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "brimm-studio-model-"));
  folders.push(dir);
  return dir;
};

/** studio-check move with `args`: { said, asked }, the sentence or null, and whether it asked whether this Mac is at work. */
const move = (args) => ask("move", args);

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
    assert.equal(move([source, target, join(here, "Trash")]).said, null);
    const moved = join(target, APP_NAME);
    assert.equal(readFileSync(join(moved, "Contents", "marker"), "utf8"), "new");
    assert.equal(quarantined(moved), false);
    assert.ok(existsSync(join(source, "Contents", "marker")));
  });

  it("a folder that is not there is made", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const target = join(here, "home", "Applications");
    assert.equal(move([source, target, join(here, "Trash")]).said, null);
    assert.equal(readFileSync(join(target, APP_NAME, "Contents", "marker"), "utf8"), "new");
  });

  it("with no copy there, whether this Mac is at work is never asked", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const target = join(here, "Applications");
    mkdirSync(target);
    assert.deepEqual(move([source, target, join(here, "Trash"), "busy:An import is at work."]), { said: null, asked: false });
    assert.equal(readFileSync(join(target, APP_NAME, "Contents", "marker"), "utf8"), "new");
  });

  it("an older copy goes to the Trash, and the new one takes its place", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const target = join(here, "Applications");
    makeBundle(target, "old");
    const trash = join(here, "Trash");
    mkdirSync(trash);
    assert.deepEqual(move([source, target, trash, "idle"]), { said: null, asked: true });
    assert.equal(readFileSync(join(trash, APP_NAME, "Contents", "marker"), "utf8"), "old");
    assert.equal(readFileSync(join(target, APP_NAME, "Contents", "marker"), "utf8"), "new");
    assert.deepEqual(readdirSync(target), [APP_NAME]);
  });

  it("an older copy is left as it was while this Mac is at work", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const target = join(here, "Applications");
    makeBundle(target, "old");
    const trash = join(here, "Trash");
    mkdirSync(trash);
    const line = "An import is at work: it holds its lock (process 5). Nothing was moved: try again when it is done.";
    assert.deepEqual(move([source, target, trash, `busy:${line}`]), { said: line, asked: true });
    assert.equal(readFileSync(join(target, APP_NAME, "Contents", "marker"), "utf8"), "old");
    assert.deepEqual(readdirSync(trash), []);
    assert.deepEqual(readdirSync(target), [APP_NAME]);
  });

  it("a link at the destination that leads nowhere goes to the Trash too", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const target = join(here, "Applications");
    mkdirSync(target);
    symlinkSync(join(here, "not-there"), join(target, APP_NAME));
    const trash = join(here, "Trash");
    mkdirSync(trash);
    assert.deepEqual(move([source, target, trash]), { said: null, asked: true });
    assert.ok(lstatSync(join(trash, APP_NAME)).isSymbolicLink());
    assert.equal(readFileSync(join(target, APP_NAME, "Contents", "marker"), "utf8"), "new");
  });

  it("a move that fails leaves nothing half-made", () => {
    const here = folder();
    const target = join(here, "Applications");
    mkdirSync(target);
    assert.equal(move([join(here, "Downloads", APP_NAME), target, join(here, "Trash")]).said, NOT_MOVED);
    assert.deepEqual(readdirSync(target), []);
  });

  it("a later step that fails leaves nothing half-made", () => {
    const here = folder();
    const source = makeBundle(join(here, "Downloads"), "new");
    const target = join(here, "Applications");
    makeBundle(target, "old");
    assert.deepEqual(move([source, target, join(here, "Trash")]), { said: NOT_MOVED, asked: true });
    assert.equal(readFileSync(join(target, APP_NAME, "Contents", "marker"), "utf8"), "old");
    assert.deepEqual(readdirSync(target), [APP_NAME]);
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

/** studio-check run: the app's own runToEnd, which Uninstall and the move use, started on `program` with `args`. */
const run = (program, args = []) => ask("run", [program, ...args], { env: { HOME: folder(), PATH: "/usr/bin:/bin" } });

describe("the app's program runner", { skip: noChecker }, () => {
  it("gives the status, the whole output and the whole error", () => {
    assert.deepEqual(run("/bin/sh", ["-c", "printf out; printf err >&2; exit 3"]), { status: 3, out: "out", err: "err" });
  });

  it("reads a full pipe on both sides without stopping the program", () => {
    const ran = run("/bin/sh", ["-c", "head -c 200000 /dev/zero | tr '\\0' a; head -c 200000 /dev/zero | tr '\\0' b >&2"]);
    assert.equal(ran.status, 0);
    assert.equal(ran.out.length, 200000);
    assert.equal(ran.err.length, 200000);
  });

  it("a program that cannot be started gives 127", () => {
    assert.deepEqual(run(join(folder(), "not-there")), { status: 127, out: "", err: "" });
  });

  it("a program ended by a signal gives 128 and the signal", () => {
    assert.equal(run("/bin/sh", ["-c", "kill -9 $$"]).status, 137);
  });

  it("a program it runs for the app gets the app's own environment: HOME is kept, and a stray variable never reaches it", () => {
    const home = folder();
    const ran = ask("run", ["/bin/sh", "-c", "printf '%s|%s' \"$HOME\" \"$STRAY\""], { env: { HOME: home, PATH: "/usr/bin:/bin", STRAY: "x" } });
    assert.equal(ran.out, `${home}|`);
  });
});

const SOURCES = fileURLToPath(new URL("../studio-app/Sources/", import.meta.url));
const SAMPLE_GUIDE = fileURLToPath(new URL("../studio-app/sample-guide.js", import.meta.url));
const TOOL = fileURLToPath(new URL("..", import.meta.url));

describe("the real guide for a stand-in build", () => {
  it("sample-guide.js prints the real guide for a sample Mac", () => {
    const ran = spawnSync(process.execPath, [SAMPLE_GUIDE, TOOL, "1.0.0-beta.1", "7"], { encoding: "utf8", timeout: 60000 });
    assert.equal(ran.status, 0, ran.stderr);
    for (const words of ["Studio Test Mac", "1.0.0-beta.1", "<li>HyperFrames</li>", "<h2>Notes</h2>", 'url("data:font/']) assert.ok(ran.stdout.includes(words), words);
    assert.equal(ran.stdout.includes("{{"), false);
    assert.equal(ran.stderr, "");
  });

  it("sample-guide.js with the wrong number of words says how it is called and ends with 2", () => {
    for (const args of [[], [TOOL, "1.0.0"], [TOOL, "1.0.0", "7", "more"]]) {
      const ran = spawnSync(process.execPath, [SAMPLE_GUIDE, ...args], { encoding: "utf8", timeout: 60000 });
      assert.equal(ran.status, 2, args.join(" "));
      assert.equal(ran.stdout, "");
      assert.match(ran.stderr, /^node sample-guide\.js <tool folder> <version> <build>\n$/);
    }
  });
});

/** The names of the Swift files in Sources/. */
const swiftFiles = () => readdirSync(SOURCES).filter((name) => name.endsWith(".swift")).sort();

/** The text of the Sources/ file `name`. */
const source = (name) => readFileSync(join(SOURCES, name), "utf8");

describe("the app's sources", () => {
  it("the app's sources typecheck, and the typecheck prints no warning", { skip: noChecker, timeout: 180000 }, () => {
    mkdirSync(MODULES, { recursive: true });
    const flags = ["-typecheck", "-swift-version", "5", "-target", "arm64-apple-macos13.0", "-module-cache-path", MODULES];
    const ran = spawnSync("/usr/bin/swiftc", [...flags, ...swiftFiles().map((name) => join(SOURCES, name))], { encoding: "utf8", timeout: 180000 });
    assert.equal(ran.status, 0, `swiftc -typecheck ended with ${ran.status}:\n${(ran.stderr ?? "").split("\n").slice(-20).join("\n")}`);
    const said = `${ran.stdout ?? ""}${ran.stderr ?? ""}`;
    assert.equal(said.includes("warning:"), false, said.split("\n").slice(0, 20).join("\n"));
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

  it("no run starts while the move or Uninstall works", () => {
    const text = source("AppModel.swift");
    assert.match(text, /@Published private\(set\) var working\b/);
    assert.match(text, /func begin\(chosen: Run\?\) \{\s*guard [^\n{]*!working\b/);
    assert.match(text, /func useThisCopy\(\) \{\s*guard [^\n{]*!working\b/);
    assert.match(text, /case \.removed:[^}]*if screen == \.status && current == nil \{ screen = \.removed \}/);
    const views = source("StatusViews.swift");
    for (const words of ["Moving BRIMM Video Studio…", "Stopping the background job…", ".disabled(model.working)"]) assert.ok(views.includes(words), `StatusViews.swift never holds ${words}`);
  });

  it("a logout, restart or shutdown during a run waits instead of being cancelled", () => {
    const text = source("AppDelegate.swift");
    const asked = text.slice(text.indexOf("func applicationShouldTerminate"), text.indexOf("private func cancelWaitEnded"));
    const branch = (name, next) => asked.slice(asked.indexOf(`case .${name}:`), next ? asked.indexOf(`case .${next}:`) : undefined);
    assert.match(branch("cancel", "wait"), /return \.terminateLater/);
    assert.match(branch("wait"), /return \.terminateLater/);
    assert.ok(!asked.includes(".terminateCancel"), "applicationShouldTerminate still cancels a quit");
    assert.ok(text.includes("reply(toApplicationShouldTerminate: true)"), "AppDelegate.swift never gives AppKit its reply");
  });

  it("the model and the checker share one program runner, the one the tests drive", () => {
    assert.ok(!source("AppModel.swift").includes("Process()"), "AppModel.swift starts a program of its own");
    assert.ok(source("AppModel.swift").includes("runToEnd("), "AppModel.swift never asks runToEnd");
    const checker = readFileSync(join(SOURCES, "..", "Check", "main.swift"), "utf8");
    assert.ok(!checker.includes("Process()"), "Check/main.swift starts a program of its own");
    assert.match(checker, /uninstall\(app: [^\n]*runToEnd\(/);
  });

  it("main.swift answers --agent before anything of AppKit", () => {
    const code = source("main.swift")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    const appKit = code.indexOf("NSApplication");
    assert.ok(appKit >= 0, "main.swift never makes the NSApplication");
    for (const name of ["launchOf", "runAgent"]) {
      const at = code.indexOf(name);
      assert.ok(at >= 0 && at < appKit, `main.swift does not ask ${name} before its first NSApplication`);
    }
  });

  it("the setup page says that a run stopped, and shows its top", () => {
    const text = source("SetupViews.swift");
    for (const words of ['"Setup stopped"', '"Repair stopped"', "ScrollViewReader", "scrollTo("]) assert.ok(text.includes(words), `SetupViews.swift never holds ${words}`);
  });

  it("the page after Uninstall offers Repair and Close", () => {
    const text = source("StatusViews.swift");
    const page = text.slice(text.indexOf("struct RemovedPage"), text.indexOf("struct RefusedPage"));
    for (const words of ['Button("Repair") { model.begin(chosen: .repair) }', 'Button("Close") { NSApp.terminate(nil) }', "This build's setup is a stand-in: it changes nothing on this Mac."]) {
      assert.ok(page.includes(words), `the removed page never holds ${words}`);
    }
  });

  it("the views never know a question's id", () => {
    for (const name of ["SetupViews.swift", "StatusViews.swift"]) {
      const text = source(name);
      for (const word of ['"welcome"', '"name"', '"dropbox"', '"drop-folder"', '"exports-folder"', '"review"', '"scenario"', '"permission-', "question.id =="]) {
        assert.ok(!text.includes(word), `${name} holds ${word}`);
      }
    }
  });
});
