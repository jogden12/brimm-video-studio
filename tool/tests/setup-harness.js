// A made-up Mac for the setup engine's tests: one temp folder that holds an app's copy, a home, a BRIMM Video folder in a Dropbox
// folder, stand-ins for Claude Code and for the system programs the engine runs, and the words each says. No test reaches this
// computer's own home, programs or Applications folder, and no installer runs unless it is asked what it would do (printOnly).
// Not a test: node --test runs only *.test.js.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PassThrough, Writable } from "node:stream";
import { dirname, join } from "node:path";
import { appCopy } from "./app-copy.js";
import { settingsFile, writeSettings } from "../settings.js";

export const notAMac = process.platform !== "darwin" ? "the installer is for a Mac, and so is plutil, which reads what it would write" : false;

/** A stand-in program: a shell script that is run. */
function standIn(file, script) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `#!/bin/sh\n${script}`);
  chmodSync(file, 0o755);
}

/** The words each stand-in for Claude Code says, as `claude` gives them: its version, and what it prints for `auth status --json`.
    Both signed-in and signed-out say an email address and an organisation, so that a test sees any leak of them. */
const CLAUDE = {
  "signed-in": { version: "2.1.296 (Claude Code)", status: JSON.stringify({ loggedIn: true, authMethod: "claude.ai", email: "jane@example.invalid", orgName: "Example Org", subscriptionType: "max" }), exit: 0 },
  "signed-out": { version: "2.1.296 (Claude Code)", status: JSON.stringify({ loggedIn: false, email: "jane@example.invalid", orgName: "Example Org" }), exit: 1 },
  old: { version: "2.0.0 (Claude Code)", status: JSON.stringify({ loggedIn: true, authMethod: "claude.ai", email: "jane@example.invalid", orgName: "Example Org", subscriptionType: "max" }), exit: 0 }
};

/** A whole made-up Mac in one temp folder.
    - `settings`: "none"; "takeover" (usable settings whose checkout is a git clone in the folder); "installed" (the checkout is this
      app's copy); "moved" (the checkout is another app's copy); "dev" (takeover's, marked as Jason's development Mac); "unusable"
      (a settings file that holds `{`).
    - `apps`: any of "claude-app", "dropbox" and "hyperframes", each made as that app's folder in the home's Applications folder.
    - `dropbox`: whether there is a BRIMM Video folder (`root`) in Dropbox, with Drop, Unedited Video and one episode.
    - `claude`: "none", "signed-out", "old" or "signed-in": the Claude Code in ~/.local/bin. It says what dir/says/claude-version and
      dir/says/claude-status hold, and `auth login` prints dir/says/claude-login, reads a line and writes it into dir/claude-got.
    - `programs` are stand-ins in dir/bin. Each writes "<name> <arguments>" into `ran()`, prints dir/says/<name> when it is there and ends
      with the number in dir/exits/<name> when it is there. curl writes dir/says/curl's bytes to the file after --output, and script
      runs what follows /dev/null. The installer (a list: the program and its first arguments) waits while dir/hold is there and appends
      dir/says/check-log, when there is one, to the log the installer's own check of Claude writes. */
export function mac({ settings = "none", apps = [], dropbox = true, claude = "signed-in" } = {}) {
  const copy = appCopy({ under: "Copy" });
  const { dir, app, tools, checkout } = copy;
  const home = join(dir, "home");
  const bin = join(dir, "bin");
  const ranFile = join(dir, "ran");
  const root = join(home, "Library", "CloudStorage", "Dropbox", "The BRIMM DB", "BRIMM Video");
  mkdirSync(home, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(join(dir, "says"), { recursive: true });
  mkdirSync(join(dir, "exits"), { recursive: true });
  if (dropbox) {
    for (const name of ["Drop", "Unedited Video", join("Episodes", "2026-11-01 Client Jane (Old Mac)")]) mkdirSync(join(root, name), { recursive: true });
  }
  const names = { "claude-app": "Claude.app", dropbox: "Dropbox.app", hyperframes: "HyperFrames.app" };
  for (const id of apps) mkdirSync(join(home, "Applications", names[id]), { recursive: true });

  if (claude !== "none") {
    const says = CLAUDE[claude];
    writeFileSync(join(dir, "says", "claude-version"), `${says.version}\n`);
    writeFileSync(join(dir, "says", "claude-status"), says.status);
    writeFileSync(join(dir, "says", "claude-login"), "Opening the browser to sign in.\nPaste the code here if the browser does not open.\n");
    standIn(join(home, ".local", "bin", "claude"), [
      `case "$*" in`,
      `  --version) cat "${join(dir, "says", "claude-version")}" ;;`,
      `  "auth status --json") cat "${join(dir, "says", "claude-status")}"; [ "$(grep -c '"loggedIn":true' "${join(dir, "says", "claude-status")}")" = 1 ] && exit 0; exit 1 ;;`,
      `  "auth login") cat "${join(dir, "says", "claude-login")}"; read -r line; printf '%s\\n' "$line" > "${join(dir, "claude-got")}" ;;`,
      `  *) echo "claude $*" >> "${ranFile}" ;;`,
      `esac`,
      ""
    ].join("\n"));
  }

  // The system programs. Each one's first lines are the same: write down the call, print what the test has it say.
  const own = (name) => [`echo "${name} $*" >> "${ranFile}"`, `[ -f "${join(dir, "says", name)}" ] && cat "${join(dir, "says", name)}"`, `[ -f "${join(dir, "exits", name)}" ] && exit "$(cat "${join(dir, "exits", name)}")"`, "exit 0", ""].join("\n");
  const exitsOf = (name) => `[ -f "${join(dir, "exits", name)}" ] && exit "$(cat "${join(dir, "exits", name)}")"`;
  for (const name of ["launchctl", "scutil", "codesign"]) standIn(join(bin, name), own(name));
  standIn(join(bin, "curl"), [
    `echo "curl $*" >> "${ranFile}"`,
    `out=""; prev=""`,
    `for a in "$@"; do [ "$prev" = "--output" ] && out="$a"; prev="$a"; done`,
    `[ -n "$out" ] && [ -f "${join(dir, "says", "curl")}" ] && cat "${join(dir, "says", "curl")}" > "$out"`,
    exitsOf("curl"),
    "exit 0",
    ""
  ].join("\n"));
  standIn(join(bin, "script"), [
    `echo "script $*" >> "${ranFile}"`,
    `while [ $# -gt 0 ] && [ "$1" != "/dev/null" ]; do shift; done`,
    `shift`,
    `"$@"; code=$?`,
    exitsOf("script"),
    `exit $code`,
    ""
  ].join("\n"));
  standIn(join(bin, "installer"), [
    `echo "installer $*" >> "${ranFile}"`,
    `while [ -f "${join(dir, "hold")}" ]; do sleep 0.1; done`,
    `if [ -f "${join(dir, "says", "check-log")}" ]; then mkdir -p "${join(home, "Library", "Logs")}"; cat "${join(dir, "says", "check-log")}" >> "${join(home, "Library", "Logs", "brimm-video-claude-check.log")}"; fi`,
    `[ -f "${join(dir, "says", "installer")}" ] && cat "${join(dir, "says", "installer")}"`,
    exitsOf("installer"),
    "exit 0",
    ""
  ].join("\n"));
  const programs = { launchctl: join(bin, "launchctl"), scutil: join(bin, "scutil"), curl: join(bin, "curl"), codesign: join(bin, "codesign"), script: join(bin, "script"), installer: [join(bin, "installer")] };

  // This Mac's settings, written as the tool writes them, never typed.
  const fields = { machine: "Studio Test", root, dropPath: join(home, "BRIMM Video Work", "Drop"), exportsPath: join(home, "Exports") };
  const clone = () => {
    const folder = join(dir, "Studio clone");
    mkdirSync(join(folder, ".git"), { recursive: true });
    return folder;
  };
  if (settings === "takeover") writeSettings(home, { ...fields, checkout: clone() });
  else if (settings === "installed") writeSettings(home, { ...fields, checkout });
  else if (settings === "moved") writeSettings(home, { ...fields, checkout: join(dir, "Old", "BRIMM Video Studio.app", "Contents", "Resources", "Studio") });
  else if (settings === "dev") writeSettings(home, { ...fields, checkout: clone(), mode: "dev" });
  else if (settings === "unusable") {
    mkdirSync(dirname(settingsFile(home)), { recursive: true });
    writeFileSync(settingsFile(home), "{");
  } else if (settings !== "none") throw new Error(`no such kind of settings: ${settings}`);

  return { dir, home, root, app, tools, checkout, programs, ran: copy.ran, done: copy.done };
}

/** The installer's calls in what `ran()` holds, each as its arguments. An argument with a space in it is split, as the stand-in
    writes its arguments with `$*`. */
export const installCalls = (ran) => ran.split("\n").filter((line) => line.startsWith("installer ")).map((line) => line.slice("installer ".length).split(" "));

/** The text of this Mac's settings file, or null when there is none. */
export const settingsOf = (home) => (existsSync(settingsFile(home)) ? readFileSync(settingsFile(home), "utf8") : null);

/** An installer for `programs.installer` that reaches the real install.sh of the app's copy, and only to ask what it would do: a guard
    that passes its arguments on when --print is among them and --yes is not, and otherwise writes "refused <arguments>" into `ran()`
    and ends with 99. The stand-ins come first on its PATH, and BRIMM_CLAUDE is the stand-in for Claude Code, as install.test.js's
    askWith has them. */
export function printOnly(m) {
  const guard = join(m.dir, "bin", "install-guard");
  standIn(guard, [
    `has_print=0; has_yes=0`,
    `for a in "$@"; do case "$a" in --print) has_print=1 ;; --yes) has_yes=1 ;; esac; done`,
    `if [ "$has_print" = 1 ] && [ "$has_yes" = 0 ]; then`,
    `  PATH="${join(m.dir, "bin")}:$PATH" BRIMM_CLAUDE="${join(m.home, ".local", "bin", "claude")}" exec /bin/zsh "${join(m.checkout, "tool", "install.sh")}" "$@"`,
    `fi`,
    `echo "refused $*" >> "${join(m.dir, "ran")}"`,
    `exit 99`,
    ""
  ].join("\n"));
  return [guard];
}

/** Runs the engine once, in this process, as the app's shell would start it, and gives { code, events, errors }: its exit code, each
    event it sent (the JSON lines of its output) and each line it wrote for a developer. `answers(event)` is called with every event;
    a line it gives back, as text or as an object, is sent to the engine. engine.js is imported when this is first called, so that
    this file loads before the engine exists. The engine is given no real launchd to wait on, no sleeping, and an Applications
    folder of the made-up Mac that holds nothing. */
export async function drive(m, { run, answers = () => undefined, why = () => "", argv, look } = {}) {
  const { runSetup } = await import("../setup/engine.js");
  const input = new PassThrough();
  const events = [];
  const errors = [];
  const lines = (into) => {
    let held = "";
    return new Writable({
      write(chunk, _encoding, done) {
        held += chunk.toString("utf8");
        const parts = held.split("\n");
        held = parts.pop();
        for (const line of parts) into(line);
        done();
      }
    });
  };
  const output = lines((line) => {
    if (line === "") return;
    const event = JSON.parse(line);
    events.push(event);
    const reply = answers(event);
    if (reply !== undefined && reply !== null) input.write(`${typeof reply === "string" ? reply : JSON.stringify(reply)}\n`);
  });
  const stderr = lines((line) => errors.push(line));
  const given = { programs: m.programs, applications: join(m.dir, "Applications"), ...(look ? { look } : {}) };
  const code = await runSetup({
    argv: argv ?? ["--run", run, "--app", m.app, "--tools", m.tools, "--protocol", "1"],
    input, output, errors: stderr, home: m.home, checkout: m.checkout,
    why, wait: async () => {}, now: () => new Date(), ...given
  });
  input.end();
  return { code, events, errors };
}
