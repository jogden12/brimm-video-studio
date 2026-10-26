// `behind` on a Mac with the open lock (design 2026-10-26, section 6, "One check of the lock, made by both"; R17, R18): beside PR #40's
// reasons, every settings source's sandbox keys, Edit( and WebFetch(domain:…) rules, memory keys and added folders, and her folder's
// own settings checked whole. Each test is a made-up Mac (open-world.js) with git, ps and lsof stand-ins, so no real one runs, and
// SECRET in every value, which no line may hold.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, LOCK_CHANGED } from "../edit.js";
import { readSettings, settingsFile, settingsMain, writeSettings } from "../settings.js";
import { writeStudio } from "../studio.js";
import { SECRET_WORDS, UNTRUSTED, environmentWhy, skillFolders } from "../loosened.js";
import { claudeDirName } from "../places.js";
import { openWorld, openDeps, psText, chatChain, appCopy, APP_ARGS, RECORD, MINIMUM, NODE, SESSION, CHAT_ENV, transcript } from "./open-world.js";

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

/** This Mac's settings in the world `w`. */
const readSettingsOf = (w) => readSettings(w.home).settings;

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

/** The chat's transcript where Claude Code keeps it for a chat started in her folder, ~/.claude/projects/<her folder's name>/, written
    from `lines`. Gives its path. */
const chatTranscript = (w, lines, id = SESSION) => transcript(join(w.home, ".claude", "projects", claudeDirName(w.folder)), lines, id);

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
  it("refuses when her user settings lose a Read deny rule brimm-video added, and says nothing of them on a Mac where none were added", async () => {
    const LINE = "(Jason: her user settings, ~/.claude/settings.json, no longer hold every Read deny rule brimm-video added for the places only it reads. Its contents are not shown here.)";
    const w = openWorld();
    const user = join(w.home, ".claude", "settings.json");
    const addRules = async () => assert.equal(await settingsMain(["user-deny"], { home: w.home, say: () => {}, openMinimum: MINIMUM, tmp: w.tmp, uid: w.uid }), 0);
    // None added on this Mac: her user settings are not looked at for them, though they hold none.
    put(w, "user", { model: SECRET });
    assert.deepEqual(Object.values(await behindOn(w)).slice(0, 2), [0, NEWEST]);
    // Added, as install.sh --user-deny does: it goes on.
    await addRules();
    assert.equal(readSettingsOf(w).userDeny, true);
    assert.deepEqual(Object.values(await behindOn(w)).slice(0, 2), [0, NEWEST]);
    // One taken away, in either spelling, or the .env rule: refused, naming none.
    const rules = JSON.parse(readFileSync(user, "utf8")).permissions.deny;
    for (const lost of [rules.find((rule) => rule.includes("/System/Volumes/Data")), rules.find((rule) => rule.endsWith("/.ssh/**)") && !rule.includes("/System/")), "Read(**/.env)"]) {
      assert.ok(lost, "a rule to take away");
      writeFileSync(user, JSON.stringify({ model: SECRET, permissions: { deny: rules.filter((rule) => rule !== lost) } }));
      refusedFor(await behindOn(w), LINE, lost);
    }
    // Her user settings gone, or not JSON: refused too.
    rmSync(user);
    refusedFor(await behindOn(w), LINE, "no user settings");
    writeFileSync(user, `not JSON ${SECRET}`);
    refusedFor(await behindOn(w), LINE, "user settings that are not JSON");
    // Added again, they hold every rule once more.
    rmSync(user);
    await addRules();
    assert.deepEqual(Object.values(await behindOn(w)).slice(0, 2), [0, NEWEST]);
    // On a strict Mac nothing of them is said (R18).
    writeFileSync(user, "{}");
    writeStudio(w.home, { checkout: w.checkout, node: NODE });
    assert.deepEqual(Object.values(await behindOn(w, { minimum: null })).slice(0, 2), [0, NEWEST]);
    w.done();
  });
});

describe("behind, with the open lock: the chat's environment, the proxy port and the workshop", () => {
  const secretLine = (name) => `(Jason: this chat's environment has ${name}, which looks like a secret and is not on brimm-video's list. Its value is not shown here.)`;
  it("refuses for a secret-shaped name not on the list, naming it and never its value", async () => {
    for (const name of ["GITHUB_TOKEN", "MY_API_KEY", "DB_PASSWORD", "OPENROUTER_KEY", "npm_config__auth", "Apple_PubSub_Socket_Render", "GIT_ASKPASS_PASSWD", "SESSION_COOKIE", "AWS_CREDENTIALS_FILE", "BILLING_EMAIL", "ACCOUNT_ID", "ORGANIZATION_ID", "A_SECRET"]) {
      const w = openWorld();
      refusedFor(await behindOn(w, { env: { ...CHAT_ENV, PATH: "/usr/bin", [name]: SECRET } }), secretLine(name), name);
      w.done();
    }
    assert.deepEqual(SECRET_WORDS, ["TOKEN","SECRET","PASSWORD","PASSWD","KEY","AUTH","COOKIE","CREDENTIAL","EMAIL","ACCOUNT","ORGANIZATION","SOCK"]);
  });
  it("goes on with only listed and harmless names, the chat's id and pid among them", async () => {
    // env { PATH, HOME, CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s", CLAUDE_PID: "700", CLAUDE_CODE_MESSAGING_TOKEN: SECRET, SSH_AUTH_SOCK: SECRET }
    const w = openWorld();
    const env = { PATH: "/usr/bin", HOME: w.home, CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700", CLAUDE_CODE_MESSAGING_TOKEN: SECRET, SSH_AUTH_SOCK: SECRET };
    assert.deepEqual(environmentWhy(env), []);
    chatTranscript(w, [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
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
      const r = await behindOn(w, { env: { ...CHAT_ENV, ...env } });
      refusedFor(r, line, JSON.stringify(env));
      // The memory server's token is said once, as that, and not again as a secret.
      assert.deepEqual(r.text.split("\n").slice(1), [line], JSON.stringify(env));
      w.done();
    }
    const w = openWorld();
    assert.deepEqual(Object.values(await behindOn(w, { env: { ...CHAT_ENV, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" } })).slice(0, 2), [0, NEWEST]);
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
  const missingLine = (name) => `(Jason: the plugin ${name} is turned on but is not in the plugins cache, so whether it carries hooks or a mod, which run outside the sandbox, is not known. Turn it off for her account.)`;
  const linkedLine = (name) => `(Jason: the plugin ${name} is kept through a link, so whether it carries hooks or a mod, which run outside the sandbox, is not known. Turn it off for her account.)`;
  const SYNCED_LINKED = "(Jason: a plugin synced from her account is kept through a link, so whether it carries hooks or a mod, which run outside the sandbox, is not known.)";
  const skillLinkedLine = (name) => `(Jason: the skill ${name}, which her folder allows, is kept through a link, so whether it registers hooks is not known.)`;
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
    const r = await behindOn(w, put(w, "user", { enabledPlugins: { "hooky@a-market": false, "plain@a-market": true } }));
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    w.done();
  });
  it("refuses for an enabled plugin that is not in the cache, since then whether it carries hooks is not known", async () => {
    const w = openWorld();
    plugin(cache(w, "a-market", "plain"), "neither");
    // An empty plugin folder, with no version in it, is not there either.
    mkdirSync(join(w.home, ".claude", "plugins", "cache", "a-market", "empty"), { recursive: true });
    const r = await behindOn(w, put(w, "user", { enabledPlugins: { "plain@a-market": true, "missing@a-market": true, "empty@a-market": true } }));
    for (const name of ["missing@a-market", "empty@a-market"]) refusedFor(r, missingLine(name), name);
    assert.ok(!r.text.includes("plain@a-market"), r.text);
    w.done();
  });
  it("refuses for a plugin kept through a link, in the cache or synced from her account, whatever it carries", async () => {
    // A version folder that is a link, of an enabled plugin, carrying neither hooks nor a mod where it leads.
    const w = openWorld();
    plugin(join(w.dir, "elsewhere", "linked"), "neither");
    mkdirSync(join(cache(w, "a-market", "linked"), ".."), { recursive: true });
    symlinkSync(join(w.dir, "elsewhere", "linked"), cache(w, "a-market", "linked"));
    refusedFor(await behindOn(w, put(w, "user", { enabledPlugins: { "linked@a-market": true } })), linkedLine("linked@a-market"), "a version folder");
    w.done();
    // A synced plugin that is a link, and an account folder that is one.
    for (const [what, link] of [["a synced plugin", (v) => synced(v, "linked")], ["an account", (v) => join(v.home, ".claude", "plugins", "synced", "acct_0002")]]) {
      const v = openWorld();
      plugin(join(v.dir, "elsewhere", "linked"), "neither");
      mkdirSync(join(link(v), ".."), { recursive: true });
      symlinkSync(join(v.dir, "elsewhere", what === "an account" ? "" : "linked"), link(v));
      refusedFor(await behindOn(v), SYNCED_LINKED, what);
      v.done();
    }
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
  it("refuses for a named skill kept through a link, wherever it would be kept, whatever its SKILL.md says", async () => {
    const plain = `---\nname: frontend-design\ndescription: ${SECRET}\n---\n\n# A skill\n`;
    const places = {
      "her folder": (w) => join(w.folder, ".claude", "skills", "frontend-design"),
      "the user's skills": (w) => join(w.home, ".claude", "skills", "frontend-design"),
      "a plugin in the cache": (w) => join(cache(w, "a-market", "design"), "skills", "frontend-design"),
      "a plugin synced from her account": (w) => join(synced(w, "design"), "skills", "frontend-design"),
    };
    for (const [where, at] of Object.entries(places)) {
      const w = openWorld();
      mkdirSync(join(w.dir, "elsewhere", "frontend-design"), { recursive: true });
      writeFileSync(join(w.dir, "elsewhere", "frontend-design", "SKILL.md"), plain);
      mkdirSync(join(at(w), ".."), { recursive: true });
      symlinkSync(join(w.dir, "elsewhere", "frontend-design"), at(w));
      // skillFolders, which the guard's reads rest on, still takes no link.
      assert.deepEqual(skillFolders({ home: w.home, folder: w.folder, name: "frontend-design" }), [], where);
      refusedFor(await behindOn(w), skillLinkedLine("frontend-design"), where);
      w.done();
    }
  });
  it("reads a named skill's SKILL.md in a plugin reached through a link, and one beginning with a byte-order mark", async () => {
    const withHooks = `---\nname: frontend-design\ndescription: ${SECRET}\nhooks:\n  PreToolUse: []\n---\n\n# A skill\n`;
    const w = openWorld();
    const elsewhere = join(w.dir, "elsewhere", "b-market");
    mkdirSync(join(elsewhere, "design", "1.0.0", "skills", "frontend-design"), { recursive: true });
    writeFileSync(join(elsewhere, "design", "1.0.0", "skills", "frontend-design", "SKILL.md"), withHooks);
    mkdirSync(join(w.home, ".claude", "plugins", "cache"), { recursive: true });
    symlinkSync(elsewhere, join(w.home, ".claude", "plugins", "cache", "b-market"));
    refusedFor(await behindOn(w), skillLine("frontend-design"), "a marketplace through a link");
    w.done();
    const v = openWorld();
    mkdirSync(join(v.home, ".claude", "skills", "frontend-design"), { recursive: true });
    writeFileSync(join(v.home, ".claude", "skills", "frontend-design", "SKILL.md"), `\uFEFF${withHooks}`);
    refusedFor(await behindOn(v), skillLine("frontend-design"), "a byte-order mark");
    v.done();
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

describe("behind, with the open lock: the app's flags, folders added mid-chat, the version, the session's folder and trust", () => {
  /** The app's notes folder of the world's chat, which the Code tab adds to every session. */
  const notesRoot = (w) => join(w.home, "Library", "Application Support", "Claude", "side-session-notes");
  const notes = (w) => join(notesRoot(w), "local_00000000-0000-4000-8000-000000000000");
  /** The deps for a chat whose claude was started with `args`. */
  const started = (args, more = {}) => ({ ps: () => chatChain({ args }), ...more });
  /** The app's arguments for the world's chat, with `from` put as `to`. */
  const argsWith = (w, from, to) => {
    const args = APP_ARGS(w.folder, w.home);
    assert.ok(args.includes(from), from);
    return args.replace(from, to);
  };
  /** Under Claude Code, as her chat's commands run: its environment, with the chat's id. */
  const UNDER = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: SESSION };
  const INSIDE_WHY = "(Jason: this session runs in a folder inside her folder for Claude, not in the folder itself, and Claude Code reads the folder's lock only in the folder itself. Start her sessions on ~/BRIMM Video Studio itself.)";
  const ADDED_WHY = "(Jason: this chat has a folder added to it by the Claude app (--add-dir), which its commands could write and whose skills it would load.)";
  const MID_CHAT_WHY = "(Jason: a folder was added to this chat while it ran (/add-dir, or \"add this folder\" on a card), which its commands could write and whose skills it would load.)";
  const goesOn = (r, what) => assert.deepEqual([r.code, r.text], [0, NEWEST], what);

  it("goes on for a chat whose flags are all in the record and whose one added folder is the app's own notes folder", async () => {
    const w = openWorld();
    mkdirSync(notes(w), { recursive: true });
    goesOn(await behindOn(w), "Jason's run");
    chatTranscript(w, [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
    goesOn(await behindOn(w, { env: UNDER }), "under Claude Code");
    w.done();
  });
  it("refuses for a flag outside the record, another project-config root, other setting sources, and an allowedTools rule that is not a connector's", async () => {
    const w = openWorld();
    const flag = (name) => `(Jason: the Claude app started this chat with ${name}, which is not among the flags recorded for her chats.)`;
    refusedFor(await behindOn(w, started(`${APP_ARGS(w.folder, w.home)} --plugin-dir /x/${SECRET}`)), flag("--plugin-dir"), "plugin-dir");
    refusedFor(await behindOn(w, started(`${APP_ARGS(w.folder, w.home)} --mcp-config={"a":"${SECRET}"}`)), flag("--mcp-config"), "mcp-config");
    refusedFor(await behindOn(w, { appFlags: { flags: RECORD.flags.filter((f) => f !== "--verbose") } }), flag("--verbose"), "a flag the record leaves out");
    // The record as the checkout holds it until the by-hand round: every flag is outside it (R3).
    const unrecorded = await behindOn(w, { appFlags: undefined });
    for (const name of ["--output-format", "--settings", "--add-dir", "--setting-sources"]) refusedFor(unrecorded, flag(name), name);
    refusedFor(await behindOn(w, started(argsWith(w, `--project-config-root ${w.folder}`, `--project-config-root ${w.home}`))), "(Jason: the Claude app reads this chat's project settings from another folder (--project-config-root).)", "project-config-root");
    refusedFor(await behindOn(w, started(argsWith(w, "--setting-sources=user,project,local", "--setting-sources=user,local"))), "(Jason: the Claude app starts this chat with other setting sources (--setting-sources).)", "setting-sources");
    refusedFor(await behindOn(w, started(`${APP_ARGS(w.folder, w.home)} --allowedTools mcp__a__b,Bash(${SECRET})`)), "(Jason: the Claude app allows this chat a rule that is not a connector's tool (--allowedTools).)", "allowedTools");
    goesOn(await behindOn(w, started(`${APP_ARGS(w.folder, w.home)} --allowedTools mcp__a__b mcp__c__d,mcp__e__f`)), "connectors' tools");
    w.done();
  });
  it("names a flag outside the record only when it is one of Claude Code's own, so that no word of a value is said", async () => {
    // A value holding " --": `--add-dir=/x/Smith --final` splits into --add-dir and a "flag" --final, which is a word of a path.
    const UNNAMED = "(Jason: the Claude app started this chat with a flag that is not among the flags recorded for her chats.)";
    const w = openWorld();
    for (const [what, extra] of [["a word of a value", `--add-dir=/x/${SECRET} --final`], ["a word that is no flag's shape", `--settings {} --{"${SECRET}":1}`], ["a flag-shaped word", `--allowedTools mcp__a__b --Smith-and-Jones`]]) {
      const r = await behindOn(w, started(`${APP_ARGS(w.folder, w.home)} ${extra}`));
      refusedFor(r, UNNAMED, what);
      for (const word of ["--final", "final", "Smith", "Jones"]) assert.ok(!r.text.includes(word), `${what}: ${word}: ${r.text}`);
    }
    // One of Claude Code's own option names is still said.
    refusedFor(await behindOn(w, started(`${APP_ARGS(w.folder, w.home)} --agents {"a":"${SECRET}"}`)), "(Jason: the Claude app started this chat with --agents, which is not among the flags recorded for her chats.)", "--agents");
    w.done();
  });
  it("reads the app's --settings, as JSON or as a file, for every loosening key, allowUnsandboxedCommands false among them", async () => {
    const w = openWorld();
    const loose = { sandbox: { allowUnsandboxedCommands: false }, permissions: { allow: [`Edit(/${SECRET}/**)`] }, hooks: { SessionStart: [{ hooks: [{ type: "command", command: SECRET }] }] }, disableAllHooks: true, env: { A: SECRET } };
    const lines = [
      `(Jason: ${LABEL.app} turns hooks off (disableAllHooks), which the lock rests on. Its contents are not shown here.)`,
      `(Jason: ${LABEL.app}: sandbox.allowUnsandboxedCommands, which can open her folder's lock. Its contents are not shown here.)`,
      `(Jason: ${LABEL.app}: an Edit( allow rule, which lets sandboxed commands write there. Its contents are not shown here.)`,
      `(Jason: ${LABEL.app}: a SessionStart hook, which can change the id brimm-video marks chats by. Its contents are not shown here.)`,
    ];
    const file = join(w.dir, "app settings.json");
    writeFileSync(file, JSON.stringify(loose));
    for (const value of [JSON.stringify(loose), file]) {
      const r = await behindOn(w, started(argsWith(w, "--settings {}", `--settings ${value}`)));
      for (const line of lines) refusedFor(r, line, `${value.slice(0, 1)}: ${line}`);
    }
    for (const value of ['{"sandbox":', join(w.dir, "not there.json"), "relative.json", "[]"]) {
      refusedFor(await behindOn(w, started(argsWith(w, "--settings {}", `--settings ${value}`))), "(Jason: the Claude app's --settings for this chat could not be read.)", value);
    }
    w.done();
  });
  it("refuses for any --add-dir but the app's notes folder, and for that folder through a link", async () => {
    const w = openWorld();
    mkdirSync(notes(w), { recursive: true });
    const add = (dir) => started(argsWith(w, `--add-dir=${notes(w)}`, `--add-dir=${dir}`));
    for (const dir of [join(w.home, "Documents"), join(notes(w), "deeper"), notesRoot(w), w.folder, `${notes(w)} ${w.home}`]) refusedFor(await behindOn(w, add(dir)), ADDED_WHY, dir);
    refusedFor(await behindOn(w, started(`${APP_ARGS(w.folder, w.home)} --add-dir ${w.workshop}`)), ADDED_WHY, "a second --add-dir");
    // The notes folder through a link: one in its place, and one on the way to it.
    mkdirSync(join(w.dir, "elsewhere"), { recursive: true });
    symlinkSync(join(w.dir, "elsewhere"), join(notesRoot(w), "local_link"));
    refusedFor(await behindOn(w, add(join(notesRoot(w), "local_link"))), ADDED_WHY, "a link in its place");
    symlinkSync(notesRoot(w), join(w.dir, "notes link"));
    refusedFor(await behindOn(w, add(join(w.dir, "notes link", "local_x"))), ADDED_WHY, "a link to the notes folder");
    w.done();
    const v = openWorld();
    const claude = join(v.home, "Library", "Application Support", "Claude");
    mkdirSync(join(v.dir, "the app's data", "side-session-notes", "local_x"), { recursive: true });
    symlinkSync(join(v.dir, "the app's data"), claude);
    refusedFor(await behindOn(v, started(argsWith(v, `--add-dir=${notes(v)}`, `--add-dir=${join(claude, "side-session-notes", "local_x")}`))), ADDED_WHY, "a link on the way");
    v.done();
  });
  it("reads a folder added mid-chat from the transcript's latest environment snapshot", async () => {
    // a line copied from K0's shape: {"type":"attachment","attachment":{"type":"environment","snapshot":{"additionalWorkingDirectories":["/x"]}}} → refused;
    // a later snapshot with [] → goes on
    const w = openWorld();
    const path = chatTranscript(w, [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }, '{"type":"attachment","attachment":{"type":"environment","snapshot":{"additionalWorkingDirectories":["/x"]}}}']);
    refusedFor(await behindOn(w, { env: UNDER }), MID_CHAT_WHY, "added");
    writeFileSync(path, readFileSync(path, "utf8") + '{"type":"attachment","attachment":{"type":"environment","snapshot":{"additionalWorkingDirectories":[]}}}\n');
    goesOn(await behindOn(w, { env: UNDER }), "taken away");
    writeFileSync(path, readFileSync(path, "utf8") + JSON.stringify({ type: "attachment", attachment: { type: "environment", snapshot: { additionalWorkingDirectories: [notes(w)] } } }) + "\n");
    goesOn(await behindOn(w, { env: UNDER }), "the notes folder");
    w.done();
  });
  it("is under Claude Code with a claude above, though CLAUDECODE is taken out of its environment", async () => {
    // `env -u CLAUDECODE node edit.js behind`, run in her chat: the folders added mid-chat are still read, and the session's folder
    // still judged by its transcript.
    const w = openWorld();
    chatTranscript(w, [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }, { type: "attachment", attachment: { type: "environment", snapshot: { additionalWorkingDirectories: [`/${SECRET}`] } } }]);
    refusedFor(await behindOn(w, { env: { CLAUDE_CODE_SESSION_ID: SESSION } }), MID_CHAT_WHY, "no CLAUDECODE");
    goesOn(await behindOn(w, { env: { CLAUDE_CODE_SESSION_ID: SESSION }, ps: () => psText([[1, 0, "/sbin/launchd"], [300, 1, "/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal"], [320, 300, "-zsh"], [900, 320, `${NODE} ${w.checkout}/tool/edit.js behind`]]) }), "Jason's run, with no claude above");
    w.done();
  });
  it("under Claude Code with no chat's id, refuses for the transcript it cannot find, and judges the session's folder by where it runs", async () => {
    const UNREAD = "(Jason: this chat's transcript could not be read, so whether a folder was added to it is not known.)";
    const w = openWorld();
    // Her chat's transcript is there, but with no CLAUDE_CODE_SESSION_ID nothing says it is this chat's.
    const r = await behindOn(w, { env: { CLAUDECODE: "1" } });
    assert.deepEqual([r.code, r.text.split("\n")], [1, [LOCK_CHANGED, UNREAD]]);
    const inside = await behindOn(w, { env: { CLAUDECODE: "1" }, cwd: join(w.folder, "Pictures") });
    assert.deepEqual([inside.code, inside.text.split("\n")], [1, [LOCK_CHANGED, INSIDE_WHY, UNREAD]]);
    w.done();
  });
  it("refuses when the chat's transcript cannot be read, under Claude Code", async () => {
    const w = openWorld();
    rmSync(join(w.home, ".claude", "projects"), { recursive: true });
    const r = await behindOn(w, { env: UNDER });
    refusedFor(r, "(Jason: this chat's transcript could not be read, so whether a folder was added to it is not known.)", "no transcript");
    // And with no chat's id that is one, the transcript cannot be found at all.
    refusedFor(await behindOn(w, { env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "../x" } }), "(Jason: this chat's transcript could not be read, so whether a folder was added to it is not known.)", "no id");
    w.done();
  });
  it("refuses for a Claude Code older than the one the open lock was checked on, and for one whose version cannot be read while one is named", async () => {
    const w = openWorld();
    const copy = (version) => appCopy(w.home, version);
    const app = appCopy(w.home);
    for (const version of ["2.1.300", "2.1.30", "2.0.999", "1.9.400"]) {
      refusedFor(await behindOn(w, started(argsWith(w, app, copy(version)))), `(Jason: this chat runs Claude Code ${version}, older than the ${MINIMUM} her folder's open lock was checked on.)`, version);
    }
    for (const version of ["2.1.308", "2.1.310", "2.2.0", "3.0.0"]) goesOn(await behindOn(w, started(argsWith(w, app, copy(version)))), version);
    for (const exe of ["/opt/homebrew/bin/claude", join(w.home, ".local", "bin", "claude")]) {
      refusedFor(await behindOn(w, started(argsWith(w, app, exe))), `(Jason: this chat's Claude Code is not the Claude app's own copy, so its version could not be checked against the ${MINIMUM} her folder's open lock was checked on.)`, exe);
    }
    w.done();
  });
  it("reads a version only from the app's own copy in her home, by its real path, and never from a claude-code folder elsewhere", async () => {
    const NOT_APP = `(Jason: this chat's Claude Code is not the Claude app's own copy, so its version could not be checked against the ${MINIMUM} her folder's open lock was checked on.)`;
    const w = openWorld();
    const claudeCode = join(w.home, "Library", "Application Support", "Claude", "claude-code");
    const tail = ["a93ded4b1b47", "claude.app", "Contents", "MacOS", "claude"];
    const cases = {
      "the workshop": join(w.workshop, "claude-code", "9.9.9", ...tail),
      "the workshop, the copy's old shape": join(w.workshop, "claude-code", "9.9.9", "claude"),
      "another home": appCopy(join(w.dir, "someone else"), "9.9.9"),
      "her home, the copy's old shape": join(claudeCode, "9.9.9", "claude"),
      "a folder between": join(claudeCode, "9.9.9", "x", ...tail),
      "a name that is not 12 hex letters": join(claudeCode, "9.9.9", "A93DED4B1B47", ...tail.slice(1)),
      "a version that is not one": join(claudeCode, "latest", ...tail),
    };
    for (const [what, exe] of Object.entries(cases)) refusedFor(await behindOn(w, started(argsWith(w, appCopy(w.home), exe))), NOT_APP, what);
    w.done();
    // Her copy's path, through a link to the workshop on the way.
    const v = openWorld();
    mkdirSync(join(v.workshop, "Claude", "claude-code", "9.9.9", "a93ded4b1b47", "claude.app", "Contents", "MacOS"), { recursive: true });
    writeFileSync(join(v.workshop, "Claude", "claude-code", "9.9.9", "a93ded4b1b47", "claude.app", "Contents", "MacOS", "claude"), SECRET);
    mkdirSync(join(v.home, "Library", "Application Support"), { recursive: true });
    symlinkSync(join(v.workshop, "Claude"), join(v.home, "Library", "Application Support", "Claude"));
    refusedFor(await behindOn(v, started(argsWith(v, appCopy(v.home), appCopy(v.home, "9.9.9")))), NOT_APP, "a link on the way");
    v.done();
  });
  it("says nothing of the app's flags for Jason's own run, with no claude above it and not under Claude Code", async () => {
    const w = openWorld();
    const terminal = () => psText([[1, 0, "/sbin/launchd"], [300, 1, "/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal"], [320, 300, "-zsh"], [900, 320, `${NODE} ${w.checkout}/tool/edit.js behind`]]);
    goesOn(await behindOn(w, { ps: terminal, env: {} }), "Terminal");
    w.done();
  });
  it("refuses under Claude Code when no claude is found above, as for a Claude Code run as node …/cli.js", async () => {
    // env { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: <uuid> }; ps: node 900 ← zsh 800 ← "node /x/cli.js" 700 ← launchd 1
    const w = openWorld();
    chatTranscript(w, [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
    const cli = () => psText([[1, 0, "/sbin/launchd"], [700, 1, "node /x/cli.js --output-format stream-json"], [800, 700, "/bin/zsh -c x"], [900, 800, `${NODE} /x/tool/edit.js behind`]]);
    refusedFor(await behindOn(w, { ps: cli, env: UNDER }), "(Jason: the Claude Code above this check could not be found, so its flags and version are not known.)", "cli.js");
    w.done();
  });
  it("refuses when the processes cannot be read", async () => {
    const w = openWorld();
    refusedFor(await behindOn(w, { ps: () => null }), "(Jason: this chat's processes could not be read, so the Claude app's flags on it are not known.)", "no ps");
    w.done();
  });
  it("goes on for a chat whose commands run in a folder inside hers, judged by its transcript's folder", async () => {
    // openDeps(w, { cwd: join(w.folder, "Pictures"), env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: id } }) with the transcript at
    // <home>/.claude/projects/<claudeDirName(folder)>/<id>.jsonl → code 0; with it at …/<claudeDirName(folder + "/Pictures")>/<id>.jsonl → PR #40's line
    const w = openWorld();
    const pictures = join(w.folder, "Pictures");
    const path = chatTranscript(w, [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
    goesOn(await behindOn(w, { cwd: pictures, env: UNDER }), "her chat, in Pictures");
    rmSync(path);
    transcript(join(w.home, ".claude", "projects", claudeDirName(pictures)), [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
    refusedFor(await behindOn(w, { cwd: pictures, env: UNDER }), INSIDE_WHY, "a chat started in Pictures");
    // With $CLAUDE_CONFIG_DIR, the projects folder is there.
    const config = join(w.dir, "config");
    transcript(join(config, "projects", claudeDirName(w.folder)), [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
    writeFileSync(join(config, ".claude.json"), readFileSync(join(w.home, ".claude.json")));
    goesOn(await behindOn(w, { cwd: pictures, env: { ...UNDER, CLAUDE_CONFIG_DIR: config } }), "CLAUDE_CONFIG_DIR");
    // Jason's own run, not under Claude Code, keeps PR #40's look at the folder it runs in.
    refusedFor(await behindOn(w, { cwd: pictures }), INSIDE_WHY, "Jason's run in Pictures");
    w.done();
  });
  it("refuses a chat started in a folder whose name differs from hers only in its punctuation, though its transcript is kept in her projects folder", async () => {
    // Claude Code names a projects folder by the folder's path with every letter but A-Z, a-z and 0-9 made "-" (claudeDirName), so
    // ~/BRIMM-Video-Studio, ~/BRIMM_Video_Studio and ~/BRIMM Video/Studio keep their chats' transcripts beside hers, with no guard.
    const OTHER_WHY = "(Jason: this session runs in a folder other than her folder for Claude, and Claude Code reads the folder's lock only in the folder itself. Start her sessions on ~/BRIMM Video Studio itself.)";
    for (const name of ["BRIMM-Video-Studio", "BRIMM_Video_Studio", join("BRIMM Video", "Studio")]) {
      const w = openWorld();
      const other = join(w.home, name);
      mkdirSync(other, { recursive: true });
      assert.equal(claudeDirName(other), claudeDirName(w.folder), name);
      chatTranscript(w, [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
      refusedFor(await behindOn(w, { cwd: other, env: UNDER }), OTHER_WHY, name);
      w.done();
    }
  });
  it("says the folder is not trusted yet, from ~/.claude.json, and still goes on; a parent folder's trust counts", async () => {
    // r.code 0; r.text includes UNTRUSTED once, not LOCK_CHANGED
    assert.equal(UNTRUSTED, "Claude Code has not trusted this folder yet: open it once and choose to trust it.");
    for (const [what, text] of [["no trust", (w) => ({ projects: { [w.folder]: { hasTrustDialogAccepted: false } } })], ["another folder's", (w) => ({ projects: { [w.workshop]: { hasTrustDialogAccepted: true } } })], ["none at all", () => ({})], ["not JSON", () => "{half"]]) {
      const w = openWorld();
      const json = text(w);
      writeFileSync(join(w.home, ".claude.json"), typeof json === "string" ? json : JSON.stringify(json));
      const r = await behindOn(w);
      assert.equal(r.code, 0, what);
      assert.equal(r.text.split("\n").filter((line) => line === UNTRUSTED).length, 1, what);
      assert.ok(!r.text.includes(LOCK_CHANGED), what);
      assert.equal(r.g.calls.length, 2, what);
      w.done();
    }
    const w = openWorld();
    writeFileSync(join(w.home, ".claude.json"), JSON.stringify({ projects: { [w.home]: { hasTrustDialogAccepted: true } } }));
    goesOn(await behindOn(w), "the home folder trusted");
    // With $CLAUDE_CONFIG_DIR, Claude Code keeps its trust there, beside the chat's transcript.
    const config = join(w.dir, "config");
    transcript(join(config, "projects", claudeDirName(w.folder)), [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
    assert.ok((await behindOn(w, { env: { ...CHAT_ENV, CLAUDE_CONFIG_DIR: config } })).text.split("\n").includes(UNTRUSTED));
    w.done();
  });
  it("says the entries this Mac adds to her folder's allowlist, and says nothing of the default ones", async () => {
    const w = openWorld();
    goesOn(await behindOn(w), "the default ones");
    const tool = "mcp__4e8268a7-b354-4c23-ab7d-2076f0dc3000__opusclip_list_clips";
    writeSettings(w.home, { studioAllow: [{ type: "skill", name: "her-own" }, { type: "mcp-tool", name: tool }] });
    const r = await behindOn(w);
    assert.deepEqual([r.code, r.text], [0, `${NEWEST}\n(Jason: her folder also allows, on this Mac: skill her-own, mcp-tool ${tool}.)`]);
    w.done();
  });
  it("asks nothing of the processes, trust or the allowlist on a strict Mac", async () => {
    const w = openWorld();
    writeSettings(w.home, { lock: "strict", studioAllow: [{ type: "skill", name: "her-own" }] });
    writeStudio(w.home, { checkout: w.checkout, node: NODE });
    writeFileSync(join(w.home, ".claude.json"), "{}");
    const r = await behindOn(w, { ps: () => { throw new Error("ps was run"); }, env: UNDER });
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    w.done();
  });
});
