// The setup engine's questions, as whole `question` events, and the reading of each answer into a value, a warning or a fault. Pure:
// it starts no program, writes nothing and emits nothing. It reads the disk only through settings.js's folder faults and nameClash.
// Every line is what a person reads, so it says "BRIMM Video Studio" and never the name of a program.
import { switchFor } from "../access.js";
import { cloudFolder, dropFolderFault, exportsFolderFault, defaultDropFolder, folderWords, machineFault } from "../settings.js";
import { APPS, GUARD_CLAUDE, NO_BRIMM_VIDEO, nameClash } from "./checks.js";

/** A faults that settings.js words as a phrase, as a sentence: a capital first letter and a full stop. */
export function sentence(words) {
  const text = String(words).trim();
  if (text === "") return "";
  const capital = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

/** The name macOS shows for the program that asks for a folder: the app's own, in these questions always. access.js's lookerOf says
    the same for an installed app, and a test holds the two equal. */
const LOOKER = "BRIMM Video Studio";

/** A whole question event. A warning and a fault go in only when they are given and not empty. */
function made(id, kind, prompt, fields = {}, { warning, fault } = {}) {
  const question = { event: "question", id, kind, prompt, ...fields };
  if (warning) question.warning = warning;
  if (fault) question.fault = fault;
  return question;
}

const isText = (x) => typeof x === "string" && x.trim() !== "";
/** Whether a pin names a version, where to get it and its SHA-256: the install button is shown only with a whole one. */
const wholePin = (pin) => Boolean(pin) && typeof pin === "object" && isText(pin.version) && isText(pin.url) && isText(pin.sha256);
const supportSentence = (support) => (isText(support) ? `Write to ${support.trim()} for help.` : "");
const joined = (...parts) => parts.filter((part) => part).join(" ");

export const welcomeQuestion = () => made("welcome", "confirm", "Set up BRIMM Video Studio on this Mac?", { ok: "Continue" });

export const nameQuestion = ({ suggested = "", warning, fault } = {}) => made("name", "text", "What should this Mac be called?", { suggested }, { warning, fault });

/** The apps question. `state` is { here, claude }, from appsHere and claudeState. `support` is the support contact, put at the end of
    Claude Code's note when this copy cannot install it. */
export function appsQuestion(state, { pin, warning, fault, working, support } = {}) {
  const canInstall = wholePin(pin);
  const claude = state.claude ?? {};
  const rows = APPS.map((app) => {
    if (app.id === "claude-code") {
      const ready = Boolean(claude.here && claude.enough && claude.signedIn);
      const row = { id: app.id, name: app.name, here: ready };
      if (working) return { ...row, note: working };
      if (!claude.here) {
        if (canInstall) return { ...row, note: "Not installed.", action: "install-claude-code" };
        return { ...row, note: joined("Not installed.", supportSentence(support)) };
      }
      if (!claude.enough) {
        const note = `Version ${claude.version ?? "unknown"} is too old: BRIMM Video Studio needs ${GUARD_CLAUDE} or later.`;
        return canInstall ? { ...row, note, action: "install-claude-code" } : { ...row, note };
      }
      if (!claude.signedIn) return { ...row, note: "Not signed in yet.", action: "sign-in" };
      return row;
    }
    const here = Boolean(state.here?.[app.id]);
    const row = { id: app.id, name: app.name, here };
    if (app.link) row.link = app.link;
    const note = joined(app.note, here ? "" : app.administrator);
    if (note) row.note = note;
    return row;
  });
  return made("apps", "apps", "These apps work with BRIMM Video Studio.", { apps: rows }, { warning, fault });
}

export const signInQuestion = ({ link, fault } = {}) => made("sign-in", "sign-in", "Sign in to Claude in the browser. If it gives a code, paste it here.", { paste: true, ...(link ? { link } : {}) }, { fault });

/** The BRIMM Video folders found, as a choice; null when exactly one was found, since then there is nothing to ask. */
export function rootQuestion(found, home) {
  if (found.length === 1) return null;
  const again = { value: "look-again", label: "Look again" };
  if (found.length === 0) return made("dropbox", "choice", NO_BRIMM_VIDEO[0], { options: [{ ...again, detail: NO_BRIMM_VIDEO.slice(1).join(" ") }] });
  return made("dropbox", "choice", "Which BRIMM Video folder is The BRIMM's?", { options: [...found.map((path) => ({ value: path, label: folderWords(path, home) })), again] });
}

const FOLDER_PROMPTS = { drop: "Where will videos be dropped on this Mac?", exports: "Where does HyperFrames save its exports on this Mac?" };

export const folderQuestion = (purpose, { suggested, home, warning, fault }) => made(`${purpose}-folder`, "folder", FOLDER_PROMPTS[purpose], { suggested, words: folderWords(suggested, home), purpose }, { warning, fault });

/** The question when macOS will not let this app look in `folder`. `place` is drop, episodes or downloads. */
export const permissionQuestion = (place, { folder, home }) => made(`permission-${place}`, "choice", `This Mac does not let ${LOOKER} look in ${folderWords(folder, home)}. In System Settings, under Privacy & Security, Files and Folders, turn on ${switchFor(folder, home)} under "${LOOKER}". Then choose Look again.`, { options: [{ value: "again", label: "Look again" }, { value: "skip", label: "Go on without it" }] });

export const reviewQuestion = (ok) => (ok
  ? made("review", "confirm", "Install BRIMM Video Studio on this Mac?", { ok: "Install" })
  : made("review", "choice", "This Mac is not ready to install yet. What stands in the way is under Details.", { options: [{ value: "again", label: "Check again" }] }));

/** The faults of "continue" in the apps question, the first that holds, or "". */
function continueFault({ state, pin, support }) {
  const claude = state?.claude ?? {};
  const canInstall = wholePin(pin);
  const help = supportSentence(support);
  if (!claude.here) return canInstall ? "Claude Code is not installed yet. Choose Install Claude Code." : joined("This copy of BRIMM Video Studio cannot install Claude Code.", help);
  if (!claude.enough) return joined(`Claude Code ${claude.version ?? "unknown"} is too old: BRIMM Video Studio needs ${GUARD_CLAUDE} or later.`, canInstall ? "Choose Install Claude Code." : help);
  if (!claude.signedIn) return "Claude Code is not signed in yet. Choose Sign in.";
  if (!state?.here?.dropbox) return "Dropbox is not installed yet. Install it, sign in to The BRIMM's account, then choose Continue.";
  return "";
}

/** The warning of "continue" for the Claude app and HyperFrames when either is missing, or "". */
function continueWarning(state) {
  const missing = ["claude-app", "hyperframes"].filter((id) => !state?.here?.[id]).map((id) => APPS.find((app) => app.id === id).name);
  if (missing.length === 0) return "";
  return `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not installed yet. You can go on: the Getting Started guide lists what is still to install.`;
}

const take = (value, warning) => (warning ? { value, warning } : { value });
const refuse = (what) => ({ fault: `That answer is not one of the choices${what ? ` for ${what}` : ""}.` });

/** An answer to `question`, read: { value }, { value, warning } or { fault }. `ctx` is { home, root, drop, exports, state, pin, support },
    each given when the engine knows it. A fault is a sentence. A pasted sign-in code is never put into a fault or a warning. */
export function read(question, value, ctx = {}) {
  const { home, root, drop, exports } = ctx;
  const id = question.id;
  if (id === "welcome") return value === true ? { value: true } : refuse("this question");
  if (id === "name") {
    if (typeof value !== "string") return refuse("the name");
    const name = value.trim();
    const wrong = machineFault(name);
    if (wrong) return { fault: sentence(wrong) };
    return take(name, root ? nameClash(name, root) : "");
  }
  if (id === "apps") {
    if (["check", "install-claude-code", "sign-in"].includes(value)) return { value };
    if (value !== "continue") return refuse("the apps");
    const fault = continueFault(ctx);
    return fault ? { fault } : take("continue", continueWarning(ctx.state));
  }
  if (id === "sign-in") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return refuse("signing in");
    const code = typeof value.code === "string" ? value.code.trim() : "";
    return { value: code ? { code } : {} };
  }
  if (id === "dropbox") return value === "look-again" || question.options?.some((option) => option.value === value) ? { value } : refuse("BRIMM Video");
  if (id === "drop-folder") {
    const fault = dropFolderFault(value, { home, root, ...(exports ? { exports } : {}) });
    if (fault) return { fault: sentence(fault) };
    const cloud = cloudFolder(value, home);
    return take(value, cloud ? `This folder is kept in ${cloud}: every video dropped here would be uploaded there too. A folder on this Mac itself, such as BRIMM Video Work › Drop, is better.` : "");
  }
  if (id === "exports-folder") {
    const fault = exportsFolderFault(value, { home, root, drop: drop ?? defaultDropFolder(home) });
    return fault ? { fault: sentence(fault) } : { value };
  }
  if (id.startsWith("permission-")) return value === "again" || value === "skip" ? { value } : refuse("the folder");
  if (id === "review") {
    const wanted = question.kind === "confirm" ? true : "again";
    return value === wanted ? { value } : refuse("the review");
  }
  return refuse("");
}
