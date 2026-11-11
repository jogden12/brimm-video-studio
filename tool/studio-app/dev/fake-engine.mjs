// A stand-in for the setup engine, for looking at the Mac app's windows by hand (Phase 6, Task 11). It speaks the protocol between the
// shell and the engine (version 1, tool/setup/protocol.js) and does nothing else: it keeps one file, <TMPDIR>/brimm-fake-engine/needs,
// writes its sample guide into the same folder, and reads and writes nothing more. It starts no program and never looks at this Mac's
// settings, launch agents or folders. It imports only node's own modules, since a --fake-engine build copies it to tool/setup/engine.js
// of an app that holds nothing else of Studio. A setup first asks which scenario to show. The bars move on a timer, so that a whole run
// takes about ten seconds; FAKE_ENGINE_FAST=1 takes the waits away, for the tests.
import { mkdirSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

const FOLDER = join(tmpdir(), "brimm-fake-engine");
const NEEDS_FILE = join(FOLDER, "needs");
const FAST = process.env.FAKE_ENGINE_FAST === "1";
const HOME = homedir();

// The real engine's own sentences, copied: tool/setup/engine.js's table, tool/build.js's REPAIR, tool/setup/checks.js's DAMAGED,
// tool/setup/install.js's busy sentence and its model's download sentence, and tool/settings.js's DEV_REFUSAL.
const REPAIR = "Open BRIMM Video Studio and choose Repair.";
const SAY = {
  arguments: "BRIMM Video Studio's setup was started in a way it does not know.",
  protocol: "BRIMM Video Studio's window and its setup did not understand each other.",
  reopen: "Close BRIMM Video Studio and open it again.",
  settings: "This Mac's BRIMM Video settings cannot be read, so setup stopped and changed nothing.",
  notSetUp: "BRIMM Video Studio could not be set up on this Mac.",
  download: "Check this Mac's internet connection, then open BRIMM Video Studio and choose Repair."
};
const DAMAGED = "This copy of BRIMM Video Studio may be damaged: download it again, then open it and choose Repair.";
const BUSY_GIVEN_UP = "BRIMM Video Studio is at work on this Mac, so setup cannot finish yet. Wait until it is done, then choose Repair.";
const MODEL_FAILED = "The transcription model could not be downloaded (curl 6). Check this Mac's internet connection, then choose Repair.";
const DEV_REFUSAL = 'Not written: this Mac is marked as Jason\'s development Mac ("mode": "dev" in its settings), and the app does not take it over. Its settings are as they were.';
/** The support contact a real build carries (tool/studio-app/build-info.js), which the real engine puts on every error. */
const CONTACT = "admin@growwiththebrimm.com";

const TITLES = { welcome: "Welcome", name: "This Mac's name", apps: "Apps", dropbox: "BRIMM Video in Dropbox", folders: "Folders", permissions: "Permissions", review: "Review", install: "Install", done: "Done" };
const BODIES = {
  welcome: [
    "BRIMM Video Studio takes in a video, reads it, and makes it ready to edit in HyperFrames.",
    "Setup puts on this Mac: a transcription model (about 1.6 GB), the HyperFrames tools, and a background job that watches one folder for new videos.",
    "It takes about ten minutes, most of it the download.",
    "Nothing is ever posted, sent or published by BRIMM Video Studio."
  ],
  name: ["Each Mac that runs BRIMM Video Studio has its own name, so its videos can be told apart."],
  apps: ["BRIMM Video Studio works with these apps. Install the ones that are missing, then continue."],
  dropbox: [
    "More than one BRIMM Video folder is on this Mac. Choose the one to use.",
    "Make the BRIMM Video folder available offline in Finder, so it opens without a connection.",
    "When you drag a video from Dropbox into your drop folder, hold Option, so Dropbox keeps its copy.",
    "Never export a video into the drop folder: BRIMM Video Studio would take it in as a new video."
  ],
  folders: ["The drop folder is where you put a video for BRIMM Video Studio to take in.", "The exports folder is where HyperFrames saves a finished video, and where BRIMM Video Studio looks for it."],
  permissions: ["BRIMM Video Studio looks in three folders: the drop folder, the Episodes folder in BRIMM Video, and the exports folder.", 'If macOS asks whether "BRIMM Video Studio" may look in a folder, choose Allow.'],
  review: ["This is what Install will do. Nothing has been changed yet."],
  install: ["Setting up this Mac. The download is the longest part: leave this window open."]
};
const FRESH_STEPS = ["welcome", "name", "apps", "dropbox", "folders", "permissions", "review", "install", "done"];
const REPAIR_STEPS = ["install", "done"];
const SETUP_LINE = {
  setup: "BRIMM Video Studio is not set up on this Mac yet.",
  repair: "This Mac was set up from a copy of BRIMM Video Studio that is no longer where it was. Repair points it at this one.",
  nothing: "BRIMM Video Studio is set up on this Mac."
};
const LABELS = {
  programs: "Checking BRIMM Video Studio",
  model: "Transcription model",
  hyperframes: "HyperFrames tools",
  chrome: "Chrome for HyperFrames",
  installer: "Setting up this Mac",
  claude: "Asking Claude from the background job"
};
const MODEL_BYTES = 1624555275;
const VERSION = "Version 1.0.0-beta.1 (1)";

const SCENARIOS = [
  ["whole", "A whole setup", "Every step, one question of each kind, and the six bars."],
  ["damaged", "A damaged copy", "Two steps, then the error damaged."],
  ["dev", "The development Mac", "Two steps, then the error dev."],
  ["busy", "A Mac at work", "Two steps, then the error busy."],
  ["download", "A failed download", "Two steps, then the error download."],
  ["install", "A failed install", "Two steps, then the error install."],
  ["settings", "Settings that cannot be read", "Two steps, then the error settings."],
  ["crash", "A crash", "One step, then the run ends with no last event."],
  ["moved", "A moved copy", "The next status says repair."],
  ["fresh", "A fresh Mac", "The next status says setup."]
];

/** Writes one event and its line feed in one write to fd 1, so that a run that ends at once has written everything. A shell that has
    gone away is passed over. */
function send(event) {
  try {
    writeSync(1, `${JSON.stringify(event)}\n`);
  } catch {
    // The shell has gone away: the run still goes to its end.
  }
}

const pause = (ms) => (FAST ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms)));

/** What the last run left this Mac needing: the file's word, or setup when there is none. */
function needs() {
  try {
    const word = readFileSync(NEEDS_FILE, "utf8").trim();
    return Object.hasOwn(SETUP_LINE, word) ? word : "setup";
  } catch {
    return "setup";
  }
}

function leave(word) {
  mkdirSync(FOLDER, { recursive: true });
  writeFileSync(NEEDS_FILE, `${word}\n`);
}

/** Writes the sample Getting Started guide and gives the done event's guide. */
function writeGuide() {
  mkdirSync(FOLDER, { recursive: true });
  const html = join(FOLDER, "BRIMM Video Studio Getting Started.html");
  writeFileSync(
    html,
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>BRIMM Video Studio Getting Started</title>
<style>@page { size: Letter; margin: 0.8in; } body { font-family: -apple-system, sans-serif; color: #1f2a44; } h2 { break-before: page; }</style></head>
<body><h1>Getting Started</h1><p>A sample guide from the stand-in, for looking at the windows.</p>
<h2>Your first video</h2><p>Put a video in the drop folder.</p>
<h2>When it is ready</h2><p>Open it in HyperFrames.</p></body></html>
`
  );
  return { html, pdf: join(FOLDER, "BRIMM Video Studio Getting Started.pdf") };
}

/** Where a folder is, in words, as the real engine words a folder in the home folder. */
function wordsOf(path) {
  if (path.startsWith(`${HOME}/`)) return `${path.slice(HOME.length + 1).split("/").filter(Boolean).join(" › ")}, in your home folder`;
  return path.split("/").filter(Boolean).join(" › ");
}

const stepEvent = (id, order, body = BODIES[id] ?? []) => ({ event: "step", id, n: order.indexOf(id) + 1, of: order.length, title: TITLES[id], body });
const bar = (part, state, done = 0, total = null) => ({ event: "progress", part, label: LABELS[part], done, total, state });

/** Why a run stops before its install: a cancel, or stdin closing. */
class Cancel extends Error {}

/** The shell's lines, read from stdin. A cancel, or stdin closing, before the install marks the run cancelled; from the install on, a
    cancel is passed over, as the real engine passes it over once the installer may run. Lines that are no answer are passed over. */
function listen(input) {
  const queue = [];
  let waiter = null;
  let held = "";
  let ended = false;
  const talk = { cancelled: false, installing: false };
  const wake = () => {
    if (!waiter || (queue.length === 0 && !talk.cancelled)) return;
    const resolve = waiter;
    waiter = null;
    resolve(talk.cancelled ? null : queue.shift());
  };
  const cancel = () => {
    if (!talk.installing) talk.cancelled = true;
    wake();
  };
  const take = (text) => {
    const line = text.endsWith("\r") ? text.slice(0, -1) : text;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      return;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) return;
    if (value.cancel === true) return cancel();
    queue.push(value);
    wake();
  };
  const end = () => {
    if (ended) return;
    ended = true;
    if (held !== "") take(held);
    held = "";
    cancel();
  };
  input.setEncoding("utf8");
  input.on("data", (chunk) => {
    const lines = (held + chunk).split("\n");
    held = lines.pop();
    for (const line of lines) take(line);
  });
  input.on("end", end);
  input.on("close", end);
  input.on("error", end);
  const next = () => new Promise((resolve) => {
    waiter = resolve;
    wake();
  });
  /** Sends `question` and waits for its answer: { value } or { back: true }. An answer to another question is passed over. */
  talk.ask = async (question) => {
    talk.checkpoint();
    send(question);
    for (;;) {
      const line = await next();
      if (line === null) throw new Cancel();
      if (line.back === true) return { back: true };
      if (line.answer === question.id && line.value !== undefined) return { value: line.value };
    }
  };
  talk.checkpoint = () => {
    if (talk.cancelled) throw new Cancel();
  };
  return talk;
}

/** The six bars, moving on a timer: about nine seconds in all, the model's download most of it. */
async function bars() {
  const plain = async (part, ms) => {
    send(bar(part, "running"));
    await pause(ms);
    send(bar(part, "done"));
  };
  await plain("programs", 600);
  const ticks = 20;
  for (let i = 0; i <= ticks; i += 1) {
    send(bar("model", "running", Math.round((MODEL_BYTES * i) / ticks), MODEL_BYTES));
    await pause(250);
  }
  send(bar("model", "done", MODEL_BYTES, MODEL_BYTES));
  for (const [part, ms] of [["hyperframes", 1400], ["chrome", 1200], ["installer", 900], ["claude", 500]]) await plain(part, ms);
}

/** The setup summary, and the done event of a run that set this Mac up, with its guide. */
function finish(outcome, { order, body, machine, root, drop, exports, notes }) {
  send(stepEvent("done", order, [body]));
  const summary = {
    event: "summary",
    id: "setup",
    ok: true,
    lines: [
      { label: "This Mac", value: machine },
      { label: "BRIMM Video Studio", value: VERSION },
      { label: "BRIMM Video in Dropbox", value: wordsOf(root) },
      { label: "Drop folder", value: wordsOf(drop) },
      { label: "Exports folder", value: wordsOf(exports) },
      { label: "Claude Code", value: "Version 2.1.0, signed in." },
      { label: "Background job", value: "Claude answered from the background job." }
    ]
  };
  send(summary);
  send({ event: "done", outcome, summary: summary.lines.map((l) => `${l.label}: ${l.value}`).join("\n"), studio: FOLDER, guide: writeGuide(), notes });
  leave("nothing");
}

const SAMPLE = {
  machine: "Studio Test Mac",
  root: join(HOME, "Library", "CloudStorage", "Dropbox", "BRIMM Video"),
  drop: join(HOME, "BRIMM Video Work", "Drop"),
  exports: join(HOME, "BRIMM Video Work", "Exports")
};

/** The whole setup: the nine steps and their questions, then the install. It gives "back" for a back at its first question. */
async function whole(talk) {
  const order = FRESH_STEPS;
  const s = { ...SAMPLE, faulted: false, warned: false, claude: "missing", here: { "claude-app": false, dropbox: false, hyperframes: false } };
  let shown = null;
  const show = (id) => {
    if (id === shown) return;
    shown = id;
    send(stepEvent(id, order));
  };
  const appsQuestion = () => ({
    event: "question",
    id: "apps",
    kind: "apps",
    prompt: "These apps work with BRIMM Video Studio.",
    apps: [
      { id: "claude-app", name: "Claude", here: s.here["claude-app"], link: "https://claude.ai/download" },
      s.claude === "missing"
        ? { id: "claude-code", name: "Claude Code", here: false, note: "Not installed.", action: "install-claude-code" }
        : s.claude === "installed"
          ? { id: "claude-code", name: "Claude Code", here: false, note: "Not signed in yet.", action: "sign-in" }
          : { id: "claude-code", name: "Claude Code", here: true },
      { id: "dropbox", name: "Dropbox", here: s.here.dropbox, link: "https://www.dropbox.com/install" },
      { id: "hyperframes", name: "HyperFrames", here: s.here.hyperframes, link: "https://hyperframes.dev/studio/download" }
    ]
  });
  // Each stage shows its step and asks until it gives "next" or "back". Permissions asks nothing, so a back passes it by.
  const stages = [
    {
      step: "welcome",
      async run() {
        return (await talk.ask({ event: "question", id: "welcome", kind: "confirm", prompt: "Set up BRIMM Video Studio on this Mac?", ok: "Continue" })).back ? "back" : "next";
      }
    },
    {
      step: "name",
      async run() {
        let fault = {};
        for (;;) {
          const got = await talk.ask({ event: "question", id: "name", kind: "text", prompt: "What should this Mac be called?", suggested: s.machine, ...fault });
          if (got.back) return "back";
          // The run's first answer here is refused once, so that the window shows a fault.
          if (!s.faulted) {
            s.faulted = true;
            fault = { fault: "A Mac's name is made of letters, numbers, spaces and hyphens." };
            continue;
          }
          if (typeof got.value === "string" && got.value.trim()) s.machine = got.value.trim();
          return "next";
        }
      }
    },
    {
      step: "apps",
      async run() {
        for (;;) {
          const got = await talk.ask(appsQuestion());
          if (got.back) return "back";
          if (got.value === "continue") return "next";
          if (got.value === "install-claude-code") s.claude = "installed";
          else if (got.value === "check") {
            const next = Object.keys(s.here).find((id) => !s.here[id]);
            if (next) s.here[next] = true;
          } else if (got.value === "sign-in") {
            const signed = await talk.ask({ event: "question", id: "sign-in", kind: "sign-in", prompt: "Sign in to Claude in the browser. If it gives a code, paste it here.", paste: true, link: "https://claude.ai/" });
            if (!signed.back) s.claude = "signed";
          }
        }
      }
    },
    {
      step: "dropbox",
      async run() {
        for (;;) {
          const other = join(HOME, "Library", "CloudStorage", "Dropbox", "Archive", "BRIMM Video");
          const got = await talk.ask({
            event: "question",
            id: "dropbox",
            kind: "choice",
            prompt: "Which BRIMM Video folder is The BRIMM's?",
            options: [
              { value: SAMPLE.root, label: "Dropbox › BRIMM Video" },
              { value: other, label: "Dropbox › Archive › BRIMM Video" },
              { value: "look-again", label: "Look again" }
            ]
          });
          if (got.back) return "back";
          if (got.value === "look-again") continue;
          s.root = got.value;
          return "next";
        }
      }
    },
    {
      step: "folders",
      async run() {
        let warning = {};
        for (;;) {
          const got = await talk.ask({ event: "question", id: "drop-folder", kind: "folder", prompt: "Where will videos be dropped on this Mac?", suggested: s.drop, words: wordsOf(s.drop), purpose: "drop", ...warning });
          if (got.back) return "back";
          // The run's first answer here is warned of once, so that the window shows a warning; the answer that follows is taken.
          if (!s.warned) {
            s.warned = true;
            warning = { warning: "This folder is kept in Dropbox: every video dropped here would be uploaded there too. A folder on this Mac itself, such as BRIMM Video Work › Drop, is better." };
            continue;
          }
          if (typeof got.value === "string" && isAbsolute(got.value)) s.drop = got.value;
          return "next";
        }
      }
    },
    {
      step: "folders",
      async run() {
        const got = await talk.ask({ event: "question", id: "exports-folder", kind: "folder", prompt: "Where does HyperFrames save its exports on this Mac?", suggested: s.exports, words: wordsOf(s.exports), purpose: "exports" });
        if (got.back) return "back";
        if (typeof got.value === "string" && isAbsolute(got.value)) s.exports = got.value;
        return "next";
      }
    },
    {
      step: "permissions",
      asks: false,
      async run() {
        await pause(800);
        talk.checkpoint();
        return "next";
      }
    },
    {
      step: "review",
      async run() {
        send({
          event: "summary",
          id: "review",
          ok: true,
          lines: [
            { label: "This Mac", value: s.machine },
            { label: "BRIMM Video in Dropbox", value: wordsOf(s.root) },
            { label: "Drop folder", value: wordsOf(s.drop) },
            { label: "Exports folder", value: wordsOf(s.exports) },
            { label: "BRIMM Video Studio", value: VERSION },
            { label: "Transcription model", value: "Will be downloaded (about 1.6 GB)." },
            { label: "HyperFrames tools", value: "Will be fetched." },
            { label: "Claude Code", value: "Version 2.1.0, signed in." },
            { label: "Background job", value: "Watches the drop folder for new videos, and starts when you log in." }
          ],
          details: "A sample of what the installer prints with --print.\nIt would write this Mac's settings.\nIt would load the background job.",
          exit: 0
        });
        return (await talk.ask({ event: "question", id: "review", kind: "confirm", prompt: "Install BRIMM Video Studio on this Mac?", ok: "Install" })).back ? "back" : "next";
      }
    }
  ];
  let at = 0;
  while (at < stages.length) {
    const stage = stages[at];
    show(stage.step);
    const went = await stage.run();
    if (went === "next") {
      at += 1;
      continue;
    }
    do at -= 1;
    while (at >= 0 && stages[at].asks === false);
    if (at < 0) return "back";
    // The step gone back to is shown again, even when it is the same step.
    shown = null;
  }
  talk.installing = true;
  show("install");
  await bars();
  const notes = [
    `BRIMM Video Studio is not yet allowed to look in ${wordsOf(s.exports)}. Allow it in System Settings, under Privacy & Security, then Files and Folders.`,
    "Claude Code was installed on this Mac during setup, and stays."
  ];
  finish("installed", { order, body: "BRIMM Video Studio is set up on this Mac.", ...s, notes });
  return "ended";
}

/** The run's error as the real engine sends it: its message, and its advice and details where the real one gives them. */
const ERRORS = {
  damaged: { message: DAMAGED, details: "node is not signed: code object is not signed at all." },
  dev: { message: DEV_REFUSAL },
  busy: { message: BUSY_GIVEN_UP },
  download: { message: MODEL_FAILED, advice: SAY.download },
  install: { message: SAY.notSetUp, advice: REPAIR, details: "A sample of what the installer printed.\nIt stopped with status 1." },
  settings: { message: SAY.settings, details: "settings.json is not JSON." }
};

/** Two steps, then the scenario's error. */
async function failing(talk, code) {
  send(stepEvent("welcome", FRESH_STEPS));
  await pause(800);
  talk.checkpoint();
  send(stepEvent("name", FRESH_STEPS));
  await pause(800);
  talk.checkpoint();
  const { message, advice, details } = ERRORS[code];
  send({ event: "error", code, message, ...(advice ? { advice } : {}), contact: CONTACT, ...(details ? { details } : {}) });
  return 1;
}

const cancelled = () => send({ event: "done", outcome: "cancelled", summary: "", studio: FOLDER, guide: null, notes: [] });

async function setup(talk) {
  const question = { event: "question", id: "scenario", kind: "choice", prompt: "Which setup should this stand-in show?", options: SCENARIOS.map(([value, label, detail]) => ({ value, label, detail })) };
  for (;;) {
    const got = await talk.ask(question);
    if (got.back) continue;
    const scenario = got.value;
    if (scenario === "whole") {
      if ((await whole(talk)) === "back") continue;
      return 0;
    }
    if (Object.hasOwn(ERRORS, scenario)) return failing(talk, scenario);
    if (scenario === "crash") {
      send(stepEvent("welcome", FRESH_STEPS));
      await pause(800);
      return 1;
    }
    if (scenario === "moved" || scenario === "fresh") {
      leave(scenario === "moved" ? "repair" : "setup");
      cancelled();
      return 0;
    }
  }
}

async function repair(talk) {
  talk.installing = true;
  send(stepEvent("install", REPAIR_STEPS));
  await bars();
  finish("repaired", { order: REPAIR_STEPS, body: "BRIMM Video Studio was repaired on this Mac.", ...SAMPLE, notes: [] });
  return 0;
}

function status() {
  const word = needs();
  const summary = {
    event: "summary",
    id: "status",
    ok: word === "nothing",
    lines: [
      { label: "This Mac", value: SAMPLE.machine },
      { label: "BRIMM Video Studio", value: VERSION },
      { label: "Setup", value: SETUP_LINE[word] },
      { label: "BRIMM Video in Dropbox", value: wordsOf(SAMPLE.root) },
      { label: "Drop folder", value: wordsOf(SAMPLE.drop) },
      { label: "Exports folder", value: wordsOf(SAMPLE.exports) }
    ],
    needs: word
  };
  send(summary);
  send({ event: "done", outcome: "status", summary: summary.lines.map((l) => `${l.label}: ${l.value}`).join("\n"), studio: FOLDER, guide: null, notes: [] });
  return 0;
}

/** The run named on the command line, or the real engine's error for a start it does not know. */
function runOf(argv) {
  const given = new Map();
  for (let i = 0; i < argv.length; i += 2) given.set(argv[i], argv[i + 1]);
  const known = ["--run", "--app", "--tools", "--protocol"];
  if (argv.length !== 8 || given.size !== 4 || !known.every((name) => given.has(name))) return { code: "arguments", details: "The options are not --run, --app, --tools and --protocol, each once." };
  if (given.get("--protocol") !== "1") return { code: "protocol", details: "--protocol is not 1." };
  if (!["status", "setup", "repair"].includes(given.get("--run"))) return { code: "arguments", details: "--run is not status, setup or repair." };
  return { run: given.get("--run") };
}

async function main() {
  const args = runOf(process.argv.slice(2));
  if (args.code) {
    if (args.code === "protocol") send({ event: "error", code: "protocol", message: SAY.protocol, advice: SAY.reopen, contact: CONTACT, details: args.details });
    else send({ event: "error", code: "arguments", message: SAY.arguments, contact: CONTACT, details: args.details });
    return 2;
  }
  if (args.run === "status") return status();
  const talk = listen(process.stdin);
  try {
    return args.run === "setup" ? await setup(talk) : await repair(talk);
  } catch (e) {
    if (!(e instanceof Cancel)) throw e;
    cancelled();
    return 0;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
    process.stdin.destroy();
  },
  (e) => {
    process.stderr.write(`${e?.stack ?? String(e)}\n`);
    process.exitCode = 1;
    process.stdin.destroy();
  }
);
