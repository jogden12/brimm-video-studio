// What the setup engine tells a person before and after it sets a Mac up: the review shown before Install, the summary shown after it,
// the status, and the text for "Copy setup summary". The review is made from what settings.js plans and from this file's own words,
// never from what the installer prints (that goes under `details`). The one function here that starts a program is planOf.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { unfinishedBy } from "../set-up.js";
import { dropFolderOf, exportsFolderOf, folderWords } from "../settings.js";
import { installerEnv, quiet } from "./install.js";

/** The arguments settings.js's plan is given for these answers: install.sh's own (its settings_plan, and --drop-folder and
    --exports-folder as its switch_args pass them on). A held Mac names no folder, and the plan keeps the ones its settings hold. */
export function planArgs(answers, { checkout }) {
  const head = ["plan", "--machine", answers.machine, "--root", answers.root, "--checkout", checkout];
  return answers.kind === "fresh" ? [...head, "--drop-folder", answers.drop, "--exports-folder", answers.exports] : head;
}

const PLAN_FAILED = "BRIMM Video Studio could not work out what it would set up on this Mac.";
const PLAN_UNREAD = "BRIMM Video Studio could not read the settings it planned for this Mac.";

/** Asks settings.js what it would write, with the real node unless another is given: `{ code: 0, settings }`, or `{ code, why }` with
    the plan's own words and a code that is never 0. The settings are the JSON object that comes first in what it prints, up to the
    first line that is `}` alone: the plain lines after it are not read. Nothing is written. */
export function planOf({ answers, home, checkout, node = process.execPath, run = spawnSync }) {
  const ran = run(node, [join(checkout, "tool", "settings.js"), ...planArgs(answers, { checkout })], { encoding: "utf8", env: installerEnv(home), input: "", timeout: 60000 });
  const said = quiet(String(ran?.stdout ?? "")).trim();
  const code = Number.isInteger(ran?.status) && ran.status !== 0 ? ran.status : 1;
  if (!ran || ran.error || ran.status !== 0) return { code, why: said || quiet(String(ran?.stderr ?? "")).trim() || PLAN_FAILED };
  const lines = String(ran.stdout).split("\n");
  const end = lines.indexOf("}");
  try {
    const settings = JSON.parse(end < 0 ? "" : lines.slice(0, end + 1).join("\n"));
    if (settings && typeof settings === "object" && !Array.isArray(settings)) return { code: 0, settings };
  } catch {
    // Not JSON: told below.
  }
  return { code: 1, why: PLAN_UNREAD };
}

/** A value on one line: whatever line break it holds becomes a space. */
const one = (text) => String(text).replace(/\s*[\r\n]+\s*/g, " ").trim();
const line = (label, value) => ({ label, value: one(value) });

const versionLine = (build) => (build?.broken || !build?.version ? "This copy's version cannot be read." : `Version ${build.version} (${build.build})`);

/** Claude Code's line: the version and whether it is signed in, and the plan. Never the address or the organisation. */
function claudeLine(claude) {
  if (!claude?.here) return "Not found on this Mac.";
  const version = claude.version ?? "that cannot be read";
  if (!claude.enough) return claude.version ? `Version ${version}, which is too old for BRIMM Video Studio.` : "Its version cannot be read, so it may be too old for BRIMM Video Studio.";
  if (!claude.signedIn) return `Version ${version}, not signed in.`;
  return claude.plan ? `Version ${version}, signed in, on the ${claude.plan} plan.` : `Version ${version}, signed in.`;
}

const MOVING = {
  takeover: "This Mac already runs BRIMM Video Studio from an older copy. Installing moves it to this app. Its name, its settings and its drop folder stay as they are.",
  moved: "This Mac was set up from a copy of BRIMM Video Studio that is no longer where it was. Installing points it at this one."
};

/** The review: a whole `summary` event, id `review`. Its ok is the installer's exit code being 0 and a plan that was made, and its
    details are the installer's text, with the plan's refusal first when it refused. */
export function reviewSummary({ kind, moved, answers, home, build, printed, planned, claude, here }) {
  const made = planned?.code === 0 && planned.settings;
  const settings = made ? planned.settings : null;
  const name = settings?.machine ?? answers.machine;
  const root = settings?.root ?? answers.root;
  const lines = [line("This Mac", name), line("BRIMM Video in Dropbox", folderWords(root, home))];
  if (settings) lines.push(line("Drop folder", folderWords(dropFolderOf(settings, home), home)), line("Exports folder", folderWords(exportsFolderOf(settings, home), home)));
  else if (answers.kind === "fresh") lines.push(line("Drop folder", folderWords(answers.drop, home)), line("Exports folder", folderWords(answers.exports, home)));
  lines.push(
    line("BRIMM Video Studio", versionLine(build)),
    line("Transcription model", here.model ? "Already on this Mac." : "Will be downloaded (about 1.6 GB)."),
    line("HyperFrames tools", here.cli ? "Already on this Mac." : "Will be fetched."),
    line("Claude Code", claudeLine(claude)),
    line("Background job", "Watches the drop folder for new videos, and starts when you log in.")
  );
  if (kind === "takeover") lines.push(line("Moving to this app", MOVING.takeover));
  else if (kind === "installed" && moved) lines.push(line("Moving to this app", MOVING.moved));
  const text = String(printed.text ?? "");
  return { event: "summary", id: "review", ok: printed.code === 0 && Boolean(made), lines, details: made ? text : `${planned?.why ?? PLAN_FAILED}\n\n${text}`, exit: printed.code };
}

/** The three lines that say where a set-up Mac's folders are, from its settings: the setup summary and the status word them alike. */
const folderLines = (settings, home) => [
  line("BRIMM Video in Dropbox", folderWords(settings.root, home)),
  line("Drop folder", folderWords(dropFolderOf(settings, home), home)),
  line("Exports folder", folderWords(exportsFolderOf(settings, home), home))
];

/** The setup summary: a whole `summary` event, id `setup`. Its ok is whether Claude answered from the background job; when it did not,
    the check's own line is its details. The old copy of a takeover is named and left as it is. */
export function setupSummary({ kind, home, settings, build, claude, check, missing, old }) {
  const lines = [
    line("This Mac", settings.machine),
    line("BRIMM Video Studio", versionLine(build)),
    ...folderLines(settings, home),
    line("Claude Code", claudeLine(claude)),
    line("Background job", check.answered ? "Claude answered from the background job." : "Claude did not answer from the background job.")
  ];
  if (missing.length > 0) lines.push(line("Still to install", missing.join(", ")));
  if (kind === "takeover" && old) lines.push(line("Older copy", `${folderWords(old, home)} is no longer used, and was left as it is.`));
  return { event: "summary", id: "setup", ok: check.answered, lines, ...(check.answered ? {} : { details: check.line }) };
}

const SETUP = {
  fresh: "BRIMM Video Studio is not set up on this Mac yet.",
  takeover: "This Mac runs BRIMM Video Studio from an older copy. Setup moves it to this app.",
  moved: "This Mac was set up from a copy of BRIMM Video Studio that is no longer where it was. Repair points it at this one.",
  installed: "BRIMM Video Studio is set up on this Mac.",
  updated: "BRIMM Video Studio was updated on this Mac. It finishes the update when it is opened."
};

/** The status: a whole `summary` event, id `status`, with what this Mac needs, and its folders when it has settings. It starts no
    program and reads no file: the settings, and the record of the build that set the Mac up, are the ones kindOf already read. An
    installed Mac that was not moved needs an update when set-up.js's `unfinishedBy` holds for kindOf's record: the app's build is an
    installed one that can be read, and the record is of another build, or there is none. */
export function statusSummary({ found, home, build }) {
  const updated = unfinishedBy(found.setUpBy, build);
  const state = found.kind === "installed" ? (found.moved ? "moved" : updated ? "updated" : "installed") : found.kind === "takeover" ? "takeover" : "fresh";
  const needs = { fresh: "setup", takeover: "setup", moved: "repair", updated: "update", installed: "nothing" }[state];
  const lines = [];
  if (found.settings?.machine) lines.push(line("This Mac", found.settings.machine));
  lines.push(line("BRIMM Video Studio", versionLine(build)), line("Setup", SETUP[state]));
  if (found.settings) lines.push(...folderLines(found.settings, home));
  return { event: "summary", id: "status", ok: needs === "nothing", lines, needs };
}

/** The text for "Copy setup summary": label: value, one to a line, in the summary's order, without its details. */
export function summaryText(summary) {
  return summary.lines.map((one) => `${one.label}: ${one.value}`).join("\n");
}
