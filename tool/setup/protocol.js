// The setup protocol between the Mac app's shell and the setup engine, version 1: what each event, answer and argument may hold,
// checked in one place. A fault says which field is wrong and never repeats a value, since a value may be a pasted sign-in code.
// Whether a value is good (a name, a folder that is there) is for the questions to say; this only says whether it can be read.
import { isAbsolute } from "node:path";
import { createInterface } from "node:readline";

export const PROTOCOL = 1;
export const EVENTS = ["step", "question", "progress", "summary", "done", "error"];
export const STEPS = ["welcome", "name", "apps", "dropbox", "folders", "permissions", "review", "install", "done"];
export const PARTS = ["programs", "model", "hyperframes", "chrome", "installer", "claude"];
export const CODES = ["arguments", "protocol", "damaged", "dev", "no-settings", "settings", "busy", "install", "download", "engine"];
export const RUNS = ["setup", "repair", "update", "status"];

const KINDS = ["confirm", "text", "choice", "folder", "apps", "sign-in"];
const STATES = ["waiting", "running", "done", "skipped", "failed"];
const SUMMARIES = ["review", "setup", "status"];
const NEEDS = ["nothing", "setup", "repair"];
const OUTCOMES = ["installed", "repaired", "updated", "status", "cancelled"];
const APP_IDS = ["claude-app", "claude-code", "dropbox", "hyperframes"];
const APP_ACTIONS = ["install-claude-code", "sign-in"];
const PURPOSES = ["drop", "exports"];
const MAY_BREAK = ["details", "summary", "body"];

const isObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isString = (x) => typeof x === "string";
const isWhole = (x) => Number.isInteger(x) && x >= 0;
const oneLine = (x) => isString(x) && !/[\r\n]/.test(x);
const hasBreak = (x) => /[\r\n]/.test(x);
const listOf = (x, test) => Array.isArray(x) && x.every(test);
const optional = (event, name, test) => event[name] === undefined || test(event[name]);

/** The field whose string holds a line break where none may, or "". Strings in a list count under the list's field. */
function breakIn(value, field) {
  if (isString(value)) return hasBreak(value) && !MAY_BREAK.includes(field) ? field : "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = breakIn(item, field);
      if (found) return found;
    }
    return "";
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      const found = breakIn(item, MAY_BREAK.includes(field) ? field : key);
      if (found) return found;
    }
  }
  return "";
}

function questionFault(q) {
  if (!isString(q.id) || q.id === "") return "question: id is not a name";
  if (!isString(q.prompt) || q.prompt === "") return "question: prompt is not a text";
  if (!optional(q, "warning", isString)) return "question: warning is not a text";
  if (!optional(q, "fault", isString)) return "question: fault is not a text";
  switch (q.kind) {
    case "confirm":
      return isString(q.ok) && q.ok !== "" ? "" : "question: ok is not a text";
    case "text":
      return isString(q.suggested) ? "" : "question: suggested is not a text";
    case "choice":
      return listOf(q.options, (o) => isObject(o) && isString(o.value) && isString(o.label) && optional(o, "detail", isString)) && q.options.length > 0 ? "" : "question: options is not a list of value and label";
    case "folder":
      if (!isString(q.suggested)) return "question: suggested is not a text";
      if (!isString(q.words)) return "question: words is not a text";
      return PURPOSES.includes(q.purpose) ? "" : "question: purpose is not drop or exports";
    case "apps":
      return listOf(q.apps, (a) => isObject(a) && APP_IDS.includes(a.id) && isString(a.name) && typeof a.here === "boolean" && optional(a, "link", isString) && optional(a, "note", isString) && optional(a, "action", (x) => APP_ACTIONS.includes(x))) ? "" : "question: apps is not a list of known apps";
    case "sign-in":
      if (!optional(q, "link", isString)) return "question: link is not a text";
      return q.paste === true ? "" : "question: paste is not true";
    default:
      return "question: kind is not one of the six";
  }
}

const FIELDS = {
  step: (e) => {
    if (!STEPS.includes(e.id)) return "step: id is not one of the steps";
    if (!Number.isInteger(e.n) || !Number.isInteger(e.of) || e.n < 1 || e.n > e.of) return "step: n and of are not whole numbers with n from 1 to of";
    if (!isString(e.title)) return "step: title is not a text";
    return listOf(e.body, isString) ? "" : "step: body is not a list of texts";
  },
  question: questionFault,
  progress: (e) => {
    if (!PARTS.includes(e.part)) return "progress: part is not one of the six";
    if (!isString(e.label)) return "progress: label is not a text";
    if (!STATES.includes(e.state)) return "progress: state is not a known state";
    if (!isWhole(e.done)) return "progress: done is not a whole number";
    if (e.total !== null && (!isWhole(e.total) || e.total < e.done)) return "progress: total is not null or a whole number from done up";
    return optional(e, "detail", isString) ? "" : "progress: detail is not a text";
  },
  summary: (e) => {
    if (!SUMMARIES.includes(e.id)) return "summary: id is not review, setup or status";
    if (typeof e.ok !== "boolean") return "summary: ok is not true or false";
    if (!listOf(e.lines, (l) => isObject(l) && isString(l.label) && isString(l.value))) return "summary: lines is not a list of label and value";
    if (!optional(e, "details", isString)) return "summary: details is not a text";
    if (!optional(e, "exit", Number.isInteger)) return "summary: exit is not a whole number";
    if (e.id === "status") return NEEDS.includes(e.needs) ? "" : "summary: needs is not nothing, setup or repair";
    return e.needs === undefined ? "" : "summary: needs belongs to status only";
  },
  done: (e) => {
    if (!OUTCOMES.includes(e.outcome)) return "done: outcome is not one of the five";
    if (!isString(e.summary)) return "done: summary is not a text";
    if (!isString(e.studio)) return "done: studio is not a text";
    if (e.guide !== null && !(isObject(e.guide) && isString(e.guide.html) && isString(e.guide.pdf))) return "done: guide is not null or html and pdf";
    return listOf(e.notes, isString) ? "" : "done: notes is not a list of texts";
  },
  error: (e) => {
    if (!CODES.includes(e.code)) return "error: code is not one of the known codes";
    if (!isString(e.message) || e.message === "") return "error: message is empty";
    for (const name of ["advice", "contact", "details"]) if (!optional(e, name, isString)) return `error: ${name} is not a text`;
    return "";
  },
};

/** "" when the event may be sent, otherwise why not. The why names fields, never values. */
export function eventFault(event) {
  if (!isObject(event)) return "An event is not an object.";
  if (!EVENTS.includes(event.event)) return "An event's name is not one of the six.";
  const wrong = FIELDS[event.event](event);
  if (wrong) return wrong;
  const broken = breakIn(event, "");
  return broken ? `${event.event}: ${broken} holds a line break` : "";
}

/** A function that writes one event as one JSON line. It throws on a faulty event before it writes anything. */
export function emitter(output) {
  return (event) => {
    const fault = eventFault(event);
    if (fault) throw new Error(`The engine made a faulty event. ${fault}`);
    output.write(`${JSON.stringify(event)}\n`);
  };
}

/** The shell's lines, one object each, queued so that next() may wait while other work goes on. null at the end of the input. */
export function readerOf(input) {
  const queue = [];
  const waiting = [];
  let ended = false;
  const push = (item) => {
    const waiter = waiting.shift();
    if (waiter) waiter(item);
    else queue.push(item);
  };
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on("line", (line) => {
    if (line.trim() === "") return;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      value = undefined;
    }
    push(isObject(value) ? value : { fault: "A line was not a JSON object." });
  });
  lines.on("close", () => {
    ended = true;
    while (waiting.length) waiting.shift()(null);
  });
  return {
    next() {
      if (queue.length) return Promise.resolve(queue.shift());
      if (ended) return Promise.resolve(null);
      return new Promise((resolve) => waiting.push(resolve));
    },
  };
}

/** "" when the line holds exactly one of an answer (with its value), back: true and cancel: true, otherwise why not. */
export function lineFault(line) {
  if (!isObject(line)) return "A line is not an object.";
  const present = ["answer", "back", "cancel"].filter((name) => line[name] !== undefined);
  if (present.length !== 1) return "A line must hold exactly one of answer, back and cancel.";
  if (present[0] === "answer") {
    if (!isString(line.answer) || line.answer === "") return "answer is not a question id.";
    return line.value === undefined ? "An answer has no value." : "";
  }
  return line[present[0]] === true ? "" : `${present[0]} is not true.`;
}

/** "" when the answer is to the open question and its value is of the question's kind, otherwise why not. The shape only. */
export function answerFault(question, line) {
  const fault = lineFault(line);
  if (fault) return fault;
  if (line.answer === undefined) return "The line is not an answer.";
  if (line.answer !== question.id) return "The answer is not to the open question.";
  const value = line.value;
  switch (question.kind) {
    case "confirm":
      return value === true ? "" : "A confirm takes true.";
    case "text":
      return oneLine(value) ? "" : "A text takes a string of one line.";
    case "choice":
      return Array.isArray(question.options) && question.options.some((o) => o.value === value) ? "" : "The value is not one of the options.";
    case "folder":
      return oneLine(value) && isAbsolute(value) ? "" : "A folder takes an absolute path.";
    case "apps": {
      if (value === "check" || value === "continue") return "";
      if (APP_ACTIONS.includes(value)) return Array.isArray(question.apps) && question.apps.some((a) => a.action === value) ? "" : "No app in the question carries that action.";
      return "The value is not one of the app answers.";
    }
    case "sign-in": {
      if (!isObject(value)) return "A sign-in takes an object.";
      if (Object.keys(value).some((key) => key !== "code")) return "A sign-in takes only a code.";
      return value.code === undefined || (oneLine(value.code) && value.code !== "") ? "" : "The code is not a string of one line.";
    }
    default:
      return "The open question has no known kind.";
  }
}

const OPTIONS = ["--run", "--app", "--tools", "--protocol"];

/** The command line's four options, or { fault, code }. A fault names an option and never its value. */
export function argsOf(argv) {
  const given = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    if (!OPTIONS.includes(name)) return { fault: "An option the engine does not know was given.", code: "arguments" };
    if (given.has(name)) return { fault: `${name} was given more than once.`, code: "arguments" };
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) return { fault: `${name} has no value.`, code: "arguments" };
    given.set(name, value);
  }
  for (const name of OPTIONS) if (!given.has(name)) return { fault: `${name} is missing.`, code: "arguments" };
  if (given.get("--protocol") !== String(PROTOCOL)) return { fault: `--protocol is not ${PROTOCOL}.`, code: "protocol" };
  if (!RUNS.includes(given.get("--run"))) return { fault: "--run is not one of the runs.", code: "arguments" };
  if (!isAbsolute(given.get("--app"))) return { fault: "--app is not an absolute path.", code: "arguments" };
  if (!isAbsolute(given.get("--tools"))) return { fault: "--tools is not an absolute path.", code: "arguments" };
  if (given.get("--tools").includes(":")) return { fault: "--tools holds a colon.", code: "arguments" };
  return { run: given.get("--run"), app: given.get("--app"), tools: given.get("--tools"), protocol: PROTOCOL };
}
