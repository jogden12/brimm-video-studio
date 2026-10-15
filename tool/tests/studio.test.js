// Sallie's folder for Claude, ~/BRIMM Video Studio (studio.js): its CLAUDE.md, its settings, its skill and Pictures/, and the
// guard hook that lets her session run brimm-video's edit.js and nothing else. Each test writes into a home folder of its own.
// The hook is run here as Claude Code runs it, by /bin/sh and node, on made-up tool calls: nothing it allows is run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { studioFiles, writeStudio, guardDecision, studioFolder } from "../studio.js";
import { COMMAND_NAMES } from "../edit.js";

const CHECKOUT = "/Users/sallie/Claude Code/BRIMM video";
const FOLDER = "/Users/sallie/BRIMM Video Studio";
const NODE = "/opt/homebrew/bin/node";
const EDIT = `${NODE} "${CHECKOUT}/tool/edit.js"`;
const bash = (command) => guardDecision({ tool_name: "Bash", tool_input: { command } }, { checkout: CHECKOUT, node: NODE }).decision;
const tool = (tool_name) => guardDecision({ tool_name, tool_input: {} }, { checkout: CHECKOUT, node: NODE }).decision;
/** The guard as Claude Code runs it, in exec form: /bin/sh, the guard's own script in this checkout, and a node. */
const GUARD = join(dirname(fileURLToPath(import.meta.url)), "..", "studio", "guard.sh");
const THIS_CHECKOUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const hook = (input, node = process.execPath, folder = "/Users/sallie/BRIMM Video Studio") => spawnSync("/bin/sh", [GUARD, node, folder], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8" });

describe("her folder's settings", () => {
  it("allow only edit.js, deny the editing and web tools, and lock the mode, with no read block", () => {
    // Claude Code's read block (blockReadsOutsideWorkingDirectories) takes edit.js's own path for a read outside the folder,
    // and stops every call of it (the review of PR 21, finding 1): the guard decides reads itself.
    const s = JSON.parse(studioFiles({ checkout: CHECKOUT, node: NODE, folder: FOLDER })[".claude/settings.json"]);
    assert.deepEqual(s.permissions, {
      defaultMode: "dontAsk",
      allow: [`Bash(${EDIT} *)`],
      deny: ["Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "mcp__*", "Monitor", "RemoteTrigger", "SendMessage"],
      disableBypassPermissionsMode: "disable",
      disableAutoMode: "disable"
    });
  });
  it("guard every tool with the hook, run without a shell so the paths' spaces and apostrophes stay whole, and block a call when the hook cannot run", () => {
    const s = JSON.parse(studioFiles({ checkout: "/Users/o'hara/Claude Code/BRIMM video", node: NODE, folder: "/Users/o'hara/BRIMM Video Studio" })[".claude/settings.json"]);
    assert.deepEqual(s.hooks, {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "/bin/sh", args: ["/Users/o'hara/Claude Code/BRIMM video/tool/studio/guard.sh", NODE, "/Users/o'hara/BRIMM Video Studio"], onFailure: "block" }] }]
    });
  });
  it("name the checkout in the skill, with its spaces, and leave no {{ }} behind", () => {
    const files = studioFiles({ checkout: CHECKOUT, node: NODE });
    assert.deepEqual(Object.keys(files).sort(), [".claude/settings.json", ".claude/skills/brimm-edit/SKILL.md", "CLAUDE.md"]);
    assert.ok(files[".claude/skills/brimm-edit/SKILL.md"].includes(EDIT));
    for (const text of Object.values(files)) assert.ok(!text.includes("{{"), text);
  });
  it("have the skill run only commands edit.js has, and say the ones it has not yet are not ready", () => {
    const skill = studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/skills/brimm-edit/SKILL.md"];
    // Every backticked span that starts with a lowercase word is a command line; its first word must be a command. Flags
    // start with - and are not checked.
    const given = [...skill.matchAll(/`([a-z][^`]*)`/g)].map((m) => m[1]);
    assert.ok(given.length >= 10, given.join(" "));
    for (const span of given) assert.ok(COMMAND_NAMES.includes(span.split(" ")[0]), `the skill runs "${span}", which edit.js does not have`);
    assert.match(skill, /^---\nname: brimm-edit\ndescription: [^\n]+\n---\n/);
    assert.ok(skill.split("\n").length < 160, "the skill is short");
  });
});

describe("the guard", () => {
  it("lets edit.js run with plain or double-quoted words", () => {
    for (const c of [`${EDIT} episodes`, `${EDIT} open "Pricing talk"`, `node "${CHECKOUT}/tool/edit.js" open "Talk (Sallie's laptop)"`, `${EDIT} title "Pricing talk" --words "Price it right" --approve`, `${EDIT} finish "Pricing talk" --take "main=this Mac"`])
      assert.equal(bash(c), "allow", c);
  });
  it("refuses anything else, and edit.js with anything that could run more", () => {
    for (const c of ["date", "cat /etc/hosts", `ls "${CHECKOUT}"`, `${NODE} -e "1"`, `${NODE} "${CHECKOUT}/tool/unedited.js" --from-plan x`,
      `${NODE} "/other/tool/edit.js" open x`, `${NODE} "${CHECKOUT}/tool/edit.jsx" open x`, `/usr/local/bin/node "${CHECKOUT}/tool/edit.js" episodes`,
      `${EDIT} open x; cat /etc/hosts`, `${EDIT} open x && date`, `${EDIT} open x | sh`, `${EDIT} open x &`,
      `${EDIT} open $(date)`, `${EDIT} open "$(cat ~/.ssh/id_ed25519)"`, `${EDIT} open "\`date\`"`, `${EDIT} open '"' ; date ; '"'`, `${EDIT} open "a\\" ; date ; \\""`, `${EDIT} open "a\\b"`, `${EDIT} open "x\\" "; date; " "y"`,
      `${EDIT} open x > /tmp/y`, `${EDIT} open < /etc/hosts`,
      // The same, glued to a word (the review of PR 21, finding 15).
      `${EDIT} episodes|sh`, `${EDIT} episodes||date`, `${EDIT} episodes&&date`, `${EDIT} episodes&`, `${EDIT} open x>/tmp/y`, `${EDIT} open x<y`,
      `${EDIT} open x$(date)`, `${EDIT} open x\`date\``, `${EDIT} open x(y)`, `${EDIT} open x{a,b}`, `${EDIT} open x*`, `${EDIT} open x?`, `${EDIT} open =date`, `${EDIT} open x;date`, `${EDIT} open ~/x`, `${EDIT} open *`, `${EDIT} open "a\nb"`, `${EDIT} open x\ndate`, ` ${EDIT} episodes`, `${EDIT}  episodes`, `${EDIT} episodes `, ""])
      assert.equal(bash(c), "deny", JSON.stringify(c));
    assert.equal(guardDecision({ tool_name: "Bash", tool_input: {} }, { checkout: CHECKOUT, node: NODE }).decision, "deny");
  });
  it("leaves reads and Claude's own bookkeeping to Claude Code's own rules, and refuses every other tool, with a reason in plain words", () => {
    for (const t of ["TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch", "AskUserQuestion"]) assert.equal(tool(t), "pass", t);
    for (const t of ["Glob", "Grep", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "Monitor", "Artifact", "Workflow", "RemoteTrigger", "SendMessage", "Agent", "LSP",
      "mcp__gmail__send_message", "mcp__terminal__run_in_terminal", "mcp__ccd_directory__change_directory", "mcp__computer-use__app_click", "SomethingNew", undefined]) assert.equal(tool(t), "deny", t);
    assert.equal(guardDecision({ tool_name: "Write", tool_input: {} }, { checkout: CHECKOUT, node: NODE }).reason, "In this folder Claude runs only brimm-video's own commands. Ask Jason for anything else.");
  });
});

describe("the guard and paths that hold a regular expression's own characters", () => {
  it("matches the checkout and node letter for letter", () => {
    const checkout = "/Users/o.hara/Claude Code/BRIMM video (1)+";
    const node = "/Users/o.hara/.nvm/versions/node/v22.11.0/bin/node";
    const decide = (command) => guardDecision({ tool_name: "Bash", tool_input: { command } }, { checkout, node }).decision;
    assert.equal(decide(`${node} "${checkout}/tool/edit.js" episodes`), "allow");
    assert.equal(decide(`node "${checkout}/tool/edit.js" episodes`), "allow");
    for (const c of [`node "/Users/oXhara/Claude Code/BRIMM video (1)+/tool/edit.js" episodes`, `node "/Users/o.hara/Claude Code/BRIMM video 1/tool/edit.js" episodes`,
      `node "${checkout}/tool/editXjs" episodes`, `/Users/oXhara/.nvm/versions/node/v22X11X0/bin/node "${checkout}/tool/edit.js" episodes`])
      assert.equal(decide(c), "deny", c);
  });
});

describe("the guard and reading", () => {
  /** Her folder, a file outside it, a link in Pictures to that file, and a session's own folder of tool results, in a
      folder of the test's own. */
  const place = () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-guard-read-")));
    const folder = join(dir, "BRIMM Video Studio");
    mkdirSync(join(folder, "Pictures"), { recursive: true });
    writeFileSync(join(folder, "CLAUDE.md"), "hers");
    writeFileSync(join(dir, "outside.txt"), "not hers");
    symlinkSync(join(dir, "outside.txt"), join(folder, "Pictures", "link.png"));
    const transcript = join(dir, "projects", "her-folder", "abc123.jsonl");
    mkdirSync(join(dir, "projects", "her-folder", "abc123", "tool-results"), { recursive: true });
    writeFileSync(join(dir, "projects", "her-folder", "abc123", "tool-results", "out.txt"), "a long answer");
    // Where Claude Code writes what a command run in the background prints: <its temp folder>/claude-<uid>/<the transcript's
    // folder>/<session>/tasks/.
    const tmp = join(dir, "tmp");
    const tasks = join(tmp, `claude-${process.getuid()}`, "her-folder", "abc123", "tasks");
    mkdirSync(tasks, { recursive: true });
    writeFileSync(join(tasks, "b1.output"), "Sallie's laptop has it open. Say \"take it over\".");
    mkdirSync(join(tmp, `claude-${process.getuid()}`, "her-folder", "other", "tasks"), { recursive: true });
    writeFileSync(join(tmp, `claude-${process.getuid()}`, "her-folder", "other", "tasks", "b2.output"), "another session's");
    const read = (file_path, more = {}) => guardDecision({ tool_name: "Read", tool_input: { file_path }, cwd: folder, transcript_path: transcript, session_id: "abc123", ...more }, { checkout: CHECKOUT, node: NODE, folder, tmp }).decision;
    return { dir, folder, tasks, tmp, read, done: () => rmSync(dir, { recursive: true, force: true }) };
  };
  it("leaves a read inside her folder, or of the session's own saved tool results, to Claude Code", () => {
    const p = place();
    for (const path of ["CLAUDE.md", join(p.folder, "CLAUDE.md"), "Pictures/new.png", join(p.folder, "Pictures", "not there yet.png"), join(p.dir, "projects", "her-folder", "abc123", "tool-results", "out.txt")]) assert.equal(p.read(path), "pass", path);
    p.done();
  });
  it("refuses a read anywhere else: outside, by .., by ~, by a link, another session's results, or with no path", () => {
    const p = place();
    for (const path of ["/etc/hosts", join(p.dir, "outside.txt"), "../outside.txt", join(p.folder, "..", "outside.txt"), "~/.ssh/id_ed25519", "~", "Pictures/link.png", join(p.dir, "missing", "file.txt"), join(p.dir, "projects", "her-folder", "other", "tool-results", "out.txt"), join(p.dir, "projects", "her-folder", "abc123", "x.jsonl"), CHECKOUT + "/tool/edit.js"])
      assert.equal(p.read(path), "deny", path);
    assert.equal(p.read(undefined), "deny");
    assert.equal(p.read(join(p.dir, "projects", "her-folder", "abc123", "tool-results", "out.txt"), { session_id: undefined }), "deny");
    assert.equal(guardDecision({ tool_name: "Read", tool_input: { file_path: "CLAUDE.md" }, cwd: p.folder }, { checkout: CHECKOUT, node: NODE }).decision, "deny");
    p.done();
  });
  it("leaves a read of what a command run in the background printed, in this session's own tasks folder, to Claude Code", () => {
    const p = place();
    assert.equal(p.read(join(p.tasks, "b1.output")), "pass");
    for (const path of [join(p.tmp, `claude-${process.getuid()}`, "her-folder", "other", "tasks", "b2.output"), join(p.tasks, "..", "x.txt"), join(p.tmp, "elsewhere.txt")]) assert.equal(p.read(path), "deny", path);
    assert.equal(p.read(join(p.tasks, "b1.output"), { session_id: undefined }), "deny");
    p.done();
  });
  it("refuses a link in her folder whose target cannot be found, to a file or through a folder", () => {
    const p = place();
    symlinkSync(join(p.dir, "outside", "later.txt"), join(p.folder, "Pictures", "dangle.txt"));
    symlinkSync("/Volumes/Not Mounted/folder", join(p.folder, "Pictures", "drive-folder"));
    for (const path of ["Pictures/dangle.txt", join(p.folder, "Pictures", "drive-folder", "pic.png"), "Pictures/drive-folder"]) assert.equal(p.read(path), "deny", path);
    // A file not there yet, in a real folder of hers, still reaches Claude Code, which says it is not there.
    assert.equal(p.read("Pictures/not there yet.png"), "pass");
    p.done();
  });
  it("expands ~ to the home folder", () => {
    const p = place();
    const home = homedir();
    assert.equal(guardDecision({ tool_name: "Read", tool_input: { file_path: "~/notes.txt" }, cwd: home }, { checkout: CHECKOUT, node: NODE, folder: home }).decision, "pass");
    p.done();
  });
});

describe("the guard and her skill", () => {
  it("allows her skill and refuses any other", () => {
    const skill = (name) => guardDecision({ tool_name: "Skill", tool_input: { skill: name } }, { checkout: CHECKOUT, node: NODE }).decision;
    assert.equal(skill("brimm-edit"), "allow");
    for (const other of ["something-else", "brimm-edit-2", "", undefined]) assert.equal(skill(other), "deny", other);
  });
});

describe("the guard, run as Claude Code runs the hook", () => {
  const decision = (r) => JSON.parse(r.stdout).hookSpecificOutput;
  it("answers allow and deny as a PreToolUse decision, and ends with 0", () => {
    const allowed = hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: `${process.execPath} "${THIS_CHECKOUT}/tool/edit.js" episodes` } });
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.deepEqual({ ...decision(allowed), permissionDecisionReason: "" }, { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "" });
    const refused = hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "date" } });
    assert.equal(refused.status, 0, refused.stderr);
    assert.deepEqual(decision(refused), { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "In this folder Claude runs only brimm-video's own commands. Ask Jason for anything else." });
  });
  it("says nothing of a read inside her folder, so Claude Code's own rules decide, and refuses one outside it", () => {
    const folder = realpathSync(mkdtempSync(join(tmpdir(), "brimm-guard-hook-")));
    writeFileSync(join(folder, "CLAUDE.md"), "hers");
    const inside = hook({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: join(folder, "CLAUDE.md") }, cwd: folder }, process.execPath, folder);
    assert.deepEqual([inside.status, inside.stdout], [0, ""]);
    const outside = hook({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "/etc/hosts" }, cwd: folder }, process.execPath, folder);
    assert.equal(outside.status, 0);
    assert.equal(decision(outside).permissionDecision, "deny");
    rmSync(folder, { recursive: true, force: true });
  });
  it("refuses what it cannot read", () => {
    const r = hook("not JSON");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(decision(r).permissionDecision, "deny");
  });
  it("blocks the call, with exit 2, when its node cannot run", () => {
    const r = hook({ tool_name: "Bash", tool_input: { command: "date" } }, "/no/such/node");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /brimm-video's guard could not check this\. Ask Jason\./);
  });
  it("can be run by /bin/sh from the checkout as it is committed", () => {
    assert.ok(statSync(GUARD).mode & 0o100, "guard.sh can be run");
  });
});

describe("writing her folder, when it is there already in another case", () => {
  it("gives the hook the folder as the disk spells it, which is the folder Claude Code runs in", (ctx) => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "brimm-studio-case-")));
    mkdirSync(join(home, "BRIMM video studio"));
    // On a disk that tells case apart, as Linux's, there is no other spelling to take.
    if (!existsSync(join(home, "BRIMM Video Studio"))) {
      rmSync(home, { recursive: true, force: true });
      return ctx.skip("this disk tells case apart");
    }
    const folder = writeStudio(home, { checkout: CHECKOUT, node: NODE });
    assert.equal(folder, join(home, "BRIMM video studio"));
    const s = JSON.parse(readFileSync(join(folder, ".claude", "settings.json"), "utf8"));
    assert.equal(s.hooks.PreToolUse[0].hooks[0].args[2], join(home, "BRIMM video studio"));
    rmSync(home, { recursive: true, force: true });
  });
});

describe("writing her folder", () => {
  it("writes the three files and Pictures, and keeps whatever else is there", () => {
    const home = mkdtempSync(join(tmpdir(), "brimm-studio-"));
    const folder = studioFolder(home);
    assert.equal(folder, join(home, "BRIMM Video Studio"));
    mkdirSync(join(folder, "Pictures"), { recursive: true });
    writeFileSync(join(folder, "Pictures", "chart.png"), "x");
    writeFileSync(join(folder, "notes.txt"), "hers");
    assert.equal(writeStudio(home, { checkout: CHECKOUT, node: NODE }), realpathSync(folder));
    for (const f of ["CLAUDE.md", ".claude/settings.json", ".claude/skills/brimm-edit/SKILL.md", "Pictures/chart.png", "notes.txt"]) assert.ok(existsSync(join(folder, f)), f);
    const files = studioFiles({ checkout: CHECKOUT, node: NODE, folder: realpathSync(folder) });
    for (const [name, text] of Object.entries(files)) assert.equal(readFileSync(join(folder, name), "utf8"), text, name);
    assert.equal(readFileSync(join(folder, "notes.txt"), "utf8"), "hers");
    // Written again, as a later install does, it is the same.
    writeStudio(home, { checkout: CHECKOUT, node: NODE });
    assert.equal(readFileSync(join(folder, "Pictures", "chart.png"), "utf8"), "x");
    rmSync(home, { recursive: true, force: true });
  });
  it("tells Claude in its CLAUDE.md to use the skill, run nothing else, and speak plainly", () => {
    const text = studioFiles({ checkout: CHECKOUT, node: NODE })["CLAUDE.md"];
    for (const line of ["Use the brimm-edit skill for everything here.", "do not run any other program", "Nothing here posts, sends or publishes anything.", "Never show her command names, paths or flags."]) assert.ok(text.includes(line), line);
  });
});
