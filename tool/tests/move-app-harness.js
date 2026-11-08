// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop or Jason's MacBook from brimm-video
// to Studio, or sets up fresh, as Jason's MacBook, a Mac with no brimm-video, one asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
// The shared harness of the move script's test files (tests/move-app-*.test.js). It is not a test file itself.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MOVE = fileURLToPath(new URL("../move-app/move.zsh", import.meta.url));
const notAMac = process.platform !== "darwin" || !existsSync("/bin/zsh") ? "the move script is for a Mac: it needs zsh and plutil" : false;
/** What Claude Code prints for `claude auth status --json` when it is signed in: its email and organisation are never to be shown. */
const EMAIL = "sallie@example.com";
const ORG = "The BRIMM Secret Org";
const SIGNED_IN = `{"loggedIn":true,"authMethod":"claude.ai","subscriptionType":"max","email":"${EMAIL}","orgName":"${ORG}"}`;
const SIGNED_OUT = '{"loggedIn":false}';
const KEY_COMMENT = "brimm-video-studio read-only, Sallie's laptop";
const GITHUB_HOST_KEY = "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl";
const HOST_BLOCK = "Host github-brimm-video-studio\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/brimm_video_studio_deploy\n  IdentitiesOnly yes\n";
const HI = "Hi jogden12/brimm-video-studio! You've successfully authenticated, but GitHub does not provide shell access.";
const STOPPED_NOTHING = "Stopped. This run changed nothing.\nDouble-click Move to Studio again to go on from here.\n";
const HEADINGS = [
  "1. Looking at this Mac (check 41). This changes nothing.",
  "2. Studio's key (check 42)",
  "3. Studio's code (check 42)",
  "4. The HyperFrames app (check 43)",
  "5. Studio's installer (check 44)",
  "6. The report",
  "7. brimm-video's old key (check 48)"
];
/** What the stand-in installer prints for --print: the lines the app repeats, as install.sh words them. */
const PRINT_LINES = {
  signed: "  Claude Code, signed in:  yes (max)",
  version: "  Claude Code's version:  2.1.300 (her folder's guard needs 2.1.0 or later)",
  older: "  Claude Code's version:  1.0.1, older than the 2.1.0 her folder's guard needs: on it the guard could let a call through. In Terminal: claude update, then run this again. Until then the install does not write her folder for Claude.",
  app: "  The Claude app's own Claude Code:  2.1.300, the newest copy the app keeps here (her folder's guard needs 2.1.0 or later; /status in the Code tab says which copy runs)",
  appOlder: "  The Claude app's own Claude Code:  1.0.1, the newest copy the app keeps here, older than the 2.1.0 her folder's guard needs: on it the guard could let a call through. In the app, choose Claude > Check for Updates, then check /status in the Code tab",
  hdr: "  HDR video:  ffmpeg here can make an HDR video standard, which an iPhone's clip is by default: it has the videotoolbox hwaccel and the scale_vt filter that the working copy needs for it",
  lock: "  Her folder's lock:  strict (Claude runs only brimm-video's commands there)"
};
const printText = (...lines) => ["  Its drop folder, to make in Dropbox and watch:  /somewhere", "  Swift, to find the speaker's face:  here already", ...lines, "  By hand afterwards:  the setup guide (docs/setup/sallies-laptop.md)", ""].join("\n");
const DEFAULT_PRINT = printText(PRINT_LINES.signed, PRINT_LINES.version, PRINT_LINES.hdr, PRINT_LINES.lock, PRINT_LINES.app);
const BACKGROUND = "From the background job: Claude answered from here, so its sign-in is seen there.";
const DEFAULT_RAN = `Setting up Studio...\n  The launch agent is in place.\nAsking Claude once from the background job (up to 90 seconds)...\n${BACKGROUND}\nDone.\n`;
const GIT_ENV = { PATH: "/usr/bin:/bin", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };

const git = (cwd, ...args) => {
  const r = spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: { ...GIT_ENV, HOME: cwd } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const put = (file, text, mode) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  if (mode) chmodSync(file, mode);
};

/** The fake tool/settings.js of the old checkout (brimm-video's): `show` and `set --app hyperframes`. */
const FAKE_SETTINGS_JS = `import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const file = join(process.env.HOME, "Library", "Application Support", "BRIMM Video", "settings.json");
const s = JSON.parse(readFileSync(file, "utf8"));
const [command, ...rest] = process.argv.slice(2);
if (command === "show") {
  console.log("  Its drop folder:  " + s.root + "/" + s.drop + "/" + s.machine);
  if (s.app !== undefined) console.log("  The editing app:  " + s.app);
} else if (command === "set" && rest.join(" ") === "--app hyperframes") {
  const was = s.app ?? "off";
  s.app = "hyperframes";
  writeFileSync(file, JSON.stringify(s));
  console.log("The editing app is now hyperframes (it was " + was + ").");
} else {
  console.log("settings.js: not understood: " + process.argv.slice(2).join(" "));
  process.exit(2);
}
`;

/** The fake tool/settings.js of Studio's checkout, as Phase 3's is: it runs as a command only (its own main guard, so that importing it
    runs nothing), `show` prints the drop folder (dropPath, else root/drop/machine) and the exports line, and it exports what the move
    script imports for words: folderWords, cloudFolder and needsFilesAccess. */
const FAKE_STUDIO_SETTINGS_JS = `import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function folderWords(path, home) {
  const p = resolve(path);
  const h = resolve(home);
  if (p === h) return "your home folder";
  if (p.startsWith(h + "/")) return p.slice(h.length + 1).split("/").join(" › ") + ", in your home folder";
  return p.split("/").filter(Boolean).join(" › ");
}
export function cloudFolder(path, home) {
  const p = resolve(path);
  const h = resolve(home);
  const under = (dir) => p === dir || p.startsWith(dir + "/");
  const storage = join(h, "Library", "CloudStorage");
  if (under(join(h, "Dropbox")) || p.startsWith(join(storage, "Dropbox"))) return "Dropbox";
  if (under(join(h, "Library", "Mobile Documents"))) return "iCloud Drive";
  if (under(join(h, "Desktop")) || under(join(h, "Documents"))) return "iCloud Drive, if it keeps Desktop & Documents";
  if (p.startsWith(storage + "/")) return "a cloud folder";
  return "";
}
export function needsFilesAccess(path, home) {
  const p = resolve(path);
  const h = resolve(home);
  return [join(h, "Desktop"), join(h, "Documents"), "/volumes", join(h, "Library", "Mobile Documents")].some((dir) => p === dir || p.startsWith(dir + "/"))
    || p.startsWith(join(h, "Library", "CloudStorage") + "/");
}

function main() {
  const file = join(process.env.HOME, "Library", "Application Support", "BRIMM Video", "settings.json");
  const s = JSON.parse(readFileSync(file, "utf8"));
  const [command, ...rest] = process.argv.slice(2);
  if (command === "show") {
    console.log("  Its drop folder:  " + (s.dropPath ?? s.root + "/" + s.drop + "/" + s.machine));
    console.log("  Exports from HyperFrames, looked for in:  " + (s.exportsPath ?? join(process.env.HOME, "Downloads")));
    if (s.app !== undefined) console.log("  The editing app:  " + s.app);
  } else if (command === "set" && rest.join(" ") === "--app hyperframes") {
    const was = s.app ?? "off";
    s.app = "hyperframes";
    writeFileSync(file, JSON.stringify(s));
    console.log("The editing app is now hyperframes (it was " + was + ").");
  } else {
    console.log("settings.js: not understood: " + process.argv.slice(2).join(" "));
    process.exit(2);
  }
}
let isMain = false;
try {
  isMain = pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
} catch {}
if (isMain) main();
`;

/** The stand-in chooser. Its answers are in files of the test's own folder, a file an answer and a count (see writeList), read again
    at each run: `pick-N` for the first way (through the stand-in `open`), `prog-N` for the second (the helper's own program). */
const NEXT_SH = (dir) => `D="${dir}"
next() {
  n=$(cat "$D/n-$1" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "$D/n-$1"
  c=$(cat "$D/$1-count" 2>/dev/null || echo 0)
  if [ "$c" -eq 0 ]; then printf '%s' "$2"; return; fi
  [ $n -le $c ] || n=$c
  cat "$D/$1-$n"
}
`;
/** The program of the stand-in helper app: the second way, answering from `prog`; or, with --late, the first way's result file written
    two seconds on (a pick that arrives after `open` has ended 1). */
const helperStandIn = (dir, ran) => `#!/bin/sh
${NEXT_SH(dir)}RAN="${ran}"
if [ "$1" = --late ]; then sleep 2; printf 'path\\n%s\\n' "$3" > "$2.part"; mv "$2.part" "$2"; exit 0; fi
printf '%s\\n' "program $1 | $2" >> "$RAN"
a=$(next prog two)
case "$a" in
  cancel) exit 1 ;;
  linebreak) echo "That folder's name holds a line break." >&2; exit 3 ;;
  two) echo "The window to choose a folder could not be shown." >&2; exit 2 ;;
  *) printf '%s\\n' "$a"; exit 0 ;;
esac
`;
/** The stand-in `open`: for the chooser's launch line it takes the next pick (a path, cancel, linebreak, nofile, fail, or late:<path>),
    notes `chooser <message> | <start>` in `ran` and on its own stdout, and each argument on a line of its own; every other call is noted
    as `open <arguments>`. It never writes into the home folder. `appears` is shell run for `open -a Safari` (the HyperFrames app arriving). */
const openStandIn = (dir, ran, appears) => `#!/bin/sh
${NEXT_SH(dir)}RAN="${ran}"
if [ "$1" = -n ] && [ "$2" = -W ]; then
  app="$3"; message="$5"; start="$6"; result="$7"
  printf '%s\\n' "chooser $message | $start" | tee -a "$RAN"
  for a in "$@"; do printf 'chooser-arg: %s\\n' "$a" >> "$RAN"; done
  if [ "$app" != "$BRIMM_CHOOSER_APP" ]; then echo "open: not the chooser app: $app" >> "$RAN"; exit 1; fi
  pick=$(next pick cancel)
  case "$pick" in
    cancel|linebreak) printf '%s\\n' "$pick" > "$result.part"; mv "$result.part" "$result"; exit 0 ;;
    nofile) exit 0 ;;
    fail) exit 1 ;;
    late:*) "$app/Contents/MacOS/Choose a Folder" --late "$result" "\${pick#late:}" </dev/null >/dev/null 2>&1 &
            sleep 0.5; exit 1 ;;
    *) printf 'path\\n%s\\n' "$pick" > "$result.part"; mv "$result.part" "$result"; exit 0 ;;
  esac
fi
printf '%s\\n' "open $*" >> "$RAN"
${appears}exit 0
`;

/** Writes a list of answers as files `name-1`, `name-2`… and `name-count` in `dir`, and forgets how far the last run read (`n-name`). */
const writeList = (dir, name, list) => {
  const items = [list ?? []].flat();
  items.forEach((text, i) => writeFileSync(join(dir, `${name}-${i + 1}`), text));
  writeFileSync(join(dir, `${name}-count`), String(items.length));
  rmSync(join(dir, `n-${name}`), { force: true });
};
/** Makes the stand-in chooser: the app (at the returned path) with its program, and `open` in `bin`. The run's answers are in `dir` (writeList). */
function makeChooser(dir, bin, ran, appears = "") {
  const app = join(dir, "Applications", "Choose a Folder.app");
  put(join(app, "Contents", "MacOS", "Choose a Folder"), helperStandIn(dir, ran), 0o755);
  put(join(bin, "open"), openStandIn(dir, ran, appears), 0o755);
  return app;
}

const dirsToClean = new Set();
process.on("exit", () => {
  for (const dir of dirsToClean) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});
const xmlEscape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
/** A stand-in launch agent's plist: its label and the folders it watches. */
const agentPlist = (paths) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.thebrimm.unedited</string><key>WatchPaths</key><array>${paths.map((p) => `<string>${xmlEscape(p)}</string>`).join("")}</array></dict></plist>\n`;

/** Runs the move script on a Mac made for the test. `options`, all optional. A string anywhere in the folder options may begin with
    <HOME>, the made-up home folder (a real path, so that zsh's :A on a pick matches).
    settings   her settings.json (default: as the switch of 26 October left it), or null for none (a Mac with no brimm-video)
    settingsChange  values to change in the default settings. dropPath ("<HOME>/…") with drop kept, or with drop taken out (drop:
               undefined), and exportsPath, are the two Studio's installer adds. With dropPath and no drop, the drop folder made
               (.DS_Store, .brimm-watched-by, dropFiles, dropMode) is the one at dropPath; with both, the old Drop/<Mac> is made too.
    brimmVideo with no settings, Dropbox's The BRIMM DB/BRIMM Video is still made in ~/Dropbox, unless this is null (none),
               "two" (a second one in ~/Library/CloudStorage/Dropbox too), "linked" (only in ~/Library/CloudStorage/Dropbox, with
               ~/Dropbox a link to that Dropbox folder) or "team" (a level deeper, in a team member's folder, as on the Mac Studio:
               ~/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB/BRIMM Video)
    launchctl  what `launchctl list` prints; launchctlLater: what it prints from its second call on (default: the same)
    agentLoaded  whether `launchctl list com.thebrimm.unedited` finds the job (default: true on a Mac with settings, false with none);
               agentWatches: the folders the stand-in unedited plist's WatchPaths name (default: the Mac's drop folder in Dropbox)
    dropFiles  names put in her drop folder (it always holds .DS_Store and .brimm-watched-by too)
    folderFiles  { "<HOME>/…": [names] }: each folder is made and holds these files (a name alone makes an empty folder);
               links  { "<HOME>/…": "<HOME>/…" }: links made, a name and where it goes
    claude     { status, version }: what the stand-in prints for `auth status --json` (default signed in, Max), and for --version;
               `auth login` flips it to signed in unless loginFails
    key        the comment of a key already in ~/.ssh (default: KEY_COMMENT, so a key made earlier), or null for none
    sshConfig  text of ~/.ssh/config (default: just the Host entry), or null for none
    knownHosts text of ~/.ssh/known_hosts (default: GitHub's published ed25519 key), or null for none
    ssh        what `ssh -T` answers, one answer a call: "ok", "denied", "noisy" (a line, then the welcome) or "banner" (a host-key
               warning) or a list of them (default "ok"; the last repeats)
    firstRunWaiting  a real run is started first and left waiting at its question, holding the lock (use it with a signed-out claude)
    dropMode, desktopMode  the mode her drop folder or her Desktop is given for the run (0o000 and 0o555 test the unreadable and the unwritable)
    folderModes  { "<HOME>/…": 0o000 }: modes given to folders for the run, after the listing in `before`, and put right before `tree`
    checkout   Studio's checkout in the home folder: "at-pin" (default), "absent", "other-commit", "dirty", "other-remote", "detached", "other-branch" or
               "partial-left" (no checkout, a half-made .partial beside where it goes)
    marks      text of the checkout's .git/move-to-studio, SHA standing for the pin (default for an at-pin checkout: the tests passed,
               the installer finished at the pin, and the Finder step is done)
    hfApp      the version of the HyperFrames app (default "1.4.0"), or null for none; hfAppAfterOpen: the version the app has once
               `open -a Safari` has been run (the stand-in puts it there)
    dropGone   true: the drop folder settings.js show names is taken away again, so that it is not there
    install    what the stand-in tool/install.sh in the "GitHub" repo does: { print, printExit, ran, ranExit, noBackground, moves, checkLeft }.
               `ranDrops` (names, separated by spaces) are put in the Mac's old Drop/<Mac> by --yes, and `ranUnreadable` makes that folder mode 000 (the test puts it right).
               `print` and `printExit` are the text and the status of --print (a list: one a call, the last repeating), `ran` the text of
               --yes (noBackground leaves out its "From the background job:" line); `printDrops` (a file name put in her drop folder by every --print), `moves`
               rewrites settings.json's checkout to Studio and writes the agent's plist; `checkLeft` leaves the one-shot plist;
               `writesSettings` makes, as the real one does on a Mac with none, a settings.json for the --machine and the folder it is
               given, and the drop folder Drop/<machine>. --yes writes dropPath and exportsPath from --drop-folder and --exports-folder (after
               writesSettings' settings, so that dropPath is kept), and makes that drop folder
    picks      answers for the stand-in `open`'s chooser call (a list: one a call, the last repeating, "cancel" with none): "<HOME>/…"
               (a pick), "cancel", "linebreak", "nofile" (no result file), "fail" (open ends 1), or "late:<HOME>/…" (open ends 1 at once, and
               the helper writes the pick two seconds later)
    program    answers for the stand-in helper's second way: "<HOME>/…", "cancel" (ends 1), "linebreak" (ends 3), "two" (ends 2 with a
               sentence; the default) or "missing" (the program is not there)
    transcribe  { on: [paths], off: [paths] }: the WatchPaths of a made-up com.thebrimm.transcribe.plist and of its .plist.off
    laterCommit  the "GitHub" repo gets a commit after the pin
    testFail   BRIMM_TEST_FAIL=1 for the tests in the checkout
    gitStandIn a stand-in git that notes its arguments and GIT_SSH_COMMAND, and fails; noRepo leaves BRIMM_STUDIO_REPO unset;
               repoMissing points it at nothing
    commit     the commit to pass: the "GitHub" repo's own by default, null for none
    oldKey     true puts brimm-video's old key (its two files) in ~/.ssh, beside an unrelated id_ed25519 that must always stay
    oldReport  text of a report an earlier run left on her Desktop
    answers    stdin, such as "y\ny\n\n"
    env        more of the run's environment, such as { GIT_SSH: "..." }
    Returns { status, out, ran, home, before, tree, log, report, again }: `before` and `tree` list every file in the home folder before
    and after, and `log` and `report` are those files' text, or "". installGitEnv and installGitSsh are what the stand-in installer
    saw of GIT_SSH_COMMAND and GIT_SSH ("unset" for none). `again(options, ...args)` runs the script again in the same home, the same
    "GitHub" and the same clone, and returns the same shape for that run alone. It takes the options of one run: answers, env, picks,
    program, launchctl, launchctlLater, agentLoaded, agentWatches, install's print, printExit, ran, ranExit and noBackground, dropMode,
    desktopMode, folderModes and commit; each not given is its default again. Every stand-in reads these from files in the test's own
    folder, which a run writes first: none reads them from the committed clone, which step 3 needs clean. */
function moveOn(options = {}, ...args) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-move-")));
  dirsToClean.add(dir);
  const home = join(dir, "home");
  const bin = join(dir, "bin");
  const ran = join(dir, "ran");
  const github = join(dir, "github");
  mkdirSync(home);
  mkdirSync(bin);
  const fill = (v) => (typeof v === "string" ? v.replaceAll("<HOME>", home) : Array.isArray(v) ? v.map(fill) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [fill(k), fill(x)])) : v);

  // The "GitHub" Studio is cloned from: a local repository with a stand-in installer, the fake settings.js and one test.
  mkdirSync(github);
  git(github, "init", "-q", "-b", "main");
  // The stand-in installer: it notes its call in `ran` (and each argument on a line of its own), answers --print from a file a call
  // (the last repeating) and --yes from another. Everything it answers with is in files of the test's folder, which a run writes first.
  const inst = options.install ?? {};
  put(join(github, "tool", "install.sh"), `#!/bin/zsh
echo "install.sh $*" >> "${ran}"
for a in "$@"; do echo "install-arg: $a" >> "${ran}"; done
echo "\${GIT_SSH_COMMAND-unset}" > "${dir}/install-gitenv"
echo "\${GIT_SSH-unset}" > "${dir}/install-gitssh"
case "$1" in
  --print)
    n=$(cat "${dir}/n-print" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${dir}/n-print"
    call=$n
    c=$(cat "${dir}/print-count"); [ $n -le $c ] || n=$c
    ${inst.printDrops ? `touch "${join(home, "Dropbox", "The BRIMM DB", "BRIMM Video", "Drop", "Sallie's laptop", inst.printDrops)}"` : ""}
    cat "${dir}/print-$n"
    c=$(cat "${dir}/exit-count"); n=$call; [ $n -le $c ] || n=$c
    exit $(cat "${dir}/exit-$n") ;;
  --yes)
    cat "${dir}/install-ran"
    ${inst.moves ? `node -e 'const fs=require("fs");const f=process.argv[1];const s=JSON.parse(fs.readFileSync(f,"utf8"));s.checkout=process.argv[2];fs.writeFileSync(f,JSON.stringify(s))' "$HOME/Library/Application Support/BRIMM Video/settings.json" "$HOME/Claude Code/brimm-video-studio"
    mkdir -p "$HOME/Library/LaunchAgents"; echo "$HOME/Claude Code/brimm-video-studio/tool/unedited.js" > "$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist"` : ""}
    ${inst.checkLeft ? 'mkdir -p "$HOME/Library/LaunchAgents"; echo left > "$HOME/Library/LaunchAgents/com.thebrimm.claude-check.plist"' : ""}
    ${inst.writesSettings ? `machine="$3"; for a in "$@"; do root="$a"; done
    mkdir -p "$HOME/Library/Application Support/BRIMM Video" "$root/Drop/$machine"
    node -e 'const [f, root, machine, checkout] = process.argv.slice(1); require("fs").writeFileSync(f, JSON.stringify({ version: 1, machine, root, checkout, import: "light", handoffVersion: 2, drop: "Drop" }))' "$HOME/Library/Application Support/BRIMM Video/settings.json" "$root" "$machine" "$HOME/Claude Code/brimm-video-studio"` : ""}
    ${inst.ranDrops ? `machine="$3"; for a in "$@"; do root="$a"; done; for n in ${inst.ranDrops}; do touch "$root/Drop/$machine/$n"; done` : ""}
    ${inst.ranUnreadable ? `machine="$3"; for a in "$@"; do root="$a"; done; chmod 000 "$root/Drop/$machine"` : ""}
    dropf=""; exportsf=""
    while [ $# -gt 0 ]; do case "$1" in --drop-folder) dropf="$2"; shift ;; --exports-folder) exportsf="$2"; shift ;; esac; shift; done
    if [ -n "$dropf$exportsf" ] && [ -f "$HOME/Library/Application Support/BRIMM Video/settings.json" ]; then
      node -e 'const fs=require("fs");const [f, d, e]=process.argv.slice(1);const s=JSON.parse(fs.readFileSync(f,"utf8"));if(d)s.dropPath=d;if(e)s.exportsPath=e;fs.writeFileSync(f,JSON.stringify(s))' "$HOME/Library/Application Support/BRIMM Video/settings.json" "$dropf" "$exportsf"
    fi
    [ -z "$dropf" ] || mkdir -p "$dropf"
    exit $(cat "${dir}/install-ranexit") ;;
esac
`, 0o755);
  put(join(github, "tool", "settings.js"), FAKE_STUDIO_SETTINGS_JS);
  put(join(github, "tool", "tests", "ok.test.js"), 'import { test } from "node:test";\nimport assert from "node:assert/strict";\ntest("ok", () => assert.notEqual(process.env.BRIMM_TEST_FAIL, "1"));\n');
  git(github, "add", "-A");
  git(github, "commit", "-q", "-m", "the stand-in Studio");
  const sha = git(github, "rev-parse", "HEAD");
  if (options.laterCommit) {
    put(join(github, "later.txt"), "after the pin\n");
    git(github, "add", "-A");
    git(github, "commit", "-q", "-m", "after the pin");
  }

  // Her laptop: the old checkout (with the fake settings.js), her settings, her drop folder.
  const oldCheckout = join(home, "Claude Code", "BRIMM video");
  put(join(oldCheckout, "tool", "settings.js"), FAKE_SETTINGS_JS);
  const settings = options.settings === undefined
    ? { version: 1, machine: "Sallie's laptop", root: join(home, "Dropbox", "The BRIMM DB", "BRIMM Video"), checkout: oldCheckout, import: "light", handoffVersion: 2, drop: "Drop", app: "hyperframes", ...fill(options.settingsChange) }
    : fill(options.settings);
  // The drop folder settings.js show names (dropPath, else Drop/<Mac> in BRIMM Video), and the old one when both are there.
  const oldDrop = settings !== null && settings.drop !== undefined ? join(settings.root, settings.drop, settings.machine) : null;
  const dropDir = settings === null ? null : settings.dropPath ?? oldDrop;
  if (settings !== null) {
    put(join(home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify(settings));
    for (const drop of new Set([settings.dropPath, oldDrop].filter(Boolean))) {
      put(join(drop, ".DS_Store"), "");
      put(join(drop, ".brimm-watched-by"), `${settings.machine}\n`);
    }
    for (const name of options.dropFiles ?? []) put(join(dropDir, name), "made for the test");
    // dropGone: the drop folder settings.js show names is not there (yet), as a folder the installer has still to make.
    if (options.dropGone) rmSync(dropDir, { recursive: true, force: true });
  }
  // A Mac with no settings still has The BRIMM DB in Dropbox, unless the test says it has none (null), two ("two"), or one in
  // CloudStorage with ~/Dropbox a link to it ("linked"), as Dropbox makes it on a newer Mac.
  if (settings === null && options.brimmVideo !== null) {
    const cloud = join(home, "Library", "CloudStorage", "Dropbox");
    if (options.brimmVideo === "linked") {
      mkdirSync(join(cloud, "The BRIMM DB", "BRIMM Video"), { recursive: true });
      symlinkSync(cloud, join(home, "Dropbox"));
    } else if (options.brimmVideo === "team") {
      mkdirSync(join(home, "Library", "CloudStorage", "Dropbox-Ogden28.5", "Jason Ogden", "The BRIMM DB", "BRIMM Video"), { recursive: true });
    } else {
      mkdirSync(join(home, "Dropbox", "The BRIMM DB", "BRIMM Video"), { recursive: true });
      if (options.brimmVideo === "two") mkdirSync(join(cloud, "The BRIMM DB", "BRIMM Video"), { recursive: true });
    }
  }
  // Every Mac has Downloads; a test's folders hold their files, and its links go where it says.
  mkdirSync(join(home, "Downloads"), { recursive: true });
  for (const [folder, names] of Object.entries(fill(options.folderFiles ?? {}))) {
    mkdirSync(folder, { recursive: true });
    for (const name of names) put(join(folder, name), "made for the test");
  }
  for (const [link, to] of Object.entries(fill(options.links ?? {}))) {
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(to, link);
  }

  // Studio's checkout, as an earlier run left it.
  const studio = join(home, "Claude Code", "brimm-video-studio");
  const checkout = options.checkout ?? "at-pin";
  if (checkout !== "absent" && checkout !== "partial-left") {
    git(home, "clone", "-q", "--branch", "main", github, studio);
    git(studio, "reset", "-q", "--hard", sha);
    if (checkout === "other-commit") git(studio, "commit", "-q", "--allow-empty", "-m", "elsewhere");
    if (checkout === "detached") git(studio, "checkout", "-q", "--detach");
    if (checkout === "other-branch") git(studio, "checkout", "-q", "-b", "feature");
    if (checkout === "dirty") put(join(studio, "tool", "install.sh"), "changed by hand\n");
    if (checkout === "other-remote") git(studio, "remote", "set-url", "origin", "/somewhere/else");
    const marks = options.marks ?? (checkout === "at-pin" ? "tests=SHA\ninstalled=SHA\nfinder=SHA\n" : null);
    if (marks !== null) writeFileSync(join(studio, ".git", "move-to-studio"), fill(marks).replaceAll("SHA", sha));
  }
  if (checkout === "partial-left") put(`${studio}.partial/half-made`, "cut short\n");

  // The stand-ins: each writes what it was asked into `ran`.
  const stand = (name, body = "") => put(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${ran}"\n${body}`, 0o755);
  // `launchctl list` answers the first time with the first text and from the second time on with the later one; `list <label>` ends 0
  // when the job is loaded, and does not count.
  stand("launchctl", `if [ "$1" = list ] && [ -n "$2" ]; then
  [ "$(cat "${dir}/agent-loaded")" = yes ] || exit 113
  echo '{ "Label" = "com.thebrimm.unedited"; };'; exit 0
fi
if [ "$1" = list ]; then n=$(cat "${dir}/n-launchctl" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${dir}/n-launchctl"
  if [ $n -gt 1 ]; then printf '%b\\n' "$(cat "${dir}/launchctl-later")"; else printf '%b\\n' "$(cat "${dir}/launchctl-first")"; fi
fi
exit 0
`);
  const hfApp = join(dir, "Applications", "HyperFrames.app");
  const appPlist = (version) => `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>\n`;
  const hfVersion = options.hfApp === undefined ? "1.4.0" : options.hfApp;
  if (hfVersion !== null) put(join(hfApp, "Contents", "Info.plist"), appPlist(hfVersion));
  for (const name of ["caffeinate", "brew"]) stand(name, name === "brew" ? 'echo "Homebrew 4.5.0"\n' : "");
  // `open -a Safari <page>` puts the app in place when the test says the app arrives after it. The chooser's stand-ins are in makeChooser.
  const chooserApp = makeChooser(dir, bin, ran, options.hfAppAfterOpen ? `[ "$1" = -a ] && { mkdir -p "${hfApp}/Contents"; printf '%s' '${appPlist(options.hfAppAfterOpen)}' > "${hfApp}/Contents/Info.plist"; }\n` : "");
  // pbcopy keeps what it was given; ssh-keygen makes a stand-in key (-t) and looks in known_hosts (-F); ssh answers one answer a call.
  const copied = join(dir, "pbcopied");
  stand("pbcopy", `cat > "${copied}"\n`);
  stand("ssh-keygen", `case "$1" in
  -t) file=""; comment=""
      while [ $# -gt 0 ]; do case "$1" in -f) file="$2"; shift ;; -C) comment="$2"; shift ;; esac; shift; done
      echo PRIVATE-HALF > "$file"; chmod 600 "$file"
      echo "ssh-ed25519 AAAAstandin $comment" > "$file.pub" ;;
  -F) [ -f "$4" ] && grep "^$2 " "$4" && exit 0
      exit 1 ;;
esac
`);
  const answers = join(dir, "ssh-answers");
  const asked = join(dir, "ssh-asked");
  const said = [options.ssh ?? "ok"].flat();
  writeFileSync(answers, said.join("\n") + "\n");
  // Like the real ssh, this one reads standard input unless it is given -n: a call that forgets -n eats the answers still to come.
  stand("ssh", `case " $* " in *" -n "*) ;; *) cat > /dev/null ;; esac
n=$(cat "${asked}" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${asked}"
a=$(sed -n "$n"p "${answers}"); [ -n "$a" ] || a=$(tail -n 1 "${answers}")
case "$a" in
  ok) echo "${HI}"; exit 1 ;;
  denied) echo "git@github.com: Permission denied (publickey)."; exit 255 ;;
  noisy) echo "Warning: a first line that is not the welcome."; echo "${HI}"; exit 1 ;;
  banner) echo "@@@@@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@@@@@"; echo "Host key verification failed."; exit 255 ;;
esac
`);
  if (options.gitStandIn) stand("git", `echo "GIT_SSH_COMMAND=$GIT_SSH_COMMAND" >> "${ran}"\nexit 1\n`);
  stand("sw_vers", '[ "$1" = "-productVersion" ] && echo 15.1\n');
  stand("df", 'echo "Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on"\necho "/dev/disk3s1s1 971350180 400000000 450000000 47% 400000 4000000000 0% /"\n');
  stand("xcode-select", '[ "$1" = "-p" ] && echo /Library/Developer/CommandLineTools\n');
  const ssh = join(home, ".ssh");
  const keyComment = options.key === undefined ? KEY_COMMENT : options.key;
  if (keyComment !== null) {
    put(join(ssh, "brimm_video_studio_deploy"), "PRIVATE-HALF\n", 0o600);
    put(join(ssh, "brimm_video_studio_deploy.pub"), `ssh-ed25519 AAAAstandin ${keyComment}\n`);
    // The Desktop copy of its public half, as the key step of an earlier run left it, so that a run that stops changes nothing.
    put(join(home, "Desktop", "Studio key (public half).txt"), `ssh-ed25519 AAAAstandin ${keyComment}\n`);
  }
  if (options.oldKey) {
    put(join(ssh, "brimm_video_deploy"), "OLD-PRIVATE-HALF\n", 0o600);
    put(join(ssh, "brimm_video_deploy.pub"), "ssh-ed25519 AAAAold brimm-video read-only\n");
    put(join(ssh, "id_ed25519"), "HER-OWN-KEY\n", 0o600);
  }
  if (options.oldReport) put(join(home, "Desktop", "Studio move report.txt"), options.oldReport);
  const sshConfig = options.sshConfig === undefined ? HOST_BLOCK : options.sshConfig;
  if (sshConfig !== null) put(join(ssh, "config"), sshConfig, 0o600);
  const knownHosts = options.knownHosts === undefined ? `${GITHUB_HOST_KEY}\n` : options.knownHosts;
  if (knownHosts !== null) put(join(ssh, "known_hosts"), knownHosts, 0o644);
  const state = join(dir, "claude-state");
  writeFileSync(state, (options.claude?.status ?? SIGNED_IN).includes('"loggedIn":true') ? "in" : "out");
  stand("claude", `case "$*" in
  "auth status --json")
    if [ "$(cat "${state}")" = in ]; then printf '%s' '${SIGNED_IN}'; exit 0; fi
    printf '%s' '${options.claude?.status ?? SIGNED_OUT}'; exit 1 ;;
  "auth login") ${options.claude?.loginFails ? ":" : `echo in > "${state}"`} ;;
  --version) echo '${options.claude?.version ?? "2.1.300 (Claude Code)"}' ;;
esac
`);
  // The unedited launch agent's file: it watches the Mac's drop folder in Dropbox, as brimm-video's agent does, unless a test says.
  if (settings !== null) {
    const watched = options.agentWatches === undefined ? [oldDrop ?? settings.dropPath] : fill(options.agentWatches);
    put(join(home, "Library", "LaunchAgents", "com.thebrimm.unedited.plist"), agentPlist(watched));
  }

  for (const [ending, list] of [["plist", options.transcribe?.on], ["plist.off", options.transcribe?.off]]) {
    if (list) put(join(home, "Library", "LaunchAgents", `com.thebrimm.transcribe.${ending}`), agentPlist(fill(list)));
  }

  const desktop = join(home, "Desktop");
  const baseEnv = {
    HOME: home, PATH: `${bin}:/usr/bin:/bin:${dirname(process.execPath)}`, BRIMM_HOMEBREW_DIRS: "",
    BRIMM_CLAUDE: join(bin, "claude"), BRIMM_STUDIO_REPO: options.repoMissing ? join(dir, "nowhere") : github, BRIMM_HYPERFRAMES_APP: hfApp,
    BRIMM_CHOOSER_APP: chooserApp, TMPDIR: join(dir, "tmp")
  };
  mkdirSync(join(dir, "tmp"));
  if (options.noNode) baseEnv.PATH = `${bin}:/usr/bin:/bin`;
  if (options.noRepo) delete baseEnv.BRIMM_STUDIO_REPO;
  if (options.testFail) baseEnv.BRIMM_TEST_FAIL = "1";
  const text = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
  const mode = (file) => (existsSync(file) ? statSync(file).mode & 0o777 : null);
  const inStudio = (...a) => spawnSync("git", ["-C", studio, ...a], { encoding: "utf8", env: { ...GIT_ENV, HOME: home } }).stdout.trim();

  // One run of the script. `o` holds what only this run has (see `again`); the first run takes the options given to moveOn.
  const run = (o, runArgs, first) => {
    // What the stand-ins answer, written first: files of the test's own folder, read by every call.
    writeList(dir, "pick", fill(o.picks));
    writeList(dir, "prog", fill(o.program));
    rmSync(join(dir, "n-launchctl"), { force: true });
    writeFileSync(join(dir, "launchctl-first"), o.launchctl ?? "-\\t0\\tcom.thebrimm.unedited");
    writeFileSync(join(dir, "launchctl-later"), o.launchctlLater ?? o.launchctl ?? "-\\t0\\tcom.thebrimm.unedited");
    writeFileSync(join(dir, "agent-loaded"), (o.agentLoaded ?? (settings !== null)) ? "yes" : "no");
    if (!first && o.agentWatches !== undefined) put(join(home, "Library", "LaunchAgents", "com.thebrimm.unedited.plist"), agentPlist(fill(o.agentWatches)));
    const i = o.install ?? {};
    writeList(dir, "print", [i.print ?? DEFAULT_PRINT].flat());
    writeList(dir, "exit", [i.printExit ?? 0].flat().map(String));
    writeFileSync(join(dir, "install-ran"), i.noBackground ? (i.ran ?? DEFAULT_RAN).split("\n").filter((l) => !l.startsWith("From the background job:")).join("\n") : i.ran ?? DEFAULT_RAN);
    writeFileSync(join(dir, "install-ranexit"), String(i.ranExit ?? 0));
    // The program of the second way is not there at all when a test says "missing".
    const program = join(chooserApp, "Contents", "MacOS", "Choose a Folder");
    if ([o.program ?? []].flat().includes("missing")) rmSync(program, { force: true });
    else if (!existsSync(program)) put(program, helperStandIn(dir, ran), 0o755);
    rmSync(ran, { force: true });

    const before = readdirSync(home, { recursive: true }).sort();
    // Folders made unreadable or unwritable only now, after the listing above, and put right again after the run.
    const modes = [];
    if (o.dropMode !== undefined) modes.push([dropDir, o.dropMode]);
    if (o.desktopMode !== undefined) { mkdirSync(desktop, { recursive: true }); modes.push([desktop, o.desktopMode]); }
    for (const [folder, m] of Object.entries(fill(o.folderModes ?? {}))) modes.push([folder, m]);
    const putRight = () => { for (const [folder] of [...modes].reverse()) { try { chmodSync(folder, 0o755); } catch {} } };
    try {
      for (const [folder, m] of modes) chmodSync(folder, m);
      // The environment is built from scratch: the stand-ins first, the node that runs these tests last, no Homebrew.
      const env = { ...baseEnv, ...o.env };
      const commit = o.commit === undefined ? ["--commit", sha] : o.commit === null ? [] : ["--commit", o.commit];
      // A first run already open, waiting at its first question (stdin is held open): the one the run under test is a second to.
      let firstRun = null;
      if (first && o.firstRunWaiting) {
        firstRun = spawn("/bin/zsh", [MOVE, ...commit], { env, stdio: ["pipe", "pipe", "pipe"] });
        const log = join(home, "Library", "Logs", "brimm-video-studio-move.log");
        const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
        const asking = () => existsSync(log) && readFileSync(log, "utf8").includes("Go ahead?");
        // Node can't see the first run end while this waits, so ps is asked: gone, or a zombie (Z), is ended.
        const ended = () => !/^[^Z]/.test(spawnSync("ps", ["-o", "stat=", "-p", String(firstRun.pid)], { encoding: "utf8" }).stdout.trim());
        const limit = Date.now() + 30_000;
        let why = "";
        while (!asking() && !why) {
          if (ended()) why = "it ended first";
          else if (Date.now() > limit) why = "it was still going after 30 seconds (is this Mac very busy?)";
          else sleep(100);
        }
        if (why) {
          firstRun.kill("SIGKILL");
          throw new Error(`The first run never reached its first question: ${why}. Its log:\n${existsSync(log) ? readFileSync(log, "utf8") : "(none)"}`);
        }
      }
      const r = spawnSync("/bin/zsh", [MOVE, ...commit, ...runArgs], { encoding: "utf8", input: o.answers ?? "", env });
      if (firstRun) firstRun.kill("SIGKILL");
      // The stand-in installer made the old drop folder unreadable (ranUnreadable); it is put right for the listing below.
      if (o.install?.ranUnreadable && oldDrop) { try { chmodSync(oldDrop, 0o755); } catch {} }
      putRight();
      const studioNow = existsSync(studio)
        ? { branch: inStudio("rev-parse", "--abbrev-ref", "HEAD"), head: inStudio("rev-parse", "HEAD"), upstream: inStudio("rev-parse", "--abbrev-ref", "@{u}"),
            origin: inStudio("remote", "get-url", "origin"), marks: text(join(studio, ".git", "move-to-studio")) }
        : null;
      return {
        sha, github, studioNow, installGitEnv: text(join(dir, "install-gitenv")), installGitSsh: text(join(dir, "install-gitssh")), partialLeft: existsSync(`${studio}.partial`),
        copied: text(copied), sshConfig: text(join(ssh, "config")), sshConfigMode: mode(join(ssh, "config")), knownHosts: text(join(ssh, "known_hosts")),
        publicCopy: text(join(home, "Desktop", "Studio key (public half).txt")), sshAsked: Number(text(asked).trim() || 0),
        status: r.status, out: r.stdout, err: r.stderr, home, before, tree: readdirSync(home, { recursive: true }).sort(),
        oldKeyFiles: ["brimm_video_deploy", "brimm_video_deploy.pub"].map((f) => existsSync(join(ssh, f))), ownKeyKept: existsSync(join(ssh, "id_ed25519")),
        ran: text(ran), log: text(join(home, "Library", "Logs", "brimm-video-studio-move.log")), report: text(join(home, "Desktop", "Studio move report.txt")),
        again: (next = {}, ...nextArgs) => run(next, nextArgs, false)
      };
    } finally {
      putRight();
    }
  };
  return run(options, args, true);
}


export {
  MOVE,
  notAMac,
  EMAIL,
  ORG,
  SIGNED_IN,
  SIGNED_OUT,
  KEY_COMMENT,
  GITHUB_HOST_KEY,
  HOST_BLOCK,
  HI,
  STOPPED_NOTHING,
  HEADINGS,
  PRINT_LINES,
  printText,
  DEFAULT_PRINT,
  BACKGROUND,
  DEFAULT_RAN,
  GIT_ENV,
  git,
  put,
  FAKE_SETTINGS_JS,
  FAKE_STUDIO_SETTINGS_JS,
  NEXT_SH,
  helperStandIn,
  openStandIn,
  writeList,
  makeChooser,
  dirsToClean,
  xmlEscape,
  agentPlist,
  moveOn
};
