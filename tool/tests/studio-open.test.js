// Her folder's settings under the open lock (studio.js, design 2026-10-26, section 7, "Her folder's settings (open), in outline"):
// the sandbox on with edit.js its one door, the gated places denied to Read and to sandboxed commands, writes only into the
// workshop, the app's secrets taken from sandboxed commands, Claude Code's memory off, the guard and the receipt hook. Every test is
// on a made-up Mac (tests/open-world.js): nothing here reads this Mac's own home, settings or temp folder.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { studioFiles, writeStudio, openSettingsOf, lockBroken, workshopFolder, ALLOW_DEFAULT, ENVIRONMENT, APP_FLAGS, OPEN_LOCK_CLAUDE } from "../studio.js";
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
  it("takes 2.1.308's second list of credentials from sandboxed commands too", () => {
    const names = open().sandbox.credentials.envVars;
    for (const n of ["CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR", "CLAUDE_CODE_GATEWAY_TOKEN_FILE_DESCRIPTOR", "CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR", "CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR", "CCR_AGENT_PROXY_TOKEN_FILE_DESCRIPTOR", "CLAUDE_CODE_HFI_BEARER_TOKEN", "CLAUDE_BRIDGE_OAUTH_TOKEN", "CLAUDE_TRUSTED_DEVICE_TOKEN", "AGENT_PROXY_AUTH_TOKEN", "CLAUDE_CODE_MCP_SERVE_AUTH_TOKEN", "CLAUDE_BG_AUTH_SNAPSHOT_PATH", "CLAUDE_BG_SOCKET_TOKENS_PATH", "CLAUDE_BG_RV_AUTH", "CLAUDE_BG_PTY_AUTH", "CLAUDE_BG_CLAIM_AUTH"]) assert.ok(names.some((e) => e.name === n && e.mode === "deny"), n);
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
  it("denies the Cron tools unless this Mac allows them, and Workflow always", () => {
    for (const tool of ["CronCreate", "CronDelete", "CronList", "Workflow"]) assert.ok(open().permissions.deny.includes(tool), tool);
    const allowed = openWith({ allow: [...ALLOW_DEFAULT, { type: "tool", name: "CronCreate" }, { type: "tool", name: "Workflow" }] }).permissions.deny;
    assert.deepEqual(["CronCreate", "CronDelete", "CronList", "Workflow"].map((t) => allowed.includes(t)), [false, true, true, true]);
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
    // Her folder's three files are the open lock's own CLAUDE.md and skill (studio.test.js has what they say), with the checkout's
    // path and node's put in, and Pictures/.
    const files = studioFiles({ checkout: w.checkout, node: w.node, folder: w.folder, lock: "open", facts: w.facts });
    for (const [name, text] of Object.entries(files)) assert.equal(readFileSync(join(w.folder, name), "utf8"), text, name);
    const template = (name) => readFileSync(new URL(`../studio/${name}`, import.meta.url), "utf8").split("{{CHECKOUT}}").join(w.checkout).split("{{NODE}}").join(w.node);
    assert.equal(files[".claude/skills/brimm-edit/SKILL.md"], template("SKILL-open.md"));
    assert.notEqual(files[".claude/skills/brimm-edit/SKILL.md"], studioFiles({ checkout: w.checkout, node: w.node, folder: w.folder })[".claude/skills/brimm-edit/SKILL.md"]);
    assert.ok(files[".claude/skills/brimm-edit/SKILL.md"].includes(`${w.node} "${w.checkout}/tool/edit.js"`));
    assert.equal(files["CLAUDE.md"], template("CLAUDE-open.md"));
    assert.ok(statSync(join(w.folder, "Pictures")).isDirectory());
  });
});

describe("what is changed in her folder's settings under the open lock (lockBroken)", () => {
  let w;
  before(() => {
    w = openWorld();
  });
  after(() => w.done());
  const open = () => JSON.parse(readFileSync(join(w.folder, ".claude", "settings.json"), "utf8"));
  const where = () => ({ checkout: w.checkout, folder: w.folder, facts: w.facts });
  const broken = (s, node = w.node) => lockBroken(s, { ...where(), lock: "open", node });

  it("finds nothing broken in the open shape it writes, for the node this Mac recorded", () => {
    assert.deepEqual(broken(open()), []);
    assert.deepEqual(broken(openSettingsOf({ checkout: w.checkout, node: w.node, folder: w.folder, facts: w.facts })), []);
  });
  it("says the guard, the allow rule and the excluded command are changed when another program stands in node's place in all three", () => {
    const text = readFileSync(join(w.folder, ".claude", "settings.json"), "utf8").split(w.node).join(join(w.workshop, "x"));
    const s = JSON.parse(text);
    const found = broken(s);
    for (const key of ["guard", "permissions", "sandbox"]) assert.ok(found.includes(key), key);
    // The node is the one this Mac recorded, never the one the file names.
    assert.deepEqual(lockBroken(s, { ...where(), lock: "open", node: join(w.workshop, "x") }), []);
  });
  it("names a SessionStart hook, another hook beside the guard, an env, a statusLine or an enabledPlugins key in her folder's own settings", () => {
    const hook = { type: "command", command: "/bin/sh", args: ["/x.sh"] };
    for (const [change, key] of [
      [(s) => { s.hooks.SessionStart = [{ matcher: "*", hooks: [hook] }]; }, "other-hooks"],
      [(s) => { s.hooks.PreToolUse.push({ matcher: "Bash", hooks: [hook] }); }, "other-hooks"],
      [(s) => { s.hooks.PostToolUse.push({ matcher: "*", hooks: [hook] }); }, "other-hooks"],
      [(s) => { s.env = { X: "1" }; }, "other"],
      [(s) => { s.statusLine = { type: "command", command: "/x.sh" }; }, "other"],
      [(s) => { s.enabledPlugins = { "x@y": true }; }, "other"],
      [(s) => { s.apiKeyHelper = "/x.sh"; }, "other"],
      [(s) => { delete s.disableAllHooks; }, "other"],
      [(s) => { s.disableAllHooks = true; }, "hooks"]
    ]) {
      const s = open();
      change(s);
      assert.deepEqual(broken(s), [key], change.toString());
    }
  });
  it("says the node is not known when this Mac's settings name none", () => {
    assert.deepEqual(broken(open(), null), ["node"]);
    assert.deepEqual(lockBroken(open(), { ...where(), lock: "open" }), ["node"]);
  });
  it("names each part of the open shape that is changed", () => {
    for (const [change, key] of [[(s) => { s.sandbox.enabled = false; }, "sandbox"], [(s) => s.sandbox.filesystem.denyRead.pop(), "sandbox"], [(s) => s.sandbox.filesystem.allowRead.push("/Users"), "sandbox"], [(s) => s.sandbox.excludedCommands.push("python3 *"), "sandbox"], [(s) => s.sandbox.credentials.envVars.pop(), "sandbox"], [(s) => { s.sandbox.network.allowUnixSockets = ["/x"]; }, "sandbox"], [(s) => { s.sandbox.network.socksProxyPort = 1; }, "sandbox"], [(s) => s.permissions.deny.splice(s.permissions.deny.findIndex((r) => r.startsWith("Read(")), 1), "permissions"], [(s) => s.permissions.deny.push("mcp__visualize__*"), "permissions"], [(s) => s.permissions.allow.push("WebFetch"), "permissions"], [(s) => { s.permissions.additionalDirectories = ["/x"]; }, "permissions"], [(s) => { s.autoMemoryEnabled = true; }, "memory"], [(s) => { s.disableSkillShellExecution = false; }, "skill-shell"], [(s) => { delete s.hooks.PostToolUse; }, "receipt"]]) {
      const s = open(); change(s); assert.deepEqual(lockBroken(s, { ...where(), lock: "open", node: w.node }), [key], change.toString());
    }
    for (const [change, keys] of [
      [(s) => { s.autoDreamEnabled = true; }, ["memory"]],
      [(s) => { delete s.hooks.PreToolUse; }, ["guard"]],
      [(s) => { s.hooks.PreToolUse[0].hooks[0].onFailure = "ignore"; }, ["guard"]],
      [(s) => { s.permissions.disableBypassPermissionsMode = "enable"; }, ["bypass", "permissions"]],
      [(s) => { delete s.permissions.disableAutoMode; }, ["auto", "permissions"]]
    ]) {
      const s = open();
      change(s);
      assert.deepEqual(broken(s), keys, change.toString());
    }
  });
  it("names what a folder written strict lacks on a Mac with the open lock", () => {
    const strict = JSON.parse(studioFiles({ checkout: w.checkout, node: w.node, folder: w.folder })[".claude/settings.json"]);
    assert.deepEqual(broken(strict), ["sandbox", "permissions", "memory", "skill-shell", "receipt"]);
  });
  it("keeps the strict lock's check as it was", () => {
    const strict = () => JSON.parse(studioFiles({ checkout: w.checkout, node: w.node, folder: w.folder })[".claude/settings.json"]);
    assert.deepEqual(lockBroken(strict(), { checkout: w.checkout, folder: w.folder }), []);
    assert.deepEqual(lockBroken(strict(), { ...where(), lock: "strict", node: "/elsewhere/node" }), []);
    // The strict check is not the whole: the node, and any other key, are only out of date there.
    for (const change of [(s) => { s.hooks.PreToolUse[0].hooks[0].args[1] = "/x/node"; }, (s) => { s.env = { X: "1" }; }, (s) => { s.permissions.deny.pop(); }]) {
      const s = strict();
      change(s);
      assert.deepEqual(lockBroken(s, { checkout: w.checkout, folder: w.folder }), [], change.toString());
    }
    for (const [change, keys] of [[(s) => { s.disableAllHooks = true; }, ["hooks"]], [(s) => { delete s.hooks; }, ["guard"]], [(s) => { s.permissions.disableBypassPermissionsMode = "enable"; }, ["bypass"]], [(s) => { delete s.permissions.disableAutoMode; }, ["auto"]]]) {
      const s = strict();
      change(s);
      assert.deepEqual(lockBroken(s, { checkout: w.checkout, folder: w.folder }), keys, change.toString());
    }
    // The open shape holds all the strict lock rests on.
    assert.deepEqual(lockBroken(open(), { checkout: w.checkout, folder: w.folder }), []);
  });
});
