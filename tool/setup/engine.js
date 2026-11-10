// The setup engine: the program the Mac app's shell runs to set up, repair, update or ask about this Mac. It takes the shell's answers
// as JSON lines on stdin, and tells the shell what to show as JSON lines on stdout (protocol.js, version 1), from the first step to
// `done` or `error`. stderr is for a developer only. Before the Review's Install it changes only the note of what its looks in the
// three folders found (access.js), and Claude Code, which the Apps step may install and sign in. The Install changes the rest,
// through install.sh and the three stages. A repair or an update asks nothing, and goes straight to the Install.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { lookAt } from "../access.js";
import { REPAIR, buildOf } from "../build.js";
import { idleWhy } from "../busy.js";
import { toolchainDiffers, toolchainHolds } from "../hyperframes.js";
import { isMain } from "../is-main.js";
import { DEV_REFUSAL, defaultDropFolder, downloadsFolder, dropFolderOf, episodesFolder, exportsFolderOf, folderWords } from "../settings.js";
import { studioFolder } from "../studio.js";
import { APPS, DAMAGED, NO_BRIMM_VIDEO, appsHere, brimmVideoFolders, claudeState, copyFault, kindOf, nameClash, nameSuggestion } from "./checks.js";
import { guideData, writeGuide } from "./guide.js";
import { LABELS, checkLogSays, checkLogSize, claudePin, installClaudeCode, installWhenIdle, installerArgs, installerOutcome, modelPath, modelPin, runInstaller, runProgram, signIn, stageChrome, stageCli, stageModel } from "./install.js";
import { STEPS, answerFault, argsOf, emitter, lineFault, readerOf } from "./protocol.js";
import { appsQuestion, folderQuestion, nameQuestion, permissionQuestion, read, reviewQuestion, rootQuestion, welcomeQuestion } from "./questions.js";
import { planOf, reviewSummary, setupSummary, statusSummary, summaryText } from "./summary.js";

const SAY = {
  arguments: "BRIMM Video Studio's setup was started in a way it does not know.",
  protocol: "BRIMM Video Studio's window and its setup did not understand each other.",
  reopen: "Close BRIMM Video Studio and open it again.",
  noSettings: "BRIMM Video Studio is not set up on this Mac yet, so there is nothing to repair or update. Set it up first.",
  settings: "This Mac's BRIMM Video settings cannot be read, so setup stopped and changed nothing.",
  notSetUp: "BRIMM Video Studio could not be set up on this Mac.",
  refused: "Setup was refused, and nothing was changed.",
  download: "Check this Mac's internet connection, then open BRIMM Video Studio and choose Repair.",
  engine: "BRIMM Video Studio's setup stopped on a fault of its own.",
  stopped: "Stopped, since setup was cancelled."
};

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
  folders: ["The drop folder is where you put a video for BRIMM Video Studio to take in.", "The exports folder is where HyperFrames saves a finished video, and where BRIMM Video Studio looks for it."],
  permissions: ["BRIMM Video Studio looks in three folders: the drop folder, the Episodes folder in BRIMM Video, and the exports folder.", 'If macOS asks whether "BRIMM Video Studio" may look in a folder, choose Allow.'],
  review: ["This is what Install will do. Nothing has been changed yet."],
  install: ["Setting up this Mac. The download is the longest part: leave this window open."]
};
const SEVERAL_BRIMM_VIDEO = ["More than one BRIMM Video folder is on this Mac. Choose the one to use."];
/** The steps a setup shows on a Mac that is already set up, or was by an older copy: its name and folders are its settings' own. */
const HELD_STEPS = ["welcome", "apps", "permissions", "review", "install", "done"];
const DONE_BODY = { installed: "BRIMM Video Studio is set up on this Mac.", repaired: "BRIMM Video Studio was repaired on this Mac.", updated: "BRIMM Video Studio was updated on this Mac." };

const NOTE = {
  claude: "Claude did not answer from the background job. Open BRIMM Video Studio and choose Repair.",
  missing: (names) => `Still to install: ${names.join(", ")}.`,
  update: "Start a new chat in Claude so it reads this version.",
  takeover: "The older copy of BRIMM Video Studio on this Mac is no longer used, and was left as it is.",
  refused: (words) => `BRIMM Video Studio is not yet allowed to look in ${words}. Allow it in System Settings, under Privacy & Security, then Files and Folders.`,
  unseen: (words) => `BRIMM Video Studio could not look in ${words}.`,
  claudeStays: "Claude Code was installed on this Mac during setup, and stays.",
  staged: "What setup had already put on this Mac stays, and the next run uses it."
};

/** What readerOf gives for a line that is no JSON object. */
const NOT_JSON = "A line was not a JSON object.";

/** A text on one line: whatever line break it holds becomes a space. An event's message, advice, fault or note may hold none. */
const one = (text) => String(text).replace(/\s*[\r\n]+\s*/g, " ").trim();

/** An end of the run that the engine meant: the `error` event it sends. */
class Ending extends Error {
  constructor(code, message, { advice, details } = {}) {
    super(one(message));
    this.code = code;
    this.advice = advice;
    this.details = details;
  }
}

/** Why a run stops before its end: a cancel (stdin closing is one), or a line from the shell that the engine cannot take. */
class Stop extends Error {
  constructor(reason) {
    super(reason.kind === "cancel" ? "Setup was cancelled." : "A line from the shell could not be taken.");
    this.reason = reason;
  }
}

/** The engine's side of the conversation with the shell: one reader of stdin for the whole run. It knows the question that is open
    and every id asked in this run. An answer to the open question settles it; one to an id asked before, or while no question is
    open, is dropped (Decided 18); one to an id never asked, or a line that cannot be taken, stops the run. A cancel or the end of
    stdin stops it too, until the installer may run: from then on a cancel is answered with the run's own outcome (Decided 13, 38). */
function conversation({ input, send, errors }) {
  const asked = new Set();
  let open = null;
  let waiters = [];
  let stop = null;
  let installing = false;
  let finished = false;
  const halts = new Set();
  const settle = (how) => {
    const now = waiters;
    waiters = [];
    open = null;
    for (const waiter of now) how(waiter);
  };
  const stopWith = (reason) => {
    if (stop || finished) return;
    stop = reason;
    for (const halt of [...halts]) halt();
    settle((waiter) => waiter.reject(new Stop(reason)));
  };
  const cancel = () => {
    if (!installing) stopWith({ kind: "cancel" });
  };
  const fault = (details) => stopWith({ kind: "fault", details });
  const hear = (line) => {
    if (finished) return;
    if (line === null) return cancel();
    const wrong = lineFault(line);
    if (wrong) return fault(line.fault === NOT_JSON ? NOT_JSON : wrong);
    if (line.cancel) return cancel();
    if (line.back) {
      if (open && !installing) settle((waiter) => waiter.resolve({ back: true }));
      return;
    }
    if (!asked.has(line.answer)) return fault("An answer was to a question that was never asked in this run.");
    if (!open || open.id !== line.answer) return;
    const bad = answerFault(open, line);
    if (bad) return fault(bad);
    settle((waiter) => waiter.resolve({ value: line.value }));
  };
  // The shell's stdin, through a stream that cannot fail: an input that breaks counts as stdin closing, never as a crash.
  const shell = new PassThrough();
  input.on("error", (e) => {
    errors.write(`The shell's input failed (${e?.code || "no code"}), which counts as a cancel.\n`);
    if (!shell.writableEnded) shell.end();
  });
  input.pipe(shell);
  const reader = readerOf(shell);
  (async () => {
    for (;;) {
      const line = await reader.next();
      hear(line);
      if (line === null) return;
    }
  })();
  return {
    /** Sends `question` and waits for its answer: { value } or { back: true }. It rejects with Stop when the run must stop. Several
        asks of one id may wait at once (a sign-in asks again when its link comes), and then one answer settles them all. */
    ask(question) {
      if (stop) return Promise.reject(new Stop(stop));
      asked.add(question.id);
      open = question;
      const answer = new Promise((resolve, reject) => waiters.push({ resolve, reject }));
      send(question);
      return answer;
    },
    /** Throws Stop when the run must stop. */
    checkpoint() {
      if (stop) throw new Stop(stop);
    },
    get stopping() {
      return stop !== null;
    },
    /** Runs `work(signal)`, whose signal is aborted if the run must stop meanwhile. */
    async abortable(work) {
      const controller = new AbortController();
      const halt = () => controller.abort();
      if (stop) halt();
      halts.add(halt);
      try {
        return await work(controller.signal);
      } finally {
        halts.delete(halt);
      }
    },
    /** From now on the installer may run: a cancel is answered with the run's own outcome, and a back is dropped. */
    installerMayRun() {
      installing = true;
    },
    finish() {
      finished = true;
    }
  };
}

/** A `step` event of this run, counted over the steps it shows. */
function step(ctx, id, body = BODIES[id]) {
  ctx.send({ event: "step", id, n: ctx.order.indexOf(id) + 1, of: ctx.order.length, title: TITLES[id], body });
}

/** One of the engine's own bars: it is the engine's for programs, installer and claude; a stage sends its own through `ctx.progress`. */
const bar = (ctx, part, state, detail) => ctx.progress({ part, label: LABELS[part], done: 0, total: null, state, ...(detail ? { detail } : {}) });

/** Ends a bar that a stage left open, as failed: a stage that was stopped sends no last state of its own. */
function close(ctx, part, detail) {
  if (["waiting", "running"].includes(ctx.bars[part])) bar(ctx, part, "failed", detail);
}

/** The Install, part by part: the copy's whole check, the three stages, the installer once nothing is at work, and whether Claude
    answered from the background job, which it gives back. */
async function install(ctx, answers) {
  const { home, app, tools, checkout, programs, talk } = ctx;
  step(ctx, "install");
  bar(ctx, "programs", "running");
  const damaged = copyFault({ app, tools, checkout, programs, deep: true });
  if (damaged) {
    bar(ctx, "programs", "failed");
    throw new Ending("damaged", DAMAGED, { details: damaged });
  }
  bar(ctx, "programs", "done");
  talk.checkpoint();
  const own = {
    model: () => ({ home, pin: modelPin(join(checkout, "tool")), programs }),
    cli: () => ({ home, tools, run: ctx.runProgram }),
    chrome: () => ({ home, tools, run: ctx.runProgram })
  };
  for (const [stage, part] of [["model", "model"], ["cli", "hyperframes"], ["chrome", "chrome"]]) {
    ctx.had.staged = true;
    try {
      await talk.abortable((signal) => ctx.stages[stage]({ ...own[stage](), progress: ctx.progress, signal }));
    } catch (e) {
      close(ctx, part, talk.stopping ? SAY.stopped : undefined);
      talk.checkpoint();
      if (e?.code === "download") throw new Ending("download", e.message, { advice: SAY.download });
      throw e;
    }
    talk.checkpoint();
  }
  const from = checkLogSize(home);
  talk.installerMayRun();
  bar(ctx, "installer", "running");
  // installWhenIdle asks `why` before each try: when nothing is at work after a wait, the bar is running again.
  const why = () => {
    const line = ctx.why();
    if (!line && ctx.bars.installer === "waiting") bar(ctx, "installer", "running");
    return line;
  };
  let result;
  try {
    result = await installWhenIdle({ args: installerArgs(answers, { app, tools }), home, programs, why, wait: ctx.wait, progress: ctx.progress });
  } catch (e) {
    bar(ctx, "installer", "failed");
    if (e?.code === "busy") throw new Ending("busy", e.message);
    throw e;
  }
  const outcome = installerOutcome(result.code);
  if (outcome !== "done") {
    bar(ctx, "installer", "failed");
    throw new Ending("install", outcome === "refused" ? SAY.refused : SAY.notSetUp, { advice: REPAIR, details: result.text });
  }
  bar(ctx, "installer", "done");
  // A line the engine could not take while the installer ran ends the run now that the installer has ended.
  talk.checkpoint();
  bar(ctx, "claude", "running");
  const check = checkLogSays(home, { from });
  bar(ctx, "claude", check.answered ? "done" : "failed");
  return check;
}

/** The names of the apps still to install: each app with a folder that is not here, and Claude Code when it is not here. */
const missingOf = (here, claude) => APPS.filter((app) => (app.folder ? !here[app.id] : !claude?.here)).map((app) => app.name);

/** Done: the step, the Getting Started guide, the setup summary and the `done` event. `settings` are what the run set up (Decided 32). */
function finish(ctx, { outcome, settings, claude, here, check, placeNotes = [] }) {
  const { home, build, found } = ctx;
  step(ctx, "done", [DONE_BODY[outcome]]);
  const missing = missingOf(here, claude);
  const notes = [...placeNotes];
  if (missing.length > 0) notes.push(NOTE.missing(missing));
  if (found.kind === "takeover") notes.push(NOTE.takeover);
  if (!check.answered) notes.push(NOTE.claude);
  if (ctx.run === "update") notes.push(NOTE.update);
  const guide = writeGuide({ home, data: guideData({ home, settings, build, missing, notes, now: ctx.now() }) });
  const summary = setupSummary({ kind: found.kind, home, settings, build, claude, check, missing, old: found.kind === "takeover" ? found.settings.checkout : undefined });
  ctx.send(summary);
  ctx.send({ event: "done", outcome, summary: summaryText(summary), studio: studioFolder(home), guide, notes });
}

/** Asks a step's question: { value } or { back: true }. A back at the first question of the run sends that question again. */
async function ask(ctx, question) {
  ctx.visit.asked = true;
  for (;;) {
    const got = await ctx.talk.ask(question);
    if (got.back && !ctx.visit.earlier) continue;
    return got;
  }
}

/** Whether a warning was given before for this value of this question, noting that it now has been: a warning is given once, and the
    same value again is taken (Decided 26). */
function warnedBefore(ctx, id, value) {
  const key = `${id}\n${JSON.stringify(value)}`;
  if (ctx.warned.has(key)) return true;
  ctx.warned.add(key);
  return false;
}

/** The answers the installer and the plan are given: a fresh Mac's name, BRIMM Video and folders, or a held Mac's name and BRIMM Video. */
const answersOf = (state) => (state.kind === "fresh" ? { kind: "fresh", machine: state.machine, root: state.root, drop: state.drop, exports: state.exports } : { kind: "held", machine: state.machine, root: state.root });

/** Each step of a setup before its Install: it shows itself, asks what it asks, and says where the run goes, "next" or "back", or
    "name-again" when BRIMM Video, once found, shows that another Mac uses the name (Decided 25). */
const STEP = {
  async welcome(ctx) {
    step(ctx, "welcome");
    return (await ask(ctx, welcomeQuestion())).back ? "back" : "next";
  },

  async name(ctx, state) {
    const found = brimmVideoFolders(ctx.home);
    const root = found.length === 1 ? found[0] : state.root;
    if (ctx.suggestion === undefined) ctx.suggestion = nameSuggestion({ programs: ctx.programs });
    step(ctx, "name");
    let question = nameQuestion({ suggested: state.machine ?? ctx.suggestion, warning: state.nameWarning });
    state.nameWarning = undefined;
    for (;;) {
      const got = await ask(ctx, question);
      if (got.back) return "back";
      const said = read(question, got.value, { home: ctx.home, root });
      if (said.fault) question = nameQuestion({ suggested: got.value, fault: said.fault });
      else if (said.warning && !warnedBefore(ctx, "name", said.value)) question = nameQuestion({ suggested: said.value, warning: said.warning });
      else {
        state.machine = said.value;
        state.nameRoot = root;
        return "next";
      }
    }
  },

  async apps(ctx, state) {
    const { home, tools, applications, checkout, build } = ctx;
    const pin = claudePin(join(checkout, "tool"));
    const support = build.support;
    const lookAgain = () => {
      state.here = appsHere({ home, system: applications });
      state.claude = claudeState({ home, tools });
    };
    step(ctx, "apps");
    lookAgain();
    let fault;
    let warning;
    for (;;) {
      const now = { here: state.here, claude: state.claude };
      const question = appsQuestion(now, { pin, warning, fault, support });
      fault = warning = undefined;
      const got = await ask(ctx, question);
      if (got.back) return "back";
      const said = read(question, got.value, { home, state: now, pin, support });
      if (said.fault) fault = said.fault;
      else if (said.value === "check") lookAgain();
      else if (said.value === "install-claude-code") {
        fault = await installClaude(ctx, state, { pin, support });
        lookAgain();
      } else if (said.value === "sign-in") fault = await signInHere(ctx, state);
      else if (said.warning && !warnedBefore(ctx, "apps", said.value)) warning = said.warning;
      else return "next";
    }
  },

  async dropbox(ctx, state) {
    const { home } = ctx;
    for (;;) {
      const found = brimmVideoFolders(home);
      if (found.length === 1) {
        step(ctx, "dropbox", [`BRIMM Video is at ${folderWords(found[0], home)}.`]);
        state.root = found[0];
        break;
      }
      step(ctx, "dropbox", found.length === 0 ? NO_BRIMM_VIDEO : SEVERAL_BRIMM_VIDEO);
      const question = rootQuestion(found, home);
      const got = await ask(ctx, question);
      if (got.back) return "back";
      const said = read(question, got.value);
      if (said.fault || said.value === "look-again") continue;
      state.root = said.value;
      break;
    }
    // The name was not checked against this BRIMM Video at its own step: it is now, and a clash brings the name step again, once.
    if (state.nameRoot !== state.root) {
      state.nameRoot = state.root;
      const warning = nameClash(state.machine, state.root);
      if (warning && !warnedBefore(ctx, "name", state.machine)) {
        state.nameWarning = warning;
        return "name-again";
      }
    }
    return "next";
  },

  async folders(ctx, state) {
    const { home } = ctx;
    step(ctx, "folders");
    for (const purpose of ["drop", "exports"]) {
      let question = folderQuestion(purpose, { suggested: state[purpose] ?? (purpose === "drop" ? defaultDropFolder(home) : downloadsFolder(home)), home });
      for (;;) {
        const got = await ask(ctx, question);
        if (got.back) return "back";
        const said = read(question, got.value, { home, root: state.root, ...(purpose === "exports" ? { drop: state.drop } : {}) });
        if (said.fault) question = folderQuestion(purpose, { suggested: got.value, home, fault: said.fault });
        else if (said.warning && !warnedBefore(ctx, question.id, said.value)) question = folderQuestion(purpose, { suggested: said.value, home, warning: said.warning });
        else {
          state[purpose] = said.value;
          break;
        }
      }
    }
    return "next";
  },

  async permissions(ctx, state) {
    const { home, look } = ctx;
    step(ctx, "permissions");
    state.placeNotes = [];
    for (const [place, folder] of [["drop", state.drop], ["episodes", episodesFolder(state.root)], ["downloads", state.exports]]) {
      // Only whether a look gave names is used, never the names: an episode's folder can carry a client's name.
      for (;;) {
        const seen = look(place, folder, { home });
        if (Array.isArray(seen?.names) || seen?.state === "missing") break;
        if (seen?.state !== "refused") {
          state.placeNotes.push(NOTE.unseen(folderWords(folder, home)));
          break;
        }
        const question = permissionQuestion(place, { folder, home });
        const got = await ask(ctx, question);
        if (got.back) return "back";
        if (read(question, got.value).value === "again") continue;
        state.placeNotes.push(NOTE.refused(folderWords(folder, home)));
        break;
      }
    }
    return "next";
  },

  async review(ctx, state) {
    const { home, checkout, app, tools, programs, build, found, talk } = ctx;
    const answers = answersOf(state);
    step(ctx, "review");
    for (;;) {
      const planned = planOf({ answers, home, checkout });
      const printed = await runInstaller({ args: installerArgs(answers, { app, tools, print: true }), home, programs });
      talk.checkpoint();
      const here = { model: existsSync(modelPath(home)), cli: toolchainDiffers(toolchainHolds(home)) === "" };
      const summary = reviewSummary({ kind: found.kind, moved: found.moved, answers, home, build, printed, planned, claude: state.claude, here });
      ctx.send(summary);
      const question = reviewQuestion(summary.ok);
      const got = await ask(ctx, question);
      if (got.back) return "back";
      if (read(question, got.value).value === "again") continue;
      state.plan = planned;
      return "next";
    }
  }
};

/** Installs Claude Code at the Apps step, showing each of its lines in the apps question. Gives its fault, or undefined when it
    installed (Decided 30: a failure is the question's fault, and the run goes on). */
async function installClaude(ctx, state, { pin, support }) {
  const { home, tools, programs, talk } = ctx;
  const say = (line) => ctx.send(appsQuestion({ here: state.here, claude: state.claude }, { pin, working: line, support }));
  try {
    await talk.abortable((signal) => installClaudeCode({ home, tools, pin, programs, say, signal, run: ctx.runProgram }));
    ctx.had.claudeCode = true;
    return undefined;
  } catch (e) {
    talk.checkpoint();
    if (e?.code === "install") return one(e.message);
    throw e;
  }
}

/** Signs Claude Code in at the Apps step. Gives the fault to show with the apps question, or undefined. After a back the apps question
    comes again as it was, and claude is not asked (Decided 23); after a cancel the run stops. */
async function signInHere(ctx, state) {
  const { home, tools, programs, talk, pty } = ctx;
  let left = "";
  const ask = async (question) => {
    try {
      const got = await talk.ask(question);
      if (got.back) return (left = "back");
      return read(question, got.value).value ?? {};
    } catch (e) {
      if (e instanceof Stop && e.reason.kind === "cancel") return (left = "cancel");
      throw e;
    }
  };
  const result = await signIn({ home, tools, claude: state.claude.where, programs, ask, pty });
  talk.checkpoint();
  if (left) return undefined;
  state.claude = claudeState({ home, tools });
  return result.fault ? one(result.fault) : undefined;
}

/** A setup: its steps before the Install, walked forward and back, then the Install and Done. */
async function setup(ctx) {
  const { found, home } = ctx;
  const fresh = found.kind === "fresh";
  ctx.order = fresh ? STEPS : HELD_STEPS;
  const state = fresh ? { kind: "fresh" } : { kind: "held", machine: found.settings.machine, root: found.settings.root, drop: dropFolderOf(found.settings, home), exports: exportsFolderOf(found.settings, home) };
  const asking = ctx.order.slice(0, ctx.order.indexOf("install"));
  const asked = asking.map(() => false);
  const before = (i) => {
    let j = i - 1;
    while (j >= 0 && !asked[j]) j--;
    return j;
  };
  let i = 0;
  let going = "next";
  let resume = null;
  while (i < asking.length) {
    ctx.visit = { asked: false, earlier: asked.slice(0, i).some(Boolean) };
    const went = await STEP[asking[i]](ctx, state);
    asked[i] = ctx.visit.asked;
    if (went === "name-again") {
      resume = i + 1;
      i = asking.indexOf("name");
      going = "next";
    } else if (went === "back" || (going === "back" && !asked[i])) {
      // Back goes to the nearest earlier step that asked something; a step that now asks nothing is passed over, further back.
      resume = null;
      i = Math.max(before(i), 0);
      going = "back";
    } else {
      going = "next";
      i = resume ?? i + 1;
      resume = null;
    }
  }
  const check = await install(ctx, answersOf(state));
  finish(ctx, { outcome: "installed", settings: state.plan.settings, claude: state.claude, here: state.here, check, placeNotes: state.placeNotes });
}

/** A repair or an update: it asks nothing, and takes this Mac's name, BRIMM Video and folders from its settings. */
async function renew(ctx) {
  const { home, tools, found, applications } = ctx;
  const answers = { kind: "held", machine: found.settings.machine, root: found.settings.root };
  const claude = claudeState({ home, tools });
  const here = appsHere({ home, system: applications });
  const check = await install(ctx, answers);
  finish(ctx, { outcome: ctx.run === "update" ? "updated" : "repaired", settings: found.settings, claude, here, check });
}

/** The whole run, from the shell's arguments to its last event: it gives the engine's exit code (0 after `done`, 1 after `error`, 2
    for a start the engine does not know). `programs` are the system programs it runs, each an absolute path, and the installer as a
    list (its program and first arguments). `why` says what is at work on this Mac, `wait` waits, `now` gives the time, `look` looks in
    a folder as the import does, and `stages` stage the model, the HyperFrames tools and Chrome. */
export async function runSetup({ argv, input, output, errors, home, checkout, programs, why, wait, now, look = lookAt, applications = "/Applications", pty = true, stages = { model: stageModel, cli: stageCli, chrome: stageChrome } }) {
  const send = emitter(output);
  const build = buildOf(checkout);
  const contact = build.support ? { contact: build.support } : {};
  const error = (code, message, { advice, details } = {}) => send({ event: "error", code, message: one(message), ...(advice ? { advice: one(advice) } : {}), ...contact, ...(details !== undefined ? { details: String(details) } : {}) });
  const had = { claudeCode: false, staged: false };
  let talk = null;
  try {
    const args = argsOf(argv);
    if (args.fault) {
      if (args.code === "protocol") error("protocol", SAY.protocol, { advice: SAY.reopen, details: args.fault });
      else error("arguments", SAY.arguments, { details: args.fault });
      return 2;
    }
    const { run, app, tools } = args;
    const found = kindOf({ home, checkout });
    if (found.kind === "unusable") throw new Ending("settings", SAY.settings, { details: found.why });
    if (found.kind === "dev") throw new Ending("dev", DEV_REFUSAL);
    if (run === "status") {
      const status = statusSummary({ found, home, build });
      send(status);
      send({ event: "done", outcome: "status", summary: summaryText(status), studio: studioFolder(home), guide: null, notes: [] });
      return 0;
    }
    if (found.kind === "fresh" && run !== "setup") throw new Ending("no-settings", SAY.noSettings);
    const damaged = copyFault({ app, tools, checkout, programs, deep: false });
    if (damaged) throw new Ending("damaged", DAMAGED, { details: damaged });
    talk = conversation({ input, send, errors });
    const bars = {};
    const progress = (p) => {
      bars[p.part] = p.state;
      send({ event: "progress", part: p.part, label: p.label, done: p.done, total: p.total, state: p.state, ...(p.detail !== undefined ? { detail: one(p.detail) } : {}) });
    };
    const runProgramHere = (program, list, options) => runProgram(program, list, { ...options, errors });
    const ctx = { run, app, tools, home, checkout, programs, build, found, talk, send, errors, why, wait, now, look, applications, pty, stages, had, bars, progress, runProgram: runProgramHere, order: ["install", "done"], warned: new Set() };
    if (run === "setup") await setup(ctx);
    else await renew(ctx);
    return 0;
  } catch (e) {
    if (e instanceof Stop && e.reason.kind === "cancel") {
      send({ event: "done", outcome: "cancelled", summary: "", studio: studioFolder(home), guide: null, notes: [...(had.claudeCode ? [NOTE.claudeStays] : []), ...(had.staged ? [NOTE.staged] : [])] });
      return 0;
    }
    if (e instanceof Stop) {
      error("protocol", SAY.protocol, { advice: SAY.reopen, details: e.reason.details });
      return 1;
    }
    if (e instanceof Ending) {
      error(e.code, e.message, { advice: e.advice, details: e.details });
      return 1;
    }
    errors.write(`${e?.stack ?? String(e)}\n`);
    error("engine", SAY.engine, { advice: REPAIR, details: [e?.name ?? "Error", e?.code].filter(Boolean).join(", code ") });
    return 1;
  } finally {
    talk?.finish();
  }
}

/** The engine as a program, as the shell starts it: its arguments, this Mac's home, and the checkout that holds this file's `tool`. */
export async function main() {
  const checkout = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const home = process.env.HOME;
  const programs = { launchctl: "/bin/launchctl", scutil: "/usr/sbin/scutil", curl: "/usr/bin/curl", codesign: "/usr/bin/codesign", script: "/usr/bin/script", installer: ["/bin/zsh", join(checkout, "tool", "install.sh")] };
  // A shell that has gone away leaves stdout broken: the run still goes to its end, as a cancel after the installer's start does.
  process.stdout.on("error", () => {});
  const code = await runSetup({
    argv: process.argv.slice(2),
    input: process.stdin,
    output: process.stdout,
    errors: process.stderr,
    home,
    checkout,
    programs,
    why: () => idleWhy({ home }),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date()
  });
  process.exitCode = code;
  process.stdin.destroy();
}

if (isMain(import.meta.url)) main();
