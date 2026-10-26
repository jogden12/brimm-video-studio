// `behind` on a Mac with the open lock (design 2026-10-26, section 6, "One check of the lock, made by both"; R17, R18): beside PR #40's
// reasons, every settings source's sandbox keys, Edit( and WebFetch(domain:…) rules, memory keys and added folders, and her folder's
// own settings checked whole. Each test is a made-up Mac (open-world.js) with git, ps and lsof stand-ins, so no real one runs, and
// SECRET in every value, which no line may hold.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, LOCK_CHANGED } from "../edit.js";
import { settingsFile, writeSettings } from "../settings.js";
import { writeStudio } from "../studio.js";
import { SECRET_WORDS, environmentWhy, skillFolders } from "../loosened.js";
import { openWorld, openDeps, NODE, SESSION } from "./open-world.js";

/** Words that must never be said: what a settings file holds. */
const SECRET = "SECRET-WORDS-OF-A-FILE";
const NEWEST = "This Mac has the newest brimm-video.";
const STALE = "Her folder for Claude is out of date";

/** `behind` on the world `w`, its deps openDeps's with `more` over them, git finding the checkout up to date: { code, text, g }. */
async function behindOn(w, more = {}) {
  const calls = [];
  const run = async (cmd, args) => {
    calls.push(args);
    return calls.length === 1 ? { code: 0, stderr: "" } : { code: 0, stderr: "", stdout: "0\n" };
  };
  const said = [];
  const code = await editMain(["behind"], { ...openDeps(w, more), run, say: (line) => said.push(line) });
  return { code, text: said.join("\n"), g: { calls } };
}

/** A settings object holding `value` at the dotted `path`. */
const at = (path, value) => path.split(".").reduceRight((inner, key) => ({ [key]: inner }), value);

/** The labels each settings source is named by. */
const LABEL = { user: "this Mac's ~/.claude/settings.json", managed: "this Mac's managed settings, managed-settings.json", app: "the Claude app's --settings for this chat" };

/** Put `settings` where `where` says on the world `w`: the user's settings file, the managed settings file, or the app's --settings
    (given as deps). Gives the deps to add. */
function put(w, where, settings) {
  if (where === "app") return { appSettings: settings };
  const file = where === "user" ? join(w.home, ".claude", "settings.json") : join(w.dir, "managed", "managed-settings.json");
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify(settings));
  return {};
}

/** A refusal of `r` for `line` alone, among others perhaps: it starts LOCK_CHANGED, holds the line, holds no SECRET, ends 1 and asks git nothing. */
function refusedFor(r, line, what) {
  assert.equal(r.code, 1, what);
  assert.ok(r.text.startsWith(LOCK_CHANGED), `${what}: ${r.text}`);
  assert.ok(r.text.split("\n").includes(line), `${what}: ${r.text}`);
  assert.ok(!r.text.includes(SECRET), what);
  assert.equal(r.g.calls.length, 0, what);
}

/** Her folder's own settings, read and changed by `change`, and written back. */
function changeOwn(w, change) {
  const file = join(w.folder, ".claude", "settings.json");
  const settings = JSON.parse(readFileSync(file, "utf8"));
  change(settings);
  writeFileSync(file, JSON.stringify(settings, null, 2));
}

const ownLine = (parts) => `(Jason: her folder's .claude/settings.json no longer holds the open lock as this brimm-video writes it: ${parts}. Its contents are not shown here.)`;

describe("behind, with the open lock", () => {
  it("goes on when her folder holds the open lock as written and nothing else loosens it, and says nothing of it being out of date", async () => {
    const w = openWorld();
    const r = await behindOn(w);
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    assert.ok(!r.text.split("\n").some((line) => line.startsWith(STALE)));
    w.done();
  });
  it("says her open folder is out of date when its skill is older than this checkout's, and names the command that writes it again", async () => {
    const w = openWorld();
    const skill = join(w.folder, ".claude", "skills", "brimm-edit", "SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace(/\| "Show me the Reels".*\n/, ""));
    const r = await behindOn(w);
    assert.deepEqual([r.code, r.text], [0, `${NEWEST}\nHer folder for Claude is out of date: an older brimm-video wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node ${NODE}, then start a new session in her Claude folder)`]);
    w.done();
  });
  it("refuses, naming the key and none of its values, for every sandbox key but the few that narrow, in the user, managed and --settings settings", async () => {
    for (const path of ["enabled","filesystem.disabled","allowAppleEvents","excludedCommands","filesystem.allowRead","filesystem.allowWrite","allowUnsandboxedCommands","enableWeakerNetworkIsolation","network.allowedDomains","network.deniedDomains","network.allowUnixSockets","network.allowAllUnixSockets","network.allowLocalBinding","network.allowMachLookup","network.httpProxyPort","network.socksProxyPort","aKeyALaterVersionAdds"])
      for (const where of ["user", "managed", "app"]) {
        const w = openWorld();
        const r = await behindOn(w, put(w, where, { sandbox: at(path, SECRET) }));
        refusedFor(r, `(Jason: ${LABEL[where]}: sandbox.${path}, which can open her folder's lock. Its contents are not shown here.)`, `${where} ${path}`);
        w.done();
      }
  });
  it("names each sandbox key once, sorted, beside the ones that narrow", async () => {
    const w = openWorld();
    const r = await behindOn(w, put(w, "user", { sandbox: { network: { socksProxyPort: SECRET, allowedDomains: [SECRET] }, filesystem: { denyRead: [SECRET], allowWrite: [SECRET] }, enabled: SECRET } }));
    const lines = r.text.split("\n").filter((line) => line.includes("sandbox."));
    assert.deepEqual(lines, ["enabled", "filesystem.allowWrite", "network.allowedDomains", "network.socksProxyPort"].map((path) => `(Jason: ${LABEL.user}: sandbox.${path}, which can open her folder's lock. Its contents are not shown here.)`));
    w.done();
  });
  it("goes on for denyRead, denyWrite and envVars deny entries in those settings", async () => {
    for (const where of ["user", "managed", "app"]) {
      const w = openWorld();
      const narrowing = { sandbox: { filesystem: { denyRead: [SECRET], denyWrite: [SECRET] }, credentials: { envVars: [{ name: SECRET, mode: "deny" }] } }, env: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" }, autoMemoryEnabled: false, permissions: { allow: [`Bash(${SECRET})`], deny: [`Read(${SECRET})`, "WebFetch"], additionalDirectories: [] } };
      const r = await behindOn(w, put(w, where, narrowing));
      assert.deepEqual([r.code, r.text], [0, NEWEST], where);
      w.done();
    }
  });
  it("refuses for an envVars entry of another mode, an Edit( allow rule, a WebFetch(domain:…) deny, memory turned on there, and added folders", async () => {
    const cases = [
      [{ sandbox: { credentials: { envVars: [{ name: SECRET, mode: "deny" }, { name: SECRET, mode: "allow" }] } } }, (L) => `(Jason: ${L}: sandbox.credentials.envVars, which can open her folder's lock. Its contents are not shown here.)`],
      [{ permissions: { allow: [`Edit(/${SECRET}/**)`] } }, (L) => `(Jason: ${L}: an Edit( allow rule, which lets sandboxed commands write there. Its contents are not shown here.)`],
      [{ permissions: { deny: [`WebFetch(domain:${SECRET})`] } }, (L) => `(Jason: ${L}: a WebFetch(domain:…) deny rule, which brings the sandbox's proxy login back. Its contents are not shown here.)`],
      [{ autoMemoryEnabled: true }, (L) => `(Jason: ${L}: autoMemoryEnabled true, which turns Claude Code's memory on. Its contents are not shown here.)`],
      [{ autoDreamEnabled: true }, (L) => `(Jason: ${L}: autoDreamEnabled true, which turns Claude Code's memory on. Its contents are not shown here.)`],
      ...["0", "false", "No", "OFF", ""].map((value) => [{ env: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: value, OTHER: SECRET } }, (L) => `(Jason: ${L}: env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, which turns Claude Code's memory on. Its contents are not shown here.)`]),
      [{ permissions: { additionalDirectories: [`/${SECRET}`] } }, (L) => `(Jason: ${L}: permissions.additionalDirectories, which adds folders to every session. Its contents are not shown here.)`],
    ];
    for (const [settings, line] of cases)
      for (const where of ["user", "managed", "app"]) {
        const w = openWorld();
        refusedFor(await behindOn(w, put(w, where, settings)), line(LABEL[where]), `${where} ${JSON.stringify(settings)}`);
        w.done();
      }
  });
  it("refuses when the app's --settings turn hooks off", async () => {
    const w = openWorld();
    refusedFor(await behindOn(w, { appSettings: { disableAllHooks: true } }), `(Jason: ${LABEL.app} turns hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)`, "app");
    w.done();
  });
  it("says which part of her folder's own open settings is changed", async () => {
    const cases = [
      [(s) => (s.sandbox.network.allowedDomains = [SECRET]), "the sandbox's settings"],
      [(s) => s.permissions.allow.push(`Read(${SECRET})`), "the allow and deny rules"],
      [(s) => (s.autoMemoryEnabled = true), "memory off"],
      [(s) => delete s.disableSkillShellExecution, "skills' shell lines off"],
      [(s) => delete s.hooks.PostToolUse, "the card's receipt hook"],
      [(s) => (s.hooks.SessionStart = [{ hooks: [{ type: "command", command: SECRET }] }]), "a hook beside the guard and the receipt"],
      [(s) => (s.env = { A: SECRET }), "settings brimm-video does not write there"],
      [(s) => { s.env = { A: SECRET }; s.autoDreamEnabled = true; s.sandbox.enabled = false; }, "the sandbox's settings, memory off, settings brimm-video does not write there"],
    ];
    for (const [change, parts] of cases) {
      const w = openWorld();
      changeOwn(w, change);
      refusedFor(await behindOn(w), ownLine(parts), parts);
      w.done();
    }
    // This Mac's settings name no node her folder was written with, so nothing can be compared.
    const w = openWorld();
    const s = JSON.parse(readFileSync(settingsFile(w.home), "utf8"));
    delete s.studioNode;
    writeFileSync(settingsFile(w.home), JSON.stringify(s));
    refusedFor(await behindOn(w), ownLine("the node it was written with (this Mac's settings name none)"), "no node");
    w.done();
  });
  it("still says PR #40's lines for her folder's own settings first, on an open-lock Mac", async () => {
    const w = openWorld();
    changeOwn(w, (s) => {
      s.permissions.disableAutoMode = SECRET;
      s.env = { A: SECRET };
    });
    const r = await behindOn(w);
    assert.deepEqual(r.text.split("\n"), [LOCK_CHANGED, "(Jason: her folder's .claude/settings.json does not disable Auto mode (disableAutoMode). Its contents are not shown here.)", ownLine("the allow and deny rules, settings brimm-video does not write there")]);
    w.done();
  });
  it("is PR #40's check on a strict Mac, whatever the user settings' sandbox keys say", async () => {
    const w = openWorld();
    writeSettings(w.home, { lock: "strict" });
    writeStudio(w.home, { checkout: w.checkout, node: NODE });
    const more = put(w, "user", { sandbox: { enabled: false, network: { allowedDomains: [SECRET] } }, permissions: { allow: [`Edit(/${SECRET})`], additionalDirectories: [SECRET] }, autoMemoryEnabled: true });
    const r = await behindOn(w, { ...more, appSettings: { sandbox: { enabled: false } } });
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    w.done();
  });
  it("is PR #40's check, and the strict folder is not out of date, on a Mac whose settings say open while no Claude Code is named for the open lock", async () => {
    // openDeps(w, { minimum: null }); her folder written strict
    const w = openWorld();
    writeStudio(w.home, { checkout: w.checkout, node: NODE });
    const more = put(w, "user", { sandbox: { enabled: false } });
    const r = await behindOn(w, { ...more, minimum: null });
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    // And her folder still written open is out of date, not changed: the strict lock is in effect.
    const open = openWorld();
    const stale = await behindOn(open, { minimum: null });
    assert.equal(stale.code, 0);
    assert.ok(stale.text.split("\n")[1].startsWith(STALE), stale.text);
    open.done();
    w.done();
  });
});

describe("behind, with the open lock: the chat's environment, the proxy port and the workshop", () => {
  const secretLine = (name) => `(Jason: this chat's environment has ${name}, which looks like a secret and is not on brimm-video's list. Its value is not shown here.)`;
  it("refuses for a secret-shaped name not on the list, naming it and never its value", async () => {
    for (const name of ["GITHUB_TOKEN", "MY_API_KEY", "DB_PASSWORD", "OPENROUTER_KEY", "npm_config__auth", "Apple_PubSub_Socket_Render", "GIT_ASKPASS_PASSWD", "SESSION_COOKIE", "AWS_CREDENTIALS_FILE", "BILLING_EMAIL", "ACCOUNT_ID", "ORGANIZATION_ID", "A_SECRET"]) {
      const w = openWorld();
      refusedFor(await behindOn(w, { env: { PATH: "/usr/bin", [name]: SECRET } }), secretLine(name), name);
      w.done();
    }
    assert.deepEqual(SECRET_WORDS, ["TOKEN","SECRET","PASSWORD","PASSWD","KEY","AUTH","COOKIE","CREDENTIAL","EMAIL","ACCOUNT","ORGANIZATION","SOCK"]);
  });
  it("goes on with only listed and harmless names, the chat's id and pid among them", async () => {
    // env { PATH, HOME, CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s", CLAUDE_PID: "700", CLAUDE_CODE_MESSAGING_TOKEN: SECRET, SSH_AUTH_SOCK: SECRET }
    const w = openWorld();
    const env = { PATH: "/usr/bin", HOME: w.home, CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700", CLAUDE_CODE_MESSAGING_TOKEN: SECRET, SSH_AUTH_SOCK: SECRET };
    assert.deepEqual(environmentWhy(env), []);
    const r = await behindOn(w, { env });
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    // A name the by-hand round finds harmless is let be; one on neither list is not.
    assert.deepEqual(environmentWhy({ ...env, XPC_SERVICE_NAME_TOKEN: SECRET }, { deny: [], harmless: ["XPC_SERVICE_NAME_TOKEN", "CLAUDE_CODE_MESSAGING_TOKEN", "SSH_AUTH_SOCK"] }), []);
    assert.deepEqual(environmentWhy({ ...env, XPC_SERVICE_NAME_TOKEN: SECRET }, { deny: [], harmless: [] }), ["CLAUDE_CODE_MESSAGING_TOKEN", "SSH_AUTH_SOCK", "XPC_SERVICE_NAME_TOKEN"].map(secretLine));
    w.done();
  });
  it("refuses when the environment turns memory on, or holds the memory server's names, and goes on for CLAUDE_CODE_DISABLE_AUTO_MEMORY=1", async () => {
    const server = (name) => `(Jason: this chat's environment has ${name}, which sends Claude Code's memory to a server. Its value is not shown here.)`;
    const on = "(Jason: this chat's environment turns Claude Code's memory on (CLAUDE_CODE_DISABLE_AUTO_MEMORY). Its value is not shown here.)";
    for (const [env, line] of [[{ CLAUDE_CODE_POST_TURN_MEMORY: SECRET }, server("CLAUDE_CODE_POST_TURN_MEMORY")], [{ CLAUDE_CODE_MEMORY_API_TOKEN: SECRET }, server("CLAUDE_CODE_MEMORY_API_TOKEN")], ...["0", "false", "Off", "no", ""].map((value) => [{ CLAUDE_CODE_DISABLE_AUTO_MEMORY: value }, on])]) {
      const w = openWorld();
      const r = await behindOn(w, { env });
      refusedFor(r, line, JSON.stringify(env));
      // The memory server's token is said once, as that, and not again as a secret.
      assert.deepEqual(r.text.split("\n").slice(1), [line], JSON.stringify(env));
      w.done();
    }
    const w = openWorld();
    assert.deepEqual(Object.values(await behindOn(w, { env: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" } })).slice(0, 2), [0, NEWEST]);
    w.done();
  });
  it("refuses when something listens on the proxy port, or that cannot be checked", async () => {
    const asked = [];
    const w = openWorld();
    const listening = await behindOn(w, { lsof: (port) => (asked.push(port), "node    4242 sallie   21u  IPv4 0x1      0t0  TCP 127.0.0.1:47123 (LISTEN)\n") });
    refusedFor(listening, `(Jason: something on this Mac listens on her folder's proxy port, ${w.port}.)`, "listening");
    assert.deepEqual(asked, [w.port]);
    refusedFor(await behindOn(w, { lsof: () => null }), `(Jason: whether anything listens on her folder's proxy port, ${w.port}, could not be checked.)`, "not checked");
    assert.deepEqual(Object.values(await behindOn(w, { lsof: () => "\n" })).slice(0, 2), [0, NEWEST]);
    w.done();
  });
  it("refuses for a .claude, CLAUDE.md, CLAUDE.local.md or .mcp.json anywhere in the workshop, in any letter case", async () => {
    const line = "(Jason: the workshop holds a .claude folder, a CLAUDE.md, a CLAUDE.local.md or a .mcp.json, which a session started there would take as its own.)";
    const makers = {
      ".claude": (dir) => mkdirSync(join(dir, ".claude")),
      ".Claude": (dir) => mkdirSync(join(dir, ".Claude")),
      "CLAUDE.md": (dir) => writeFileSync(join(dir, "CLAUDE.md"), SECRET),
      "claude.md": (dir) => writeFileSync(join(dir, "claude.md"), SECRET),
      "Claude.Local.MD": (dir) => writeFileSync(join(dir, "Claude.Local.MD"), SECRET),
      ".mcp.json": (dir) => writeFileSync(join(dir, ".mcp.json"), SECRET),
      ".MCP.JSON": (dir) => writeFileSync(join(dir, ".MCP.JSON"), SECRET),
      "a link named CLAUDE.md, to nowhere": (dir) => symlinkSync(join(dir, "nowhere"), join(dir, "CLAUDE.md")),
      "deep inside": (dir) => {
        mkdirSync(join(dir, "a", "b", "c"), { recursive: true });
        writeFileSync(join(dir, "a", "b", "c", "CLAUDE.md"), SECRET);
      },
    };
    for (const [what, make] of Object.entries(makers)) {
      const w = openWorld();
      make(w.workshop);
      refusedFor(await behindOn(w), line, what);
      w.done();
    }
    // Names that only hold those words are left alone, and a link is not followed into what it leads to.
    const w = openWorld();
    writeFileSync(join(w.workshop, "notes on CLAUDE.md.txt"), SECRET);
    mkdirSync(join(w.dir, "elsewhere", ".claude"), { recursive: true });
    symlinkSync(join(w.dir, "elsewhere"), join(w.workshop, "a link"));
    assert.deepEqual(Object.values(await behindOn(w)).slice(0, 2), [0, NEWEST]);
    w.done();
  });
  it("refuses when the workshop holds more than it looks through, or a folder in it cannot be looked through", async () => {
    const w = openWorld();
    for (let i = 0; i < 6; i++) writeFileSync(join(w.workshop, `picture ${i}.svg`), SECRET);
    assert.deepEqual(Object.values(await behindOn(w, { workshopLimit: 6 })).slice(0, 2), [0, NEWEST]);
    refusedFor(await behindOn(w, { workshopLimit: 5 }), "(Jason: the workshop holds too much to look through for a .claude folder or a CLAUDE.md.)", "too much");
    mkdirSync(join(w.workshop, "shut"));
    chmodSync(join(w.workshop, "shut"), 0o000);
    refusedFor(await behindOn(w), "(Jason: the workshop holds a folder that could not be looked through for a .claude folder or a CLAUDE.md.)", "shut");
    chmodSync(join(w.workshop, "shut"), 0o700);
    w.done();
  });
  it("leaves alone the .claude/.cc-writes folder Claude Code makes in her folder", async () => {
    const w = openWorld();
    mkdirSync(join(w.folder, ".claude", ".cc-writes"), { recursive: true });
    writeFileSync(join(w.folder, ".claude", ".cc-writes", "a write"), SECRET);
    assert.deepEqual(Object.values(await behindOn(w)).slice(0, 2), [0, NEWEST]);
    w.done();
  });
});

describe("behind, with the open lock: plugins, named skills and SessionStart hooks", () => {
  const pluginLine = (name) => `(Jason: the plugin ${name} carries hooks or a mod, which run outside the sandbox. Turn it off for her account.)`;
  const skillLine = (name) => `(Jason: the skill ${name}, which her folder allows, registers hooks (hooks: in its SKILL.md).)`;
  /** A plugin's folder at `dir`, carrying `what`: "hooks" (hooks/hooks.json), "hooks key" or "mods key" (in .claude-plugin/plugin.json), or "neither". */
  function plugin(dir, what) {
    mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
    writeFileSync(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "p", description: SECRET, ...(what === "hooks key" ? { hooks: "./h.json" } : what === "mods key" ? { mods: { a: SECRET } } : {}) }));
    if (what === "hooks") {
      mkdirSync(join(dir, "hooks"), { recursive: true });
      writeFileSync(join(dir, "hooks", "hooks.json"), JSON.stringify({ hooks: { SessionStart: [SECRET] } }));
    }
  }
  const cache = (w, marketplace, name, version = "1.0.0") => join(w.home, ".claude", "plugins", "cache", marketplace, name, version);
  const synced = (w, name) => join(w.home, ".claude", "plugins", "synced", "acct_0001", name);

  it("refuses for an enabled plugin that carries hooks or a mod, in the cache or synced from her account, and goes on for one turned off or carrying neither", async () => {
    for (const what of ["hooks", "hooks key", "mods key"])
      for (const where of ["user", "managed", "app"]) {
        const w = openWorld();
        plugin(cache(w, "a-market", "hooky"), what);
        refusedFor(await behindOn(w, put(w, where, { enabledPlugins: { "hooky@a-market": true } })), pluginLine("hooky@a-market"), `${what} ${where}`);
        w.done();
      }
    for (const what of ["hooks", "mods key"]) {
      const w = openWorld();
      plugin(synced(w, "modded"), what);
      refusedFor(await behindOn(w), pluginLine("modded"), `synced ${what}`);
      w.done();
    }
    // Turned off, not enabled at all, or enabled and carrying neither: nothing to say.
    const w = openWorld();
    plugin(cache(w, "a-market", "hooky"), "hooks");
    plugin(cache(w, "a-market", "plain"), "neither");
    plugin(synced(w, "plain-synced"), "neither");
    plugin(cache(w, "b-market", "unnamed"), "hooks");
    const r = await behindOn(w, put(w, "user", { enabledPlugins: { "hooky@a-market": false, "plain@a-market": true, "missing@a-market": true } }));
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    w.done();
  });
  it("refuses for a named skill whose SKILL.md registers hooks, wherever it is kept, and goes on for one that does not, or is not there", async () => {
    const withHooks = `---\nname: frontend-design\ndescription: ${SECRET}\nhooks:\n  PreToolUse: []\n---\n\n# A skill\n`;
    const places = {
      "her folder": (w) => join(w.folder, ".claude", "skills", "frontend-design"),
      "the user's skills": (w) => join(w.home, ".claude", "skills", "frontend-design"),
      "a plugin in the cache": (w) => join(cache(w, "a-market", "design"), "skills", "frontend-design"),
      "a plugin synced from her account": (w) => join(synced(w, "design"), "skills", "frontend-design"),
    };
    for (const [where, at] of Object.entries(places)) {
      const w = openWorld();
      mkdirSync(at(w), { recursive: true });
      writeFileSync(join(at(w), "SKILL.md"), withHooks);
      assert.ok(skillFolders({ home: w.home, folder: w.folder, name: "frontend-design" }).includes(at(w)), where);
      refusedFor(await behindOn(w), skillLine("frontend-design"), where);
      w.done();
    }
    // A skill this Mac's settings add is named too.
    const added = openWorld();
    writeSettings(added.home, { studioAllow: [{ type: "skill", name: "her-own" }] });
    mkdirSync(join(added.home, ".claude", "skills", "her-own"), { recursive: true });
    writeFileSync(join(added.home, ".claude", "skills", "her-own", "SKILL.md"), withHooks);
    refusedFor(await behindOn(added), skillLine("her-own"), "added");
    added.done();
    // No hooks: line in its front matter, a skill not named, and a named one that is not there: nothing to say.
    const w = openWorld();
    for (const [name, text] of [["frontend-design", `---\nname: frontend-design\ndescription: ${SECRET}\n---\n\nhooks: are written about here, not registered.\n`], ["not-named", withHooks]]) {
      mkdirSync(join(w.home, ".claude", "skills", name), { recursive: true });
      writeFileSync(join(w.home, ".claude", "skills", name, "SKILL.md"), text);
    }
    assert.deepEqual(skillFolders({ home: w.home, folder: w.folder, name: "theme-factory" }), []);
    const r = await behindOn(w);
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    w.done();
  });
  it("refuses for a SessionStart hook in the user, managed or --settings settings, and goes on for her folder's own guard and receipt hooks", async () => {
    for (const where of ["user", "managed", "app"]) {
      const w = openWorld();
      const r = await behindOn(w, put(w, where, { hooks: { SessionStart: [{ hooks: [{ type: "command", command: SECRET }] }] } }));
      refusedFor(r, `(Jason: ${LABEL[where]}: a SessionStart hook, which can change the id brimm-video marks chats by. Its contents are not shown here.)`, where);
      w.done();
    }
    const w = openWorld();
    const r = await behindOn(w, put(w, "user", { hooks: { Stop: [{ hooks: [{ type: "command", command: SECRET }] }], SessionStart: [] } }));
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    w.done();
  });
  it("refuses for any hook in her folder's own settings beyond the guard and the receipt, a SessionStart hook the /hooks menu wrote there among them", async () => {
    // Task 7's "other-hooks": the line names "a hook beside the guard and the receipt"
    const hook = { matcher: "*", hooks: [{ type: "command", command: SECRET }] };
    for (const [what, change] of [["SessionStart", (s) => (s.hooks.SessionStart = [{ hooks: [{ type: "command", command: SECRET }] }])], ["a second PreToolUse", (s) => s.hooks.PreToolUse.push(hook)], ["a second PostToolUse", (s) => s.hooks.PostToolUse.push(hook)], ["Stop", (s) => (s.hooks.Stop = [hook])]]) {
      const w = openWorld();
      changeOwn(w, change);
      refusedFor(await behindOn(w), ownLine("a hook beside the guard and the receipt"), what);
      w.done();
    }
  });
});
