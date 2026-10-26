// The open guard (open-lock.js; design 2026-10-26, section 6, "The guard's decision, in order"): what her chat may do under the open
// lock, step by step. Every test is on a made-up open-lock Mac (open-world.js) with a stand-in for the look-up of names, so that no
// test asks this Mac's resolver, reads its settings or runs `ps`.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { GATED_REFUSED, NEVER_REFUSED, NOT_NAMED, RUN_ALONE, WEB_HELD, WRITE_REFUSED, openDecision } from "../open-lock.js";
import { DRAWING, neverCaught } from "../never.js";
import { LOCAL_ADDRESS } from "../fetchable.js";
import { claudeDirName, gatedIndex, gatedPlaces, realOf } from "../places.js";
import { SESSION, openWorld } from "./open-world.js";
import { ALLOWED, CHECKOUT, EDIT, NODE } from "./guard-cases.js";

const CONNECTOR = "mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__";

/** A look-up from a table: a name in it answers its addresses, any other is not found. */
const resolver = (table) => async (host) => {
  if (Object.hasOwn(table, host)) return table[host];
  throw Object.assign(new Error(`${host} not found`), { code: "ENOTFOUND" });
};
const PUBLIC = resolver({ "example.com": ["93.184.215.14"], "www.example.com": ["93.184.215.14"], "private.example.com": ["10.0.0.5"] });

describe("the open guard, I: what is never, named or left to Claude Code", () => {
  let w;
  let ctx;
  before(() => {
    w = openWorld();
    ctx = { checkout: w.checkout, node: w.node, folder: w.folder, home: w.home, uid: w.uid, tmp: w.tmp, index: gatedIndex(gatedPlaces(w.facts), [join(realOf(w.root), "Assets")]), allow: w.facts.allow, web: "held", resolve: PUBLIC, loosened: false, held: false };
  });
  after(() => w.done());
  /** What the open guard answers to `name` with `input`, in a chat of her folder, `more` changing the context. */
  const decide = (name, input, more = {}) => openDecision({ session_id: SESSION, transcript_path: join(w.home, ".claude", "projects", "x", `${SESSION}.jsonl`), cwd: w.folder, hook_event_name: "PreToolUse", tool_name: name, tool_input: input }, { ...ctx, ...more });

  it("refuses every never entry, fed the Code tab's real tool list", async () => {
    const { tools } = JSON.parse(readFileSync(new URL("./fixtures/code-tab-tools.json", import.meta.url), "utf8"));
    const never = tools.filter((n) => neverCaught(n));
    assert.ok(never.length > 50);
    for (const name of never) assert.deepEqual(await decide(name, {}), { decision: "deny", reason: NEVER_REFUSED }, name);
    assert.deepEqual(await decide("Bash", { command: "date", dangerouslyDisableSandbox: true }), { decision: "deny", reason: NEVER_REFUSED });
    assert.deepEqual(await decide("Agent", { prompt: "x", isolation: "worktree" }), { decision: "deny", reason: NEVER_REFUSED });
  });
  it("leaves the card, the task list and ToolSearch to Claude Code; the subagent tool named Task is not among them", async () => {
    for (const name of ["AskUserQuestion", "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch"]) assert.deepEqual(await decide(name, {}), { decision: "pass", reason: "" }, name);
    assert.equal((await decide("Task", { prompt: "x" })).decision, "allow");
  });
  it("refuses Monitor and a tool it does not know", async () => {
    assert.deepEqual(await decide("Monitor", { command: "tail -f x" }), { decision: "deny", reason: NEVER_REFUSED });
    for (const name of ["SomeToolAddedLater", "CronCreate", "Workflow", "NotebookRead", undefined]) assert.equal((await decide(name, {})).decision, "deny", String(name));
    assert.deepEqual(await decide("SomeToolAddedLater", {}), { decision: "deny", reason: NOT_NAMED });
  });
  it("allows a named skill and refuses another", async () => {
    for (const skill of ["brimm-edit", "frontend-design", "theme-factory", "brimm-graphics"]) assert.equal((await decide("Skill", { skill })).decision, "allow", skill);
    for (const skill of ["canva-creator", "superpowers:brainstorming", "", undefined]) assert.deepEqual(await decide("Skill", { skill }), { decision: "deny", reason: NOT_NAMED }, String(skill));
    assert.equal((await decide("Skill", { skill: "canva-creator" }, { allow: [...ctx.allow, { type: "skill", name: "canva-creator" }] })).decision, "allow");
  });
  it("allows a connector's tool only when this Mac names it exactly, and never a local extension's or a posting one", async () => {
    const allow = [...ctx.allow, { type: "mcp-tool", name: `${CONNECTOR}list_designs` }, { type: "mcp-tool", name: "mcp__PDF_Tools__read_pdf_content" }, { type: "mcp-tool", name: `${CONNECTOR}send_invoice` }, { type: "skill", name: `${CONNECTOR}list_other` }];
    assert.deepEqual(await decide(`${CONNECTOR}list_designs`, {}, { allow }), { decision: "allow", reason: "a connector's tool this Mac allows" });
    assert.deepEqual(await decide(`${CONNECTOR}list_other`, {}, { allow }), { decision: "deny", reason: NOT_NAMED });
    assert.deepEqual(await decide(`${CONNECTOR}list_designs`, {}), { decision: "deny", reason: NOT_NAMED });
    assert.deepEqual(await decide("mcp__PDF_Tools__read_pdf_content", {}, { allow }), { decision: "deny", reason: NEVER_REFUSED });
    assert.deepEqual(await decide(`${CONNECTOR}send_invoice`, {}, { allow }), { decision: "deny", reason: NEVER_REFUSED });
  });
  it("allows the subagent tool as Agent and as Task with no isolation, no cwd and a built-in agent, and refuses it otherwise", async () => {
    for (const name of ["Agent", "Task"]) {
      for (const input of [{ prompt: "x" }, { prompt: "x", subagent_type: "general-purpose" }, { prompt: "x", subagent_type: "Explore" }, { prompt: "x", subagent_type: "Plan" }]) assert.equal((await decide(name, input)).decision, "allow", `${name} ${JSON.stringify(input)}`);
      for (const input of [{ prompt: "x", isolation: "remote" }, { prompt: "x", cwd: "/tmp" }, { prompt: "x", subagent_type: "code-review:reviewer" }]) assert.deepEqual(await decide(name, input), { decision: "deny", reason: NEVER_REFUSED }, `${name} ${JSON.stringify(input)}`);
    }
  });
  it("refuses WebFetch and WebSearch while the web tools are held", async () => {
    assert.deepEqual(await decide("WebFetch", { url: "https://example.com/", prompt: "x" }), { decision: "deny", reason: WEB_HELD });
    assert.deepEqual(await decide("WebSearch", { query: "x" }), { decision: "deny", reason: WEB_HELD });
  });
  it("allows WebSearch and a public WebFetch once the web tools are opened, and refuses a numeric or local one", async () => {
    const open = { web: "open" };
    assert.equal((await decide("WebSearch", { query: "x" }, open)).decision, "allow");
    assert.equal((await decide("WebFetch", { url: "https://example.com/a", prompt: "x" }, open)).decision, "allow");
    for (const url of ["http://127.0.0.1:47321/", "http://192.168.1.1/", "http://localhost/", "http://router/", "https://private.example.com/"]) assert.deepEqual(await decide("WebFetch", { url, prompt: "x" }, open), { decision: "deny", reason: LOCAL_ADDRESS }, url);
    assert.equal((await decide("WebFetch", { url: "https://unknown.example.org/", prompt: "x" }, open)).decision, "deny");
    assert.equal((await decide("WebFetch", { prompt: "x" }, open)).decision, "deny");
  });
  it("allows the drawing tools and PushNotification by the default allowlist, the drawing tools though they are MCP tools no mcp-tool entry names", async () => {
    for (const name of DRAWING) assert.deepEqual((await decide(name, {})).decision, "allow", name);
    assert.equal((await decide("PushNotification", { message: "x" })).decision, "allow");
    assert.deepEqual(await decide("mcp__visualize__show_widget", {}, { allow: [] }), { decision: "deny", reason: NOT_NAMED });
  });
  it("lets no per-Mac tool entry speak for a tool with a rule of its own: the web tools, the card and the subagent tool", async () => {
    const allow = [...ctx.allow, ...["WebFetch", "WebSearch", "AskUserQuestion", "Agent"].map((name) => ({ type: "tool", name }))];
    assert.deepEqual(await decide("WebFetch", { url: "https://example.com/", prompt: "x" }, { allow }), { decision: "deny", reason: WEB_HELD });
    assert.deepEqual(await decide("WebSearch", { query: "x" }, { allow }), { decision: "deny", reason: WEB_HELD });
    assert.deepEqual(await decide("AskUserQuestion", { questions: [] }, { allow }), { decision: "pass", reason: "" });
    assert.deepEqual(await decide("Agent", { prompt: "x", isolation: "remote" }, { allow }), { decision: "deny", reason: NEVER_REFUSED });
  });
  it("allows the Cron tools and Workflow only when this Mac names them", async () => {
    const allow = [...ctx.allow, { type: "tool", name: "CronCreate" }];
    assert.equal((await decide("CronCreate", {}, { allow })).decision, "allow");
    assert.deepEqual(await decide("CronDelete", {}, { allow }), { decision: "deny", reason: NOT_NAMED });
  });
});

describe("the open guard, II: paths and writes", () => {
  const notAMac = process.platform !== "darwin" && "/System/Volumes/Data and letter case are a Mac's";
  const OTHER = "22222222-3333-4444-8555-666666666666";
  let w;
  let ctx;
  let p;
  before(() => {
    w = openWorld();
    const AS = join(w.home, "Library", "Application Support");
    const dir = claudeDirName(w.folder);
    p = {
      episode: join(w.root, "Episodes", "x", "t.txt"),
      transcript: join(w.home, ".claude", "projects", dir, `${SESSION}.jsonl`),
      ownResults: join(w.home, ".claude", "projects", dir, SESSION, "tool-results", "r.txt"),
      otherResults: join(w.home, ".claude", "projects", dir, OTHER, "tool-results", "r.txt"),
      ownTasks: join(w.tmp, `claude-${w.uid}`, dir, SESSION, "tasks", "a.output"),
      otherTasks: join(w.tmp, `claude-${w.uid}`, dir, OTHER, "tasks", "a.output"),
      ownWords: join(AS, "BRIMM Video Words", SESSION, "x.txt"),
      otherWords: join(AS, "BRIMM Video Words", OTHER, "x.txt"),
      allowedSkill: join(w.home, ".claude", "skills", "theme-factory", "SKILL.md"),
      otherSkill: join(w.home, ".claude", "skills", "canva-creator", "SKILL.md"),
      notes: join(w.home, "Documents", "notes.txt"),
      logo: join(w.root, "Assets", "logo.png"),
      code: join(w.checkout, "tool", "edit.js"),
      zshrc: join(w.home, ".zshrc"),
    };
    for (const file of Object.values(p)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "x");
    }
    mkdirSync(join(w.root, "Drop", "Mac Studio"), { recursive: true });
    symlinkSync(join(w.root, "Episodes"), join(w.home, "Documents", "eps"));
    symlinkSync(p.notes, join(w.root, "Episodes", "out"));
    symlinkSync(p.transcript, join(w.workshop, "t"));
    symlinkSync(p.otherWords, join(w.workshop, "o"));
    symlinkSync(p.zshrc, join(w.workshop, "z"));
    symlinkSync(join(w.home, ".zshenv"), join(w.workshop, "zz"));
    symlinkSync(join(w.root, "Drop", "Mac Studio"), join(w.workshop, "d"));
    symlinkSync(w.folder, join(w.workshop, "h"));
    mkdirSync(join(w.workshop, "sub"));
    ctx = { checkout: w.checkout, node: w.node, folder: w.folder, home: w.home, uid: w.uid, tmp: w.tmp, index: gatedIndex(gatedPlaces(w.facts), [join(realOf(w.root), "Assets")]), allow: w.facts.allow, web: "held", resolve: PUBLIC, loosened: false, held: false };
  });
  after(() => w.done());
  const decide = (name, input, more = {}) => openDecision({ session_id: SESSION, transcript_path: p.transcript, cwd: w.folder, hook_event_name: "PreToolUse", tool_name: name, tool_input: input, ...more }, ctx);
  const read = (file_path, more) => decide("Read", { file_path }, more);
  const send = (file) => decide("SendUserFile", { files: [file], status: "normal" });
  const write = (file_path) => decide("Write", { file_path, content: "x" });
  const edit = (file_path) => decide("Edit", { file_path, old_string: "a", new_string: "b" });
  const GATED = { decision: "deny", reason: GATED_REFUSED };
  const NO_WRITE = { decision: "deny", reason: WRITE_REFUSED };

  it("refuses every gated place for Read, Write, Edit and SendUserFile: by .., by a link into it and out of it, and by a path in a field it did not know of", async () => {
    for (const path of [p.episode, `${w.root}/Assets/../Episodes/x/t.txt`, join(w.home, "Documents", "eps", "x", "t.txt"), join(w.root, "Episodes", "out"), "~/.ssh/id_ed25519", p.transcript, p.otherWords]) {
      assert.deepEqual(await read(path), GATED, `Read ${path}`);
      assert.deepEqual(await send(path), GATED, `SendUserFile ${path}`);
      assert.equal((await write(path)).decision, "deny", `Write ${path}`);
      assert.equal((await edit(path)).decision, "deny", `Edit ${path}`);
    }
    assert.deepEqual(await decide("Read", { file_path: p.notes, extra: { deep: [p.episode] } }), GATED);
    assert.deepEqual(await decide("Write", { file_path: join(w.workshop, "ok.txt"), content: "x", also: [p.episode] }), GATED);
    assert.deepEqual(await decide("mcp__visualize__show_widget", { widget_code: "x", file: p.episode }), GATED);
    assert.deepEqual(await read(p.notes, { cwd: join(w.root, "Episodes") }), { decision: "allow", reason: "outside the gated places" });
    assert.deepEqual(await read("x/t.txt", { cwd: join(w.root, "Episodes") }), GATED);
  });
  it("takes no path from what Write writes or what Edit changes", async () => {
    assert.equal((await decide("Write", { file_path: join(w.workshop, "ok.txt"), content: `${p.episode}\n~/.ssh/id_ed25519\n../Episodes` })).decision, "allow");
    assert.equal((await decide("Edit", { file_path: join(w.workshop, "ok.txt"), old_string: p.episode, new_string: "~/.ssh/config" })).decision, "allow");
  });
  it("refuses them by /System/Volumes/Data and by changed letter case", { skip: notAMac }, async () => {
    for (const path of [`/System/Volumes/Data${p.episode}`, p.episode.replace("Episodes", "EPISODES"), join(w.home, ".SSH", "config"), `/System/Volumes/Data${p.otherWords}`]) {
      assert.deepEqual(await read(path), GATED, path);
      assert.deepEqual(await send(path), GATED, path);
    }
  });
  it("allows Read anywhere else: her documents, Assets, the checkout's code", async () => {
    for (const path of [p.notes, p.logo, p.code, join(w.folder, "CLAUDE.md"), "~/Documents/notes.txt"]) assert.equal((await read(path)).decision, "allow", path);
    assert.equal((await send(p.logo)).decision, "allow");
  });
  it("allows Read of the chat's own tool-results, tasks and words folders and the named skills' folders, and refuses another chat's", async () => {
    for (const path of [p.ownResults, p.ownTasks, p.ownWords, p.allowedSkill]) assert.equal((await read(path)).decision, "allow", path);
    for (const path of [p.otherResults, p.otherTasks, p.otherWords, p.otherSkill, p.transcript]) assert.deepEqual(await read(path), GATED, path);
    for (const path of [p.ownResults, p.ownTasks, p.ownWords]) assert.deepEqual(await send(path), GATED, `SendUserFile ${path}`);
    assert.deepEqual(await read(p.ownWords, { session_id: "../x" }), GATED);
    assert.deepEqual(await read(p.ownResults, { session_id: undefined }), GATED);
  });
  it("refuses a link in the workshop to a gated file for Read and SendUserFile, and any link for Write and Edit", async () => {
    for (const name of ["t", "o"]) {
      assert.deepEqual(await read(join(w.workshop, name)), GATED, name);
      assert.deepEqual(await send(join(w.workshop, name)), GATED, name);
    }
    for (const path of [join(w.workshop, "z"), join(w.workshop, "zz"), join(w.workshop, "d", "x.mov"), join(w.workshop, "t")]) {
      assert.deepEqual(await write(path), NO_WRITE, `Write ${path}`);
      assert.deepEqual(await edit(path), NO_WRITE, `Edit ${path}`);
    }
  });
  it("allows Write and Edit only inside the workshop, and never a CLAUDE.md, CLAUDE.local.md, .mcp.json or anything in a .claude folder there", async () => {
    for (const path of [join(w.workshop, "a.txt"), join(w.workshop, "sub", "b.html"), join(w.workshop, "new", "c.css"), "~/BRIMM Video Workshop/d.txt"]) {
      assert.equal((await write(path)).decision, "allow", path);
      assert.equal((await edit(path)).decision, "allow", path);
    }
    for (const path of [join(w.workshop, "CLAUDE.md"), join(w.workshop, "sub", "claude.MD"), join(w.workshop, "CLAUDE.local.md"), join(w.workshop, ".mcp.json"), join(w.workshop, ".claude", "settings.json"), join(w.workshop, "sub", ".Claude", "x"), w.workshop, p.notes, join(w.folder, "x.txt"), join(w.home, "BRIMM Video Workshop2", "x"), `${w.workshop}/../BRIMM Video Studio/x`, join(w.dir, "elsewhere.txt")]) {
      assert.deepEqual(await write(path), NO_WRITE, path);
      assert.deepEqual(await edit(path), NO_WRITE, path);
    }
    assert.deepEqual(await decide("Write", { content: "x" }), NO_WRITE);
  });
  it("refuses a write through a link from the workshop into her folder", async () => {
    assert.deepEqual(await write(join(w.workshop, "h", "CLAUDE.md")), NO_WRITE);
    assert.deepEqual(await write(join(w.workshop, "h", "notes.txt")), NO_WRITE);
  });
  it("refuses, for a later Claude Code, a Glob or Grep whose folder is in a gated place or holds one, a Glob's absolute or ~/ pattern with no path among them", async () => {
    for (const [name, input] of [["Glob", { pattern: "**/*.txt", path: join(w.root, "Episodes") }], ["Grep", { pattern: "x", path: w.home }], ["Grep", { pattern: "x", path: dirname(w.root) }], ["Glob", { pattern: `${w.root}/Ep*/**` }], ["Glob", { pattern: "~/Lib*/**" }], ["Glob", { pattern: "../**/*.txt" }]]) {
      assert.deepEqual(await decide(name, input), GATED, `${name} ${JSON.stringify(input)}`);
    }
    for (const [name, input] of [["Glob", { pattern: "**/*.md" }], ["Grep", { pattern: "x", path: join(w.home, "Pictures") }], ["Grep", { pattern: "x" }], ["Glob", { pattern: "*.png", path: join(w.root, "Assets") }]]) {
      assert.equal((await decide(name, input)).decision, "allow", `${name} ${JSON.stringify(input)}`);
    }
  });
});

describe("the open guard, III: Bash", () => {
  let w;
  let ctx;
  before(() => {
    w = openWorld();
    for (const dir of [join(w.root, "Episodes", "x"), join(w.root, "Drop", "Mac Studio"), join(w.home, ".ssh"), join(w.home, ".claude", "projects"), join(w.home, "Documents")]) mkdirSync(dir, { recursive: true });
    ctx = { checkout: CHECKOUT, node: NODE, folder: w.folder, home: w.home, uid: w.uid, tmp: w.tmp, index: gatedIndex(gatedPlaces(w.facts), [join(realOf(w.root), "Assets")]), allow: w.facts.allow, web: "held", resolve: PUBLIC, loosened: false, held: false };
  });
  after(() => w.done());
  const bash = (command, more = {}) => openDecision({ session_id: SESSION, transcript_path: join(w.home, ".claude", "projects", "x", `${SESSION}.jsonl`), cwd: w.folder, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command, description: "x", ...more } }, ctx);
  const ALONE = { decision: "deny", reason: RUN_ALONE };

  it("allows edit.js in its one spelling, and every form it allows is one the excluded entry takes", async () => {
    for (const [command] of ALLOWED.filter(([c]) => !c.startsWith("node "))) {
      assert.equal((await bash(command)).decision, "allow", command);
      assert.ok(command.startsWith(`${NODE} "${CHECKOUT}/tool/edit.js" `), command);
    }
    assert.equal(RUN_ALONE, "Run brimm-video's commands on their own, exactly as her skill says, and not in the background.");
  });
  it("refuses edit.js with bare node, &&, ;, |, $(…), an environment prefix, cd … &&, another node or another path", async () => {
    for (const command of [`node "${CHECKOUT}/tool/edit.js" episodes`, `${EDIT} episodes && date`, `${EDIT} episodes; date`, `${EDIT} episodes | cat`, `${EDIT} $(date)`, `${EDIT} "$(date)"`, `A=1 ${EDIT} episodes`, `cd /tmp && ${EDIT} episodes`, `/usr/local/bin/node "${CHECKOUT}/tool/edit.js" episodes`, `${NODE} "/tmp/tool/edit.js" episodes`, `${NODE} '${CHECKOUT}/tool/edit.js' episodes`, `${EDIT}  episodes`, `${EDIT} episodes\ndate`, ` ${EDIT} episodes`]) {
      assert.deepEqual(await bash(command), ALONE, command);
    }
  });
  it("refuses edit.js with nice, env -u SANDBOX_RUNTIME, env, timeout, nohup, time, stdbuf, xargs, sudo, command or exec in front of it", async () => {
    for (const before of ["nice", "env -u SANDBOX_RUNTIME", "env", "timeout 60", "nohup", "time", "stdbuf -o0", "xargs", "sudo", "command", "exec", "A=1"]) assert.deepEqual(await bash(`${before} ${EDIT} episodes`), ALONE, before);
  });
  it("refuses edit.js in the background, but for guide's tell", async () => {
    assert.deepEqual(await bash(`${EDIT} episodes`, { run_in_background: true }), ALONE);
    assert.equal((await bash(`${EDIT} guide "Pricing talk" tell`, { run_in_background: true })).decision, "allow");
    assert.equal((await bash(`${EDIT} guide Talk tell`, { run_in_background: true })).decision, "allow");
    for (const command of [`${EDIT} guide "Pricing talk" tell --now`, `${EDIT} guide "Pricing talk"`, `${EDIT} guide tell`, `${EDIT} finish "Pricing talk"`]) assert.deepEqual(await bash(command, { run_in_background: true }), ALONE, command);
    assert.equal((await bash(`${EDIT} episodes`, { run_in_background: false })).decision, "allow");
  });
  it("refuses edit.js with no words after it", async () => {
    assert.deepEqual(await bash(EDIT), ALONE);
    assert.deepEqual(await bash(`${EDIT} `), ALONE);
  });
  it("refuses any other command that names edit.js or the checkout's tool folder", async () => {
    for (const command of [`cat "${CHECKOUT}/tool/studio.js"`, `ls "${CHECKOUT}/tool"`, "python3 edit.js", `cd "${CHECKOUT}" && node tool/EDIT.JS episodes`, `cat "/System/Volumes/Data${CHECKOUT}/tool/never.js"`]) assert.deepEqual(await bash(command), ALONE, command);
  });
  it("refuses, as a courtesy, cat, grep -r, rg and find naming a gated place", async () => {
    for (const command of [`cat "${join(w.root, "Episodes", "x", "t.txt")}"`, "grep -r secret ~/.ssh", `rg talk '${join(w.root, "Drop")}'`, "find ~/.claude -name '*.jsonl'", `ls ${join(w.root, "Episodes").replaceAll(" ", "\\ ")}`]) {
      assert.deepEqual(await bash(command), { decision: "deny", reason: GATED_REFUSED }, command);
    }
  });
  it("allows any other command, which runs in the sandbox", async () => {
    for (const c of ["date", "ls ~/Documents", "python3 -c 'print(1)'", "rg TODO ~/Documents", `cat "${join(w.root, "Assets", "logo.png")}"`, "cd Pictures"]) assert.equal((await bash(c)).decision, "allow", c);
  });
});
