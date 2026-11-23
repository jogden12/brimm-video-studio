// What the Reel Kit worker may do (spec 2026-11-23 Reel Kit in Studio, section 4; plan Task 10, Decision 4).
//
// The worker is Studio's first headless Claude Code run with tools, so it is held three ways, each on its own (gotchas, "Claude Code's
// sandbox is not a secret store: test each layer"): the permission lists it is started with (`--allowedTools`, `--disallowedTools`, and
// the same lists in its settings file), the mode that refuses anything not on them without asking (`dontAsk`), and a PreToolUse hook,
// tool/reel-kit/worker-guard.mjs, that answers every call by `workerDecision`. The lists and the hook's table both come from WORKER_TOOLS,
// so they cannot drift; the hook is the stricter of the two, as it judges every path by its real path. It never says "allow": a call it
// lets pass is still the lists' to allow, so both must say yes.
//
// What it allows, and nothing else:
//   - Read, Glob and Grep inside the project folder and the kit (KIT, read only); Write and Edit inside the project, but never Studio's own
//     files there (studio.json, the notes for the app's agent, any .claude folder). Every path is judged by its real path: a link inside the
//     project that leads out is refused, a dangling one too, and a path with `..` in it is refused whole, as the system follows a link
//     before it climbs.
//   - Bash for one program and its words, nothing a shell would act on (no `;`, `&&`, `||`, `|`, backticks, `$`, redirects, a trailing `&`,
//     new lines, globs, `~`, single quotes, an assignment before the program): Reel Kit's Python with one of its pipeline scripts and the
//     project first; Studio's ffmpeg and ffprobe in Reel Kit's tools/bin; the pinned HyperFrames' check, lint and snapshot, through that
//     folder's npx, run in the project's public/ or a card's or effect's folder, and its render only for a card, in the card's folder and
//     into it (Studio renders the video itself); `/bin/cp` (or `-R`) of one source from the kit, the project or REEL_KIT_HOME's vendor,
//     style, fx or cards, into the project, as Reel Kit's card brief starts a card; and `cd` into those folders. Each word that names a
//     file must be inside the project (ffprobe may read the kit too).
//   - Agent, for Reel Kit's card and FX builders only: a `general-purpose` agent in the same folder, in the foreground (said outright:
//     `run_in_background: false`), on the worker's own model, whose calls come through this same hook.
// Pure but for looking at the disk (real paths, whether a folder is there).
import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { PIN } from "./reel-kit.js";
import { CLAUDE_MODEL } from "./unedited.js";

/** The model of the worker and of its card and FX helpers: Studio's pinned model. */
export const WORKER_MODEL = CLAUDE_MODEL;

/** The pipeline scripts the worker may run, by name. Never trials (posting), effect (another video's effect, from a link) or render (Studio
    renders, after her go: Task 14). */
export const WORKER_SCRIPTS = Object.freeze(["words", "cut", "storyboard", "build", "mix", "cutout", "matte", "plate", "plate_finish", "track", "depth", "fxclip", "fxsandbox", "fxlib"]);
/** What the worker may ask of the pinned HyperFrames anywhere it may run it. Its render is a card's alone (cardRender); never publish or
    anything of the cloud. */
export const HF_COMMANDS = Object.freeze(["check", "lint", "snapshot"]);
/** The copy program, by its whole path: one source, one destination, `-R` or no flag. */
const CP = "/bin/cp";
/** REEL_KIT_HOME's folders a copy may come from: GSAP, the style, her own effects and cards. */
const COPY_HOME = Object.freeze(["vendor", "style", "fx", "cards"]);
/** What the refusal of an agent not in the foreground says. */
export const FOREGROUND = "Studio's Reel Kit worker runs its helper agents in the foreground only: pass run_in_background: false.";
/** The words Reel Kit's npx is asked for (its common.py), which the npx in tools/bin serves alone. */
const HF_WORDS = ["-y", `hyperframes@${PIN.hyperframes.version}`];

/** The tools the worker is never given, by name, as Claude Code's --disallowedTools takes them. */
export const NEVER_TOOLS = Object.freeze(["WebFetch", "WebSearch", "Artifact", "ArtifactComments", "ArtifactData", "mcp__*", "Skill", "NotebookEdit", "Monitor",
  "SendMessage", "RemoteTrigger", "CronCreate", "CronDelete", "CronList", "Workflow"]);

/** What the hook says to any call it refuses. */
export const REFUSED = "Studio's Reel Kit worker does not do that: only what tool/reel-kit/WORKER.md lists, inside this project.";

const q = (path) => `"${path}"`;

/** Every program the worker may run, by the exact spelling its command starts with. */
function programsOf({ kit, rkHome, bin }) {
  return {
    python: join(rkHome, ".venv", "bin", "python"),
    script: (name) => join(kit, "pipeline", `${name}.py`),
    ffmpeg: join(bin, "ffmpeg"),
    ffprobe: join(bin, "ffprobe"),
    npx: join(bin, "npx")
  };
}

/** The worker's tools for the project `project`, the kit `kit`, REEL_KIT_HOME `rkHome` and its tools/bin `bin`: `allowed` and `disallowed`,
    Claude Code's permission rules as --allowedTools and --disallowedTools take them (and as the settings file's allow and deny lists hold
    them), and `programs`, the exact spellings the hook's table checks a command against. One table for both: the hook (workerDecision) is
    built on this, never beside it. Glob and Grep are under the Read rules, as Claude Code judges them. */
export function WORKER_TOOLS({ project, kit, rkHome, bin }) {
  for (const [name, path] of Object.entries({ project, kit, rkHome, bin })) {
    if (typeof path !== "string" || !isAbsolute(path)) throw new Error(`WORKER_TOOLS: ${name} must be a whole path`);
  }
  const p = programsOf({ kit, rkHome, bin });
  const both = (command) => [`Bash(${command})`, `Bash(${command} *)`];
  const allowed = [
    `Read(/${project}/**)`, `Read(/${kit}/**)`, `Edit(/${project}/**)`, `Write(/${project}/**)`,
    ...WORKER_SCRIPTS.flatMap((name) => both(`${q(p.python)} ${q(p.script(name))} ${q(project)}`)),
    ...both(q(p.ffmpeg)), ...both(q(p.ffprobe)),
    ...HF_COMMANDS.flatMap((command) => both(`${q(p.npx)} ${HF_WORDS.join(" ")} ${command}`)),
    `Bash(${q(p.npx)} ${HF_WORDS.join(" ")} render *)`, `Bash(${CP} *)`,
    `Bash(cd ${q(project)})`, `Bash(cd ${q(join(project, "public"))})`, `Bash(cd ${q(`${project}/cards/*`)})`, `Bash(cd ${q(`${project}/fx/*`)})`,
    "Agent(general-purpose)"
  ];
  return { allowed, disallowed: [...NEVER_TOOLS], programs: p };
}

// --- Paths ---

/** The real path of `path`, a whole path: its nearest folder that is there, with every link followed, and the rest of it after that as it is.
    null for a path that is not whole, has `..` in it, or meets a dangling link or a file where a folder should be. */
export function realOf(path) {
  if (typeof path !== "string" || !isAbsolute(path) || path.split("/").includes("..") || path.includes("\0")) return null;
  let at = resolve(path);
  const rest = [];
  for (;;) {
    try {
      const real = realpathSync.native(at);
      return rest.length ? join(real, ...rest.reverse()) : real;
    } catch (e) {
      if (e.code !== "ENOENT") return null;
      try {
        lstatSync(at);
        return null; // there, but not to be followed: a dangling link
      } catch {
        // not there: look at its folder
      }
      const up = dirname(at);
      if (up === at) return null;
      rest.push(basename(at));
      at = up;
    }
  }
}

/** Whether the real path `real` is `root` or inside it. */
const within = (root, real) => root !== null && real !== null && (real === root || real.startsWith(`${root}${sep}`));
/** Whether the real path `real` is inside `root`, not `root` itself. */
const below = (root, real) => root !== null && real !== null && real.startsWith(`${root}${sep}`);

/** Whether a path inside the project (real) is one of Studio's own there, which the worker never writes: studio.json and the files Studio
    writes it through, the notes for the app's agent (CLAUDE.md, AGENTS.md), and any .claude folder. By name in any case, as the Mac's disk
    takes a name in any case. */
function studioOwn(projectReal, real) {
  const parts = relative(projectReal, real).split(sep).map((part) => part.normalize("NFC").toLowerCase());
  if (parts[0] === "studio.json" || parts[0].startsWith(".studio.json")) return true;
  if (parts.includes(".claude")) return true;
  return ["claude.md", "claude.local.md", "agents.md"].includes(parts.at(-1));
}

/** The roots a decision is made against, by their real paths. */
function rootsOf(ctx) {
  const project = realOf(ctx.project);
  const kit = realOf(ctx.kit);
  const home = COPY_HOME.map((name) => realOf(join(String(ctx.rkHome), name)));
  return { project, kit, public: project && join(project, "public"), cards: project && join(project, "cards"), fx: project && join(project, "fx"), copyFrom: [kit, project, ...home] };
}

/** A glob pattern that stays where it is looked in: not whole, no `~`, no `..`. */
const tamePattern = (pattern) => typeof pattern === "string" && pattern !== "" && !pattern.startsWith("/") && !pattern.startsWith("~") && !pattern.split("/").includes("..") && !pattern.includes("\0");

// --- Bash ---

/** A word a shell takes as it is, unquoted: no character it acts on. */
const BARE = /^[A-Za-z0-9_./:,+@%-][A-Za-z0-9_./:,=+@%-]*$/;
/** What is never inside a double-quoted word: what a shell acts on there, a quote, or a control character. */
const NOT_QUOTED = /["$`\\!\p{Cc}]/u;

/** The words of a command, `[{ text, quoted }]`, when it is one program and its words and nothing a shell would act on; null otherwise.
    A word is bare (only letters, digits and `_ . / : , = + @ % -`, not starting with `=`) or in double quotes with no `$`, backtick,
    backslash, `!` or control character inside; words are parted by single spaces. */
export function commandWords(command) {
  if (typeof command !== "string" || /[\p{Cc}]/u.test(command)) return null;
  const words = [];
  let i = 0;
  const s = command.trim();
  while (i < s.length) {
    if (s[i] === " ") {
      i++;
      continue;
    }
    if (s[i] === '"') {
      const end = s.indexOf('"', i + 1);
      if (end < 0) return null;
      const text = s.slice(i + 1, end);
      if (NOT_QUOTED.test(text)) return null;
      words.push({ text, quoted: true });
      i = end + 1;
      if (i < s.length && s[i] !== " ") return null;
      continue;
    }
    let end = i;
    while (end < s.length && s[end] !== " ") end++;
    const text = s.slice(i, end);
    if (!BARE.test(text)) return null;
    words.push({ text, quoted: false });
    i = end;
  }
  return words.length ? words : null;
}

/** Whether every word in `words` that could name a file names one inside `roots` (real paths), and none of Studio's own in the project:
    a word that is a whole path is taken whole, and any other in its pieces (split at `=`, `:` and `,`, as ffmpeg's options and filters hold
    paths), each piece not a flag taken as a path from `cwd` (real). A piece with `..` in it is refused whole. */
function wordsStayIn(words, cwd, roots, projectReal) {
  const fits = (real) => roots.some((root) => within(root, real)) && !(within(projectReal, real) && studioOwn(projectReal, real));
  for (const { text } of words) {
    // A whole path is taken whole (a folder's name may hold a comma), when it stays in.
    if (text.startsWith("/") && fits(realOf(text))) continue;
    for (const piece of text.split(/[=:,]/)) {
      if (piece === "" || piece.startsWith("-")) continue;
      if (piece.split("/").includes("..")) return false;
      if (!fits(realOf(isAbsolute(piece) ? piece : join(cwd, piece)))) return false;
    }
  }
  return true;
}

/** Whether `words[i]` is `text`, spelled as the lists spell it: quoted for a path, bare for any other word. */
const spelled = (word, text, quoted) => word !== undefined && word.text === text && word.quoted === quoted;

/** Whether a folder is one the worker may cd into or run HyperFrames in: public/, or a folder under cards/ or fx/ (and, for cd, the project). */
const hfFolder = (roots, real) => real !== null && (real === roots.public || below(roots.cards, real) || below(roots.fx, real));

/** Whether a real path is a folder that is there. */
const isFolder = (real) => {
  try {
    return real !== null && statSync(real).isDirectory();
  } catch {
    return false;
  }
};

/** The names a copy never brings into the project, anywhere in what it copies (a `-R` of a folder, or its contents when spelled with a
    trailing `/`): Studio's own files (studioOwn). */
const ownName = (name) => {
  const n = name.normalize("NFC").toLowerCase();
  return n === "studio.json" || n.startsWith(".studio.json") || n === ".claude" || ["claude.md", "claude.local.md", "agents.md"].includes(n);
};

/** Whether the folder at the real path `real`, and everything under it, holds no name ownName refuses: links are looked at, never followed
    (cp -R copies a link as a link). A tree of more than 20,000 entries is refused. */
function cleanTree(real) {
  let seen = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (++seen > 20000 || ownName(name)) return false;
      const path = join(dir, name);
      if (lstatSync(path).isDirectory() && !walk(path)) return false;
    }
    return true;
  };
  try {
    return !lstatSync(real).isDirectory() || walk(real);
  } catch {
    return false;
  }
}

/** The hook's answer to `/bin/cp [-R] <source> <destination>` run in `cwd` (real): one source, whose real path is in the kit, the project
    or REEL_KIT_HOME's vendor, style, fx or cards, one destination, whose real path (its nearest folder that is there) is in the project,
    no other flag, nothing of Studio's own where it lands or in what it copies. */
function copyAnswer(words, cwd, roots) {
  const recursive = words[1] !== undefined && !words[1].quoted && words[1].text === "-R";
  const paths = words.slice(recursive ? 2 : 1);
  if (paths.length !== 2 || paths.some((w) => w.text.startsWith("-") || w.text.split("/").includes(".."))) return false;
  const [from, to] = paths.map((w) => realOf(isAbsolute(w.text) ? w.text : join(cwd, w.text)));
  if (!roots.copyFrom.some((root) => within(root, from)) || !within(roots.project, to)) return false;
  const lands = isFolder(to) ? join(to, basename(from)) : to;
  if (studioOwn(roots.project, to) || studioOwn(roots.project, lands)) return false;
  return recursive ? cleanTree(from) : !ownName(basename(from));
}

/** The hook's answer to HyperFrames' render, with its words after `render`: a card's alone, run in a folder under the project's cards/, with
    one output (`-o` or `--output`) whose real path is inside that same card's folder, and nothing of the cloud. The video itself is
    Studio's to render (Task 14). */
function cardRender(args, cwd, roots) {
  if (!below(roots.cards, cwd)) return false;
  const card = join(roots.cards, relative(roots.cards, cwd).split(sep)[0]);
  const outputs = [];
  const others = [];
  for (let i = 0; i < args.length; i++) {
    const { text, quoted } = args[i];
    if (!quoted && (text === "-o" || text === "--output")) {
      if (args[i + 1] === undefined) return false;
      outputs.push(args[++i].text);
    } else if (!quoted && /^(?:-o|--output)=/.test(text)) outputs.push(text.slice(text.indexOf("=") + 1));
    else others.push(args[i]);
  }
  if (outputs.length !== 1 || outputs[0].split("/").includes("..")) return false;
  if (others.some((w) => /cloud|lambda|publish|upload|share/i.test(w.text))) return false;
  return below(card, realOf(isAbsolute(outputs[0]) ? outputs[0] : join(cwd, outputs[0]))) && wordsStayIn(others, cwd, [roots.project], roots.project);
}

/** The hook's answer to a Bash command run in `cwd`, by the table. */
function bashAnswer(command, cwd, ctx, roots) {
  const words = commandWords(command);
  if (!words) return false;
  const cwdReal = typeof cwd === "string" ? realOf(cwd) : null;
  if (!within(roots.project, cwdReal)) return false;
  const p = WORKER_TOOLS(ctx).programs;
  const [first] = words;
  if (spelled(first, "cd", false)) {
    if (words.length !== 2 || !words[1].quoted) return false;
    const to = realOf(words[1].text);
    return isFolder(to) && (to === roots.project || hfFolder(roots, to));
  }
  if (spelled(first, CP, false)) return copyAnswer(words, cwdReal, roots);
  if (!first.quoted) return false;
  if (first.text === p.python) {
    const script = words[1];
    const name = script && script.quoted ? WORKER_SCRIPTS.find((n) => p.script(n) === script.text) : undefined;
    return name !== undefined && spelled(words[2], ctx.project, true) && wordsStayIn(words.slice(3), cwdReal, [roots.project], roots.project);
  }
  if (first.text === p.ffmpeg) return wordsStayIn(words.slice(1), cwdReal, [roots.project], roots.project);
  if (first.text === p.ffprobe) return wordsStayIn(words.slice(1), cwdReal, [roots.project, roots.kit], roots.project);
  if (first.text === p.npx) {
    if (!spelled(words[1], HF_WORDS[0], false) || !spelled(words[2], HF_WORDS[1], false) || words[3] === undefined || words[3].quoted) return false;
    if (words[3].text === "render") return cardRender(words.slice(4), cwdReal, roots);
    return HF_COMMANDS.includes(words[3].text) && hfFolder(roots, cwdReal) && wordsStayIn(words.slice(4), cwdReal, [roots.project], roots.project);
  }
  return false;
}

// --- The decision ---

/** The keys each tool's input may hold: a key Claude Code adds later is refused until it is looked at. */
const KEYS = {
  Read: ["file_path", "offset", "limit", "pages", "allow_large"],
  Write: ["file_path", "content"],
  Edit: ["file_path", "old_string", "new_string", "replace_all"],
  Glob: ["pattern", "path"],
  Grep: ["pattern", "path", "glob", "output_mode", "-B", "-A", "-C", "context", "-n", "-i", "-o", "type", "head_limit", "offset", "multiline"],
  Bash: ["command", "description", "timeout", "run_in_background"],
  Agent: ["description", "prompt", "subagent_type", "run_in_background", "effort"]
};
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const onlyKeys = (tool, input) => Object.keys(input).every((key) => KEYS[tool].includes(key) && input[key] !== undefined);

/** Whether the call `input` (as Claude Code hands it to a PreToolUse hook: `tool_name`, `tool_input`, `cwd`, and for a helper agent's call
    its `agent_id` and `agent_type`, which change nothing) is one the table allows: true, false, or the reason a refusal says when it is
    not the usual one. */
function allows(input, ctx) {
  if (!isObject(input) || !isObject(input.tool_input)) return false;
  const tool = input.tool_name;
  const args = input.tool_input;
  if (!Object.hasOwn(KEYS, tool) || !onlyKeys(tool, args)) return false;
  const roots = rootsOf(ctx);
  if (roots.project === null || roots.kit === null) return false;
  switch (tool) {
    case "Read": {
      const real = realOf(args.file_path);
      return within(roots.project, real) || within(roots.kit, real);
    }
    case "Write":
    case "Edit": {
      const real = realOf(args.file_path);
      return within(roots.project, real) && !studioOwn(roots.project, real);
    }
    case "Glob":
    case "Grep": {
      const where = realOf(args.path ?? input.cwd);
      const patterns = tool === "Glob" ? [args.pattern] : args.glob === undefined ? [] : [args.glob];
      if (tool === "Grep" && typeof args.pattern !== "string") return false;
      return (within(roots.project, where) || within(roots.kit, where)) && patterns.every(tamePattern);
    }
    case "Bash":
      return typeof args.command === "string" && (args.run_in_background === undefined || args.run_in_background === false)
        && bashAnswer(args.command, input.cwd, ctx, roots);
    case "Agent":
      if (args.subagent_type !== "general-purpose" || typeof args.prompt !== "string") return false;
      // Claude Code runs an agent given no run_in_background in the background: the foreground is said outright.
      return args.run_in_background === false ? true : FOREGROUND;
    default:
      return false;
  }
}

/** The hook's answer to a tool call: `{ decision: "pass" }` when the table allows it (the hook then says nothing, and the permission lists,
    which allow the same, decide), or `{ decision: "deny", reason }`. `ctx` is `{ project, kit, rkHome, bin }`, as WORKER_TOOLS takes it.
    Anything it cannot judge is refused. */
export function workerDecision(input, ctx) {
  try {
    const said = allows(input, ctx);
    return said === true ? { decision: "pass", reason: "" } : { decision: "deny", reason: typeof said === "string" ? said : REFUSED };
  } catch {
    return { decision: "deny", reason: REFUSED };
  }
}

// --- How claude is started ---

/** The worker's settings file, as Studio writes it outside the project (reel-kit-worker.js settingsFileOf), where the worker cannot rewrite
    it: the PreToolUse hook in exec form (no shell: each path one argument as it is), blocking the call when it cannot run (onFailure, as her
    folder's guard: studio.js settingsOf); the permission lists of WORKER_TOOLS in the mode that refuses anything not on them without asking;
    the bypass and auto modes off; Claude Code's /feedback and its transcript-share survey off; the helper agents on the worker's model;
    memory, dreams and skills' shell off; hooks said to be on. Only keys Claude Code knows: in `-p` a settings file that fails its check is
    passed over without a word, and the lists on the command line (workerArgs) still hold then. */
export function workerSettings({ checkout, node, project, kit, rkHome, bin }) {
  const { allowed, disallowed } = WORKER_TOOLS({ project, kit, rkHome, bin });
  return {
    permissions: { defaultMode: "dontAsk", allow: allowed, deny: disallowed, disableBypassPermissionsMode: "disable", disableAutoMode: "disable" },
    env: { DISABLE_FEEDBACK_COMMAND: "1", CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1", CLAUDE_CODE_SUBAGENT_MODEL: WORKER_MODEL },
    autoMemoryEnabled: false,
    autoDreamEnabled: false,
    disableSkillShellExecution: true,
    disableAllHooks: false,
    hooks: {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "/bin/sh", args: [join(checkout, "tool", "reel-kit", "worker-guard.sh"), node, project, kit, rkHome, bin], onFailure: "block" }] }]
    }
  };
}

/** What `claude` is run with for the worker (Decision 4): it prints and stops, on the worker's model, in the mode that refuses anything not
    allowed without asking, with no MCP server, no skill or slash command, no setting source but its own settings file (`--setting-sources ""`
    keeps out the user's, the project's and the local settings; `--settings` is loaded beside them, checked against `claude --help` 2.1.318),
    and its stream of events as JSON lines. `session` names a new session (`--session-id`, so it is known before the first event); `resume`
    carries on an earlier one (`--resume`). The permission lists last, each rule one argument of its own, so a path with a space in it is
    never split. The prompt goes in on standard input. */
export function workerArgs({ settingsFile, allowed, disallowed, session, resume }) {
  return [
    "-p", "--model", WORKER_MODEL, "--permission-mode", "dontAsk", "--strict-mcp-config", "--disable-slash-commands", "--setting-sources", "",
    "--settings", settingsFile, "--output-format", "stream-json", "--verbose",
    ...(resume ? ["--resume", resume] : session ? ["--session-id", session] : []),
    "--allowedTools", ...allowed, "--disallowedTools", ...disallowed
  ];
}
