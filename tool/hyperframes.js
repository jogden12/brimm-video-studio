// The pinned HyperFrames command line's rules (architecture 2026-10-27: F3, F6 and F7, and sections 4.6, 5.3, 5.5 and 5.6).
//
// BRIMM runs one version of the command line, from a folder of its own on each Mac, by absolute path and never through npx, which
// would run whatever `hyperframes` it found first (5.3). This file is everything Studio decides about it, as data or as a function
// of data:
//   - the pin, where the toolchain is kept, and whether what a Mac holds there is the pin (toolchainHolds, toolchainDiffers: `behind`
//     says it);
//   - what each of its commands is: one a project's agent may run, one only edit.js runs (the handover's), or one denied (5.5). The
//     table is checked against the help the pinned version prints, so that a new pin cannot bring in a command nobody classified (F6);
//   - the settings that deny a project's agent the commands it may not run, and the few variables the command line is run with (5.5,
//     5.6);
//   - when the app may take over her chat (F3, 5.6), and the arguments of `open` and of `history`;
//   - what `open` printed, and what the app's history holds (its turns, and the entries `history --json` prints), in her words
//     (4.6, F7): the words of hers and the app's that it quotes are made plain first (plainText).
//
// Pure: nothing here runs a program or looks at a disk but this file's own pin, hyperframes.pin.json, and toolchainHolds, which looks at
// the toolchain's folder (and only looks). The caller runs the program and reads the history; a test gives it what the pinned version
// printed (tests/fixtures/hyperframes-<version>/).
import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { SESSION_ID } from "./scan.js";
import { workFolder } from "./settings.js";

/** A value and everything inside it, frozen. */
function deepFreeze(value) {
  if (value !== null && typeof value === "object") for (const inner of Object.values(value)) deepFreeze(inner);
  return Object.freeze(value);
}

/** The pin from the text of the pin file, frozen, or a throw. The version goes into a folder's name and into the deny rules, and the
    integrity string is what the installer checks the download against: a pin file that holds anything else is refused when this
    file is loaded, not used. */
export function pinFrom(text) {
  const pin = JSON.parse(text);
  if (pin === null || typeof pin !== "object" || !/^\d+\.\d+\.\d+$/.test(pin.version) || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(pin.integrity)) {
    throw new Error("hyperframes.pin.json must hold a version like 0.8.208 and the registry's integrity string for it, sha512-…==");
  }
  return deepFreeze(pin);
}

/** The pin (5.3): the version of the command line BRIMM runs, and the registry's integrity string for that version. Moving it is a
    pull request: the new version and string, the fixtures of the new version's output, and the class of any command it brings. */
export const PIN = pinFrom(readFileSync(new URL("./hyperframes.pin.json", import.meta.url), "utf8"));

/** Where the pinned command line is kept on a Mac: a folder for each version, in the work folder, which is on the Mac's own disk
    and never in Dropbox (5.3). */
export const toolchainDir = (home) => join(workFolder(home), ".toolchain", `hyperframes-${PIN.version}`);
/** The command line's program in it, the file `node` is given to run (5.3). */
export const cliPath = (home) => join(toolchainDir(home), "node_modules", "hyperframes", "bin", "hyperframes.mjs");

/** What the folder of the pinned command line on a Mac holds, read as install.sh's toolchain_holds and toolchain_here read it (5.3):
    { version, integrity, program }. `version` is the one in the folder's node_modules/hyperframes/package.json, and `integrity` the
    string npm's lock file keeps for it (package-lock.json, packages["node_modules/hyperframes"].integrity); each is "" where it is
    not there or is not shaped as a version (1.2.3) or as an integrity string (sha512-…==). `program` is whether cliPath is a file.
    It only looks: it runs nothing, writes nothing, and never throws, whatever the folder holds; a home that is not an absolute
    path holds nothing, since a relative one would be read from wherever the program runs. */
export function toolchainHolds(home) {
  const held = { version: "", integrity: "", program: false };
  if (typeof home !== "string" || !isAbsolute(home)) return held;
  const dir = toolchainDir(home);
  const read = (file) => {
    try {
      return JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch {
      return null;
    }
  };
  const fit = (value, shape) => (typeof value === "string" && shape.test(value) ? value : "");
  try {
    held.version = fit(read("node_modules/hyperframes/package.json")?.version, VERSION_SHAPE);
    held.integrity = fit(read("package-lock.json")?.packages?.["node_modules/hyperframes"]?.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  } catch {
    // What is shaped so that it cannot be looked into is not there.
  }
  try {
    held.program = statSync(cliPath(home)).isFile();
  } catch {
    // No program, or one that cannot be looked at, is no program.
  }
  return held;
}

/** What a version looks like: three numbers and their points, as the installer takes one. */
const VERSION_SHAPE = /^\d+\.\d+\.\d+$/;

/** Whether what toolchainHolds read is the pin, and if not what it has, in the words Jason reads in `behind`: "" when the pinned
    version is installed with its program and the pin's integrity string in the lock file (what install.sh's toolchain_here asks);
    otherwise "none" when no version can be read or the program is missing, "version 1.2.3" when the version is another, and "version
    1.2.3, but not as the pin has it" when it is the pinned one and only the integrity string differs or is missing. Anything that
    is not what toolchainHolds gives is a toolchain that is not the pin ("none"). */
export function toolchainDiffers(held) {
  const { version, integrity, program } = held !== null && typeof held === "object" ? held : {};
  if (typeof version !== "string" || !VERSION_SHAPE.test(version) || program !== true) return "none";
  if (version !== PIN.version) return `version ${version}`;
  return integrity === PIN.integrity ? "" : `version ${version}, but not as the pin has it`;
}

/** The table of commands from its rows, { name: { class, why } }, frozen. */
const classify = (rows) => deepFreeze(Object.fromEntries(rows.map(([name, kind, why]) => [name, { class: kind, why }])));

/** Every command of the pinned command line, and what it is (5.5). The help of 0.8.208 lists 43; A0's hand-made list of what to
    deny named 6 of them (F6). A command is one of three classes, each with the reason it is in it:
    - `agent`: one a project's agent may run (20). It reads the project, draws frames, renders on this Mac or measures sound.
    - `edit`: one only edit.js runs (2). They are the handover's (5.6), and edit.js runs them with a fixed list of arguments and variables.
      A project's settings deny them to its own agent (denyRules): edit.js runs them by absolute path, outside those settings.
    - `denied`: one nobody runs here (21). It uploads, publishes, signs in, fetches or installs from the network, generates a voice,
      changes the pin, or redoes what Studio did. A project's settings deny each (denyRules), and its notes name each.
    It is a table, one row for each command, so that a command can be in only one class, and it is checked against the help
    (unclassified): a command that is in none fails a test, so a new pin cannot slip one in. */
export const COMMANDS = classify([
  ["preview", "agent", "starts the live preview of the project on this Mac"],
  ["render", "agent", "renders the project to a video file on this Mac"],
  ["lint", "agent", "reads the project and reports mistakes in it"],
  ["check", "agent", "runs the lint, the runtime check and the layout check as one gate"],
  ["validate", "agent", "runs the project in a headless browser on this Mac and reports its errors"],
  ["inspect", "agent", "reads the layout of the rendered frames along the timeline"],
  ["keyframes", "agent", "reads the project's keyframes and draws diagnostic frames of them"],
  ["snapshot", "agent", "draws still frames of the project, to look at"],
  ["info", "agent", "prints the project's facts"],
  ["compositions", "agent", "lists the project's compositions"],
  ["timeline", "agent", "prints the project's tracks and clips"],
  ["history", "agent", "lists, undoes and restores the project's recorded changes: going back to an earlier version is something she can ask"],
  ["docs", "agent", "prints the command line's own documentation"],
  ["doctor", "agent", "checks the tools on this Mac and says what is missing"],
  ["beats", "agent", "finds the beats in the project's music and writes them beside it"],
  ["audio", "agent", "measures where sounds land and how loud they are"],
  ["media-treatment", "agent", "applies or clears a treatment on a picture or video in the project"],
  ["normalize-audio", "agent", "matches the loudness of one clip to another's"],
  ["grade-compare", "agent", "draws candidate colour grades on one frame, to compare"],
  ["compare", "agent", "renders variants of a composition into one sheet, to compare"],

  ["open", "edit", "hands the project to the HyperFrames app, and her chat with it when the handover is allowed: only edit.js runs it (5.6)"],
  ["catch-up", "edit", "reads what was done in the app since the project was last looked at, the other half of the handover: only edit.js runs it"],

  ["init", "denied", "makes a project of its own, which loads code from the network and carries a publish script: Studio writes the project's files itself"],
  ["add", "denied", "installs blocks from a registry that sits on a moving branch"],
  ["catalog", "denied", "browses and installs blocks from that same registry"],
  ["capture", "denied", "fetches a website"],
  ["present", "denied", "shares a slide deck with an audience"],
  ["publish", "denied", "uploads the project to an address that anyone with the link can open"],
  ["cloud", "denied", "renders on HeyGen's cloud, which means sending the project there"],
  ["lambda", "denied", "deploys to Amazon's cloud and renders there"],
  ["cloudrun", "denied", "deploys to Google's cloud and renders there"],
  ["auth", "denied", "signs in to HeyGen and keeps its credentials"],
  ["feedback", "denied", "sends feedback to the makers"],
  ["telemetry", "denied", "changes what the makers are told about its use: the environment keeps that off"],
  ["skills", "denied", "downloads skills from the network and changes the project's guidance"],
  ["models", "denied", "lists and downloads on-device models, a download from the network"],
  ["browser", "denied", "downloads a browser: the installer does that, once, with Jason's yes"],
  ["upgrade", "denied", "looks for a newer version and says how to move to it: the pin moves only by a pull request"],
  ["benchmark", "denied", "renders again and again to time it, which nobody asked for"],
  ["clean", "denied", "sweeps the history and the render leftovers of every project it knows, not of one: named paths are deleted instead (7.4)"],
  ["transcribe", "denied", "listens to audio again: the words are in transcript.json already, made on the Mac"],
  ["tts", "denied", "writes speech from text with a local model: a generated voice"],
  ["remove-background", "denied", "may download a model when first used; it waits for A0 to say it is wanted"]
]);

/** A category's header in the help: "Getting Started:", "AI & Integrations:". */
const HEADER = /^[A-Z][A-Za-z &]*:$/;
/** A command's line in the help: two spaces, its name, two spaces or more, then what it does. */
const COMMAND = /^ {2}([a-z][a-z-]+) {2,}\S/;

/** The commands a help lists, in its order: from the first category's header on, each line that has a command's name at its start
    and its words after. The examples at the end start with "$", so they are not taken for commands. It reads on past them to the
    end, so that a command added after them is found, not missed. */
export function commandsIn(help) {
  const lines = String(help ?? "").split(/\r?\n/);
  const first = lines.findIndex((line) => HEADER.test(line));
  if (first === -1) return [];
  return lines.slice(first + 1).flatMap((line) => line.match(COMMAND)?.[1] ?? []);
}

/** The commands a help lists that no class names, once each, in the help's order. A test holds this empty for the pinned help,
    which is what keeps the pin from moving without the classification (F6). */
export const unclassified = (help) => [...new Set(commandsIn(help))].filter((name) => !Object.hasOwn(COMMANDS, name));

/** The three ways a project's notes, its scripts and the agent's habits spell a command (5.5): through npx, through npx at the
    pinned version, and as the bare name that the link in the project's node_modules/.bin gives. */
const SPELLINGS = [(c) => `npx hyperframes ${c}`, (c) => `npx --yes hyperframes@${PIN.version} ${c}`, (c) => `hyperframes ${c}`];

/** The rules that deny a project's agent the commands it may not run, `Bash(<command line>:*)`: each denied command and each of the
    two only edit.js runs (which runs them by absolute path, outside the project's settings, so the rules never stop it), in each
    spelling; and one for the script `npm run publish`, though a project made here has none. Sorted, so that the settings file is
    the same every time. A prefix rule can be got round (`npx -y …`, `node …/hyperframes.mjs …`), so it is a second line: the first
    is that a project has no credentials and no publish script, and the project's notes say it in words (5.5). A new list each time. */
export function denyRules() {
  const barred = Object.keys(COMMANDS).filter((name) => COMMANDS[name].class !== "agent");
  return [...barred.flatMap((name) => SPELLINGS.map((spell) => `Bash(${spell(name)}:*)`)), "Bash(npm run publish:*)"].sort();
}

/** What the command line does on its own unless it is told not to, and the variable that tells it (version 0.8.208, read in its
    dist): it tells its makers of its use (HYPERFRAMES_NO_TELEMETRY), downloads skills (HYPERFRAMES_SKIP_SKILLS), fetches the
    registry's newest version in the background to say there is one (HYPERFRAMES_NO_UPDATE_CHECK), can schedule a background install
    of that newer version (HYPERFRAMES_NO_AUTO_INSTALL), and installs a package it finds missing when a feature needs it, an optional
    one (HYPERFRAMES_NO_OPTIONAL_INSTALL: it then says the package is not installed, and the feature needs it). All five are off, in
    each place the command line is run: Studio's own runs (childEnv), the app's agent's (settingsFor), and the installer's (install.sh
    run_hyperframes, which a test holds to this list). The rule behind them is that nothing is installed on a Mac without Jason's yes:
    a newer version comes by a pull request that moves the pin and then by the installer, and a feature whose optional package is
    missing says so and is not given it (5.3). A new object each time. */
const quiet = () => ({
  HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1", HYPERFRAMES_NO_UPDATE_CHECK: "1", HYPERFRAMES_NO_AUTO_INSTALL: "1", HYPERFRAMES_NO_OPTIONAL_INSTALL: "1"
});

/** The three variables by which the command line takes a HeyGen key or token (version 0.8.208, resolveCredential), each set to "": it
    takes the first that is set, in this order, HEYGEN_API_KEY, HYPERFRAMES_API_KEY, HEYGEN_ACCESS_TOKEN, and then reads its own
    file, ~/.heygen/credentials; an empty value counts as unset. Whether the app hands its agent one of them is not known, so a
    project's settings blank all three (settingsFor), and a command the agent runs finds none set. Studio's own runs (childEnv) are
    a list of their own and carry none, so they need no blanks. A new object each time. */
const heygenBlanks = () => ({ HEYGEN_API_KEY: "", HYPERFRAMES_API_KEY: "", HEYGEN_ACCESS_TOKEN: "" });

/** The settings of a project, to be written as its `.claude/settings.json` (5.5): the deny rules, and ten variables: the five that
    turn off what the command line does on its own (quiet: its telemetry, skills download, update check, background install and
    install of a missing optional package), Claude Code's /feedback command and transcript-share survey, and, blank, the three by
    which the command line takes a HeyGen key or token (heygenBlanks). `kind` is "main" (an episode's, or a Reel's) or "clip" (a
    session's, which also denies the web: its words must not go anywhere, 5.4); any other throws. There is no `allow`: what the agent
    may run is what the app's own permissions give it. A new object each time. */
export function settingsFor(kind) {
  if (kind !== "main" && kind !== "clip") throw new Error(`settingsFor: a project's kind is "main" or "clip", not ${JSON.stringify(kind)}`);
  const deny = kind === "clip" ? [...denyRules(), "WebFetch", "WebSearch"].sort() : denyRules();
  return {
    permissions: { deny },
    env: { ...quiet(), DISABLE_FEEDBACK_COMMAND: "1", CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1", ...heygenBlanks() }
  };
}

const absolute = (path) => typeof path === "string" && isAbsolute(path);
/** Whether an id is a chat's, as Claude Code gives one: the only shape the handover takes (SESSION_ID, scan.js). */
const isChat = (id) => typeof id === "string" && SESSION_ID.test(id);

/** The environment the command line is run in (5.6): a list, not what Studio inherited. `PATH` is node's own folder, /usr/bin and
    /bin; `HOME` and `LANG` come from `base` (LANG is en_US.UTF-8 when it has none); what it does on its own is off (quiet:
    telemetry, the skills download, the update check, the background install and the install of a missing optional package). No
    key, nothing of Anthropic's, no proxy setting, and none of the variables by which `open` finds an agent's conversation to hand
    over (CLAUDE_CODE_SESSION_ID, CODEX_THREAD_ID, GROK_SESSION_ID, F3). `CLAUDE_CODE_SESSION_ID` is added, as `sessionId`, only
    when `handover` is true and the id is a chat's: it is how the app is handed the chat, so whether it may be is handoverAllowed's
    to say, and this only carries out its answer. Given `node`, the absolute path of the program that runs the command line. A
    plain object; `base` is left as it was. */
export function childEnv(options) {
  const { base, node, handover, sessionId } = options ?? {};
  const home = base?.HOME;
  if (!absolute(home)) throw new Error("childEnv: the base holds no HOME to give the command line");
  if (!absolute(node)) throw new Error("childEnv: node must be an absolute path");
  const env = {
    PATH: [dirname(node), "/usr/bin", "/bin"].join(":"),
    HOME: home,
    LANG: typeof base.LANG === "string" && base.LANG !== "" ? base.LANG : "en_US.UTF-8",
    ...quiet()
  };
  if (handover === true && isChat(sessionId)) env.CLAUDE_CODE_SESSION_ID = sessionId;
  return env;
}

/** Whether the app may be handed the chat that opens a project (5.6, F3), as { allowed, why }. A handover puts the chat's whole
    conversation into the app's assistant, so it is allowed only when all of these hold, and the first that does not is the `why`:
    - `setting` is true: this Mac's `appHandover` is on (it is off until Jason turns it on), else "off";
    - `sessionId` is a chat's id (SESSION_ID), else "no chat";
    - `held` is false: `chatHeld` says the chat holds no session's words, else "held";
    - `episode.session` is false, else "session"; and `episode.unanswered` is false, else "unanswered";
    - `project.clip` is false: a session clip is never opened with a handover, else "clip".
    It fails closed: a flag that is missing, or is not the boolean that lets it through, counts as the unsafe answer. `why` is ""
    when it is allowed. */
export function handoverAllowed(facts) {
  const { setting, sessionId, held, episode, project } = facts ?? {};
  const refused = (why) => ({ allowed: false, why });
  if (setting !== true) return refused("off");
  if (!isChat(sessionId)) return refused("no chat");
  if (held !== false) return refused("held");
  if (episode?.session !== false) return refused("session");
  if (episode?.unanswered !== false) return refused("unanswered");
  if (project?.clip !== false) return refused("clip");
  return { allowed: true, why: "" };
}

/** What to run to open a project in the app (5.6): { file, args } for a program-running call, `node <the pinned program> open
    <project> --json`, with nothing of npx in it. `home`, `node` and `project` are absolute paths, or it throws: a path that is not
    absolute could be taken for an option, or for another folder than the one meant. */
export function openArgs(options) {
  const { home, node, project } = options ?? {};
  needAbsolute("openArgs", { home, node, project });
  return { file: node, args: [cliPath(home), "open", project, "--json"] };
}

/** Throws, in the name of `who`, for the first of `paths` ({ name: path }) that is not an absolute path: a path that is not could
    be taken for an option, or for another folder than the one meant. */
function needAbsolute(who, paths) {
  for (const [name, path] of Object.entries(paths)) {
    if (!absolute(path)) throw new Error(`${who}: ${name} must be an absolute path`);
  }
}

/** How many versions `versions` asks the command line for: the newest 20 (4.6). */
export const VERSIONS_LIMIT = 20;

/** What to run to list a project's versions (4.6): { file, args } for a program-running call, `node <the pinned program> history
    --json --limit 20 --dir <project>`, with nothing of npx in it, in the order the plan gives (the command line itself takes its
    flags in any order; the stand-in used by the tests answers this order only, so that a call that drifted is seen). `home`, `node`
    and `project` are absolute paths, or it throws, as openArgs does. */
export function historyArgs(options) {
  const { home, node, project } = options ?? {};
  needAbsolute("historyArgs", { home, node, project });
  return { file: node, args: [cliPath(home), "history", "--json", "--limit", String(VERSIONS_LIMIT), "--dir", project] };
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const OPENED = "It's open in HyperFrames.";
const PICKS_UP = "It's open in HyperFrames, and it picks up this conversation.";
// A handover that was wanted and not made is refused for several reasons (handoverAllowed), so these words say none of them: the
// caller adds the one that is true.
const NEW_CONVERSATION = "It's open in HyperFrames. It starts a new conversation.";
const WOULD_NOT = "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason.";
const CANNOT = "HyperFrames can't be opened from here: ask Jason.";
/** The reasons `open` gives for not opening (dist/open-*.js, WHY_NOT), and her words for each. */
const NOT_OPENED = {
  "not-installed": "HyperFrames isn't installed on this Mac: ask Jason.",
  "open-failed": WOULD_NOT,
  "unsupported-platform": CANNOT,
  "handoff-unavailable": CANNOT
};

/** What `open --json` printed and its exit status, in her words (5.6): { opened, handedOver, reason, words }, and `downloadUrl`
    when the command line gave one. `reason` is null when it opened; otherwise the command line's own reason, or "unknown" for one
    that is not among those it gives (what it printed is never repeated). It opened only when it printed `opened: true` and exited 0;
    anything it cannot read, an empty output, bad JSON, `opened` missing or contradicted by the exit status, is "wouldn't open". A
    `handedOver` of any value but none (null, false, 0, "") counts as a handover: whether the chat went is what must be recorded, so
    any doubt goes that way. `handoverWanted` is true when this Mac's setting asks for a handover: if it was wanted and not made,
    the words say only that a new conversation starts, and the caller adds why. */
export function readOpen(stdout, code, options) {
  let said = null;
  if (typeof stdout === "string") {
    try {
      said = JSON.parse(stdout);
    } catch {
      said = null;
    }
  }
  if (isObject(said) && said.opened === true && code === 0) {
    const handedOver = Boolean(said.handedOver);
    return { opened: true, handedOver, reason: null, words: handedOver ? PICKS_UP : options?.handoverWanted === true ? NEW_CONVERSATION : OPENED };
  }
  const reason = isObject(said) && typeof said.reason === "string" && Object.hasOwn(NOT_OPENED, said.reason) ? said.reason : "unknown";
  const read = { opened: false, handedOver: false, reason, words: NOT_OPENED[reason] ?? WOULD_NOT };
  if (isObject(said) && typeof said.downloadUrl === "string" && /^https:\/\/\S+$/.test(said.downloadUrl)) read.downloadUrl = said.downloadUrl;
  return read;
}

/** How long a text of a turn may be, as the command line cuts them when it reads the history. */
const TEXT_MAX = 2000;
const cut = (value) => (typeof value === "string" ? value.slice(0, TEXT_MAX) : "");

/** One line of the app's history as a turn, or null (as the command line's own reader does it): a line that is not JSON, or has no
    date that is a date, is passed over. */
function turnOf(line) {
  let raw;
  try {
    raw = Object(JSON.parse(line));
  } catch {
    return null;
  }
  const at = cut(raw.at);
  if (Number.isNaN(Date.parse(at))) return null;
  return { at, engine: cut(raw.engine), asked: cut(raw.asked), did: cut(raw.did), files: Array.isArray(raw.files) ? raw.files.map(cut).filter(Boolean) : [] };
}

/** The turns in the text of a project's `.hyperframes/app-history.jsonl` (4.6, F7), one to a line, each { at, engine, asked, did,
    files }, in the order written. It reads as the pinned command line's `catch-up` does, so that the two agree on what a turn is:
    a line that is not JSON, or has no date that is a date, is passed over; a text is cut at 2,000 characters; a field that is not a
    text is none. The command line reads the last megabyte of the file, and a caller does the same. Nothing, or anything but a
    text, is no turns: the file is the app's, and may not be there. */
export function turnsOf(text) {
  if (typeof text !== "string") return [];
  return text.split("\n").flatMap((line) => turnOf(line) ?? []);
}

/** The furthest a moment can be from the epoch, in milliseconds either way, for a Date to hold it (ECMAScript's time value limit).
    A number beyond it is a number and not a moment, and the clock that tells the time (clockIn) throws a RangeError for it. */
const DATE_MOST = 8.64e15;
/** Whether a value is a moment a Date can hold: a number no further from the epoch than DATE_MOST. NaN and the infinities are not. */
const isMoment = (value) => typeof value === "number" && Math.abs(value) <= DATE_MOST;

/** One entry of what `history --json` printed (publicEntry, in the pinned command line) as { kind, label, endedAt, files, undone,
    pinned }, or null when it has no time that is a moment (isMoment): when it happened is what is told first, and an entry that
    cannot be dated is passed over. `kind` is who made it (`who.kind`: "agent", "person" or "outside"); the name is not kept, since
    it is the app's assistant's own. A part that is not what it should be is none (the texts are cut at 2,000 characters as a
    turn's are), and `undone` and `pinned` are so only when they are `true`: whether it was undone is not guessed at. */
function entryOf(raw) {
  if (!isObject(raw) || !isMoment(raw.endedAt)) return null;
  return {
    kind: cut(isObject(raw.who) ? raw.who.kind : ""),
    label: cut(raw.label),
    endedAt: raw.endedAt,
    files: Array.isArray(raw.files) ? raw.files.map(cut).filter(Boolean) : [],
    undone: raw.undone === true,
    pinned: raw.pinned === true
  };
}

/** What `history --json` printed and its exit status (4.6, F7): { ok: true, entries }, the entries in the order the command line
    gave them (the newest first), or { ok: false } when it cannot be read. History is a trial (F7), so anything that is not the
    list the pinned version prints is "cannot read" and never a guess: an exit status other than 0, an output that is not a text
    or is not JSON, one without a list of `entries`, one that says `ok: false` (as the command line's own refusals do), and a list
    that has entries none of which can be read, which is not the same as a list with none. */
export function readHistory(stdout, code) {
  const failed = { ok: false };
  if (code !== 0 || typeof stdout !== "string") return failed;
  let said;
  try {
    said = JSON.parse(stdout);
  } catch {
    return failed;
  }
  if (!isObject(said) || said.ok === false || !Array.isArray(said.entries)) return failed;
  const entries = said.entries.flatMap((raw) => entryOf(raw) ?? []);
  return said.entries.length > 0 && entries.length === 0 ? failed : { ok: true, entries };
}

/** How long a text she or the app wrote may be in a line of hers, in characters (plainText). */
export const QUOTE_MOST = 200;
/** How many files a line names before it says how many there were instead (plainTurns, plainVersions). */
export const FILES_MOST = 5;

/** The five names of programs that a text, or a file's name, is left out whole for, since a line of hers holds none of them: npx,
    npm and node (the programs that run the command line), and edit.js and hyperframes.mjs (this one, and the command line's). No
    other program's name is looked for. */
const COMMAND_WORDS = /\b(?:npx|npm|node)\b|edit\.js|hyperframes\.mjs/i;

/** A chip is a thing the person attached to a request in the app, its Storyboard ability, say. The app writes it into the request she
    typed as U+E000, then the encodeURIComponent of a JSON object (`{"t":"ability","id":"storyboard","name":"Storyboard"}`), then U+E001
    (Jason's by-hand check of 30 October: his fbb80c's first turn, said with %7B…%7D in it). The app's own label for such a turn has the
    chip as `#Storyboard`, and that is how she reads it. */
const CHIP = /([^]*)/g;
/** The mark of a chip that has no other mark to go with it. */
const CHIP_MARK = /[]/g;

/** How the app labels a chip, `#<name>`, from the text between its two marks: the object's `name` when that is a text with something
    in it, and "" for a chip that cannot be read (not a percent-encoding, not JSON, not an object, or no such name). */
function chipName(coded) {
  try {
    const chip = JSON.parse(decodeURIComponent(coded));
    const name = isObject(chip) && typeof chip.name === "string" ? chip.name.trim() : "";
    return name === "" ? "" : `#${name}`;
  } catch {
    return "";
  }
}

/** A text with each chip said as `#<name>` and a chip that cannot be read left out, as are the lone marks that have no chip. A chip is
    set off by a space from a word or another chip beside it, and from a full stop or a comma beside it by none: "Use #Storyboard, then". */
function chipsSaid(text) {
  const sticks = (char, mark) => char === mark || /[\p{L}\p{N}]/u.test(char ?? "");
  return text
    .replace(CHIP, (whole, coded, at) => {
      const name = chipName(coded);
      const before = sticks(text[at - 1], "");
      const after = sticks(text[at + whole.length], "");
      if (name === "") return before && after ? " " : "";
      return `${before ? " " : ""}${name}${after ? " " : ""}`;
    })
    .replace(CHIP_MARK, "");
}

/** A word of a text, made plain: a `--word` token (a double hyphen and a letter at its start, as `--now` and `--dir=x`) is left out
    whole; a path is its file's name (or its folder's, when it ends in a slash); and any other word with a slash in it is the words
    it joins, as "and/or" and "9/16" are. A path is a word with a slash that starts with one, with a tilde or with a dot, that ends in
    one, that has three parts or more, or whose last part has an extension. */
function plainWord(word) {
  if (/^--[A-Za-z]/.test(word)) return [];
  if (!word.includes("/")) return [word];
  const parts = word.split("/").filter(Boolean);
  if (parts.length === 0) return [];
  const last = parts[parts.length - 1];
  const path = /^[/~.]/.test(word) || word.endsWith("/") || parts.length >= 3 || /\.[A-Za-z0-9]{1,8}\W*$/.test(last);
  return path ? [last] : parts;
}

/** A text she or the app wrote, as a line of hers has it (4.6): on one line, with a chip the person attached to a request said as
    `#<name>` as the app labels it (and one that cannot be read left out), its markdown marks off (bold, slant and code), a
    link as its words and an address left out, every path as its file's name, any other slash as a space, every `--word` token left
    out whole and any other run of hyphens made one, and cut at `most` characters (QUOTE_MOST) at a word, with an ellipsis, when it
    is longer. "" for what is not a text, what has no letter or number in it, and a text that holds one of the five program names
    (COMMAND_WORDS): nothing can be made plain of that, so it is left out whole rather than changed into something it was not.
    Whatever it is given, what it gives holds no slash, no double hyphen and none of those five names, a chip's name included. It
    takes nothing else out of what was said: a single-dash option, or the name of another program, stays. */
export function plainText(text, most = QUOTE_MOST) {
  if (typeof text !== "string") return "";
  const words = chipsSaid(text)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[*`]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(plainWord)
    .join(" ")
    .replace(/-{2,}/g, "-");
  if (!/[\p{L}\p{N}]/u.test(words) || COMMAND_WORDS.test(words)) return "";
  if (words.length <= most) return words;
  // The cut falls on the last space within `most` characters, unless that leaves less than half of them.
  const head = words.slice(0, most + 1);
  const at = head.lastIndexOf(" ");
  return `${(at > most / 2 ? head.slice(0, at) : head.slice(0, most)).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** A text on one line: its runs of space and line ends made one space, as the command line prints it. */
const oneLine = (text) => (typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "");

/** The names of files, without their folders, each once, in order: what she sees of a change, never where it is. A name that holds
    a program's name or a double hyphen is left out, since a line of hers holds neither. */
const namesOf = (files) => [...new Set((Array.isArray(files) ? files : []).map((file) => oneLine(typeof file === "string" ? file.split("/").pop() : "")).filter((name) => name !== "" && !COMMAND_WORDS.test(name) && !name.includes("--")))];

/** The files of a change, as a line of hers says them: "changed index.html, logo.html", or, past FILES_MOST, "changed 12 files". */
const changedWords = (names) => (names.length === 0 ? "" : names.length > FILES_MOST ? `changed ${names.length} files` : `changed ${names.join(", ")}`);

/** The time of day a moment is told as, "3:41 pm", in the zone `tz` (an IANA name; the Mac's own when none is given). A zone that
    is not one throws, here, rather than tell a wrong time later. app-history.js turnTime tells the time of a turn with it too. */
export function clockIn(tz) {
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  // Built from parts: newer ICU versions put a no-break space before AM and PM, and her words have an ordinary one.
  return (ms) => {
    const parts = clock.formatToParts(ms);
    const part = (type) => parts.find((p) => p.type === type)?.value ?? "";
    return `${part("hour")}:${part("minute")} ${part("dayPeriod").toLowerCase()}`;
  };
}

/** What was done in the app, in her words (4.6): one line for each turn, newest first, "3:41 pm: you asked …; HyperFrames did …;
    changed index.html". The time is of the day, in the time zone `tz` (clockIn), and a time zone that is not one throws, rather
    than tell a wrong time. A part with nothing in it is left out, a turn with nothing in it is left out, and so is a turn whose
    date cannot be read: this says nothing rather than something wrong. Turns of the same time are put later line first. What she
    asked and what the app did are hers and the app's words, so they are quoted, but as a line of hers has them (plainText): the
    real history has them long, in markdown, and with paths in them. The files are names only (namesOf, changedWords). Given the
    turns turnsOf reads, in any order, which it leaves as they were. */
export function plainTurns(turns, options) {
  const timeOf = clockIn(options?.tz);
  return (Array.isArray(turns) ? turns : [])
    .map((turn, index) => ({ turn, index, ms: typeof turn?.at === "string" ? Date.parse(turn.at) : NaN }))
    .filter(({ ms }) => !Number.isNaN(ms))
    .sort((a, b) => b.ms - a.ms || b.index - a.index)
    .flatMap(({ turn, ms }) => {
      const [asked, did] = [plainText(turn.asked), plainText(turn.did)];
      const parts = [asked && `you asked ${asked}`, did && `HyperFrames did ${did}`, changedWords(namesOf(turn.files))].filter(Boolean);
      return parts.length ? [`${timeOf(ms)}: ${parts.join("; ")}`] : [];
    });
}

/** Who made a version, in her words, by the kind the command line gives (`who.kind`): the app's assistant, she by hand in the app,
    or something that is not the app (the brand kit arriving, a transcript saved: A0 counted 17 versions in the command line's list
    against 13 in the app's own, the others being these). A kind that is not among them is not told. */
const WHO = { agent: "HyperFrames", person: "you", outside: "outside HyperFrames" };

/** The versions the command line lists, in her words (4.6): one line for each entry readHistory gives, newest first by when it
    ended, "3:41 pm: Make the title bigger (HyperFrames; undone; changed index.html)". The label is what the app wrote for it: her
    request to the assistant, often headed by the name of the file she attached, "Imported media" for what she did by hand, and
    "Changed outside the app", quoted as a line of hers has it (plainText), or "a change" when it has nothing that can be said. In
    brackets: who (WHO), "undone" if it was undone, "kept" if it is pinned, and the files it changed. An entry of the same time
    stays in the order given. The time is told as plainTurns tells it, and a time zone that is not one throws. An entry that cannot
    be dated is passed over, and anything but a list is no entries. */
export function plainVersions(entries, options) {
  const timeOf = clockIn(options?.tz);
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => ({ entry, index, ms: isObject(entry) && isMoment(entry.endedAt) ? entry.endedAt : NaN }))
    .filter(({ ms }) => !Number.isNaN(ms))
    .sort((a, b) => b.ms - a.ms || a.index - b.index)
    .map(({ entry, ms }) => {
      const inside = [Object.hasOwn(WHO, entry.kind) ? WHO[entry.kind] : "", entry.undone === true ? "undone" : "", entry.pinned === true ? "kept" : "", changedWords(namesOf(entry.files))].filter(Boolean);
      return `${timeOf(ms)}: ${plainText(entry.label) || "a change"}${inside.length ? ` (${inside.join("; ")})` : ""}`;
    });
}
