// The shell's pure decisions, from tool/studio-app/Sources/Core.swift, asked through studio-check (Phase 6, Task 4).
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_LABEL } from "../busy.js";
import { REPAIR } from "../build.js";
import { DAMAGED } from "../setup/checks.js";
import { GUIDE_NAME, guideData, writeGuide } from "../setup/guide.js";
import { check, checkerPath, noChecker } from "./studio-app-check.js";

const ENGINE = fileURLToPath(new URL("../setup/engine.js", import.meta.url));
const TEMPLATE = fileURLToPath(new URL("../setup/guide-template.html", import.meta.url));
const FONTS = fileURLToPath(new URL("../brand/fonts", import.meta.url));
const APP = "/Applications/BRIMM Video Studio.app";
const TOOLS = `${APP}/Contents/Resources/node/bin`;
const STUDIO = `${APP}/Contents/Resources/Studio`;

/** studio-check's answer to `command` with `args`, which must have ended with 0. */
function ask(command, args = [], options) {
  const ran = check(command, args, options);
  assert.equal(ran.status, 0, `studio-check ${command} ${args.join(" ")} ended with ${ran.status}: ${ran.stderr}`);
  return ran.json;
}

/** The `next` answer for the five words, in the command's order. */
const next = (...words) => ask("next", words);

// The first test may wait for the compile, which has its own 180-second limit.
before(() => {
  if (!noChecker) checkerPath();
}, { timeout: 200000 });

describe("the engine's lines", { skip: noChecker }, () => {
  it("a line ends only at a line feed: U+2028, U+2029 and U+0085 stay inside it", () => {
    const first = '{"a":"x y z\u0085w"}';
    const input = Buffer.from(`${first}\n{"b":1}\r\n\npart`, "utf8");
    const split = ask("split", [], { input });
    assert.deepEqual(split, { lines: [first, '{"b":1}', ""], rest: "part" });
    for (const c of [" ", " ", "\u0085"]) assert.ok(split.lines[0].includes(c));
  });
});

describe("the engine's command line and environment", { skip: noChecker }, () => {
  it("the engine is started from inside the app, with the four options once each", () => {
    assert.deepEqual(ask("engine-command", ["status", APP]), {
      program: `${TOOLS}/node`,
      arguments: [`${STUDIO}/tool/setup/engine.js`, "--run", "status", "--app", APP, "--tools", TOOLS, "--protocol", "1"]
    });
  });

  it("an app whose path holds a colon, or is not absolute, starts no engine", () => {
    assert.equal(ask("engine-command", ["setup", "/Volumes/a:b/BRIMM Video Studio.app"]), null);
    assert.equal(ask("engine-command", ["setup", "Applications/BRIMM Video Studio.app"]), null);
    const update = check("engine-command", ["update", APP]);
    assert.equal(update.status, 2);
    assert.ok(update.stderr.length > 0);
  });

  it("the engine's environment is built from scratch", () => {
    const from = { USER: "sallie", LOGNAME: "sallie", TMPDIR: "/var/folders/x/T/", NODE_OPTIONS: "--inspect", PATH: "/opt/homebrew/bin" };
    const made = ask("environment", ["/Users/sallie", APP], { input: JSON.stringify(from) });
    assert.deepEqual(Object.keys(made).sort(), ["HOME", "LANG", "LOGNAME", "PATH", "TMPDIR", "USER"]);
    assert.equal(made.HOME, "/Users/sallie");
    assert.equal(made.USER, "sallie");
    assert.equal(made.LOGNAME, "sallie");
    assert.equal(made.TMPDIR, "/var/folders/x/T/");
    assert.equal(made.LANG, "en_US.UTF-8");
    assert.equal(made.PATH, `${TOOLS}:/usr/bin:/bin:/usr/sbin:/sbin`);
    assert.ok(made.PATH.startsWith(`${TOOLS}:`));
    assert.deepEqual(Object.keys(ask("environment", ["/Users/sallie", APP], { input: "{}" })).sort(), ["HOME", "LANG", "PATH"]);
  });

  it("--agent first makes the app the background job, and the rest goes to unedited.js", () => {
    assert.deepEqual(ask("launch", ["--agent", "--watch", "/a", "--rules-only"]), { agent: ["--watch", "/a", "--rules-only"] });
    assert.deepEqual(ask("launch"), { window: true });
    assert.deepEqual(ask("launch", ["--watch", "/a", "--agent"]), { window: true });
    assert.deepEqual(ask("agent-command", [APP, "--check-claude", "--until", "5"]), {
      program: `${TOOLS}/node`,
      arguments: [`${STUDIO}/tool/unedited.js`, "--check-claude", "--until", "5"]
    });
  });
});

describe("what comes next", { skip: noChecker }, () => {
  it("a translocated copy moves first, whatever the status", () => {
    for (const needs of ["setup", "repair", "nothing", "none"])
      for (const failed of ["yes", "no"])
        for (const chosen of ["setup", "repair", "none"])
          for (const other of ["yes", "no"]) assert.equal(next("yes", needs, failed, chosen, other), "move", `${needs} ${failed} ${chosen} ${other}`);
  });

  it("a status that failed offers nothing, whatever was chosen", () => {
    for (const chosen of ["repair", "setup", "none"]) assert.equal(next("no", "nothing", "yes", chosen, "no"), "refused", chosen);
  });

  it("a Mac with no setup is set up, whatever was chosen", () => {
    assert.equal(next("no", "setup", "no", "repair", "no"), "setup");
    assert.equal(next("no", "setup", "no", "none", "yes"), "setup");
  });

  it("a moved copy is repaired, and a second copy is asked about", () => {
    assert.equal(next("no", "repair", "no", "none", "no"), "repair");
    assert.equal(next("no", "repair", "no", "none", "yes"), "twoCopies");
  });

  it("a Mac that needs nothing shows its status, and repairs only when asked", () => {
    assert.equal(next("no", "nothing", "no", "none", "no"), "status");
    assert.equal(next("no", "nothing", "no", "setup", "no"), "status");
    assert.equal(next("no", "nothing", "no", "repair", "no"), "repair");
    assert.equal(next("no", "none", "no", "repair", "no"), "refused");
    assert.equal(next("no", "none", "no", "none", "no"), "refused");
  });
});

describe("where the app is", { skip: noChecker }, () => {
  it("a copy under AppTranslocation is translocated, and one in Applications is not", () => {
    assert.equal(ask("translocated", ["/private/var/folders/x/T/AppTranslocation/1234/d/BRIMM Video Studio.app"]), true);
    assert.equal(ask("translocated", [APP]), false);
  });

  it("the move goes to /Applications when it can be written to, and to the home's Applications otherwise", () => {
    assert.equal(ask("move-target", ["/Users/sallie", "yes"]), "/Applications");
    assert.equal(ask("move-target", ["/Users/sallie", "no"]), "/Users/sallie/Applications");
  });

  it("the other copy is the one in the other Applications folder, never this one", () => {
    const home = "/Users/sallie";
    const mine = `${home}/Applications/BRIMM Video Studio.app`;
    assert.equal(ask("other-copy", [APP, home, APP, mine]), mine);
    assert.equal(ask("other-copy", [mine, home, APP, mine]), APP);
    assert.equal(ask("other-copy", [APP, home, APP]), null);
    assert.equal(ask("other-copy", [APP, home]), null);
    assert.equal(ask("other-copy", ["/Volumes/Studio/BRIMM Video Studio.app", home, mine]), mine);
  });
});

describe("the app's links", { skip: noChecker }, () => {
  it("only brimm-video-studio://check-for-updates is an action", () => {
    assert.equal(ask("url", ["brimm-video-studio://check-for-updates"]), "check-for-updates");
    assert.equal(ask("url", ["BRIMM-VIDEO-STUDIO://Check-For-Updates"]), "check-for-updates");
    for (const url of ["brimm-video-studio://other", "https://check-for-updates", ""]) assert.equal(ask("url", [url]), null, url);
  });
});

describe("the shell's names", { skip: noChecker }, () => {
  it("the shell's names and paths are Studio's own", () => {
    const names = ask("names");
    assert.equal(names.appName, "BRIMM Video Studio");
    assert.equal(names.agentLabel, AGENT_LABEL);
    assert.equal(names.guideName, GUIDE_NAME);
    assert.equal(names.workFolderName, "BRIMM Video Work");
    assert.ok(readFileSync(ENGINE, "utf8").includes(names.crashMessage), names.crashMessage);
    assert.equal(names.crashMessage, "BRIMM Video Studio's setup stopped on a fault of its own.");
    assert.equal(names.crashAdvice, REPAIR);
    assert.equal(names.damagedAdvice, DAMAGED);
    assert.equal(names.checkEvery, 3);
    assert.ok(ask("agent-file", ["/Users/sallie"]).endsWith(`/Library/LaunchAgents/${AGENT_LABEL}.plist`));
    assert.equal(ask("agent-file", ["/Users/sallie"]), `/Users/sallie/Library/LaunchAgents/${AGENT_LABEL}.plist`);
    const home = mkdtempSync(join(tmpdir(), "studio-core-"));
    const settings = { machine: "A Mac", root: `${home}/Dropbox/BRIMM Video`, dropPath: `${home}/BRIMM Video Work/Drop`, exportsPath: `${home}/Movies/Exports` };
    const data = guideData({ home, settings, build: { version: "1.0.0", build: "abc1234" } });
    const written = writeGuide({ home, data, template: readFileSync(TEMPLATE, "utf8"), fonts: FONTS });
    assert.deepEqual(ask("guide-paths", [home]), { html: written.html, pdf: written.pdf });
  });

  it("an unknown command, or a command missing its words, ends with 2", () => {
    assert.equal(check("no-such-command").status, 2);
    assert.equal(check("translocated").status, 2);
    assert.equal(check("move-target", ["/Users/sallie", "maybe"]).status, 2);
  });
});
