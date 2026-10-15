// Sallie's folder for Claude, ~/BRIMM Video Studio, on this Mac's own disk: her sessions in the Claude app run there. It
// holds a CLAUDE.md, the folder's settings for Claude Code, the brimm-edit skill, and Pictures/ for her own pictures. The
// settings let her session run brimm-video's edit.js and nothing else: they deny the editing and web tools, lock the
// permission mode, and run a guard hook before every tool call, which also keeps reads inside the folder. The hook answers in
// every mode, which a mode alone does not: the Code tab may not honour dontAsk, and a mode picked there overrides the
// folder's default. Claude Code's own read block (blockReadsOutsideWorkingDirectories) is not used: it takes edit.js's path,
// outside the folder, for a read, and stops every brimm-video command (the review of PR 21, finding 1).
// `node settings.js studio --node "<node>"` writes the folder, as install.sh --machine does. The checkout's path and node's
// are written into the files here, in node, since a path may hold spaces and an apostrophe.
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

/** Her folder for Claude, in the home folder. */
export const studioFolder = (home) => join(home, "BRIMM Video Studio");

/** A template in tool/studio/, with the checkout's path and node's put in. */
const filled = (name, { checkout, node }) => readFileSync(new URL(`./studio/${name}`, import.meta.url), "utf8").split("{{CHECKOUT}}").join(checkout).split("{{NODE}}").join(node);

/** The folder's settings for Claude Code. The hook runs in exec form, with no shell, so each path is one argument as it is,
    and a hook that cannot run blocks the call (onFailure, Claude Code 2.1.295 or later) rather than letting it through. It
    is given her folder, which reads must stay in. */
function settingsOf({ checkout, node, folder }) {
  return {
    permissions: {
      defaultMode: "dontAsk",
      allow: [`Bash(${node} "${checkout}/tool/edit.js" *)`],
      deny: ["Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "mcp__*", "Monitor", "RemoteTrigger", "SendMessage"],
      disableBypassPermissionsMode: "disable",
      disableAutoMode: "disable"
    },
    hooks: {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "/bin/sh", args: [`${checkout}/tool/studio/guard.sh`, node, folder], onFailure: "block" }] }]
    }
  };
}

/** The files of her folder, `folder`, by their paths in it, each with its text: the checkout's path and node's put in. */
export function studioFiles({ checkout, node, folder }) {
  return {
    "CLAUDE.md": filled("CLAUDE.md", { checkout, node }),
    ".claude/settings.json": JSON.stringify(settingsOf({ checkout, node, folder }), null, 2) + "\n",
    ".claude/skills/brimm-edit/SKILL.md": filled("SKILL.md", { checkout, node })
  };
}

/** Write her folder in `home`: its three files, written over the ones there, and Pictures/. Nothing else in it is touched.
    It is on this Mac's own disk, so the files are written in place. The hook is given the folder as the disk spells it,
    which is the folder Claude Code runs in, even when it was made by hand in another case. Gives back the folder. */
export function writeStudio(home, { checkout, node }) {
  mkdirSync(studioFolder(home), { recursive: true });
  const folder = realpathSync.native(studioFolder(home));
  for (const [name, text] of Object.entries(studioFiles({ checkout, node, folder }))) {
    mkdirSync(dirname(join(folder, name)), { recursive: true });
    writeFileSync(join(folder, name), text);
  }
  mkdirSync(join(folder, "Pictures"), { recursive: true });
  return folder;
}

/** Why the guard refuses a tool call, as Claude says it to her. */
const REFUSED = "In this folder Claude runs only brimm-video's own commands. Ask Jason for anything else.";

/** The tools the guard leaves to Claude Code's own rules: Claude's own bookkeeping, its list of what it is doing, its
    questions to her, and ToolSearch, which only loads a tool that then meets this guard. Read is left to them only inside
    her folder (readable, below); Glob and Grep, which search, are refused. */
const LEFT_TO_CLAUDE_CODE = new Set(["TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch", "AskUserQuestion"]);

/** A path with its links followed, as far as it is there: a file not there yet is its folder's real path with its own name.
    null when something on the way is there but cannot be followed, as a link to a place not there, or a loop: where it
    leads cannot be known, and Claude Code would ask about it. */
function real(path) {
  try {
    return realpathSync(path);
  } catch (e) {
    if (lstatSync(path, { throwIfNoEntry: false })) return null;
    const parent = dirname(path);
    if (parent === path) return path;
    const above = real(parent);
    return above === null ? null : join(above, path.slice(parent.length).replace(/^\//, ""));
  }
}

/** Whether `path` is the folder `dir` or inside it, once both have their links followed. */
const within = (path, dir) => {
  const p = real(path);
  const d = real(dir);
  return p !== null && d !== null && (p === d || p.startsWith(d.endsWith(sep) ? d : d + sep));
};

/** Whether a Read is one her session may make: of a file in her folder; of a long answer Claude Code saved for this
    session, in its own tool-results folder beside the session's transcript; or of what a command this session ran in the
    background printed, in its own tasks folder, <Claude Code's temp folder>/claude-<uid>/<the transcript's folder>/
    <session>/tasks, as when edit.js asks a question from the background. A path is taken from the session's folder, with ~
    as the home folder, and with its links followed, so neither .. nor a link leads out. `tmp` is Claude Code's temp
    folder, which the hook is run with. */
function readable(input, folder, tmp, uid) {
  const given = input.tool_input && input.tool_input.file_path;
  if (typeof given !== "string" || !given || !folder) return false;
  const expanded = given === "~" || given.startsWith("~/") ? join(homedir(), given.slice(2)) : given;
  const path = resolve(input.cwd || folder, expanded);
  const session = typeof input.transcript_path === "string" && typeof input.session_id === "string" && input.session_id;
  const results = session ? join(dirname(input.transcript_path), input.session_id, "tool-results") : "";
  const tasks = session ? join(tmp, `claude-${uid}`, basename(dirname(input.transcript_path)), input.session_id, "tasks") : "";
  return within(path, folder) || Boolean(results && within(path, results)) || Boolean(tasks && within(path, tasks));
}

/** Her skill, the one the guard lets her session use. */
const SKILL = "brimm-edit";

/** A text as a regular expression matches it, letter for letter. */
const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One word after edit.js: a plain word of letters, digits and _ . , : + = @ % / - (not starting with =), or a word in double
    quotes holding no double quote, $, backtick, backslash or line break. Nothing in either can run anything else. */
const WORD = String.raw`(?:[A-Za-z0-9_.,:+@%/-][A-Za-z0-9_.,:+=@%/-]*|"[^"$` + "`" + String.raw`\\\r\n]*")`;

/** What the guard answers to a tool call Claude Code is about to make, `input` as the PreToolUse hook is given it:
    { decision, reason }. "allow" for brimm-video's edit.js run with node (the word node, or the node the installer found)
    from the checkout, followed only by words one space apart (WORD), and for her skill; "pass" for a tool left to Claude
    Code's own rules, which gives no answer, and for a read inside her folder, `folder`; and "deny" for everything else, any
    other read, any other skill and any tool added later among them. */
export function guardDecision(input, { checkout, node, folder = "", tmp = process.env.CLAUDE_CODE_TMPDIR || "/tmp", uid = process.getuid() }) {
  const name = input && input.tool_name;
  if (LEFT_TO_CLAUDE_CODE.has(name)) return { decision: "pass", reason: "" };
  if (name === "Read") return readable(input, folder, tmp, uid) ? { decision: "pass", reason: "" } : { decision: "deny", reason: REFUSED };
  if (name === "Skill" && input.tool_input && input.tool_input.skill === SKILL) return { decision: "allow", reason: "her skill" };
  if (name === "Bash") {
    const command = input.tool_input && input.tool_input.command;
    const edit = new RegExp(`^(?:node|${literally(node)}) "${literally(checkout)}/tool/edit\\.js"(?: ${WORD})*$`);
    if (typeof command === "string" && edit.test(command)) return { decision: "allow", reason: "brimm-video's own command" };
  }
  return { decision: "deny", reason: REFUSED };
}
