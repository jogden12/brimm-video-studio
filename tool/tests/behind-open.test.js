// `behind` on a Mac with the open lock (design 2026-10-26, section 6, "One check of the lock, made by both"; R17, R18): beside PR #40's
// reasons, every settings source's sandbox keys, Edit( and WebFetch(domain:…) rules, memory keys and added folders, and her folder's
// own settings checked whole. Each test is a made-up Mac (open-world.js) with git, ps and lsof stand-ins, so no real one runs, and
// SECRET in every value, which no line may hold.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, LOCK_CHANGED } from "../edit.js";
import { settingsFile, writeSettings } from "../settings.js";
import { writeStudio } from "../studio.js";
import { openWorld, openDeps, NODE } from "./open-world.js";

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
