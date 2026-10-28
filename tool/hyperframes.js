// The pinned HyperFrames command line's rules (architecture 2026-10-27: F3, F6 and F7, and sections 4.6, 5.3, 5.5 and 5.6).
//
// BRIMM runs one version of the command line, from a folder of its own on each Mac, by absolute path and never through npx, which
// would run whatever `hyperframes` it found first (5.3). This file is everything Studio decides about it, as data or as a function
// of data:
//   - the pin, and where the toolchain is kept;
//   - what each of its commands is: one a project's agent may run, one only edit.js runs (the handover's), or one denied (5.5). The
//     table is checked against the help the pinned version prints, so that a new pin cannot bring in a command nobody classified (F6);
//   - the settings that deny the denied commands in a project, and the few variables the command line is run with (5.5, 5.6);
//   - when the app may take over her chat (F3, 5.6), and the arguments of `open`;
//   - what `open` printed, and what the app's history holds, in her words (4.6, F7).
//
// Pure: nothing here runs a program or looks at a disk but this file's own pin, hyperframes.pin.json. The caller runs the program and
// reads the history; a test gives it what the pinned version printed (tests/fixtures/hyperframes-<version>/).
import { readFileSync } from "node:fs";
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

/** The table of commands from its rows, { name: { class, why } }, frozen. */
const classify = (rows) => deepFreeze(Object.fromEntries(rows.map(([name, kind, why]) => [name, { class: kind, why }])));

/** Every command of the pinned command line, and what it is (5.5). The help of 0.8.208 lists 43; A0's hand-made list of what to
    deny named 6 of them (F6). A command is one of three classes, each with the reason it is in it:
    - `agent`: one a project's agent may run (20). It reads the project, draws frames, renders on this Mac or measures sound.
    - `edit`: one only edit.js runs (2). They are the handover's (5.6), and edit.js runs them with a fixed list of arguments and variables.
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

/** The rules that deny the denied commands, `Bash(<command line>:*)`: for each denied command in each spelling, and one for the
    script `npm run publish`, though a project made here has none. Sorted, so that the settings file is the same every time. A
    prefix rule can be got round (`npx -y …`, `node …/hyperframes.mjs …`), so it is a second line: the first is that a project has
    no credentials and no publish script, and the project's notes say it in words (5.5). A new list each time. */
export function denyRules() {
  const denied = Object.keys(COMMANDS).filter((name) => COMMANDS[name].class === "denied");
  return [...denied.flatMap((name) => SPELLINGS.map((spell) => `Bash(${spell(name)}:*)`)), "Bash(npm run publish:*)"].sort();
}

/** The settings of a project, to be written as its `.claude/settings.json` (5.5): the deny rules, and four variables that turn off
    the command line's telemetry and skills download and Claude Code's /feedback command and transcript-share survey. `kind` is
    "main" (an episode's, or a Reel's) or "clip" (a session's, which also denies the web: its words must not go anywhere, 5.4); any
    other throws. There is no `allow`: what the agent may run is what the app's own permissions give it. A new object each time. */
export function settingsFor(kind) {
  if (kind !== "main" && kind !== "clip") throw new Error(`settingsFor: a project's kind is "main" or "clip", not ${JSON.stringify(kind)}`);
  const deny = kind === "clip" ? [...denyRules(), "WebFetch", "WebSearch"].sort() : denyRules();
  return {
    permissions: { deny },
    env: { HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1", DISABLE_FEEDBACK_COMMAND: "1", CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1" }
  };
}

const absolute = (path) => typeof path === "string" && isAbsolute(path);
/** Whether an id is a chat's, as Claude Code gives one: the only shape the handover takes (SESSION_ID, scan.js). */
const isChat = (id) => typeof id === "string" && SESSION_ID.test(id);

/** The environment the command line is run in (5.6): a list, not what Studio inherited. `PATH` is node's own folder, /usr/bin and
    /bin; `HOME` and `LANG` come from `base` (LANG is en_US.UTF-8 when it has none); telemetry and the skills download are off. No
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
    HYPERFRAMES_NO_TELEMETRY: "1",
    HYPERFRAMES_SKIP_SKILLS: "1"
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
  for (const [name, path] of [["home", home], ["node", node], ["project", project]]) {
    if (!absolute(path)) throw new Error(`openArgs: ${name} must be an absolute path`);
  }
  return { file: node, args: [cliPath(home), "open", project, "--json"] };
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

/** A text on one line: its runs of space and line ends made one space, as the command line prints it. */
const oneLine = (text) => (typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "");

/** The names of files, without their folders, each once, in order: what she sees of a change, never where it is. */
const namesOf = (files) => [...new Set((Array.isArray(files) ? files : []).map((file) => oneLine(typeof file === "string" ? file.split("/").pop() : "")).filter(Boolean))];

/** What was done in the app, in her words (4.6): one line for each turn, newest first, "3:41 pm: you asked …; HyperFrames did …;
    changed index.html". The time is of the day, in the time zone `tz` (an IANA name; the Mac's own when none is given), and a time
    zone that is not one throws, rather than tell a wrong time. A part with nothing in it is left out, a turn with nothing in it
    is left out, and so is a turn whose date cannot be read: this says nothing rather than something wrong. Turns of the same
    time are put later line first. What she asked and what the app did are quoted as they were written, on one line: they are hers
    and the app's words, and are not scrubbed, so they hold whatever was said. The files are names only. Given the turns turnsOf
    reads, in any order, which it leaves as they were. */
export function plainTurns(turns, options) {
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: options?.tz, hour: "numeric", minute: "2-digit" });
  // Built from parts: newer ICU versions put a no-break space before AM and PM, and her words have an ordinary one.
  const timeOf = (ms) => {
    const parts = clock.formatToParts(ms);
    const part = (type) => parts.find((p) => p.type === type)?.value ?? "";
    return `${part("hour")}:${part("minute")} ${part("dayPeriod").toLowerCase()}`;
  };
  return (Array.isArray(turns) ? turns : [])
    .map((turn, index) => ({ turn, index, ms: typeof turn?.at === "string" ? Date.parse(turn.at) : NaN }))
    .filter(({ ms }) => !Number.isNaN(ms))
    .sort((a, b) => b.ms - a.ms || b.index - a.index)
    .flatMap(({ turn, ms }) => {
      const [asked, did, files] = [oneLine(turn.asked), oneLine(turn.did), namesOf(turn.files)];
      const parts = [asked && `you asked ${asked}`, did && `HyperFrames did ${did}`, files.length && `changed ${files.join(", ")}`].filter(Boolean);
      return parts.length ? [`${timeOf(ms)}: ${parts.join("; ")}`] : [];
    });
}
