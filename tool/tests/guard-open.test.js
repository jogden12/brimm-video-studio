// The open guard (open-lock.js; design 2026-10-26, section 6, "The guard's decision, in order"): what her chat may do under the open
// lock, step by step. Every test is on a made-up open-lock Mac (open-world.js) with a stand-in for the look-up of names, so that no
// test asks this Mac's resolver, reads its settings or runs `ps`.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { GATED_REFUSED, NEVER_REFUSED, NOT_NAMED, RUN_ALONE, WEB_HELD, WORKSHOP_FILES_REFUSED, WRITE_REFUSED, guardAnswer, openDecision } from "../open-lock.js";
import { LOCK_CHANGED } from "../loosened.js";
import { HELD_NARROWED, HELD_REFUSED, clearStrictSeen, markChat, noteStrictSeen, untiedMark } from "../held.js";
import { processTable } from "../chain.js";
import { settingsFile, settingsMain, writeSettings } from "../settings.js";
import { heldFolder } from "../scan.js";
import { DRAWING, neverCaught } from "../never.js";
import { LOCAL_ADDRESS, NUMERIC_ADDRESS } from "../fetchable.js";
import { claudeDirName, gatedIndex, gatedPlaces, realOf } from "../places.js";
import { APP_ARGS, MINIMUM, SESSION, appCopy, chatChain, openDeps, openWorld, psText, transcript } from "./open-world.js";
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
  it("lets a subagent hand its report back", async () => {
    assert.equal((await decide("SubagentHandback", { report: "done" })).decision, "allow");
  });
  it("refuses Monitor and Workflow as never done, and a tool it does not know", async () => {
    assert.deepEqual(await decide("Monitor", { command: "tail -f x" }), { decision: "deny", reason: NEVER_REFUSED });
    assert.deepEqual(await decide("Workflow", {}), { decision: "deny", reason: NEVER_REFUSED });
    for (const name of ["SomeToolAddedLater", "CronCreate", "NotebookRead", undefined]) assert.equal((await decide(name, {})).decision, "deny", String(name));
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
  it("allows WebSearch and a public WebFetch once the web tools are opened, and refuses a numeric or local one, a public number in words of its own", async () => {
    const open = { web: "open" };
    assert.equal((await decide("WebSearch", { query: "x" }, open)).decision, "allow");
    assert.equal((await decide("WebFetch", { url: "https://example.com/a", prompt: "x" }, open)).decision, "allow");
    for (const url of ["http://127.0.0.1:47321/", "http://192.168.1.1/", "http://localhost/", "http://router/", "https://private.example.com/"]) assert.deepEqual(await decide("WebFetch", { url, prompt: "x" }, open), { decision: "deny", reason: LOCAL_ADDRESS }, url);
    for (const url of ["http://93.184.215.14/", "http://1572394766/", "https://[2606:2800:21f:cb07:6820:80da:af6b:8b2c]/"]) assert.deepEqual(await decide("WebFetch", { url, prompt: "x" }, open), { decision: "deny", reason: NUMERIC_ADDRESS }, url);
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
  it("allows the Cron tools only when this Mac names them, and Workflow never, even where a Mac names it", async () => {
    const allow = [...ctx.allow, { type: "tool", name: "CronCreate" }, { type: "tool", name: "Workflow" }];
    assert.equal((await decide("CronCreate", {}, { allow })).decision, "allow");
    assert.deepEqual(await decide("CronDelete", {}, { allow }), { decision: "deny", reason: NOT_NAMED });
    assert.deepEqual(await decide("Workflow", { script: "x" }, { allow }), { decision: "deny", reason: NEVER_REFUSED });
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
    mkdirSync(join(w.workshop, "sub", "deep"), { recursive: true });
    writeFileSync(join(w.workshop, "a.txt"), "x");
    writeFileSync(join(w.workshop, "sub", "deep", "f.txt"), "x");
    // A link in the workshop to a file outside it, and links outside it that lead in, to the workshop, to a file in it and to a
    // path in it that is not there yet.
    symlinkSync(p.notes, join(w.workshop, "out"));
    symlinkSync(w.workshop, join(w.home, "Documents", "shop"));
    symlinkSync(join(w.workshop, "a.txt"), join(w.home, "Documents", "shop-file"));
    symlinkSync(join(w.workshop, "later", "new.txt"), join(w.home, "Documents", "shop-later"));
    ctx = { checkout: w.checkout, node: w.node, folder: w.folder, home: w.home, uid: w.uid, tmp: w.tmp, index: gatedIndex(gatedPlaces(w.facts), [join(realOf(w.root), "Assets")]), allow: w.facts.allow, web: "held", resolve: PUBLIC, loosened: false, held: false };
  });
  after(() => w.done());
  const decide = (name, input, more = {}, context = ctx) => openDecision({ session_id: SESSION, transcript_path: p.transcript, cwd: w.folder, hook_event_name: "PreToolUse", tool_name: name, tool_input: input, ...more }, context);
  const read = (file_path, more) => decide("Read", { file_path }, more);
  const send = (file) => decide("SendUserFile", { files: [file], status: "normal" });
  const write = (file_path) => decide("Write", { file_path, content: "x" });
  const edit = (file_path) => decide("Edit", { file_path, old_string: "a", new_string: "b" });
  const GATED = { decision: "deny", reason: GATED_REFUSED };
  const NO_WRITE = { decision: "deny", reason: WRITE_REFUSED };
  const IN_WORKSHOP = { decision: "deny", reason: WORKSHOP_FILES_REFUSED };

  it("refuses every gated place for Read, Write, Edit and SendUserFile: by .., by a link into it and out of it, and by a path in a field it did not know of", async () => {
    for (const path of [p.episode, `${w.root}/Assets/../Episodes/x/t.txt`, join(w.home, "Documents", "eps", "x", "t.txt"), join(w.root, "Episodes", "out"), "~/.ssh/id_ed25519", p.transcript, p.otherWords]) {
      assert.deepEqual(await read(path), GATED, `Read ${path}`);
      assert.deepEqual(await send(path), GATED, `SendUserFile ${path}`);
      assert.equal((await write(path)).decision, "deny", `Write ${path}`);
      assert.equal((await edit(path)).decision, "deny", `Edit ${path}`);
    }
    assert.deepEqual(await decide("Read", { file_path: p.notes, extra: { deep: [p.episode] } }), GATED);
    assert.deepEqual(await decide("mcp__visualize__show_widget", { widget_code: "x", file: p.episode }), GATED);
    assert.deepEqual(await read(p.notes, { cwd: join(w.root, "Episodes") }), { decision: "allow", reason: "outside the gated places and the workshop" });
    assert.deepEqual(await read("x/t.txt", { cwd: join(w.root, "Episodes") }), GATED);
  });
  it("finds a path with white space around it, as Claude Code's tools take it", async () => {
    for (const path of [` ${p.otherWords}`, `\t${p.transcript}`, `\n${p.episode}`, `${p.otherWords} `]) {
      assert.deepEqual(await send(path), GATED, JSON.stringify(path));
      assert.deepEqual(await read(path), GATED, JSON.stringify(path));
    }
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
  it("allows Read of the chat's own tool-results and words folders and the named skills' folders, and refuses another chat's", async () => {
    for (const path of [p.ownResults, p.ownWords, p.allowedSkill]) assert.equal((await read(path)).decision, "allow", path);
    for (const path of [p.otherResults, p.otherTasks, p.otherWords, p.otherSkill, p.transcript]) assert.deepEqual(await read(path), GATED, path);
    for (const path of [p.ownResults, p.ownTasks, p.ownWords]) assert.deepEqual(await send(path), GATED, `SendUserFile ${path}`);
    assert.deepEqual(await read(p.ownWords, { session_id: "../x" }), GATED);
    assert.deepEqual(await read(p.ownResults, { session_id: undefined }), GATED);
  });
  it("refuses Read of the chat's own command-output folder too: a sandboxed command can write the temp folder and swap a file there for a link (open item, design C11)", async () => {
    // The tasks folder lies in Claude Code's temp folder, where the sandbox may write (C11), so it is no carve-out, as the workshop is
    // none. A sandboxed command reads the file with cat or head instead: the sandbox's allowRead keeps her temp subfolder (C36).
    const tasks = dirname(p.ownTasks);
    for (const path of [p.ownTasks, tasks, join(tasks, "sub", "b.output"), join(tasks, "..", SESSION, "tasks", "a.output")]) {
      assert.deepEqual(await read(path), GATED, path);
      assert.deepEqual(await send(path), GATED, `SendUserFile ${path}`);
    }
    // The carve-outs that lie where a sandboxed command cannot write still open what is theirs.
    for (const path of [p.ownResults, p.ownWords, p.allowedSkill]) assert.equal((await read(path)).decision, "allow", path);
  });
  it("refuses a link in the workshop to a gated file for Read and SendUserFile as a gated place, not as the workshop", async () => {
    for (const name of ["t", "o"]) {
      assert.deepEqual(await read(join(w.workshop, name)), GATED, name);
      assert.deepEqual(await send(join(w.workshop, name)), GATED, name);
    }
    assert.deepEqual(await read(join(w.workshop, "a.txt"), {}), IN_WORKSHOP);
    assert.deepEqual(await decide("Read", { file_path: join(w.workshop, "a.txt"), also: [p.episode] }), GATED, "a gated path anywhere in the input answers first");
  });
  it("refuses Write and Edit for every path, the workshop included, saying where a file is made", async () => {
    for (const [what, path] of [
      ["a file in the workshop", join(w.workshop, "a.txt")],
      ["a file in a folder not there yet", join(w.workshop, "new", "c.css")],
      ["a file in the workshop, by ~", "~/BRIMM Video Workshop/d.txt"],
      ["the workshop itself", w.workshop],
      ["a CLAUDE.md in the workshop", join(w.workshop, "CLAUDE.md")],
      ["a .mcp.json in the workshop spelled with a long s, which macOS takes as that name", join(w.workshop, ".mcp.j\u017fon")],
      ["a file in a .claude folder in the workshop", join(w.workshop, ".claude", "settings.json")],
      ["a link in the workshop to a file in her home", join(w.workshop, "z")],
      ["a link in the workshop that leads nowhere", join(w.workshop, "zz")],
      ["a file through a link in the workshop into the Drop folder", join(w.workshop, "d", "x.mov")],
      ["a file through a link in the workshop into her folder", join(w.workshop, "h", "CLAUDE.md")],
      ["a link in the workshop to a gated file", join(w.workshop, "t")],
      ["a file in a link outside the workshop that leads in", join(w.home, "Documents", "shop", "b.txt")],
      ["a path that leaves the workshop by ..", `${w.workshop}/../BRIMM Video Studio/x`],
      ["a file in a folder named like the workshop's", join(w.home, "BRIMM Video Workshop2", "x")],
      ["a path with white space before it", ` ${join(w.workshop, "a.txt")}`],
      ["a path with white space after it", `${join(w.workshop, "a.txt")}\n`],
      ["her folder", join(w.folder, "x.txt")],
      ["her documents", p.notes],
      ["a gated place", p.episode],
      ["her ssh folder, by ~", "~/.ssh/id_ed25519"],
    ]) {
      assert.deepEqual(await write(path), NO_WRITE, `Write ${what}`);
      assert.deepEqual(await edit(path), NO_WRITE, `Edit ${what}`);
      assert.deepEqual(await decide("Write", { file_path: path, content: "x" }, { cwd: w.workshop }), NO_WRITE, `Write in the workshop ${what}`);
    }
    // No path, or one that is no text, or a path in another field.
    for (const input of [{ content: "x" }, { file_path: undefined, content: "x" }, { file_path: "", content: "x" }, { file_path: 7 }, { file_path: [join(w.workshop, "a.txt")] }, { file_path: join(w.workshop, "a.txt"), content: "x", also: [p.episode] }, "text", null]) {
      assert.deepEqual(await decide("Write", input), NO_WRITE, JSON.stringify(input));
      assert.deepEqual(await decide("Edit", input), NO_WRITE, JSON.stringify(input));
    }
    assert.equal(WRITE_REFUSED, "Claude's own file tools do not write files here. Make a file in the workshop, ~/BRIMM Video Workshop, with a command, which runs in the sandbox.");
  });
  it("refuses, for a later Claude Code, a Glob or Grep whose folder is in a gated place or holds one, a Glob's absolute or ~/ pattern with no path among them", async () => {
    for (const [name, input] of [["Glob", { pattern: "**/*.txt", path: join(w.root, "Episodes") }], ["Grep", { pattern: "x", path: w.home }], ["Grep", { pattern: "x", path: dirname(w.root) }], ["Glob", { pattern: `${w.root}/Ep*/**` }], ["Glob", { pattern: "~/Lib*/**" }], ["Glob", { pattern: "../**/*.txt" }]]) {
      assert.deepEqual(await decide(name, input), GATED, `${name} ${JSON.stringify(input)}`);
    }
    for (const [name, input] of [["Glob", { pattern: "**/*.md" }], ["Grep", { pattern: "x", path: join(w.home, "Pictures") }], ["Grep", { pattern: "x" }], ["Glob", { pattern: "*.png", path: join(w.root, "Assets") }]]) {
      assert.equal((await decide(name, input)).decision, "allow", `${name} ${JSON.stringify(input)}`);
    }
  });

  describe("the workshop: files there are made and read with commands, never with Claude's own file tools", () => {
    /** Paths in the workshop, or leading into it, as Read, SendUserFile and the search tools meet them. */
    const spellings = () => [
      ["the workshop itself", w.workshop],
      ["a file in it", join(w.workshop, "a.txt")],
      ["a file in a folder in it", join(w.workshop, "sub", "deep", "f.txt")],
      ["a folder in it", join(w.workshop, "sub")],
      ["a file in it, by ~", "~/BRIMM Video Workshop/a.txt"],
      ["a file in it, by ..", join(w.home, "Documents", "..", "BRIMM Video Workshop", "a.txt")],
      ["a link in it to a file outside it", join(w.workshop, "out")],
      ["a link outside it that leads to it", join(w.home, "Documents", "shop")],
      ["a file through a link outside it that leads to it", join(w.home, "Documents", "shop", "sub", "deep", "f.txt")],
      ["a link outside it to a file in it", join(w.home, "Documents", "shop-file")],
      ["a link outside it to a path in it that is not there yet", join(w.home, "Documents", "shop-later")],
      ["a path in it that is not there yet", join(w.workshop, "later", "new.txt")],
      ["a path in a folder in it that is not there yet", join(w.workshop, "sub", "not", "yet", "x.txt")],
      ["a path with white space around it", ` ${join(w.workshop, "a.txt")}\n`],
    ];
    const macSpellings = () => [
      ["by /System/Volumes/Data", `/System/Volumes/Data${join(w.workshop, "a.txt")}`],
      ["by /System/Volumes/Data, a folder in it", `/System/Volumes/Data${join(w.workshop, "sub")}`],
      ["by /System/Volumes/Data, not there yet", `/System/Volumes/Data${join(w.workshop, "later", "new.txt")}`],
      ["in another letter case", join(w.home, "BRIMM VIDEO WORKSHOP", "A.TXT")],
      ["in another letter case, a folder", join(w.home, "brimm video workshop", "SUB")],
      ["in another letter case, not there yet", join(w.home, "Brimm Video Workshop", "Later", "New.txt")],
      ["through a link, in another letter case", join(w.home, "DOCUMENTS", "SHOP", "a.txt")],
    ];

    it("refuses Read and SendUserFile of any path in the workshop, or that leads into it, as the workshop's, by what the path is", async () => {
      for (const [what, path] of spellings()) {
        assert.deepEqual(await read(path), IN_WORKSHOP, `Read ${what}`);
        assert.deepEqual(await send(path), IN_WORKSHOP, `SendUserFile ${what}`);
      }
      assert.equal(WORKSHOP_FILES_REFUSED, "Claude's own file tools do not read the workshop. Read a file there with a command, which runs in the sandbox.");
    });
    it("refuses them by /System/Volumes/Data and by changed letter case", { skip: notAMac }, async () => {
      for (const [what, path] of macSpellings()) {
        assert.deepEqual(await read(path), IN_WORKSHOP, `Read ${what}`);
        assert.deepEqual(await send(path), IN_WORKSHOP, `SendUserFile ${what}`);
      }
    });
    it("refuses Glob and Grep whose folder is in the workshop, or leads into it, or whose pattern names a place in it", async () => {
      for (const [what, path] of [
        ["the workshop itself", w.workshop],
        ["a folder in it", join(w.workshop, "sub", "deep")],
        ["the workshop, by ~", "~/BRIMM Video Workshop"],
        ["a folder in it that is not there yet", join(w.workshop, "sub", "not")],
        ["a link in it to a file outside it", join(w.workshop, "out")],
        ["a link outside it that leads to it", join(w.home, "Documents", "shop")],
        ["a folder in it, through that link", join(w.home, "Documents", "shop", "sub")],
        ["the workshop, with white space around it", ` ${w.workshop} `],
      ]) {
        for (const name of ["Glob", "Grep"]) assert.deepEqual(await decide(name, { pattern: "*", path }), IN_WORKSHOP, `${name} ${what}`);
      }
      for (const name of ["Glob", "Grep"]) {
        assert.deepEqual(await decide(name, { pattern: "x", path: join(w.workshop, "a.txt") }), IN_WORKSHOP, `${name} a file in it`);
        assert.deepEqual(await decide(name, { pattern: "x" }, { cwd: w.workshop }), IN_WORKSHOP, `${name} from the workshop`);
        assert.deepEqual(await decide(name, { pattern: "x" }, { cwd: join(w.workshop, "sub") }), IN_WORKSHOP, `${name} from a folder in it`);
      }
      for (const pattern of [`${w.workshop}/**/*.txt`, "~/BRIMM Video Workshop/*.txt", `${w.home}/Documents/shop/**`, `${w.workshop}/sub/../*.txt`]) assert.deepEqual(await decide("Glob", { pattern }), IN_WORKSHOP, pattern);
    });
    it("refuses Glob and Grep of a folder above the workshop, which holds it, even where no gated place is in the way", async () => {
      const bare = { ...ctx, index: gatedIndex([]) };
      for (const root of [w.home, w.dir, "/"]) for (const name of ["Glob", "Grep"]) assert.deepEqual(await decide(name, { pattern: "x", path: root }, {}, bare), IN_WORKSHOP, `${name} ${root}`);
      assert.deepEqual(await decide("Glob", { pattern: "../**/*.txt" }, {}, bare), IN_WORKSHOP);
      for (const root of [join(w.home, "Documents"), w.folder, join(w.home, "BRIMM Video Workshop2"), join(w.home, "Documents", "BRIMM Video Workshop")]) for (const name of ["Glob", "Grep"]) assert.equal((await decide(name, { pattern: "x", path: root }, {}, bare)).decision, "allow", `${name} ${root}`);
    });
    it("answers a gated place before the workshop, and the workshop for every other tool whose input holds a path in it", async () => {
      assert.deepEqual(await decide("Read", { file_path: join(w.workshop, "a.txt"), also: [p.episode] }), GATED);
      assert.deepEqual(await decide("Grep", { pattern: "x", path: join(w.workshop, "a.txt"), also: p.episode }), GATED);
      assert.deepEqual(await send(join(w.workshop, "t")), GATED, "a link in the workshop to a gated file");
      for (const [name, input] of [["mcp__visualize__show_widget", { widget_code: "x", file: join(w.workshop, "a.txt") }], ["Agent", { prompt: "x", files: [{ path: join(w.workshop, "sub") }] }], ["PushNotification", { message: join(w.workshop, "a.txt") }], ["Skill", { skill: "brimm-edit", args: join(w.workshop, "a.txt") }]]) {
        assert.deepEqual(await decide(name, input), IN_WORKSHOP, name);
      }
      assert.deepEqual(await decide("PushNotification", { message: "Done" }), { decision: "allow", reason: "a tool this folder allows" });
      assert.equal((await decide("Agent", { prompt: "Look in the workshop for the pictures" })).decision, "allow");
    });
    it("still allows Read of her documents, Assets and the checkout's code, and a path that only looks like the workshop's", async () => {
      for (const path of [p.notes, p.logo, p.code, join(w.folder, "CLAUDE.md"), "~/Documents/notes.txt", join(w.home, "BRIMM Video Workshop2", "x"), join(w.home, "Documents", "BRIMM Video Workshop", "x"), join(w.home, "Workshop")]) {
        assert.equal((await read(path)).decision, "allow", path);
        assert.equal((await send(path)).decision, "allow", path);
      }
      for (const [name, input] of [["Glob", { pattern: "**/*.md" }], ["Grep", { pattern: "x", path: join(w.home, "Pictures") }], ["Glob", { pattern: "*.png", path: join(w.root, "Assets") }]]) assert.equal((await decide(name, input)).decision, "allow", name);
    });
    it("uses the workshop's index it is given, and builds one from the home folder when it is given none", async () => {
      const none = { ...ctx, workshop: gatedIndex([]) };
      assert.equal((await decide("Read", { file_path: join(w.workshop, "a.txt") }, {}, none)).decision, "allow", "an index with no place in it");
      const all = { ...ctx, workshop: { at: () => ({ path: "x" }), holds: () => false } };
      assert.deepEqual(await read(p.notes, {}), { decision: "allow", reason: "outside the gated places and the workshop" });
      assert.deepEqual(await decide("Read", { file_path: p.notes }, {}, all), IN_WORKSHOP);
      assert.deepEqual(await decide("Read", { file_path: join(w.workshop, "a.txt") }), IN_WORKSHOP, "none given: built from ctx.home");
    });
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
    for (const command of [`cat "${CHECKOUT}/tool/studio.js"`, `ls "${CHECKOUT}/tool"`, "python3 edit.js", `cd "${CHECKOUT}" && node tool/EDIT.JS episodes`, `cat "/System/Volumes/Data${CHECKOUT}/tool/never.js"`, `${NODE} "${CHECKOUT.replace("BRIMM video", 'BRIMM vi""deo')}/tool/ed"'it.js' episodes`, `${NODE} ${CHECKOUT.replaceAll(" ", "\\ ")}/tool/edi\\t.js episodes`]) assert.deepEqual(await bash(command), ALONE, command);
  });
  it("refuses, as a courtesy, cat, grep -r, rg and find naming a gated place", async () => {
    for (const command of [`cat "${join(w.root, "Episodes", "x", "t.txt")}"`, "grep -r secret ~/.ssh", `rg talk '${join(w.root, "Drop")}'`, "find ~/.claude -name '*.jsonl'", `ls ${join(w.root, "Episodes").replaceAll(" ", "\\ ")}`]) {
      assert.deepEqual(await bash(command), { decision: "deny", reason: GATED_REFUSED }, command);
    }
  });
  it("allows any other command, which runs in the sandbox", async () => {
    for (const c of ["date", "ls ~/Documents", "python3 -c 'print(1)'", "rg TODO ~/Documents", `cat "${join(w.root, "Assets", "logo.png")}"`, "cd Pictures"]) assert.equal((await bash(c)).decision, "allow", c);
  });
  it("allows a command that makes, reads or lists files in the workshop, which is how Claude does it: the sandbox writes there", async () => {
    const shop = join(w.workshop, "a b.txt");
    for (const c of [`cat "${shop}"`, `printf 'hello' > "${shop}"`, `printf '%s' 'aGk=' | base64 -d > "${shop}"`, `python3 -c 'open("${shop}", "w").write("x")'`, `node -e 'require("fs").writeFileSync("${shop}", "x")'`, `ls "${w.workshop}"`, `cd "${w.workshop}" && cat 'a b.txt'`, "cat ~/'BRIMM Video Workshop'/x.txt", `rg x "${w.workshop}"`]) {
      assert.deepEqual(await bash(c), { decision: "allow", reason: "a command in the sandbox" }, c);
    }
  });
});

describe("the open guard, IV: falling back to today's, and the hook", () => {
  const REFUSED = "In this folder Claude runs only brimm-video's own commands. Ask Jason for anything else.";
  const OTHER = "22222222-3333-4444-8555-666666666666";
  const AT = "2026-10-26T10:00:00.000Z";
  /** A made-up open-lock Mac with a chat in her folder: its transcript in her folder's projects folder. */
  function chat() {
    const w = openWorld();
    w.projects = join(w.home, ".claude", "projects", claudeDirName(w.folder));
    w.transcript = transcript(w.projects, [{ type: "user", uuid: "u-1", timestamp: AT }]);
    w.edit = `${w.node} "${w.checkout}/tool/edit.js"`;
    w.words = join(w.home, "Library", "Application Support", "BRIMM Video Words");
    return w;
  }
  /** What the guard answers in the chat of `w` to `name` with `input`; `call` changes the hook's input, `more` the guard's deps. */
  const guard = (w, name, input, { call = {}, more = {} } = {}) => guardAnswer({ session_id: SESSION, transcript_path: w.transcript, cwd: w.folder, hook_event_name: "PreToolUse", tool_name: name, tool_input: input, ...call }, { checkout: w.checkout, node: w.node, folder: w.folder, deps: openDeps(w, { resolve: PUBLIC, ...more }) });
  const date = (w, options) => guard(w, "Bash", { command: "date" }, options);
  const CHANGED = { decision: "deny", reason: LOCK_CHANGED };

  it("goes on with the open lock when nothing loosens it", async () => {
    const w = chat();
    assert.equal((await date(w)).decision, "allow");
    assert.deepEqual(await guard(w, "Write", { file_path: join(w.workshop, "a.txt"), content: "x" }), { decision: "deny", reason: WRITE_REFUSED });
    assert.deepEqual(await guard(w, "Read", { file_path: join(w.workshop, "a.txt") }), { decision: "deny", reason: WORKSHOP_FILES_REFUSED });
    assert.deepEqual(await guard(w, "Grep", { pattern: "x", path: w.workshop }), { decision: "deny", reason: WORKSHOP_FILES_REFUSED });
    assert.equal((await guard(w, "Bash", { command: `printf x > "${join(w.workshop, "a.txt")}"` })).decision, "allow");
    assert.equal((await guard(w, "Read", { file_path: join(w.home, "Documents", "notes.txt") })).decision, "allow");
    w.done();
  });
  it("answers as today's guard does, saying the lock is changed, while anything loosens the lock", async () => {
    const loosen = [
      ["her folder's settings.local.json", (w) => writeFileSync(join(w.folder, ".claude", "settings.local.json"), "{}"), {}],
      ["a user sandbox key", (w) => writeFileSync(join(w.home, ".claude", "settings.json"), JSON.stringify({ sandbox: { enabled: false } })), {}],
      ["an unlisted secret name", () => {}, { env: { SOME_SERVICE_TOKEN: "x" } }],
      ["a plugin with hooks", (w) => {
        writeFileSync(join(w.home, ".claude", "settings.json"), JSON.stringify({ enabledPlugins: { "hooky@market": true } }));
        mkdirSync(join(w.home, ".claude", "plugins", "cache", "market", "hooky", "1.0.0", "hooks"), { recursive: true });
        writeFileSync(join(w.home, ".claude", "plugins", "cache", "market", "hooky", "1.0.0", "hooks", "hooks.json"), "{}");
      }, {}],
      ["no claude above", () => {}, { ps: () => psText([[1, 0, "/sbin/launchd"], [800, 1, "/bin/sh"], [900, 800, "node guard.mjs"]]) }],
      ["an agent definition named as one of Claude Code's own", (w) => {
        mkdirSync(join(w.home, ".claude", "agents"), { recursive: true });
        writeFileSync(join(w.home, ".claude", "agents", "Explore.md"), "---\nname: Explore\n---\n");
      }, {}],
      ["an agent definition asking for its own hooks", (w) => {
        mkdirSync(join(w.folder, ".claude", "agents"), { recursive: true });
        writeFileSync(join(w.folder, ".claude", "agents", "reviewer.md"), "---\nname: reviewer\nhooks:\n  Stop: []\n---\n");
      }, {}],
    ];
    for (const [what, make, more] of loosen) {
      const w = chat();
      mkdirSync(join(w.home, ".claude"), { recursive: true });
      make(w);
      assert.deepEqual(await date(w, { more }), CHANGED, what);
      assert.equal((await guard(w, "Bash", { command: `${w.edit} episodes` }, { more })).decision, "allow", what);
      assert.deepEqual(await guard(w, "Write", { file_path: join(w.workshop, "a.txt"), content: "x" }, { more }), CHANGED, what);
      w.done();
    }
  });
  it("answers as today's guard does in a chat that holds a session's words, allowing it to read its own words with no card", async () => {
    const w = chat();
    for (const id of [SESSION, OTHER]) {
      mkdirSync(join(w.words, id), { recursive: true });
      writeFileSync(join(w.words, id, "x.txt"), "words");
    }
    symlinkSync(join(w.words, SESSION, "x.txt"), join(w.workshop, "mine.txt"));
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: "700" }, table: processTable(chatChain({ args: APP_ARGS(w.folder, w.home) })), pid: 900, now: Date.parse("2026-10-26T10:30:00.000Z") });
    assert.equal((await guard(w, "Read", { file_path: join(w.words, SESSION, "x.txt") })).decision, "allow");
    // Not through a link in the workshop: a path there is one Claude's own tools do not act on, since a loop in the sandbox can swap a
    // link in it between the guard's look and the Read.
    assert.deepEqual(await guard(w, "Read", { file_path: join(w.workshop, "mine.txt") }), { decision: "deny", reason: HELD_REFUSED });
    assert.deepEqual(await guard(w, "Read", { file_path: join(w.words, OTHER, "x.txt") }), { decision: "deny", reason: HELD_REFUSED });
    assert.deepEqual(await date(w), { decision: "deny", reason: HELD_REFUSED });
    for (const [name, input] of [["WebSearch", { query: "x" }], ["SendUserFile", { files: [join(w.folder, "CLAUDE.md")] }], ["PushNotification", { message: "x" }], ["mcp__visualize__show_widget", {}], ["Write", { file_path: join(w.workshop, "a.txt"), content: "x" }]]) {
      assert.deepEqual(await guard(w, name, input), { decision: "deny", reason: HELD_REFUSED }, name);
    }
    assert.deepEqual(await guard(w, "Read", { file_path: join(w.folder, "CLAUDE.md") }), { decision: "pass", reason: "" });
    assert.deepEqual(await guard(w, "AskUserQuestion", { questions: [] }), { decision: "pass", reason: "" });
    w.done();
  });
  it("lets a chat that holds a session's words run only the commands a session runs", async () => {
    const w = chat();
    untiedMark({ home: w.home, now: Date.parse("2026-10-26T10:30:00.000Z") });
    for (const words of ["episodes", 'guide "Talk" tell', 'principles "Pricing talk" keep 1', 'finish "Pricing talk"', 'teachings "Pricing talk"', "behind", 'kind "Pricing talk" session', 'reel "Pricing talk" 1']) {
      assert.equal((await guard(w, "Bash", { command: `${w.edit} ${words}` })).decision, "allow", words);
    }
    assert.equal((await guard(w, "Bash", { command: `${w.edit} guide "Talk" tell`, run_in_background: true })).decision, "allow");
    for (const words of ['name "Pricing talk" "x"', 'title "Pricing talk" --words "x"', 'text "Pricing talk" --line "x"', 'spell "Pricing talk" add "x"', 'cut "Pricing talk" --words "x"', 'picture make "x"', 'read "Pricing talk"', '"name" "Pricing talk" "x"']) {
      assert.deepEqual(await guard(w, "Bash", { command: `${w.edit} ${words}` }), { decision: "deny", reason: HELD_NARROWED }, words);
    }
    assert.deepEqual(await guard(w, "Bash", { command: w.edit }), { decision: "deny", reason: HELD_NARROWED });
    w.done();
  });
  it("keeps a held chat to the commands a session runs while the lock is loosened too, and a call it cannot judge", async () => {
    const w = chat();
    untiedMark({ home: w.home, now: Date.parse("2026-10-26T10:30:00.000Z") });
    writeFileSync(join(w.folder, ".claude", "settings.local.json"), "{}");
    assert.deepEqual(await guard(w, "Bash", { command: `${w.edit} name "Pricing talk" "key phrases"` }), { decision: "deny", reason: HELD_NARROWED });
    assert.equal((await guard(w, "Bash", { command: `${w.edit} episodes` })).decision, "allow");
    assert.deepEqual(await date(w), CHANGED);
    rmSync(join(w.folder, ".claude", "settings.local.json"));
    for (const call of [{ session_id: undefined }, { transcript_path: undefined }, { session_id: "../x" }]) {
      assert.deepEqual(await guard(w, "Bash", { command: `${w.edit} title "Pricing talk" --words "x"` }, { call }), { decision: "deny", reason: HELD_NARROWED }, JSON.stringify(call));
      assert.equal((await guard(w, "Bash", { command: `${w.edit} episodes` }, { call })).decision, "allow", JSON.stringify(call));
    }
    w.done();
  });
  it("lets a chat that holds no session's words run every edit.js command while the lock is loosened", async () => {
    const w = chat();
    writeFileSync(join(w.folder, ".claude", "settings.local.json"), "{}");
    assert.equal((await guard(w, "Bash", { command: `${w.edit} name "Pricing talk" "x"` })).decision, "allow");
    w.done();
  });
  it("says the lock is changed while Claude Code keeps its chats somewhere other than ~/.claude, which is not gated", async () => {
    const w = chat();
    mkdirSync(join(w.home, ".claude"), { recursive: true });
    assert.deepEqual(await date(w, { more: { env: { CLAUDE_CONFIG_DIR: join(w.home, "Claude config") } } }), CHANGED);
    assert.equal((await date(w, { more: { env: { CLAUDE_CONFIG_DIR: join(w.home, ".claude") } } })).decision, "allow");
    assert.equal((await date(w, { more: { env: { CLAUDE_CONFIG_DIR: "" } } })).decision, "allow");
    assert.deepEqual(await date(w, { more: { env: { CLAUDE_CONFIG_DIR: ".claude" } } }), CHANGED, "not absolute");
    w.done();
  });
  it("says the lock is changed while Claude Code keeps its chats in a folder whose name only looks like .claude, there or not", async () => {
    const w = chat();
    // A script small l (U+2113) and a fullwidth c (U+FF43): each folds to .claude, but macOS keeps it a folder of its own.
    for (const name of [".cℓaude", ".ｃlaude"]) {
      const config = join(w.home, name);
      assert.deepEqual(await date(w, { more: { env: { CLAUDE_CONFIG_DIR: config } } }), CHANGED, `${name}, not there`);
      mkdirSync(join(config, "projects"), { recursive: true });
      assert.deepEqual(await date(w, { more: { env: { CLAUDE_CONFIG_DIR: config } } }), CHANGED, `${name}, there`);
    }
    w.done();
  });
  it("keeps a chat to a session's commands when the claude above cannot be found while a mark names a claude", async () => {
    const w = chat();
    const other = transcript(w.projects, [{ type: "user", uuid: "x-1", timestamp: AT }], OTHER);
    markChat({ home: w.home, env: { CLAUDE_CODE_SESSION_ID: OTHER, CLAUDE_PID: "700" }, table: processTable(chatChain({ args: APP_ARGS(w.folder, w.home) })), pid: 900, now: Date.parse("2026-10-26T10:30:00.000Z") });
    assert.ok(other);
    for (const ps of [() => null, () => psText([[1, 0, "/sbin/launchd"], [800, 1, "/bin/sh"], [900, 800, "node guard.mjs"]])]) {
      assert.deepEqual(await guard(w, "Bash", { command: `${w.edit} name "Pricing talk" "key phrases"` }, { more: { ps } }), { decision: "deny", reason: HELD_NARROWED });
      assert.equal((await guard(w, "Bash", { command: `${w.edit} episodes` }, { more: { ps } })).decision, "allow");
    }
    w.done();
  });
  it("says the lock is changed after a time her folder kept the open shape under the strict lock, until settings.js studio writes it again", async () => {
    const w = chat();
    const output = join(w.tmp, `claude-${w.uid}`, claudeDirName(w.folder), SESSION, "tasks", "a.output");
    assert.deepEqual(await date(w, { more: { minimum: null } }), { decision: "deny", reason: REFUSED });
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, "words printed under the strict lock");
    assert.deepEqual(await date(w), CHANGED);
    const marks = () => readdirSync(heldFolder(w.home)).filter((n) => n.startsWith("mark-")).length;
    const before = existsSync(heldFolder(w.home)) ? marks() : 0;
    assert.equal(await settingsMain(["studio", "--node", w.node], { home: w.home, say: () => {}, openMinimum: MINIMUM, tmp: w.tmp, uid: w.uid, freePort: () => 47123 }), 0);
    assert.equal(marks(), before + 1);
    assert.equal(existsSync(output), false);
    assert.deepEqual(await date(w), { decision: "deny", reason: HELD_REFUSED }, "a chat of that time is held");
    const later = transcript(w.projects, [{ type: "user", uuid: "l-1", timestamp: "2099-01-01T00:00:00.000Z" }], OTHER);
    assert.equal((await date(w, { call: { session_id: OTHER, transcript_path: later } })).decision, "allow", "a chat begun after goes on");
    w.done();
  });
  it("keeps the open lock for a chat that ran cd Pictures", async () => {
    const w = chat();
    const pictures = join(w.folder, "Pictures");
    assert.equal((await date(w, { call: { cwd: pictures } })).decision, "allow");
    assert.deepEqual(await guard(w, "Read", { file_path: join(w.workshop, "a.txt") }, { call: { cwd: pictures } }), { decision: "deny", reason: WORKSHOP_FILES_REFUSED });
    const there = transcript(join(w.home, ".claude", "projects", claudeDirName(pictures)), [{ type: "user", uuid: "p-1", timestamp: AT }], OTHER);
    assert.deepEqual(await date(w, { call: { cwd: pictures, session_id: OTHER, transcript_path: there } }), CHANGED);
    w.done();
  });
  it("says the lock is changed for a chat started in a folder whose projects folder is spelled as hers, as ~/BRIMM-Video-Studio", async () => {
    const w = chat();
    for (const name of ["BRIMM-Video-Studio", "BRIMM_Video_Studio", join("BRIMM Video", "Studio")]) {
      const elsewhere = join(w.home, name);
      mkdirSync(elsewhere, { recursive: true });
      assert.equal(claudeDirName(elsewhere), claudeDirName(w.folder), name);
      const there = transcript(w.projects, [{ type: "user", uuid: "e-1", timestamp: AT }], OTHER);
      assert.deepEqual(await date(w, { call: { cwd: elsewhere, session_id: OTHER, transcript_path: there } }), CHANGED, name);
      assert.deepEqual(await date(w, { call: { cwd: `${w.folder}x`, session_id: OTHER, transcript_path: there } }), CHANGED, `${name}: a folder beside hers whose name begins as hers does`);
    }
    assert.equal((await date(w, { call: { cwd: join(w.folder, "Pictures", "deeper") } })).decision, "allow");
    w.done();
  });
  it("decides a subagent's call, with its chat's session id and an agent_id, as its chat's own", async () => {
    const w = chat();
    const call = { agent_id: "a-1", agent_type: "Explore" };
    assert.equal((await date(w, { call })).decision, "allow");
    assert.deepEqual(await guard(w, "Read", { file_path: join(w.root, "Episodes", "x.txt") }, { call }), { decision: "deny", reason: GATED_REFUSED });
    untiedMark({ home: w.home, now: Date.parse("2026-10-26T10:30:00.000Z") });
    assert.deepEqual(await date(w, { call }), { decision: "deny", reason: HELD_REFUSED });
    w.done();
  });
  it("keeps to today's guard on a strict Mac, on a Mac whose settings cannot be read, and on one whose settings say open while no Claude Code is named for it", async () => {
    const asked = () => {
      throw new Error("asked");
    };
    const w = chat();
    const strict = { ps: asked, lsof: asked };
    assert.deepEqual(await date(w, { more: { minimum: null, ...strict } }), { decision: "deny", reason: REFUSED });
    assert.equal((await guard(w, "Bash", { command: `${w.edit} episodes` }, { more: { minimum: null, ...strict } })).decision, "allow");
    writeSettings(w.home, { lock: "strict" });
    assert.deepEqual(await date(w, { more: strict }), { decision: "deny", reason: REFUSED });
    writeFileSync(settingsFile(w.home), "{not json");
    assert.deepEqual(await date(w, { more: strict }), { decision: "deny", reason: REFUSED });
    rmSync(settingsFile(w.home));
    assert.deepEqual(await date(w, { more: strict }), { decision: "deny", reason: REFUSED });
    w.done();
  });
  it("takes the home folder from her folder, never from HOME", async () => {
    const w = chat();
    const was = process.env.HOME;
    process.env.HOME = join(w.dir, "elsewhere");
    try {
      assert.equal((await date(w, { more: { env: { HOME: join(w.dir, "elsewhere") } } })).decision, "allow");
      assert.deepEqual(await guard(w, "Read", { file_path: "~/.ssh/id_ed25519" }), { decision: "deny", reason: GATED_REFUSED });
      assert.deepEqual(await guard(w, "Read", { file_path: "~/BRIMM Video Workshop/a.txt" }), { decision: "deny", reason: WORKSHOP_FILES_REFUSED });
    } finally {
      process.env.HOME = was;
    }
    const bare = realpathSync(mkdtempSync(join(tmpdir(), "brimm-guard-bare-")));
    const folder = join(bare, "BRIMM Video Studio");
    assert.deepEqual(await guardAnswer({ session_id: SESSION, transcript_path: w.transcript, cwd: folder, tool_name: "Bash", tool_input: { command: "date" } }, { checkout: w.checkout, node: w.node, folder, deps: openDeps(w, { env: { HOME: w.home } }) }), { decision: "deny", reason: REFUSED });
    rmSync(bare, { recursive: true, force: true });
    w.done();
  });
  it("falls back to today's guard for a call with no session id, transcript or folder, a session id that is not a chat's, or a tool_input that is not an object", async () => {
    const w = chat();
    for (const call of [{ session_id: undefined }, { transcript_path: undefined }, { cwd: undefined }, { session_id: "../x" }, { session_id: SESSION.toUpperCase().replace("1", "A") }]) {
      assert.deepEqual(await date(w, { call }), CHANGED, JSON.stringify(call));
      assert.equal((await guard(w, "Bash", { command: `${w.edit} episodes` }, { call })).decision, "allow", JSON.stringify(call));
    }
    assert.deepEqual(await guard(w, "Bash", "date"), CHANGED);
    assert.deepEqual(await guard(w, "Bash", ["date"]), CHANGED);
    w.done();
  });
  it("reuses the lock check while nothing it looked at has changed, and looks again when a file changes or appears", async () => {
    const w = chat();
    let looks = 0;
    const more = { lsof: () => {
      looks += 1;
      return "";
    } };
    const ask = () => date(w, { more });
    assert.equal((await ask()).decision, "allow");
    assert.equal((await ask()).decision, "allow");
    assert.equal(looks, 1, "the second call reuses the check");
    writeFileSync(join(w.folder, ".claude", "settings.local.json"), "{}");
    assert.deepEqual(await ask(), CHANGED);
    rmSync(join(w.folder, ".claude", "settings.local.json"));
    assert.equal((await ask()).decision, "allow");
    mkdirSync(join(w.dir, "managed"), { recursive: true });
    writeFileSync(join(w.dir, "managed", "managed-settings.json"), JSON.stringify({ sandbox: { enabled: false } }));
    assert.deepEqual(await ask(), CHANGED);
    rmSync(join(w.dir, "managed", "managed-settings.json"));
    assert.equal((await ask()).decision, "allow");
    // An enabled plugin with no hooks, then a hooks file appearing deep in its folder.
    const plugin = join(w.home, ".claude", "plugins", "cache", "market", "hooky", "1.0.0");
    mkdirSync(join(plugin, ".claude-plugin"), { recursive: true });
    writeFileSync(join(plugin, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "hooky" }));
    writeFileSync(join(w.home, ".claude", "settings.json"), JSON.stringify({ enabledPlugins: { "hooky@market": true } }));
    assert.equal((await ask()).decision, "allow");
    mkdirSync(join(plugin, "hooks"));
    writeFileSync(join(plugin, "hooks", "hooks.json"), "{}");
    assert.deepEqual(await ask(), CHANGED);
    rmSync(join(plugin, "hooks"), { recursive: true });
    assert.equal((await ask()).decision, "allow");
    writeFileSync(join(plugin, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "hooky", hooks: "./hooks.json" }));
    assert.deepEqual(await ask(), CHANGED, "a plugin.json changed in place");
    rmSync(join(w.home, ".claude", "plugins"), { recursive: true });
    rmSync(join(w.home, ".claude", "settings.json"));
    assert.equal((await ask()).decision, "allow");
    // An agent definition appearing where Claude Code would load one is looked at again.
    const agents = looks;
    mkdirSync(join(w.home, ".claude", "agents"), { recursive: true });
    assert.equal((await ask()).decision, "allow");
    assert.equal(looks, agents + 1);
    writeFileSync(join(w.home, ".claude", "agents", "reviewer.md"), "---\nname: reviewer\ndescription: x\ntools: Read\n---\n");
    assert.equal((await ask()).decision, "allow");
    assert.equal(looks, agents + 2);
    mkdirSync(join(w.folder, ".claude", "agents"), { recursive: true });
    writeFileSync(join(w.folder, ".claude", "agents", "planner.md"), "---\nname: planner\n---\n");
    assert.equal((await ask()).decision, "allow");
    assert.equal(looks, agents + 3);
    writeFileSync(join(w.folder, ".claude", "agents", "planner.md"), "---\nname: Plan\nisolation: remote\n---\n");
    assert.deepEqual(await ask(), CHANGED, "a definition changed in place");
    assert.equal(looks, agents + 4);
    writeFileSync(join(w.folder, ".claude", "agents", "planner.md"), "---\nname: planner\n---\n");
    assert.equal((await ask()).decision, "allow");
    assert.equal(looks, agents + 5);
    const before = looks;
    appendFileSync(w.transcript, `${JSON.stringify({ type: "user", uuid: "u-2", timestamp: AT })}\n`);
    assert.equal((await ask()).decision, "allow");
    assert.equal(looks, before, "a transcript that grew does not miss the cache");
    appendFileSync(w.transcript, `${JSON.stringify({ type: "attachment", attachment: { type: "environment", snapshot: { additionalWorkingDirectories: [join(w.home, "Documents")] } } })}\n`);
    assert.deepEqual(await ask(), CHANGED, "a folder added in that line is still seen");
    assert.equal(looks, before);
    w.done();
  });
  it("still sees a plugin gain hooks while a link in the plugins cache cannot be looked through", async () => {
    const w = chat();
    const cache = join(w.home, ".claude", "plugins", "cache");
    const plugin = join(cache, "market", "hooky", "1.0.0");
    mkdirSync(join(plugin, ".claude-plugin"), { recursive: true });
    writeFileSync(join(plugin, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "hooky" }));
    writeFileSync(join(w.home, ".claude", "settings.json"), JSON.stringify({ enabledPlugins: { "hooky@market": true } }));
    // A link to itself cannot be looked at (ELOOP), and must not hide the real marketplace beside it.
    symlinkSync("loop", join(cache, "loop"));
    assert.equal((await date(w)).decision, "allow");
    mkdirSync(join(plugin, "hooks"));
    writeFileSync(join(plugin, "hooks", "hooks.json"), "{}");
    assert.deepEqual(await date(w), CHANGED, "the next call, with no waiting out the cache");
    w.done();
  });
  it("sees an agent definition that replaces one of Claude Code's own appear or change on the next call, wherever Claude Code would load it from", async () => {
    const w = chat();
    const ask = () => date(w);
    const plain = "---\nname: reviewer\ndescription: x\ntools: Read\n---\n";
    const replaces = "---\nname: Explore\nisolation: remote\n---\n";
    assert.equal((await ask()).decision, "allow");
    // A folder inside the user's agents folder, with a definition in it that is then changed in place.
    const deep = join(w.home, ".claude", "agents", "team", "deep");
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(deep, "reviewer.md"), plain);
    assert.equal((await ask()).decision, "allow");
    writeFileSync(join(deep, "reviewer.md"), replaces);
    assert.deepEqual(await ask(), CHANGED, "changed in place, two folders down");
    rmSync(join(w.home, ".claude", "agents"), { recursive: true });
    assert.equal((await ask()).decision, "allow");
    // Her folder's agents folder, and a plugin's in the cache, each appearing whole after a clean answer.
    mkdirSync(join(w.folder, ".claude", "agents"));
    writeFileSync(join(w.folder, ".claude", "agents", "Explore.md"), plain);
    assert.deepEqual(await ask(), CHANGED, "in her folder");
    rmSync(join(w.folder, ".claude", "agents"), { recursive: true });
    assert.equal((await ask()).decision, "allow");
    const plugin = join(w.home, ".claude", "plugins", "cache", "market", "team", "1.0.0");
    mkdirSync(join(plugin, ".claude-plugin"), { recursive: true });
    writeFileSync(join(plugin, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "team" }));
    assert.equal((await ask()).decision, "allow");
    mkdirSync(join(plugin, "agents"));
    writeFileSync(join(plugin, "agents", "Plan.md"), plain);
    assert.deepEqual(await ask(), CHANGED, "in a plugin's folder");
    w.done();
  });
  it("looks again when a time her folder kept the open shape under the strict lock is noted or taken away, or CLAUDE_CONFIG_DIR's folder comes to be another folder than ~/.claude", async () => {
    const w = chat();
    const ask = (more) => date(w, { more });
    assert.equal((await ask()).decision, "allow");
    noteStrictSeen(w.home, Date.parse("2026-10-26T10:30:00.000Z"));
    assert.deepEqual(await ask(), CHANGED, "noted after a clean answer");
    clearStrictSeen(w.home);
    assert.equal((await ask()).decision, "allow", "taken away");
    // A name for ~/.claude through a link, which is then pointed at another folder.
    const config = join(w.home, "claude link");
    symlinkSync(join(w.home, ".claude"), config);
    const env = { CLAUDE_CONFIG_DIR: config };
    assert.equal((await ask({ env })).decision, "allow", "a link to ~/.claude");
    rmSync(config);
    mkdirSync(join(w.home, "elsewhere", "projects"), { recursive: true });
    symlinkSync(join(w.home, "elsewhere"), config);
    assert.deepEqual(await ask({ env }), CHANGED, "the link pointed at another folder");
    assert.equal((await ask()).decision, "allow", "and none given again");
    w.done();
  });
  it("looks again when a value the check reads in the environment changes, or the app's notes folder becomes a link", async () => {
    const w = chat();
    assert.equal((await date(w, { more: { env: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" } } })).decision, "allow");
    assert.deepEqual(await date(w, { more: { env: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0" } } }), CHANGED);
    const notes = join(w.home, "Library", "Application Support", "Claude", "side-session-notes", "local_00000000-0000-4000-8000-000000000000");
    mkdirSync(notes, { recursive: true });
    assert.equal((await date(w)).decision, "allow");
    rmSync(notes, { recursive: true });
    mkdirSync(join(w.dir, "elsewhere"));
    symlinkSync(join(w.dir, "elsewhere"), notes);
    assert.deepEqual(await date(w), CHANGED);
    w.done();
  });
  it("looks again when a skill changes in place in a plugin's version kept through a link, or the app's copy of Claude Code comes to be reached through a link", async () => {
    const w = chat();
    const real = join(w.dir, "linked plugin");
    const skill = join(real, "skills", "theme-factory", "SKILL.md");
    mkdirSync(dirname(skill), { recursive: true });
    writeFileSync(skill, "---\nname: theme-factory\n---\n");
    mkdirSync(join(w.home, ".claude", "plugins", "cache", "market", "linky"), { recursive: true });
    symlinkSync(real, join(w.home, ".claude", "plugins", "cache", "market", "linky", "1.0.0"));
    assert.equal((await date(w)).decision, "allow");
    writeFileSync(skill, "---\nname: theme-factory\nhooks:\n  PreToolUse: []\n---\n");
    assert.deepEqual(await date(w), CHANGED, "a SKILL.md through a linked version, changed in place");
    writeFileSync(skill, "---\nname: theme-factory\n---\n");
    assert.equal((await date(w)).decision, "allow");
    // The app's copy, reached through a link to a folder elsewhere with its version's name.
    const elsewhere = join(w.dir, "elsewhere app", "2.1.308");
    const exe = appCopy(w.home);
    const below = exe.slice(join(w.home, "Library", "Application Support", "Claude", "claude-code", "2.1.308").length + 1);
    mkdirSync(dirname(join(elsewhere, below)), { recursive: true });
    writeFileSync(join(elsewhere, below), "");
    mkdirSync(join(w.home, "Library", "Application Support", "Claude", "claude-code"), { recursive: true });
    symlinkSync(elsewhere, join(w.home, "Library", "Application Support", "Claude", "claude-code", "2.1.308"));
    assert.deepEqual(await date(w), CHANGED, "the app's copy through a link");
    w.done();
  });
  it("ignores a cache another call is writing, or one that is not JSON", async () => {
    const w = chat();
    const cache = join(w.home, "Library", "Application Support", "BRIMM Video", "lock-cache.json");
    assert.equal((await date(w)).decision, "allow");
    for (const text of ["{not json", '{"signature":', "[]", JSON.stringify({ signature: 1, lines: "x", at: "y" })]) {
      writeFileSync(cache, text);
      assert.equal((await date(w)).decision, "allow", text);
      JSON.parse(readFileSync(cache, "utf8"));
    }
    writeFileSync(`${cache}.4242.abcdef.tmp`, '{"half');
    assert.equal((await date(w)).decision, "allow");
    writeFileSync(join(w.folder, ".claude", "settings.local.json"), "{}");
    writeFileSync(cache, "{not json");
    assert.deepEqual(await date(w), CHANGED);
    w.done();
  });
});
