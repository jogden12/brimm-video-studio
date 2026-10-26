// A made-up Mac with the open lock, for the open lock's tests: a home with a space and an apostrophe, BRIMM Video in a made-up
// Dropbox, a checkout, a temp folder of its own (<dir>/tmp, never Claude Code's real one), this Mac's settings saying open with the
// node her folder was written with, her folder written open and trusted, and her chat's transcript where Claude Code keeps it. With
// it, stand-ins for what the lock check and the guard would ask of this Mac: the process table `ps` gives (psText, chatChain), the
// arguments the Claude app starts a chat's `claude` with (APP_ARGS), the record of those flags (RECORD), a transcript, the chat's
// environment (CHAT_ENV) and the `deps` every open-lock test gives (openDeps), so that no real `ps`, `lsof` or `plutil` runs, this
// Mac's managed settings and temp folder are never read, and the runner's own environment (often a Claude Code session's) is never
// taken for the chat's.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALLOW_DEFAULT, workshopFolder, writeStudio } from "../studio.js";
import { writeSettings } from "../settings.js";
import { claudeDirName } from "../places.js";

/** The node her folder is written with in these tests. */
export const NODE = "/opt/homebrew/bin/node";
/** A chat's id, as Claude Code gives one. */
export const SESSION = "11111111-2222-4333-8444-555555555555";
/** The Claude Code version the open lock is checked on in these tests. */
export const MINIMUM = "2.1.308";

/** A made-up Mac with the open lock, made for one test or one describe, and removed by `done()`. */
export function openWorld() {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-open-")));
  const home = join(dir, "Sallie's home");
  const dropbox = join(dir, "Dropbox (Personal)");
  const root = join(dropbox, "The BRIMM DB", "BRIMM Video");
  const checkout = join(dir, "Claude Code", "BRIMM video");
  const tmp = join(dir, "tmp");
  for (const d of [home, join(root, "Assets"), join(dropbox, ".dropbox.cache"), checkout, tmp]) mkdirSync(d, { recursive: true });
  const uid = 502;
  const port = 47123;
  writeSettings(home, { machine: "Sallie's laptop", root, checkout, lock: "open", proxyPort: port, studioNode: NODE });
  const facts = { home, root, uid, tmp, zoomFolder: join(home, "Documents", "Zoom"), port, web: "held", allow: [...ALLOW_DEFAULT] };
  const folder = writeStudio(home, { checkout, node: NODE, lock: "open", facts });
  // Her folder trusted, as step 9 of the setup guide has her do once.
  writeFileSync(join(home, ".claude.json"), JSON.stringify({ projects: { [folder]: { hasTrustDialogAccepted: true } } }));
  // Her chat's transcript, started in her folder, with no folder added to it.
  transcript(join(home, ".claude", "projects", claudeDirName(folder)), [{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }]);
  return { dir, home, root, checkout, node: NODE, folder, workshop: workshopFolder(home), uid, tmp, port, facts, cwd: folder, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** A start time as `ps -o lstart=` gives it with LC_ALL=C: 24 letters. */
const LSTART = "Mon Oct 26 09:00:00 2026";

/** What `/bin/ps -A -ww -o pid=,ppid=,lstart=,args=` prints for these rows, `[pid, ppid, args]` or `[pid, ppid, args, lstart]`. */
export const psText = (rows) => rows.map(([pid, ppid, args, start = LSTART]) => `${String(pid).padStart(5)} ${String(ppid).padStart(5)} ${start} ${args}`).join("\n") + "\n";

/** A chat's processes, from edit.js up: node 900 ← zsh 800 ← claude (700, or `claude`) ← launchd 1, the claude given `args`. */
export const chatChain = ({ claude = 700, args }) => psText([
  [1, 0, "/sbin/launchd"],
  [claude, 1, args],
  [800, claude, "/bin/zsh -c source /tmp/snapshot.sh && eval 'node edit.js episodes'"],
  [900, 800, `${NODE} /x/tool/edit.js episodes`],
]);

/** The arguments the Claude app starts a chat in her folder with: its own copy of Claude Code, the flags of RECORD, and the app's
    notes folder added. */
export const APP_ARGS = (folder, home) => [
  `${join(home, "Library", "Application Support", "Claude", "claude-code", MINIMUM, "claude")}`,
  "--output-format stream-json",
  "--input-format stream-json",
  "--verbose",
  "--model claude-opus-5-5",
  "--permission-prompt-tool stdio",
  "--permission-mode default",
  "--settings {}",
  `--add-dir=${join(home, "Library", "Application Support", "Claude", "side-session-notes", "local_00000000-0000-4000-8000-000000000000")}`,
  `--project-config-root ${folder}`,
  "--setting-sources=user,project,local",
].join(" ");

/** The record of the flags the Claude app starts her chats with (the by-hand round's, made up here). */
export const RECORD = { flags: ["--output-format", "--input-format", "--verbose", "--model", "--effort", "--resume", "--permission-prompt-tool", "--permission-mode", "--allow-dangerously-skip-permissions", "--allowedTools", "--disallowedTools", "--settings", "--add-dir", "--project-config-root", "--setting-sources"] };

/** A transcript in `dir`, named for the chat's id, one line for each of `lines` (an object as JSON, a string as it is). Gives its path. */
export function transcript(dir, lines, id = SESSION) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${id}.jsonl`);
  writeFileSync(path, lines.map((line) => (typeof line === "string" ? line : JSON.stringify(line)) + "\n").join(""));
  return path;
}

/** Her chat's environment as the lock check reads it, by the names it looks at: under Claude Code, with the chat's id. */
export const CHAT_ENV = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: SESSION };

/** The `deps` every open-lock test gives: the world's home, folder and temp folder, managed folders of its own, her chat's
    environment (CHAT_ENV), and stand-ins for ps and lsof, the claude above being the app's. `minimum` is set, since with none the lock
    in effect is strict. */
export const openDeps = (w, more = {}) => ({
  home: w.home,
  cwd: w.folder,
  env: CHAT_ENV,
  pid: 900,
  tmp: w.tmp,
  uid: w.uid,
  managedDir: join(w.dir, "managed"),
  managedPrefs: join(w.dir, "managed-preferences"),
  user: "sallie",
  ps: () => chatChain({ args: APP_ARGS(w.folder, w.home) }),
  lsof: () => "",
  appFlags: RECORD,
  minimum: MINIMUM,
  ...more,
});
