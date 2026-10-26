// Sallie's folder for Claude, ~/BRIMM Video Studio, on this Mac's own disk: her sessions in the Claude app run there. It
// holds a CLAUDE.md, the folder's settings for Claude Code, the brimm-edit skill, and Pictures/ for her own pictures. The
// settings let her session run brimm-video's edit.js and nothing else: they deny the editing and web tools, turn the Auto
// and Bypass modes off, and run a guard hook before every tool call, which also keeps reads inside the folder. The hook
// answers in every mode, which a mode alone does not: a mode picked in the Code tab overrides the folder's default. So the
// folder's mode is "default", not dontAsk: dontAsk denies AskUserQuestion, the card she answers what a video is on (spec
// 2026-10-22, section 7), and the guard refuses everything else in any mode. So the mode rests on the hook, and the
// settings say `disableAllHooks: false`, which keeps a "hooks off" in the settings they are shared with from turning it
// off. What a settings file in her folder, or the user's or the managed settings, can change of that is not for this file but for
// `behind` (edit.js, lockLoosened): it runs at every session start, and refuses to go on, saying to ask Jason, when the session
// does not run in her folder itself (Claude Code reads these settings only from the session's own folder, but her CLAUDE.md and
// skill from the folders above it too, so a session in Pictures/ looks like hers and has no lock), when her folder has
// a .claude/settings.local.json, when its own .claude/settings.json no longer holds the lock (lockBroken, here), or when the user
// settings or the managed settings turn hooks off. Claude Code's own read block (blockReadsOutsideWorkingDirectories) is not used: it takes
// edit.js's path, outside the folder, for a read, and stops every brimm-video command (the review of PR 21, finding 1).
// `node settings.js studio --node "<node>"` writes the folder, as install.sh --machine does. The checkout's path and node's
// are written into the files here, in node, since a path may hold spaces and an apostrophe.
//
// That is the strict lock, and it stays as it is. The open lock (design 2026-10-26, section 7) is the other shape her folder can be
// written in (openSettingsOf): Claude Code's sandbox on, with edit.js the one command outside it and no network; the never list
// (never.js) and the gated places (places.js) denied, by their real paths in both spellings; writes only into the workshop,
// ~/BRIMM Video Workshop; the app's secrets taken from sandboxed commands; Claude Code's memory off; and, beside the guard, a hook
// after every card she answers (the receipt). It is written only where this Mac's settings say open and OPEN_LOCK_CLAUDE is set
// (settings.js effectiveLock), so while that is null every Mac keeps the strict lock. What it rests on that the by-hand round
// records is data here (studio/allow.json, environment.json, app-flags.json), and starts so that the open lock fails closed.
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { neverDenyRules } from "./never.js";
import { bothSpellings, gatedPlaces, readAllowed, realOf } from "./places.js";

/** Her folder for Claude, in the home folder. */
export const studioFolder = (home) => join(home, "BRIMM Video Studio");
/** The workshop, in the home folder, on this Mac's own disk: the one folder Claude writes into under the open lock. */
export const workshopFolder = (home) => join(home, "BRIMM Video Workshop");

/** The Claude Code version the by-hand round in the Code tab passed the open lock on (R2). While it is null, the lock in effect is
    strict on every Mac whatever its settings say, and `settings.js studio --lock open` refuses. It is set, on Jason's yes, after
    that round. */
export const OPEN_LOCK_CLAUDE = null;

/** A data file in tool/studio/, as the object it holds. */
const data = (name) => JSON.parse(readFileSync(new URL(`./studio/${name}`, import.meta.url), "utf8"));
/** What her folder allows under the open lock on every Mac, each entry typed and exact (design section 2, "The allowlist is data");
    this Mac's settings may add to it (studioAllow). */
export const ALLOW_DEFAULT = data("allow.json");
/** The names in the Claude app's environment: `deny`, those taken from every sandboxed command (C27: the app's own, and the binary's
    own list of secrets), and `harmless`, those the guard lets be, which the by-hand round records. Names only, never values. */
export const ENVIRONMENT = data("environment.json");
/** The record of the flags the Claude app starts her chats with, which the by-hand round makes. Empty until then, so that every
    flag is outside it and every chat is loosened (R3). */
export const APP_FLAGS = data("app-flags.json");

/** A template in tool/studio/, with the checkout's path and node's put in. */
const filled = (name, { checkout, node }) => readFileSync(new URL(`./studio/${name}`, import.meta.url), "utf8").split("{{CHECKOUT}}").join(checkout).split("{{NODE}}").join(node);

/** The folder's settings for Claude Code. The hook runs in exec form, with no shell, so each path is one argument as it is,
    and a hook that cannot run blocks the call (onFailure, Claude Code 2.1.295 or later) rather than letting it through. It
    is given her folder, which reads must stay in. Hooks are said to be on (disableAllHooks false): the mode rests on it. */
function settingsOf({ checkout, node, folder }) {
  return {
    permissions: {
      defaultMode: "default",
      allow: [`Bash(${node} "${checkout}/tool/edit.js" *)`],
      deny: ["Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "mcp__*", "Monitor", "RemoteTrigger", "SendMessage"],
      disableBypassPermissionsMode: "disable",
      disableAutoMode: "disable"
    },
    disableAllHooks: false,
    hooks: {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "/bin/sh", args: [`${checkout}/tool/studio/guard.sh`, node, folder], onFailure: "block" }] }]
    }
  };
}

/** The folder's settings for Claude Code under the open lock, for the Mac `facts` describes (settings.js factsOf: its home,
    BRIMM Video, its uid, Claude Code's temp folder, Zoom's folder, the proxy port, the web tools and what it allows). Each path a
    rule names is a real path, in both spellings (places.js); `Read()` and `Edit()` rules spell an absolute path with `//`, the
    sandbox's own lists plainly. What it denies:
    - to Claude's own tools: the never list; Read of each gated place's read rules, and of a .env file in her folder (R20); Write
      and Edit in her folder, the checkout, BRIMM Video and every place only brimm-video writes, the app's data, LaunchAgents,
      ~/.claude and ~/.ssh, and of a CLAUDE.md, CLAUDE.local.md, .mcp.json or .claude anywhere in the workshop;
    - to sandboxed commands: reading any gated place but Assets and the three places Bash needs (readAllowed), writing anywhere
      but the workshop, the network (with both proxy ports set to one nothing listens on, so no proxy login is made: C38), and the
      app's secret names.
    It allows edit.js (outside the sandbox: its one excluded command), writes into the workshop, and the web tools only once this
    Mac's settings open them. No folder is added to the session. */
export function openSettingsOf({ checkout, node, folder, facts }) {
  const { home } = facts;
  const AS = join(home, "Library", "Application Support");
  const BV = realOf(facts.root);
  const W = realOf(workshopFolder(home));
  const places = gatedPlaces(facts);
  const both = (path) => bothSpellings(realOf(path));
  const read = (path, kind) => bothSpellings(path).map((p) => (kind === "file" ? `Read(/${p})` : `Read(/${p}/**)`));
  const edit = (path) => both(path).map((p) => `Edit(/${p}/**)`);
  const onlyBrimmVideo = [folder, checkout, BV, join(dirname(BV), "BRIMM VIDEO Transfer"), join(home, "BRIMM Video Work"), join(AS, "BRIMM Video"), join(AS, "BRIMM Video Words"), join(AS, "Claude"), join(home, "Library", "LaunchAgents"), join(home, ".claude"), join(home, ".ssh")];
  return {
    permissions: {
      defaultMode: "default",
      allow: [`Bash(${node} "${checkout}/tool/edit.js" *)`, `Edit(/${W}/**)`, ...(facts.web === "open" ? ["WebFetch", "WebSearch"] : [])],
      deny: [
        ...neverDenyRules(facts.allow),
        ...places.flatMap((place) => place.readRules.flatMap((rule) => read(rule, place.kind))),
        "Read(**/.env)",
        "Read(**/.env.*)",
        ...onlyBrimmVideo.flatMap(edit),
        ...bothSpellings(W).flatMap((w) => [".claude/**", "CLAUDE.md", "CLAUDE.local.md", ".mcp.json"].map((inner) => `Edit(/${w}/**/${inner})`))
      ],
      disableBypassPermissionsMode: "disable",
      disableAutoMode: "disable"
    },
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      excludedCommands: [`${node} "${checkout}/tool/edit.js" *`],
      network: { deniedDomains: ["*"], httpProxyPort: facts.port, socksProxyPort: facts.port },
      filesystem: {
        allowWrite: [W],
        denyWrite: [...both(folder), ...both(join(AS, "Claude"))],
        denyRead: places.flatMap((place) => bothSpellings(place.path)),
        allowRead: readAllowed({ ...facts, folder })
      },
      credentials: { envVars: ENVIRONMENT.deny.map((name) => ({ name, mode: "deny" })) }
    },
    autoMemoryEnabled: false,
    autoDreamEnabled: false,
    disableSkillShellExecution: true,
    disableAllHooks: false,
    hooks: {
      PreToolUse: settingsOf({ checkout, node, folder }).hooks.PreToolUse,
      PostToolUse: [{ matcher: "AskUserQuestion", hooks: [{ type: "command", command: "/bin/sh", args: [`${checkout}/tool/studio/receipt.sh`, node, folder] }] }]
    }
  };
}

/** What is no longer so in her folder's settings, `settings` (the object read from its .claude/settings.json), that the lock rests on.
    With the strict lock (`lock` "strict"), against what settingsOf writes for `checkout` and `folder`: "hooks" (disableAllHooks is
    true: absent, as main's studio.js wrote the folder, or false, it turns no hook off), "guard" (no entry with the guard
    hook: the matcher, the kind of hook, /bin/sh, the guard script of this checkout and the folder it is given, and onFailure "block";
    node, args[1], is not looked at), "bypass" and "auto" (disableBypassPermissionsMode, disableAutoMode not "disable"). [] when all
    hold. `behind` refuses on any of them (edit.js lockLoosened); every other difference from what is written is only "out of date".
    With the open lock, the whole of it is compared (openBroken, below). */
export function lockBroken(settings, { checkout, folder, lock = "strict", facts, node }) {
  if (lock === "open") return openBroken(settings, { checkout, folder, facts, node });
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const want = settingsOf({ checkout, node: "", folder });
  const entry = want.hooks.PreToolUse[0];
  const hook = entry.hooks[0];
  const broken = [];
  if (settings.disableAllHooks === true) broken.push("hooks");
  const entries = object(settings.hooks) && Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
  const guarded = entries.some((e) => object(e) && e.matcher === entry.matcher && Array.isArray(e.hooks)
    && e.hooks.some((h) => object(h) && h.type === hook.type && h.command === hook.command && h.onFailure === hook.onFailure && Array.isArray(h.args) && h.args[0] === hook.args[0] && h.args[2] === hook.args[2]));
  if (!guarded) broken.push("guard");
  const permissions = object(settings.permissions) ? settings.permissions : {};
  if (permissions.disableBypassPermissionsMode !== want.permissions.disableBypassPermissionsMode) broken.push("bypass");
  if (permissions.disableAutoMode !== want.permissions.disableAutoMode) broken.push("auto");
  return broken;
}

/** What is changed in her folder's settings under the open lock (R17): the whole of `settings` is compared, as an object, with what
    openSettingsOf writes for this checkout, her folder, this Mac's facts and `node`, the node this Mac's settings recorded her folder
    was written with (studioNode), never the node the file names. Any difference is changed, not out of date, and each part that
    differs is named: "hooks", "guard", "bypass" and "auto" as for the strict lock (the guard's entry compared whole, its node among
    it); "sandbox" (the sandbox's settings, whole); "permissions" (allow, deny, the modes and anything added, such as a folder);
    "memory" (autoMemoryEnabled or autoDreamEnabled not false); "skill-shell" (disableSkillShellExecution not true); "receipt" (no
    entry with the receipt hook after a card); "other-hooks" (a hook of any other event, such as SessionStart, or any hook beside the
    guard's and the receipt's); and "other" (any other key, such as env, statusLine, enabledPlugins or apiKeyHelper, or
    disableAllHooks not false). ["node"] alone when this Mac's settings name no node, so that nothing can be compared. */
function openBroken(settings, { checkout, folder, facts, node }) {
  if (!node) return ["node"];
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const s = object(settings) ? settings : {};
  const want = openSettingsOf({ checkout, node, folder, facts });
  const hooks = object(s.hooks) ? s.hooks : {};
  const entries = (event) => (Array.isArray(hooks[event]) ? hooks[event] : []);
  const holds = (event) => entries(event).some((entry) => isDeepStrictEqual(entry, want.hooks[event][0]));
  const count = (event) => entries(event).reduce((n, entry) => n + (object(entry) && Array.isArray(entry.hooks) ? entry.hooks.length : 1), 0);
  const permissions = object(s.permissions) ? s.permissions : {};
  const broken = [];
  if (s.disableAllHooks === true) broken.push("hooks");
  if (!holds("PreToolUse")) broken.push("guard");
  if (permissions.disableBypassPermissionsMode !== want.permissions.disableBypassPermissionsMode) broken.push("bypass");
  if (permissions.disableAutoMode !== want.permissions.disableAutoMode) broken.push("auto");
  if (!isDeepStrictEqual(s.sandbox, want.sandbox)) broken.push("sandbox");
  if (!isDeepStrictEqual(s.permissions, want.permissions)) broken.push("permissions");
  if (s.autoMemoryEnabled !== false || s.autoDreamEnabled !== false) broken.push("memory");
  if (s.disableSkillShellExecution !== true) broken.push("skill-shell");
  if (!holds("PostToolUse")) broken.push("receipt");
  // A hook of another event, or more than the one each, is another hook; and so is any other difference in the hooks that the
  // guard's and the receipt's do not already name.
  const otherEvent = Object.keys(hooks).some((event) => !Object.hasOwn(want.hooks, event));
  const unnamed = !isDeepStrictEqual(s.hooks, want.hooks) && !broken.includes("guard") && !broken.includes("receipt");
  if (otherEvent || count("PreToolUse") > 1 || count("PostToolUse") > 1 || unnamed) broken.push("other-hooks");
  if (Object.keys(s).some((key) => !Object.hasOwn(want, key)) || (s.disableAllHooks !== false && s.disableAllHooks !== true)) broken.push("other");
  return broken;
}

/** The files of her folder, `folder`, by their paths in it, each with its text: the checkout's path and node's put in. With the
    strict lock, today's; with the open lock, its settings (for the Mac `facts` describes) and its own CLAUDE.md. */
export function studioFiles({ checkout, node, folder, lock = "strict", facts }) {
  const open = lock === "open";
  return {
    "CLAUDE.md": filled(open ? "CLAUDE-open.md" : "CLAUDE.md", { checkout, node }),
    ".claude/settings.json": JSON.stringify(open ? openSettingsOf({ checkout, node, folder, facts }) : settingsOf({ checkout, node, folder }), null, 2) + "\n",
    ".claude/skills/brimm-edit/SKILL.md": filled("SKILL.md", { checkout, node })
  };
}

/** Write her folder in `home`: its three files, written over the ones there, and Pictures/. Nothing else in it is touched.
    It is on this Mac's own disk, so the files are written in place. The hook is given the folder as the disk spells it,
    which is the folder Claude Code runs in, even when it was made by hand in another case. With the open lock it also makes
    the workshop, readable by her alone. Gives back the folder. */
export function writeStudio(home, { checkout, node, lock = "strict", facts }) {
  if (lock === "open") {
    mkdirSync(workshopFolder(home), { recursive: true, mode: 0o700 });
    chmodSync(workshopFolder(home), 0o700);
  }
  mkdirSync(studioFolder(home), { recursive: true });
  const folder = realpathSync.native(studioFolder(home));
  for (const [name, text] of Object.entries(studioFiles({ checkout, node, folder, lock, facts }))) {
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

/** One word after edit.js: a plain word of letters, digits and _ . , : + = @ % / - (not starting with =); a word in double
    quotes holding no double quote, $, backtick, backslash or line break; or a word in single quotes holding no single quote
    or line break, for words with a $, a backtick, a backslash or a straight double quote. Nothing in any of them can run
    anything else. Inside single quotes zsh and bash take every letter as it is, a $, a backtick and a backslash among them;
    and a single quote cannot be put inside them, so the word ends at the next single quote, which must end the command or
    come before a space. One thing changes a quoted word on its way: after this guard has answered, Claude Code itself turns
    nul into /dev/null, a habit from Windows. It does so wherever nul, in any case, comes after one or more > (with an
    optional digit or & before them, as in 2>nul, >>nul and &>nul) and any spaces or tabs, and comes before any white space
    (a tab, a no-break space and U+3000 among them) or one of | & ; ). A nul just before the word's closing quote is left
    as it is, and so is the whole command when it holds a <, a $ or a backtick. The rule in Claude Code 2.1.296 and the
    app's 2.1.295 is /(\d?&?>+[ \t]*)nul(?=\s|$|[|&;)\n])/ with nul in any case. So the title Profit > nul margin, in
    either kind of quotes, reaches edit.js as Profit > /dev/null margin, still one word inside its quotes, and nothing else
    runs. The guard is given the command as written, before the rewrite. */
const WORD = String.raw`(?:[A-Za-z0-9_.,:+@%/-][A-Za-z0-9_.,:+=@%/-]*|"[^"$` + "`" + String.raw`\\\r\n]*"|'[^'\r\n]*')`;

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
