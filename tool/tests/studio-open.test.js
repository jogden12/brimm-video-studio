// Her folder's settings under the open lock (studio.js, design 2026-10-26, section 7, "Her folder's settings (open), in outline"):
// the sandbox on with edit.js its one door, the gated places denied to Read and to sandboxed commands, writes only into the
// workshop, the app's secrets taken from sandboxed commands, Claude Code's memory off, the guard and the receipt hook. Every test is
// on a made-up Mac (tests/open-world.js): nothing here reads this Mac's own home, settings or temp folder.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { studioFiles, writeStudio, openSettingsOf, workshopFolder, ALLOW_DEFAULT, ENVIRONMENT, APP_FLAGS, OPEN_LOCK_CLAUDE } from "../studio.js";
import { bothSpellings, claudeDirName, gatedPlaces, readAllowed, realOf } from "../places.js";
import { openWorld } from "./open-world.js";

describe("her folder's settings under the open lock", () => {
  let w;
  before(() => {
    w = openWorld();
  });
  after(() => w.done());
  /** The settings written into the world's folder, read back, a fresh object each time. */
  const open = () => JSON.parse(readFileSync(join(w.folder, ".claude", "settings.json"), "utf8"));
  /** Those written for other facts of the same Mac. */
  const openWith = (more) => openSettingsOf({ checkout: w.checkout, node: w.node, folder: w.folder, facts: { ...w.facts, ...more } });
  const AS = () => join(w.home, "Library", "Application Support");
  const both = (path) => bothSpellings(realOf(path));

  it("waits for the Claude Code the open lock is checked on, and starts with the record of the app's flags empty and no harmless names", () => {
    assert.equal(OPEN_LOCK_CLAUDE, null);
    assert.deepEqual(APP_FLAGS, { flags: [] });
    assert.deepEqual(ENVIRONMENT.harmless, []);
    assert.deepEqual(ALLOW_DEFAULT, [{ type: "skill", name: "brimm-edit" }, { type: "skill", name: "brimm-graphics" }, { type: "skill", name: "frontend-design" }, { type: "skill", name: "theme-factory" }, { type: "tool", name: "mcp__visualize__show_widget" }, { type: "tool", name: "mcp__visualize__read_me" }, { type: "tool", name: "PushNotification" }]);
  });
  it("writes the strict shape exactly as today when the lock is strict", () => {
    const today = studioFiles({ checkout: w.checkout, node: w.node, folder: w.folder });
    assert.deepEqual(studioFiles({ checkout: w.checkout, node: w.node, folder: w.folder, lock: "strict", facts: w.facts }), today);
    const s = JSON.parse(today[".claude/settings.json"]);
    assert.deepEqual(Object.keys(s), ["permissions", "disableAllHooks", "hooks"]);
    assert.deepEqual(s.permissions, {
      defaultMode: "default",
      allow: [`Bash(${w.node} "${w.checkout}/tool/edit.js" *)`],
      deny: ["Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "mcp__*", "Monitor", "RemoteTrigger", "SendMessage"],
      disableBypassPermissionsMode: "disable",
      disableAutoMode: "disable"
    });
    assert.equal(s.disableAllHooks, false);
    assert.deepEqual(s.hooks, { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "/bin/sh", args: [`${w.checkout}/tool/studio/guard.sh`, w.node, w.folder], onFailure: "block" }] }] });
    // Written strict, it makes no workshop.
    const home = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-strict-")));
    const folder = writeStudio(home, { checkout: w.checkout, node: w.node, lock: "strict", facts: { ...w.facts, home } });
    assert.equal(readFileSync(join(folder, ".claude", "settings.json"), "utf8"), studioFiles({ checkout: w.checkout, node: w.node, folder })[".claude/settings.json"]);
    assert.equal(existsSync(workshopFolder(home)), false);
    rmSync(home, { recursive: true, force: true });
  });
  it("writes the sandbox on, failing when it cannot start, with edit.js its one door, no network and no proxy login", () => {
    const s = open();
    assert.deepEqual([s.sandbox.enabled, s.sandbox.failIfUnavailable, s.sandbox.allowUnsandboxedCommands], [true, true, false]);
    assert.deepEqual(s.sandbox.excludedCommands, [`${w.node} "${w.checkout}/tool/edit.js" *`]);
    assert.deepEqual(s.sandbox.network, { deniedDomains: ["*"], httpProxyPort: 47123, socksProxyPort: 47123 });
    assert.deepEqual(s.permissions.allow[0], `Bash(${w.node} "${w.checkout}/tool/edit.js" *)`);
    assert.deepEqual([s.permissions.defaultMode, s.permissions.disableBypassPermissionsMode, s.permissions.disableAutoMode], ["default", "disable", "disable"]);
  });
  it("denies every gated place to Read and to sandboxed commands, by its real path and its /System/Volumes/Data spelling", () => {
    const s = open();
    const places = gatedPlaces(w.facts);
    for (const place of places) {
      for (const spelling of bothSpellings(place.path)) assert.ok(s.sandbox.filesystem.denyRead.includes(spelling), spelling);
      for (const rule of place.readRules) {
        for (const spelling of bothSpellings(rule)) {
          const want = place.kind === "file" ? `Read(/${spelling})` : `Read(/${spelling}/**)`;
          assert.ok(s.permissions.deny.includes(want), want);
        }
      }
    }
    assert.deepEqual(s.sandbox.filesystem.denyRead, places.flatMap((p) => bothSpellings(p.path)));
    for (const name of ["Drop", "Episodes", "Unedited Video"]) assert.ok(s.permissions.deny.includes(`Read(//System/Volumes/Data${join(realOf(w.root), name)}/**)`), name);
    assert.ok(s.permissions.deny.includes(`Read(/${realOf(join(w.home, ".netrc"))})`));
    // The .env rules, relative to the session's folder, hold her folder only (R20).
    assert.ok(s.permissions.deny.includes("Read(**/.env)") && s.permissions.deny.includes("Read(**/.env.*)"));
  });
  it("lets sandboxed commands read Assets and the three places Bash needs, and no other", () => {
    assert.deepEqual(open().sandbox.filesystem.allowRead, [
      join(realOf(w.root), "Assets"),
      join(w.tmp, `claude-${w.uid}`, claudeDirName(w.folder)),
      join(w.home, ".claude", "shell-snapshots"),
      join(AS(), "Claude", "claude-code")
    ]);
    assert.deepEqual(open().sandbox.filesystem.allowRead, readAllowed({ ...w.facts, folder: w.folder }));
  });
  it("keeps ~/.claude.json, the app's data and the words folder from sandboxed commands, with no Read() rule for ~/.claude or the words folder", () => {
    const s = open();
    for (const path of [join(w.home, ".claude.json"), join(AS(), "Claude"), join(AS(), "BRIMM Video Words"), join(w.home, ".claude"), join(w.tmp, `claude-${w.uid}`)]) {
      for (const spelling of both(path)) assert.ok(s.sandbox.filesystem.denyRead.includes(spelling), spelling);
    }
    for (const path of [join(w.home, ".claude"), join(AS(), "BRIMM Video Words"), join(AS(), "Claude"), join(w.tmp, `claude-${w.uid}`)]) {
      for (const spelling of both(path)) assert.ok(!s.permissions.deny.some((r) => r.startsWith(`Read(/${spelling}/`) || r === `Read(/${spelling})`), spelling);
    }
    assert.ok(s.permissions.deny.includes(`Read(/${realOf(join(w.home, ".claude.json"))})`));
  });
  it("lets sandboxed commands write only the workshop, and never her folder or the app's data", () => {
    const s = open();
    assert.deepEqual(s.sandbox.filesystem.allowWrite, [w.workshop]);
    assert.deepEqual(s.sandbox.filesystem.denyWrite, [...bothSpellings(w.folder), ...both(join(AS(), "Claude"))]);
    assert.ok(s.permissions.allow.includes(`Edit(/${w.workshop}/**)`));
    assert.equal(s.permissions.allow.filter((r) => r.startsWith("Edit(")).length, 1);
  });
  it("denies Write and Edit in her folder, the checkout, BRIMM Video, the app's data and every place only brimm-video writes, and the workshop's CLAUDE.md, CLAUDE.local.md, .mcp.json and .claude", () => {
    const s = open();
    for (const path of [w.folder, w.checkout, w.root, join(dirname(realOf(w.root)), "BRIMM VIDEO Transfer"), join(w.home, "BRIMM Video Work"), join(AS(), "BRIMM Video"), join(AS(), "BRIMM Video Words"), join(AS(), "Claude"), join(w.home, "Library", "LaunchAgents"), join(w.home, ".claude"), join(w.home, ".ssh")]) {
      for (const spelling of both(path)) assert.ok(s.permissions.deny.includes(`Edit(/${spelling}/**)`), spelling);
    }
    for (const spelling of bothSpellings(w.workshop)) {
      for (const inner of [".claude/**", "CLAUDE.md", "CLAUDE.local.md", ".mcp.json"]) assert.ok(s.permissions.deny.includes(`Edit(/${spelling}/**/${inner})`), `${spelling} ${inner}`);
    }
    assert.ok(!s.permissions.deny.includes("Edit") && !s.permissions.deny.includes("Write"));
  });
  it("takes every listed name of the app's environment from sandboxed commands, the binary's own list among them, and never the chat's id or pid", () => {
    const names = open().sandbox.credentials.envVars;
    for (const n of ["CLAUDE_CODE_MESSAGING_TOKEN", "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_USER_EMAIL", "CLAUDE_CODE_ACCOUNT_UUID", "CLAUDE_CODE_ORGANIZATION_UUID", "SSH_AUTH_SOCK", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_OAUTH_REFRESH_TOKEN", "CLAUDE_CODE_ARTIFACTS_API_TOKEN", "CLAUDE_CODE_MEMORY_API_TOKEN", "CLAUDE_CODE_SLACK_TAG_TOKEN", "ANTHROPIC_IDENTITY_TOKEN"]) assert.ok(names.some((e) => e.name === n && e.mode === "deny"), n);
    assert.ok(!names.some((e) => ["CLAUDE_CODE_SESSION_ID", "CLAUDE_PID"].includes(e.name)));
    assert.deepEqual(names, ENVIRONMENT.deny.map((name) => ({ name, mode: "deny" })));
    // Exact names only, as envVars takes them.
    for (const { name } of names) assert.match(name, /^[A-Za-z_][A-Za-z0-9_]*$/);
  });
  it("turns Claude Code's memory off, and a skill's shell lines", () => {
    const s = open();
    assert.deepEqual([s.autoMemoryEnabled, s.autoDreamEnabled, s.disableSkillShellExecution, s.disableAllHooks], [false, false, true, false]);
  });
  it("has no WebFetch or WebSearch allow rule while the web tools are held, and both once they are opened", () => {
    assert.deepEqual(open().permissions.allow, [`Bash(${w.node} "${w.checkout}/tool/edit.js" *)`, `Edit(/${w.workshop}/**)`]);
    assert.deepEqual(openWith({ web: "open" }).permissions.allow, [`Bash(${w.node} "${w.checkout}/tool/edit.js" *)`, `Edit(/${w.workshop}/**)`, "WebFetch", "WebSearch"]);
  });
  it("never denies the drawing tools, and denies Monitor and NotebookEdit", () => {
    const { deny } = open().permissions;
    assert.ok(!deny.some((r) => r.startsWith("mcp__visualize__") || r === "mcp__*"));
    assert.ok(deny.includes("Monitor") && deny.includes("NotebookEdit"));
  });
  it("denies the Cron tools and Workflow unless this Mac allows them", () => {
    for (const tool of ["CronCreate", "CronDelete", "CronList", "Workflow"]) assert.ok(open().permissions.deny.includes(tool), tool);
    const allowed = openWith({ allow: [...ALLOW_DEFAULT, { type: "tool", name: "CronCreate" }, { type: "tool", name: "Workflow" }] }).permissions.deny;
    assert.deepEqual(["CronCreate", "CronDelete", "CronList", "Workflow"].map((t) => allowed.includes(t)), [false, true, true, false]);
  });
  it("runs the guard before every call and the receipt hook after every card, each given her folder", () => {
    assert.deepEqual(open().hooks, {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "/bin/sh", args: [`${w.checkout}/tool/studio/guard.sh`, w.node, w.folder], onFailure: "block" }] }],
      PostToolUse: [{ matcher: "AskUserQuestion", hooks: [{ type: "command", command: "/bin/sh", args: [`${w.checkout}/tool/studio/receipt.sh`, w.node, w.folder] }] }]
    });
  });
  it("makes the workshop on this Mac's own disk, readable by her alone, and never adds it to the session", () => {
    assert.equal(w.workshop, join(w.home, "BRIMM Video Workshop"));
    assert.ok(statSync(w.workshop).isDirectory());
    assert.equal(statSync(w.workshop).mode & 0o777, 0o700);
    const s = open();
    assert.equal(s.permissions.additionalDirectories, undefined);
    assert.deepEqual(Object.keys(s), ["permissions", "sandbox", "autoMemoryEnabled", "autoDreamEnabled", "disableSkillShellExecution", "disableAllHooks", "hooks"]);
    assert.deepEqual(Object.keys(s.permissions), ["defaultMode", "allow", "deny", "disableBypassPermissionsMode", "disableAutoMode"]);
    // Her folder's other files are written as they are for the strict lock, but for the open lock's CLAUDE.md, and Pictures/.
    const files = studioFiles({ checkout: w.checkout, node: w.node, folder: w.folder, lock: "open", facts: w.facts });
    for (const [name, text] of Object.entries(files)) assert.equal(readFileSync(join(w.folder, name), "utf8"), text, name);
    assert.equal(files[".claude/skills/brimm-edit/SKILL.md"], studioFiles({ checkout: w.checkout, node: w.node, folder: w.folder })[".claude/skills/brimm-edit/SKILL.md"]);
    assert.equal(files["CLAUDE.md"], readFileSync(new URL("../studio/CLAUDE-open.md", import.meta.url), "utf8"));
    assert.ok(statSync(join(w.folder, "Pictures")).isDirectory());
  });
});
