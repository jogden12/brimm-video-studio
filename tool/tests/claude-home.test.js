// Under BRIMM_VIDEO_HOME, Claude Code's own files are still read from the real home. BRIMM_VIDEO_HOME moves Studio's own folders (its
// settings, work folder, runs, hand-offs) to a scratch home and leaves HOME real; Claude Code and the Claude app keep ~/.claude,
// ~/.claude.json and Application Support/Claude there, in the real home. Each test is a made-up Mac (open-world.js) whose Claude Code
// files are moved to a made-up real home, so the check finds them only if it looks in HOME. Nothing real is read or written.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { factsOf, readSettings, settingsMain } from "../settings.js";
import { gatedReadRules, writeStudio } from "../studio.js";
import { claudeDirName, gatedIndex, gatedPlaces, readAllowed, realOf } from "../places.js";
import { guardAnswer, openDecision } from "../open-lock.js";
import { addedWhy, agentsWhy, beyondWhy, skillFolders, transcriptOf, trustWhy } from "../loosened.js";
import { openWorld, openDeps, chatChain, APP_ARGS, CHAT_ENV, MINIMUM, SESSION, transcript } from "./open-world.js";

const NEWEST = "This Mac has the newest brimm-video.";
const SECRET = "SECRET-WORDS-OF-A-FILE";

/** The made-up Mac `openWorld` makes, with Claude Code's files (~/.claude, ~/.claude.json) moved to a real home of their own, and the
    environment BRIMM_VIDEO_HOME set to the world's home (the scratch one) with HOME the real one. */
function split() {
  const w = openWorld();
  const real = join(w.dir, "real home");
  mkdirSync(real, { recursive: true });
  renameSync(join(w.home, ".claude"), join(real, ".claude"));
  renameSync(join(w.home, ".claude.json"), join(real, ".claude.json"));
  const env = { ...CHAT_ENV, BRIMM_VIDEO_HOME: w.home, HOME: real };
  // Her folder written again for this Mac: its rules name Claude Code's files in the real home.
  const facts = { ...w.facts, claudeHome: real };
  writeStudio(w.home, { checkout: w.checkout, node: w.node, lock: "open", facts });
  return { ...w, real, env, facts };
}

/** `behind` on the split world `s`, its deps openDeps's with `more` over them, the Claude app's copy in the real home. */
async function behindOn(s, more = {}) {
  const calls = [];
  const run = async (cmd, args) => {
    calls.push(args);
    return calls.length === 1 ? { code: 0, stderr: "" } : { code: 0, stderr: "", stdout: "0\n" };
  };
  const said = [];
  const code = await editMain(["behind"], { ...openDeps(s, { env: s.env, ps: () => chatChain({ args: APP_ARGS(s.folder, s.real) }), ...more }), run, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}

describe("behind, under BRIMM_VIDEO_HOME", () => {
  it("finds the chat's transcript, her folder's trust and the app's copy of Claude Code in the real home, and goes on", async () => {
    const s = split();
    const r = await behindOn(s);
    assert.deepEqual([r.code, r.text], [0, NEWEST]);
    s.done();
  });
  it("still looks in Studio's home when BRIMM_VIDEO_HOME is not set (nothing moved)", async () => {
    const s = split();
    const r = await behindOn(s, { env: CHAT_ENV });
    assert.equal(r.code, 1, "the files are in the other home, so there is nothing to find here");
    s.done();
  });
  it("reads the user's settings from the real home's .claude/settings.json, and not from Studio's", async () => {
    const s = split();
    writeFileSync(join(s.real, ".claude", "settings.json"), JSON.stringify({ sandbox: { enabled: SECRET } }));
    const r = await behindOn(s);
    assert.equal(r.code, 1);
    assert.ok(r.text.split("\n").includes("(Jason: this Mac's ~/.claude/settings.json: sandbox.enabled, which can open her folder's lock. Its contents are not shown here.)"), r.text);
    // A loosening in the scratch home's own .claude, where Claude Code reads nothing, is not taken for the user's.
    const t = split();
    mkdirSync(join(t.home, ".claude"), { recursive: true });
    writeFileSync(join(t.home, ".claude", "settings.json"), JSON.stringify({ sandbox: { enabled: SECRET } }));
    const ok = await behindOn(t);
    assert.deepEqual([ok.code, ok.text], [0, NEWEST]);
    s.done();
    t.done();
  });
  it("looks for plugins, skills and agents in the real home's .claude", async () => {
    const s = split();
    const plugin = join(s.real, ".claude", "plugins", "cache", "market", "bad", "1.0.0");
    mkdirSync(join(plugin, "hooks"), { recursive: true });
    writeFileSync(join(plugin, "hooks", "hooks.json"), "{}");
    writeFileSync(join(s.real, ".claude", "settings.json"), JSON.stringify({ enabledPlugins: { "bad@market": true } }));
    const r = await behindOn(s);
    assert.ok(r.text.split("\n").includes("(Jason: the plugin bad@market carries hooks or a mod, which run outside the sandbox. Turn it off for her account.)"), r.text);
    const agents = join(s.real, ".claude", "agents");
    mkdirSync(agents, { recursive: true });
    writeFileSync(join(agents, "x.md"), "---\nname: x\nhooks: {}\n---\n");
    assert.deepEqual(agentsWhy({ home: s.home, folder: s.folder, env: s.env }).length, 1);
    assert.deepEqual(agentsWhy({ home: s.home, folder: s.folder, env: CHAT_ENV }), []);
    const skill = join(s.real, ".claude", "skills", "brimm-x");
    mkdirSync(skill, { recursive: true });
    assert.deepEqual(skillFolders({ home: s.real, folder: s.folder, name: "brimm-x" }), [skill]);
    s.done();
  });
  it("keeps the files that are Studio's in Studio's home: this Mac's settings are read there", async () => {
    const s = split();
    assert.equal(readSettings(s.home).settings.lock, "open");
    assert.equal(readSettings(s.real).settings, undefined);
    s.done();
  });
});

describe("the pieces of the lock check, under BRIMM_VIDEO_HOME", () => {
  it("transcriptOf looks in HOME/.claude/projects, or CLAUDE_CONFIG_DIR/projects as before, and trustWhy in HOME/.claude.json", () => {
    const s = split();
    const env = { BRIMM_VIDEO_HOME: s.home, HOME: s.real };
    assert.equal(transcriptOf({ home: s.home, env, folder: s.folder, sessionId: SESSION }), join(s.real, ".claude", "projects", claudeDirName(s.folder), `${SESSION}.jsonl`));
    assert.equal(transcriptOf({ home: s.home, env: { ...env, CLAUDE_CONFIG_DIR: "/config" }, folder: s.folder, sessionId: SESSION }), join("/config", "projects", claudeDirName(s.folder), `${SESSION}.jsonl`));
    assert.equal(transcriptOf({ home: s.home, env: { HOME: s.real }, folder: s.folder, sessionId: SESSION }), join(s.home, ".claude", "projects", claudeDirName(s.folder), `${SESSION}.jsonl`));
    assert.equal(trustWhy({ home: s.home, folder: s.folder, env }), "");
    assert.notEqual(trustWhy({ home: s.home, folder: s.folder, env: { HOME: s.real } }), "");
    s.done();
  });
  it("beyondWhy takes CLAUDE_CONFIG_DIR for ~/.claude when it is the real home's", () => {
    const s = split();
    const env = { BRIMM_VIDEO_HOME: s.home, HOME: s.real, CLAUDE_CONFIG_DIR: join(s.real, ".claude") };
    assert.deepEqual(beyondWhy({ env, home: s.home }), []);
    assert.equal(beyondWhy({ env: { ...env, CLAUDE_CONFIG_DIR: join(s.home, "elsewhere") }, home: s.home }).length, 1);
    s.done();
  });
  it("addedWhy takes the Claude app's notes folder in the real home for its own", () => {
    const s = split();
    const notes = join(s.real, "Library", "Application Support", "Claude", "side-session-notes", "local_00000000-0000-4000-8000-000000000000");
    mkdirSync(notes, { recursive: true });
    const path = transcript(join(s.real, ".claude", "projects", claudeDirName(s.folder)), [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }, { type: "system", subtype: "environment", additionalDirectories: [notes] }]);
    assert.deepEqual(addedWhy({ home: s.real, sessionId: SESSION, transcriptPath: path }), []);
    s.done();
  });
});

describe("the gated places, under BRIMM_VIDEO_HOME", () => {
  it("name the real home's .claude, .claude.json and Application Support/Claude, and Studio's own places in Studio's home", () => {
    const s = split();
    const settings = readSettings(s.home).settings;
    const facts = factsOf(s.home, settings, { tmp: s.tmp, uid: s.uid, env: s.env });
    const paths = gatedPlaces(facts).map((place) => place.path);
    const AS = (home) => join(home, "Library", "Application Support");
    for (const mine of [join(s.real, ".claude"), join(s.real, ".claude.json"), join(AS(s.real), "Claude")]) assert.ok(paths.includes(realOf(mine)), mine);
    for (const wrong of [join(s.home, ".claude"), join(s.home, ".claude.json"), join(AS(s.home), "Claude")]) assert.ok(!paths.includes(realOf(wrong)), wrong);
    for (const studios of [join(AS(s.home), "BRIMM Video"), join(AS(s.home), "BRIMM Video Words"), join(s.home, "BRIMM Video Work")]) assert.ok(paths.includes(realOf(studios)), studios);
    const rules = gatedReadRules(facts);
    assert.ok(rules.some((rule) => rule.includes(join(s.real, ".claude.json"))));
    assert.deepEqual(readAllowed({ ...facts, folder: s.folder }).slice(2), [join(realOf(join(s.real, ".claude")), "shell-snapshots"), join(realOf(join(AS(s.real), "Claude")), "claude-code")]);
    s.done();
  });
  it("are as they were when BRIMM_VIDEO_HOME is not set", () => {
    const w = openWorld();
    const settings = readSettings(w.home).settings;
    const plain = factsOf(w.home, settings, { tmp: w.tmp, uid: w.uid, env: { HOME: w.home } });
    assert.deepEqual(gatedPlaces(plain), gatedPlaces(w.facts));
    assert.deepEqual(gatedPlaces(factsOf(w.home, settings, { tmp: w.tmp, uid: w.uid })), gatedPlaces(w.facts));
    w.done();
  });
});

describe("the open guard, under BRIMM_VIDEO_HOME", () => {
  const read = (s, path) => openDecision({ session_id: SESSION, transcript_path: join(s.real, ".claude", "projects", "x", `${SESSION}.jsonl`), cwd: s.folder, hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: path } },
    { checkout: s.checkout, node: s.node, folder: s.folder, home: s.home, claudeHome: s.real, uid: s.uid, tmp: s.tmp, index: gatedIndex(gatedPlaces({ ...s.facts, claudeHome: s.real }), []), allow: s.facts.allow, web: "held", resolve: async () => [], loosened: false, held: false });
  it("refuses the real home's .claude and ~/.claude.json, by a path or by a tilde", async () => {
    const s = split();
    for (const path of [join(s.real, ".claude", "settings.json"), join(s.real, ".claude.json"), "~/.claude.json", "~/.claude/settings.json"]) assert.equal((await read(s, path)).decision, "deny", path);
    s.done();
  });
  it("answers from the real home's transcript and plugins: guardAnswer goes through for her chat", async () => {
    const s = split();
    const path = transcript(join(s.real, ".claude", "projects", claudeDirName(s.folder)), [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
    const answer = await guardAnswer({ session_id: SESSION, transcript_path: path, cwd: s.folder, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "date" } },
      { checkout: s.checkout, node: s.node, folder: s.folder, deps: openDeps(s, { env: s.env, ps: () => chatChain({ args: APP_ARGS(s.folder, s.real) }) }) });
    assert.notEqual(answer.decision, "deny", answer.reason);
    s.done();
  });
});

describe("settings.js user-deny, under BRIMM_VIDEO_HOME", () => {
  it("adds the deny rules to the real home's .claude/settings.json, and notes them in Studio's settings", () => {
    const s = split();
    const said = [];
    const code = settingsMain(["user-deny"], { home: s.home, env: s.env, say: (line) => said.push(line), openMinimum: MINIMUM, tmp: s.tmp, uid: s.uid });
    assert.equal(code, 0, said.join("\n"));
    const written = JSON.parse(readFileSync(join(s.real, ".claude", "settings.json"), "utf8"));
    assert.ok(written.permissions.deny.length > 0);
    assert.equal(readSettings(s.home).settings.userDeny, true);
    assert.throws(() => readFileSync(join(s.home, ".claude", "settings.json")));
    s.done();
  });
});
