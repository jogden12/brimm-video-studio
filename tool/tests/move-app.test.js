// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop or Jason's MacBook from brimm-video
// to Studio, or sets up fresh, as Jason's MacBook, a Mac with no brimm-video, one asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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

/** The fake tool/settings.js that both the old checkout and the "GitHub" repo hold: `show` and `set --app hyperframes`. */
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

/** Runs the move script on a Mac made for the test. `options`, all optional:
    settings   her settings.json (default: as the switch of 26 October left it), or null for none (a Mac with no brimm-video)
    settingsChange  values to change in the default settings
    brimmVideo with no settings, Dropbox's The BRIMM DB/BRIMM Video is still made in ~/Dropbox, unless this is null (none),
               "two" (a second one in ~/Library/CloudStorage/Dropbox too) or "linked" (only in ~/Library/CloudStorage/Dropbox, with
               ~/Dropbox a link to that Dropbox folder)
    launchctl  what `launchctl list` prints; launchctlLater: what it prints from its second call on (default: the same)
    dropFiles  names put in her drop folder (it always holds .DS_Store and .brimm-watched-by too)
    claude     { status, version }: what the stand-in prints for `auth status --json` (default signed in, Max), and for --version;
               `auth login` flips it to signed in unless loginFails
    key        the comment of a key already in ~/.ssh (default: KEY_COMMENT, so a key made earlier), or null for none
    sshConfig  text of ~/.ssh/config (default: just the Host entry), or null for none
    knownHosts text of ~/.ssh/known_hosts (default: GitHub's published ed25519 key), or null for none
    ssh        what `ssh -T` answers, one answer a call: "ok", "denied", "noisy" (a line, then the welcome) or "banner" (a host-key
               warning) or a list of them (default "ok"; the last repeats)
    firstRunWaiting  a real run is started first and left waiting at its question, holding the lock (use it with a signed-out claude)
    dropMode, desktopMode  the mode her drop folder or her Desktop is given for the run (0o000 and 0o555 test the unreadable and the unwritable)
    checkout   Studio's checkout in the home folder: "at-pin" (default), "absent", "other-commit", "dirty", "other-remote", "detached", "other-branch" or
               "partial-left" (no checkout, a half-made .partial beside where it goes)
    marks      text of the checkout's .git/move-to-studio, SHA standing for the pin (default for an at-pin checkout: the tests passed
               and the installer finished at the pin)
    hfApp      the version of the HyperFrames app (default "1.4.0"), or null for none; hfAppAfterOpen: the version the app has once
               `open -a Safari` has been run (the stand-in puts it there)
    install    what the stand-in tool/install.sh in the "GitHub" repo does: { print, printExit, ran, ranExit, moves, checkLeft }.
               `print` is the text of --print (a list: one text a call, the last repeating), `ran` the text of --yes; `printDrops` (a file name put in her drop folder by every --print), `moves`
               rewrites settings.json's checkout to Studio and writes the agent's plist; `checkLeft` leaves the one-shot plist;
               `writesSettings` makes, as the real one does on a Mac with none, a settings.json for the --machine and the folder it is
               given, and the drop folder Drop/<machine>
    laterCommit  the "GitHub" repo gets a commit after the pin
    testFail   BRIMM_TEST_FAIL=1 for the tests in the checkout
    gitStandIn a stand-in git that notes its arguments and GIT_SSH_COMMAND, and fails; noRepo leaves BRIMM_STUDIO_REPO unset;
               repoMissing points it at nothing
    commit     the commit to pass: the "GitHub" repo's own by default, null for none
    oldKey     true puts brimm-video's old key (its two files) in ~/.ssh, beside an unrelated id_ed25519 that must always stay
    oldReport  text of a report an earlier run left on her Desktop
    answers    stdin, such as "y\ny\n\n"
    env        more of the run's environment, such as { GIT_SSH: "..." }
    Returns { status, out, ran, home, before, tree, log, report }: `before` and `tree` list every file in the home folder before
    and after, and `log` and `report` are those files' text, or "". installGitEnv and installGitSsh are what the stand-in installer
    saw of GIT_SSH_COMMAND and GIT_SSH ("unset" for none). */
function moveOn(options = {}, ...args) {
  const dir = mkdtempSync(join(tmpdir(), "brimm-move-"));
  try {
    const home = join(dir, "home");
    const bin = join(dir, "bin");
    const ran = join(dir, "ran");
    const github = join(dir, "github");
    mkdirSync(home);
    mkdirSync(bin);

    // The "GitHub" Studio is cloned from: a local repository with a stand-in installer, the fake settings.js and one test.
    mkdirSync(github);
    git(github, "init", "-q", "-b", "main");
    // The stand-in installer: it notes its call in `ran`, answers --print from a file a call (the last repeating), and --yes from another.
    const inst = options.install ?? {};
    const prints = [inst.print ?? DEFAULT_PRINT].flat();
    prints.forEach((text, i) => writeFileSync(join(dir, `install-print-${i + 1}`), text));
    writeFileSync(join(dir, "install-ran"), inst.ran ?? DEFAULT_RAN);
    const ranFile = join(dir, "ran");
    put(join(github, "tool", "install.sh"), `#!/bin/zsh
echo "install.sh $*" >> "${ranFile}"
echo "\${GIT_SSH_COMMAND-unset}" > "${dir}/install-gitenv"
echo "\${GIT_SSH-unset}" > "${dir}/install-gitssh"
case "$1" in
  --print)
    n=$(cat "${dir}/install-prints" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${dir}/install-prints"
    ${inst.printDrops ? `touch "${join(home, "Dropbox", "The BRIMM DB", "BRIMM Video", "Drop", "Sallie's laptop", inst.printDrops)}"` : ""}
    f="${dir}/install-print-$n"; [ -f "$f" ] || f="${dir}/install-print-${prints.length}"
    cat "$f"; exit ${inst.printExit ?? 0} ;;
  --yes)
    cat "${dir}/install-ran"
    ${inst.moves ? `node -e 'const fs=require("fs");const f=process.argv[1];const s=JSON.parse(fs.readFileSync(f,"utf8"));s.checkout=process.argv[2];fs.writeFileSync(f,JSON.stringify(s))' "$HOME/Library/Application Support/BRIMM Video/settings.json" "$HOME/Claude Code/brimm-video-studio"
    mkdir -p "$HOME/Library/LaunchAgents"; echo "$HOME/Claude Code/brimm-video-studio/tool/unedited.js" > "$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist"` : ""}
    ${inst.checkLeft ? 'mkdir -p "$HOME/Library/LaunchAgents"; echo left > "$HOME/Library/LaunchAgents/com.thebrimm.claude-check.plist"' : ""}
    ${inst.writesSettings ? `machine="$3"; for a in "$@"; do root="$a"; done
    mkdir -p "$HOME/Library/Application Support/BRIMM Video" "$root/Drop/$machine"
    node -e 'const [f, root, machine, checkout] = process.argv.slice(1); require("fs").writeFileSync(f, JSON.stringify({ version: 1, machine, root, checkout, import: "light", handoffVersion: 2, drop: "Drop" }))' "$HOME/Library/Application Support/BRIMM Video/settings.json" "$root" "$machine" "$HOME/Claude Code/brimm-video-studio"` : ""}
    exit ${inst.ranExit ?? 0} ;;
esac
`, 0o755);
    put(join(github, "tool", "settings.js"), FAKE_SETTINGS_JS);
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
      ? { version: 1, machine: "Sallie's laptop", root: join(home, "Dropbox", "The BRIMM DB", "BRIMM Video"), checkout: oldCheckout, import: "light", handoffVersion: 2, drop: "Drop", app: "hyperframes", ...options.settingsChange }
      : options.settings;
    if (settings !== null) {
      put(join(home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify(settings));
      const drop = join(settings.root, settings.drop, settings.machine);
      put(join(drop, ".DS_Store"), "");
      put(join(drop, ".brimm-watched-by"), `${settings.machine}\n`);
      for (const name of options.dropFiles ?? []) put(join(drop, name), "made for the test");
    }
    // A Mac with no settings still has The BRIMM DB in Dropbox, unless the test says it has none (null), two ("two"), or one in
    // CloudStorage with ~/Dropbox a link to it ("linked"), as Dropbox makes it on a newer Mac.
    if (settings === null && options.brimmVideo !== null) {
      const cloud = join(home, "Library", "CloudStorage", "Dropbox");
      if (options.brimmVideo === "linked") {
        mkdirSync(join(cloud, "The BRIMM DB", "BRIMM Video"), { recursive: true });
        symlinkSync(cloud, join(home, "Dropbox"));
      } else {
        mkdirSync(join(home, "Dropbox", "The BRIMM DB", "BRIMM Video"), { recursive: true });
        if (options.brimmVideo === "two") mkdirSync(join(cloud, "The BRIMM DB", "BRIMM Video"), { recursive: true });
      }
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
      const marks = options.marks ?? (checkout === "at-pin" ? "tests=SHA\ninstalled=SHA\n" : null);
      if (marks !== null) writeFileSync(join(studio, ".git", "move-to-studio"), marks.replaceAll("SHA", sha));
    }
    if (checkout === "partial-left") put(`${studio}.partial/half-made`, "cut short\n");

    // The stand-ins: each writes what it was asked into `ran`.
    const stand = (name, body = "") => put(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${ran}"\n${body}`, 0o755);
    // `launchctl list` answers `launchctl` the first time and `launchctlLater` from the second time on.
    const idle = "-\\t0\\tcom.thebrimm.unedited";
    stand("launchctl", `if [ "$1" = list ]; then n=$(cat "${dir}/launchctl-n" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${dir}/launchctl-n"
  if [ $n -gt 1 ]; then printf '%b\\n' '${options.launchctlLater ?? options.launchctl ?? idle}'; else printf '%b\\n' '${options.launchctl ?? idle}'; fi
fi
exit 0
`);
    const hfApp = join(dir, "Applications", "HyperFrames.app");
    const appPlist = (version) => `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>\n`;
    const hfVersion = options.hfApp === undefined ? "1.4.0" : options.hfApp;
    if (hfVersion !== null) put(join(hfApp, "Contents", "Info.plist"), appPlist(hfVersion));
    for (const name of ["caffeinate", "brew"]) stand(name, name === "brew" ? 'echo "Homebrew 4.5.0"\n' : "");
    // `open -a Safari <page>` puts the app in place when the test says the app arrives after it.
    stand("open", options.hfAppAfterOpen ? `[ "$1" = -a ] && { mkdir -p "${hfApp}/Contents"; printf '%s' '${appPlist(options.hfAppAfterOpen)}' > "${hfApp}/Contents/Info.plist"; }\nexit 0\n` : "");
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

    const before = readdirSync(home, { recursive: true }).sort();
    // A folder made unreadable or unwritable only now, after the listing above, and put right again after the run.
    const dropDir = settings !== null ? join(settings.root, settings.drop, settings.machine) : null;
    const desktop = join(home, "Desktop");
    if (options.dropMode !== undefined) chmodSync(dropDir, options.dropMode);
    if (options.desktopMode !== undefined) { mkdirSync(desktop, { recursive: true }); chmodSync(desktop, options.desktopMode); }
    // The environment is built from scratch: the stand-ins first, the node that runs these tests last, no Homebrew.
    const env = {
      HOME: home, PATH: `${bin}:/usr/bin:/bin:${dirname(process.execPath)}`, BRIMM_HOMEBREW_DIRS: "",
      BRIMM_CLAUDE: join(bin, "claude"), BRIMM_STUDIO_REPO: options.repoMissing ? join(dir, "nowhere") : github, BRIMM_HYPERFRAMES_APP: hfApp
    };
    if (options.noRepo) delete env.BRIMM_STUDIO_REPO;
    if (options.testFail) env.BRIMM_TEST_FAIL = "1";
    Object.assign(env, options.env);
    const commit = options.commit === undefined ? ["--commit", sha] : options.commit === null ? [] : ["--commit", options.commit];
    // A first run already open, waiting at its first question (stdin is held open): the one the run under test is a second to.
    let first = null;
    if (options.firstRunWaiting) {
      first = spawn("/bin/zsh", [MOVE, ...commit], { env, stdio: ["pipe", "pipe", "pipe"] });
      const log = join(home, "Library", "Logs", "brimm-video-studio-move.log");
      const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      const asking = () => existsSync(log) && readFileSync(log, "utf8").includes("Go ahead?");
      // Node can't see the first run end while this waits, so ps is asked: gone, or a zombie (Z), is ended.
      const ended = () => !/^[^Z]/.test(spawnSync("ps", ["-o", "stat=", "-p", String(first.pid)], { encoding: "utf8" }).stdout.trim());
      const limit = Date.now() + 30_000;
      let why = "";
      while (!asking() && !why) {
        if (ended()) why = "it ended first";
        else if (Date.now() > limit) why = "it was still going after 30 seconds (is this Mac very busy?)";
        else sleep(100);
      }
      if (why) {
        first.kill("SIGKILL");
        throw new Error(`The first run never reached its first question: ${why}. Its log:\n${existsSync(log) ? readFileSync(log, "utf8") : "(none)"}`);
      }
    }
    const r = spawnSync("/bin/zsh", [MOVE, ...commit, ...args], { encoding: "utf8", input: options.answers ?? "", env });
    if (first) first.kill("SIGKILL");
    if (options.dropMode !== undefined) chmodSync(dropDir, 0o755);
    if (options.desktopMode !== undefined) chmodSync(desktop, 0o755);
    const text = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
    const mode = (file) => (existsSync(file) ? statSync(file).mode & 0o777 : null);
    const inStudio = (...a) => spawnSync("git", ["-C", studio, ...a], { encoding: "utf8", env: { ...GIT_ENV, HOME: home } }).stdout.trim();
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
      ran: text(ran), log: text(join(home, "Library", "Logs", "brimm-video-studio-move.log")), report: text(join(home, "Desktop", "Studio move report.txt"))
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("the move script, looking at her Mac", { skip: notAMac }, () => {
  it("refuses another Mac, and an option it doesn't know, and a missing commit, changing nothing", () => {
    const other = moveOn({ settingsChange: { machine: "Mac Studio" } });
    assert.equal(other.status, 2);
    assert.match(other.out, /This app is for Sallie's laptop and Jason's MacBook, and this Mac's settings say it is "Mac Studio"\. Nothing was changed\./);

    const unknown = moveOn({}, "--frobnicate");
    assert.equal(unknown.status, 2);
    assert.match(unknown.out, /Not an option this app knows: --frobnicate/);

    const missing = moveOn({ commit: null });
    assert.equal(missing.status, 2);
    assert.match(missing.out, /Say the commit this app was made at: --commit and its 40 characters\./);
    const malformed = moveOn({ commit: "abc123" });
    assert.equal(malformed.status, 2);

    for (const r of [other, none, unknown, missing, malformed]) {
      assert.deepEqual(r.tree, r.before, "nothing is written");
      assert.equal(r.ran, "", "nothing is run");
    }
  });

  const stopsFor = (name, change, saying) => it(`stops, saying which, when her settings aren't as the switch of 26 October left them: ${name}`, () => {
    const r = moveOn({ settingsChange: change });
    assert.equal(r.status, 1);
    assert.match(r.out, saying);
    assert.ok(r.out.endsWith(STOPPED_NOTHING), r.out);
  });
  stopsFor("the full import", { import: "full" }, /import.*"full"/);
  stopsFor("the old drop folder", { drop: "Unedited Video" }, /drop folder.*"Unedited Video"/);
  stopsFor("hand-off version 1", { handoffVersion: 1 }, /hand-off version.*"1"/);
  stopsFor("another checkout", { checkout: "/somewhere/else" }, /checkout.*"\/somewhere\/else"/);

  it("stops while an import is running", () => {
    const r = moveOn({ launchctl: "1234\\t0\\tcom.thebrimm.unedited" });
    assert.equal(r.status, 1);
    assert.match(r.out, /An import is running now\. Wait until its window in the top right closes, then double-click Move to Studio again\./);
    assert.ok(r.out.endsWith(STOPPED_NOTHING));
  });

  it("counts the files in her drop folder, never names one, and stops when there are any", () => {
    const r = moveOn({ dropFiles: ["Client Name Session.mov"] });
    assert.equal(r.status, 1);
    assert.match(r.out, /Her drop folder holds 1 file still to be imported\./);
    assert.ok(!r.out.includes("Client Name") && !r.log.includes("Client Name") && !r.err.includes("Client Name"));
    const two = moveOn({ dropFiles: ["a.mov", "b.mov"] });
    assert.match(two.out, /Her drop folder holds 2 files still to be imported\./);
  });

  it("stops, saying to allow Terminal, when her drop folder cannot be read, and does not take it for empty", () => {
    const r = moveOn({ dropMode: 0o000 });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /Her drop folder could not be read\. macOS may have asked whether Terminal may read Dropbox/);
    assert.match(r.out, /Allow it in System Settings › Privacy & Security › Files and Folders, then run the app again\./);
    assert.ok(!r.out.includes("Her drop folder is empty."), r.out);
    assert.ok(r.out.endsWith(STOPPED_NOTHING), r.out);
  });

  it("stops with a plain sentence, and the summary, when her Desktop cannot be written to", () => {
    const copy = moveOn({ key: null, desktopMode: 0o555, answers: "y\n" });
    assert.equal(copy.status, 1, copy.out);
    assert.match(copy.out, /Desktop could not be written to\. macOS may have asked whether Terminal may write there/);
    assert.match(copy.out, /Privacy & Security › Files and Folders/);
    assert.ok(copy.out.includes("  - made Studio's key"), copy.out);
    assert.ok(!copy.out.includes("kept a copy"), copy.out);
    assert.ok(!copy.err.includes("permission denied"), "no raw zsh error");

    const report = moveOn({ desktopMode: 0o555 });
    assert.equal(report.status, 1, report.out);
    assert.match(report.out, /Desktop could not be written to/);
    assert.match(report.out, /Stopped\. This run changed/);
    assert.ok(!report.ran.includes("open -R"), report.ran);
    assert.ok(!report.err.includes("permission denied"), report.err);
  });

  it("offers claude auth login when Claude Code isn't signed in, and stops on n", () => {
    const no = moveOn({ claude: { status: SIGNED_OUT }, answers: "n\n" });
    assert.equal(no.status, 1);
    assert.ok(!no.ran.includes("claude auth login"), no.ran);
    assert.match(no.out, /claude auth login/);
    assert.ok(no.out.endsWith(STOPPED_NOTHING));

    const yes = moveOn({ claude: { status: SIGNED_OUT }, answers: "y\n" });
    assert.equal(yes.status, 0, yes.out);
    assert.match(yes.ran, /^claude auth login$/m);
    // It looked again after the sign-in, and went on.
    assert.ok(yes.ran.indexOf("claude auth login") < yes.ran.lastIndexOf("claude auth status --json"));
    assert.match(yes.out, /Claude Code:  signed in \(max\)/);
  });

  it("lists the sign-in as a change only once Claude Code is signed in", () => {
    const worked = moveOn({ claude: { status: SIGNED_OUT }, key: null, answers: "y\nn\n" });
    assert.equal(worked.status, 1, worked.out);
    assert.ok(worked.out.includes("  - signed Claude Code in\n"), worked.out);

    const failed = moveOn({ claude: { status: SIGNED_OUT, loginFails: true }, answers: "y\n" });
    assert.equal(failed.status, 1, failed.out);
    assert.match(failed.out, /Claude Code is still not signed in\./);
    assert.ok(failed.out.endsWith(STOPPED_NOTHING), failed.out);
    assert.ok(!failed.out.includes("signed Claude Code in"), failed.out);
  });

  it("never shows the Claude account's email", () => {
    const r = moveOn({});
    assert.equal(r.status, 0, r.out);
    for (const text of [r.out, r.err, r.log, r.report]) {
      assert.ok(!text.includes(EMAIL) && !text.includes(ORG) && !text.includes("The BRIMM Secret"), text);
    }
    assert.match(r.out, /Claude Code:  signed in \(max\), version 2\.1\.300/);
    assert.match(r.out, /Homebrew:  Homebrew 4\.5\.0/);
  });

  it("takes y, Y, yes and ' y ' as go ahead, and anything else as stop", () => {
    for (const answer of ["y\n", "Y\n", "yes\n", "YES\n", " y \n", "y"]) {
      const r = moveOn({ claude: { status: SIGNED_OUT }, answers: answer });
      assert.equal(r.status, 0, JSON.stringify(answer) + r.out);
      assert.match(r.ran, /^claude auth login$/m, JSON.stringify(answer));
    }
    for (const answer of ["n\n", "\n", "", "no\n", "yy\n", "yes please\n", "ok\n", "sure\n", "y n\n"]) {
      const r = moveOn({ claude: { status: SIGNED_OUT }, answers: answer });
      assert.equal(r.status, 1, JSON.stringify(answer));
      assert.ok(!r.ran.includes("claude auth login"), JSON.stringify(answer));
      assert.ok(r.out.endsWith(STOPPED_NOTHING), JSON.stringify(answer) + r.out);
    }
  });

  it("with --print, looks, says what it would do in order, and changes nothing", () => {
    const r = moveOn({}, "--print");
    assert.equal(r.status, 0, r.out);
    let at = -1;
    for (const heading of HEADINGS) {
      const next = r.out.indexOf(heading);
      assert.ok(next > at, `"${heading}" comes after the one before it:\n${r.out}`);
      at = next;
    }
    assert.ok(r.out.trimEnd().endsWith("Nothing was changed."), r.out);
    assert.deepEqual(r.tree, r.before, "no log, no report, no Desktop file");
    const reading = /^(launchctl list|claude auth status --json|claude --version|sw_vers.*|df.*|xcode-select -p|brew --version|ssh-keygen -F github\.com -f .*|ssh -F .* -T git@github-brimm-video-studio|install\.sh --print .*)$/;
    const calls = r.ran.split("\n").filter(Boolean);
    assert.ok(calls.length > 0);
    for (const call of calls) assert.match(call, reading, `a call that reads and changes nothing: ${call}`);
    assert.ok(!r.ran.includes("caffeinate"), "the Mac is not kept awake for a print");

    // Signed out, a print says it would ask, and asks nothing and signs in to nothing.
    const out = moveOn({ claude: { status: SIGNED_OUT }, answers: "" }, "--print");
    assert.equal(out.status, 0, out.out);
    assert.match(out.out, /Would ask to run claude auth login/);
    assert.ok(!out.ran.includes("auth login"));
    assert.deepEqual(out.tree, out.before);
  });

  it("writes all it says into its log, and keeps the Mac awake", () => {
    const r = moveOn({ claude: { status: SIGNED_OUT }, answers: "n\n" });
    assert.equal(r.status, 1);
    assert.match(r.ran, /^caffeinate -i -w \d+$/m);
    const logged = r.log.split("\n");
    // A question's line in the log goes on with the answer typed to it.
    for (const line of r.out.split("\n")) assert.ok(line === "" || logged.some((l) => l.startsWith(line)), `in the log: ${JSON.stringify(line)}`);
    assert.ok(r.log.includes("Stopped. This run changed nothing."));
    assert.ok(logged.includes("Go ahead? Type y and press Return, or n to stop: n"), "the answer is kept, and a newline follows it");

    // A wait for Return keeps what was typed, here nothing, and the next thing said starts a line of its own.
    const waited = moveOn({ key: null, answers: "y\n\nn\n" });
    const lines = waited.log.split("\n");
    assert.ok(lines.includes("Go ahead? Type y and press Return, or n to stop: y"), waited.log);
    assert.ok(lines.includes("Press Return when that's done, or type n and press Return to stop: "), waited.log);
  });

  it("says it was stopped, and what it changed, on Ctrl-C", () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-move-int-"));
    try {
      const home = join(dir, "home");
      mkdirSync(home);
      const partial = join(dir, "checkout.partial");
      const script = 'source "$1"; changed=("put a thing in place"); PARTIAL="$2"; mkdir -p "$PARTIAL"; made_partial=1; on_int';
      const run = (handler) => spawnSync("/bin/zsh", ["-c", script.replace("on_int", handler), "move", MOVE, partial], { encoding: "utf8", env: { HOME: home, PATH: "/usr/bin:/bin" } });
      const int = run("on_int");
      assert.equal(int.status, 130, int.stdout + int.stderr);
      assert.match(int.stdout, /Stopped\. This run changed:\n {2}- put a thing in place\nDouble-click Move to Studio again to go on from here\./);
      assert.ok(!existsSync(partial), "the clone this run was making is taken away");

      mkdirSync(partial);
      const term = run("on_term");
      assert.equal(term.status, 143);
      assert.ok(!existsSync(partial));

      // Closing the Terminal window (HUP) stops it the same way, and takes the partial away before it says anything: the terminal may be gone.
      mkdirSync(partial);
      const hup = run("on_hup");
      assert.equal(hup.status, 129, hup.stdout + hup.stderr);
      assert.match(hup.stdout, /Stopped\. This run changed:\n {2}- put a thing in place\nDouble-click Move to Studio again to go on from here\./);
      assert.ok(!existsSync(partial));
      const order = spawnSync("/bin/zsh", ["-c", 'source "$1"; changed=(); PARTIAL="$2"; mkdir -p "$PARTIAL"; made_partial=1; say() { [[ -d "$PARTIAL" ]] && echo STILL-THERE; return 0; }; on_hup', "move", MOVE, partial], { encoding: "utf8", env: { HOME: home, PATH: "/usr/bin:/bin" } });
      assert.ok(!order.stdout.includes("STILL-THERE"), "the partial is gone before the first thing said");
      // The same for Ctrl-C.
      mkdirSync(partial);
      const intOrder = spawnSync("/bin/zsh", ["-c", 'source "$1"; changed=(); PARTIAL="$2"; mkdir -p "$PARTIAL"; made_partial=1; say() { [[ -d "$PARTIAL" ]] && echo STILL-THERE; return 0; }; on_int', "move", MOVE, partial], { encoding: "utf8", env: { HOME: home, PATH: "/usr/bin:/bin" } });
      assert.ok(!intOrder.stdout.includes("STILL-THERE"));

      // A partial this run did not make is left alone.
      mkdirSync(partial);
      const other = spawnSync("/bin/zsh", ["-c", 'source "$1"; PARTIAL="$2"; on_int', "move", MOVE, partial], { encoding: "utf8", env: { HOME: home, PATH: "/usr/bin:/bin" } });
      assert.equal(other.status, 130);
      assert.match(other.stdout, /Stopped\. This run changed nothing\./);
      assert.ok(existsSync(partial));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the move script, one run at a time", { skip: notAMac }, () => {
  const SIGNED_OUT_OPEN = { claude: { status: SIGNED_OUT }, firstRunWaiting: true };
  it("stops a second run at once while a first is open, and starts nothing", () => {
    const r = moveOn({ ...SIGNED_OUT_OPEN, answers: "y\ny\ny\n" });
    assert.equal(r.status, 1, r.out);
    assert.equal(r.out, "Move to Studio is already running in another Terminal window. Use that one, or close it and double-click again.\n");
    assert.equal(r.log.split("\n").filter((l) => l.startsWith("--- ")).length, 1, "only the first run is in the log");
    assert.ok(!r.out.includes("Stopped."), "the second run changed nothing, and says nothing of the first");
  });

  it("(the test's own set-up) says so plainly when the first run never reaches its question, rather than going on", () => {
    // Refused at once (its settings name the Mac Studio), the first run never asks, so it never holds the lock the second should meet.
    assert.throws(() => moveOn({ ...SIGNED_OUT_OPEN, settingsChange: { machine: "Mac Studio" } }), /The first run never reached its first question: it ended first\./);
  });

  it("takes no lock under --print, so a print runs beside an open run", () => {
    const r = moveOn(SIGNED_OUT_OPEN, "--print");
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.trimEnd().endsWith("Nothing was changed."), r.out);
  });
});

describe("the move script, Studio's key (check 42)", { skip: notAMac }, () => {
  const KEYFILE = (home) => `${home}/.ssh/brimm_video_studio_deploy`;

  it("makes the key on y, with exactly check 42's line, and shows and copies its public half", () => {
    const r = moveOn({ key: null, answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.ran.split("\n").includes(`ssh-keygen -t ed25519 -f ${KEYFILE(r.home)} -N  -C ${KEY_COMMENT}`), r.ran);
    const pub = `ssh-ed25519 AAAAstandin ${KEY_COMMENT}\n`;
    assert.equal(r.copied, pub);
    assert.equal(r.publicCopy, pub);
    assert.ok(r.out.includes(pub.trim()));
    assert.match(r.out, /Press Return when that's done/);
    for (const text of [r.out, r.err, r.log, r.report]) assert.ok(!text.includes("PRIVATE-HALF"), "the private half is never shown");
    assert.match(r.log, /Studio's key/);
  });

  it("with --print and no key, says it would make the key, and the exact line, and changes nothing", () => {
    const r = moveOn({ key: null }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /Would make Studio's key/);
    assert.ok(r.out.includes(`ssh-keygen -t ed25519 -f "${KEYFILE(r.home)}" -N "" -C "${KEY_COMMENT}"`), r.out);
    assert.ok(!r.ran.includes("ssh-keygen -t"));
    assert.deepEqual(r.tree, r.before);
    assert.ok(r.out.trimEnd().endsWith("Nothing was changed."));
  });

  it("keeps a key of that name made earlier with the same comment, and stops on one with another comment", () => {
    const same = moveOn({ key: KEY_COMMENT });
    assert.equal(same.status, 0, same.out);
    assert.match(same.out, /Already done: .*key/);
    assert.ok(!same.ran.includes("ssh-keygen -t"), same.ran);

    const other = moveOn({ key: "someone else" });
    assert.equal(other.status, 1);
    assert.ok(!other.ran.includes("ssh-keygen -t"));
    assert.ok(other.out.endsWith(STOPPED_NOTHING), other.out);
  });

  it("adds the Host entry on y, exactly, after what is there, and leaves the rest byte for byte", () => {
    const before = "Host other\n  HostName example.com";
    const r = moveOn({ sshConfig: before, answers: "y\n" });
    assert.equal(r.status, 0, r.out);
    assert.equal(r.sshConfig, `${before}\n\n${HOST_BLOCK}`);

    const withNewline = moveOn({ sshConfig: "Host other\n  HostName example.com\n", answers: "y\n" });
    assert.equal(withNewline.sshConfig, `Host other\n  HostName example.com\n\n${HOST_BLOCK}`);

    const made = moveOn({ sshConfig: null, answers: "y\n" });
    assert.equal(made.status, 0, made.out);
    assert.equal(made.sshConfig, HOST_BLOCK);
    assert.equal(made.sshConfigMode, 0o600);

    const declined = moveOn({ sshConfig: before, answers: "n\n" });
    assert.equal(declined.status, 1);

    const again = moveOn({ sshConfig: `Host other\n  HostName example.com\n\n${HOST_BLOCK}` });
    assert.equal(again.status, 0, again.out);
    assert.match(again.out, /Already done: .*Host entry/);
    assert.equal(again.sshConfig, `Host other\n  HostName example.com\n\n${HOST_BLOCK}`);

    const different = moveOn({ sshConfig: HOST_BLOCK.replace("github.com", "example.org") });
    assert.equal(different.status, 1);
    assert.match(different.out, /Host github-brimm-video-studio/);
    assert.equal(different.sshConfig, HOST_BLOCK.replace("github.com", "example.org"), "left alone");
  });

  it("offers GitHub's published host key when this Mac has none, and stops on a different one", () => {
    const r = moveOn({ knownHosts: null, answers: "y\n" });
    assert.equal(r.status, 0, r.out);
    assert.equal(r.knownHosts, `${GITHUB_HOST_KEY}\n`);

    const declined = moveOn({ knownHosts: null, answers: "n\n" });
    assert.equal(declined.status, 1);

    const other = moveOn({ knownHosts: "github.com ssh-ed25519 AAAAOTHER\n" });
    assert.equal(other.status, 1);
    assert.match(other.out, /GitHub's key on this Mac isn't the one GitHub publishes/);
    assert.equal(other.knownHosts, "github.com ssh-ed25519 AAAAOTHER\n");
  });

  it("waits for the key to be on GitHub, then checks it with ssh, with her own files and GitHub's ed25519 key only", () => {
    const r = moveOn({ key: null, answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    const line = `ssh -F ${r.home}/.ssh/config -o UserKnownHostsFile=${r.home}/.ssh/known_hosts -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes -n -T git@github-brimm-video-studio`;
    assert.ok(r.ran.split("\n").includes(line), r.ran);
    assert.ok(r.out.includes(HI), r.out);
    assert.match(r.out, /Settings.*Deploy keys/s);
    assert.match(r.out, /write access off/i);
    assert.equal(r.sshAsked, 1);
  });

  it("shows all of ssh's lines when it stops, and keeps the welcome line, not ssh's first line, for the report", () => {
    const banner = moveOn({ ssh: ["banner"] });
    assert.equal(banner.status, 1, banner.out);
    assert.match(banner.out, /ssh did not get GitHub's welcome for this key\. It said:/);
    assert.ok(banner.out.includes("@@@@@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@@@@@\nHost key verification failed."), banner.out);

    const noisy = moveOn({ ssh: ["noisy"] });
    assert.equal(noisy.status, 0, noisy.out);
    assert.match(noisy.report, new RegExp(`^What the check of the key printed: ${HI.replace(/[.!]/g, "\\$&")}$`, "m"));
    assert.ok(!noisy.report.includes("a first line that is not the welcome"), noisy.report);
  });

  it("asks to try again when GitHub doesn't know the key yet", () => {
    const again = moveOn({ key: null, ssh: ["denied", "ok"], answers: "y\n\n\n" });
    assert.equal(again.status, 0, again.out);
    assert.equal(again.sshAsked, 2);
    assert.equal((again.out.match(/Press Return when that's done/g) ?? []).length, 2, again.out);

    const stops = moveOn({ key: null, ssh: ["denied"], answers: "y\n\nn\n" });
    assert.equal(stops.status, 1);
    assert.equal(stops.sshAsked, 1);
    assert.ok(!/Already done: .*on GitHub/.test(stops.out));

    // A key made earlier that GitHub already knows needs no waiting.
    const known = moveOn({ answers: "" });
    assert.equal(known.status, 0, known.out);
    assert.match(known.out, /Already done: .*GitHub/);
    assert.ok(!known.out.includes("Press Return when that's done"));

  });
});

describe("the move script, Studio's code (check 42)", { skip: notAMac }, () => {
  it("clones main on y into the partial folder, puts main at the app's commit, then renames it", () => {
    const r = moveOn({ checkout: "absent", laterCommit: true, answers: "y\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.studioNow, "the checkout is there");
    assert.equal(r.studioNow.branch, "main");
    assert.equal(r.studioNow.head, r.sha, "at the app's commit, though GitHub's main is further on");
    assert.equal(r.studioNow.upstream, "origin/main");
    assert.equal(r.studioNow.origin, r.github);
    assert.equal(r.partialLeft, false);
    assert.match(r.out, /3\. Studio's code \(check 42\)/);
    assert.match(r.out, new RegExp(`${r.sha.slice(0, 7)}`));
  });

  it("stops, leaving nothing, when GitHub's main doesn't hold the app's commit", () => {
    const r = moveOn({ checkout: "absent", commit: "1".repeat(40), answers: "y\n" });
    assert.equal(r.status, 1, r.out);
    assert.equal(r.studioNow, null);
    assert.equal(r.partialLeft, false);
    assert.match(r.out, /doesn't hold the commit this app was made at/);
    assert.ok(!r.out.includes("copied Studio's code"), r.out);
  });

  it("takes away a half-made clone an earlier run left, then clones", () => {
    const r = moveOn({ checkout: "partial-left", answers: "y\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /half-made/);
    assert.equal(r.partialLeft, false);
    assert.equal(r.studioNow?.head, r.sha);
    assert.ok(!r.tree.some((f) => f.includes("half-made")), "the old half-made file is gone");
  });

  it("a failed clone leaves nothing at the checkout's place", () => {
    const r = moveOn({ checkout: "absent", repoMissing: true, answers: "y\n" });
    assert.equal(r.status, 1, r.out);
    assert.equal(r.studioNow, null);
    assert.equal(r.partialLeft, false);
    assert.match(r.out, /could not be copied/);
    assert.ok(!r.out.includes("copied Studio's code to"), r.out);
  });

  it("says already done for a clean checkout at the app's commit, and stops on any other, naming what is wrong", () => {
    const ok = moveOn({ checkout: "at-pin" });
    assert.equal(ok.status, 0, ok.out);
    assert.match(ok.out, /Already done: Studio's code is there/);

    const other = moveOn({ checkout: "other-commit" });
    assert.equal(other.status, 1);
    assert.match(other.out, /is at [0-9a-f]{7}, and this app was made at [0-9a-f]{7}/);
    const dirty = moveOn({ checkout: "dirty" });
    assert.equal(dirty.status, 1);
    assert.match(dirty.out, /has changes that aren't saved/);
    const remote = moveOn({ checkout: "other-remote" });
    assert.equal(remote.status, 1);
    assert.match(remote.out, /comes from \/somewhere\/else, not from Studio's repository/);
    const detached = moveOn({ checkout: "detached" });
    const branch = moveOn({ checkout: "other-branch" });
    for (const r of [detached, branch]) {
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /isn't on main/);
      assert.ok(!r.out.includes("Already done: Studio's code"), r.out);
    }
    assert.match(branch.out, /\(feature\)|"feature"|feature/);
    assert.equal(moveOn({ checkout: "detached" }, "--print").status, 1);
    assert.match(moveOn({ checkout: "other-branch" }, "--print").out, /isn't on main/);
    assert.equal(branch.studioNow.branch, "feature", "left alone");
    // The only thing this run changed is the Desktop copy of the key's public half (the harness has none): the checkout is untouched.
    const inCheckout = (list) => list.filter((f) => f.startsWith("Claude Code/brimm-video-studio"));
    for (const r of [other, dirty, remote]) {
      assert.ok(!r.out.includes("copied Studio's code"), r.out);
      assert.deepEqual(inCheckout(r.tree), inCheckout(r.before), "the checkout is untouched");
    }
    // A print stops in the same words.
    const printed = moveOn({ checkout: "other-commit" }, "--print");
    assert.equal(printed.status, 1);
    assert.match(printed.out, /is at [0-9a-f]{7}, and this app was made at [0-9a-f]{7}/);
  });

  it("the real clone is from check 42's address, through her own ssh files", () => {
    const r = moveOn({ checkout: "absent", gitStandIn: true, noRepo: true, answers: "y\n" });
    assert.equal(r.status, 1, r.out);
    const calls = r.ran.split("\n");
    assert.ok(calls.includes(`git clone --branch main git@github-brimm-video-studio:jogden12/brimm-video-studio.git ${r.home}/Claude Code/brimm-video-studio.partial`), r.ran);
    const via = calls.find((c) => c.startsWith("GIT_SSH_COMMAND="));
    assert.ok(via, r.ran);
    for (const part of [`-F ${r.home}/.ssh/config`, `UserKnownHostsFile=${r.home}/.ssh/known_hosts`, "StrictHostKeyChecking=yes", "HostKeyAlgorithms=ssh-ed25519", "BatchMode=yes"]) {
      assert.ok(via.includes(part), `${part} in ${via}`);
    }
    assert.equal(r.partialLeft, false, "the failed clone leaves nothing");
  });

  it("runs Studio's tests there with the spec reporter, stops when one fails, and doesn't run them again at the same commit", () => {
    const fail = moveOn({ marks: "", testFail: true });
    assert.equal(fail.status, 1, fail.out);
    assert.match(fail.out, /about three minutes/);
    assert.match(fail.out, /ℹ fail 1/);
    assert.match(fail.out, /✖|✔|ok/);
    assert.ok(!/tests=/.test(fail.studioNow.marks), "nothing is marked on a failure");

    const pass = moveOn({ marks: "installed=SHA\n" });
    assert.equal(pass.status, 0, pass.out);
    assert.match(pass.out, /ℹ pass 1/);
    assert.match(pass.out, /ℹ fail 0/);
    assert.equal(pass.studioNow.marks, `installed=${pass.sha}\ntests=${pass.sha}\n`, "only its own line is written, the rest kept");
    assert.match(pass.log, /ℹ pass 1/, "kept in the log");

    const again = moveOn({});
    assert.equal(again.status, 0, again.out);
    assert.match(again.out, /Already done: Studio's tests passed at this commit/);
    assert.ok(!again.out.includes("ℹ pass"), "not run again");

    // A mark for another commit does not count.
    const old = moveOn({ marks: `tests=${"0".repeat(40)}\n` });
    assert.match(old.out, /ℹ pass 1/);
    assert.equal(old.studioNow.marks, `tests=${old.sha}\n`);
  });

  it("with --print, says what it would clone and test, and runs and changes nothing", () => {
    const r = moveOn({ checkout: "absent", gitStandIn: true, noRepo: true, laterCommit: true }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /Would clone Studio's code with: git clone --branch main git@github-brimm-video-studio:jogden12\/brimm-video-studio\.git .*brimm-video-studio\.partial/);
    assert.match(r.out, /Would put main at [0-9a-f]{7}/);
    assert.match(r.out, /Would run Studio's tests/);
    assert.ok(!r.ran.includes("git clone"), r.ran);
    assert.deepEqual(r.tree, r.before);

    const left = moveOn({ checkout: "partial-left" }, "--print");
    assert.equal(left.status, 0, left.out);
    assert.match(left.out, /Would take away the half-made copy/);
    assert.deepEqual(left.tree, left.before, "a print takes no .partial away");

    const there = moveOn({ marks: "" }, "--print");
    assert.equal(there.status, 0, there.out);
    assert.match(there.out, /Would run Studio's tests/);
    assert.ok(!there.out.includes("ℹ pass"));
  });
});

describe("the move script, HyperFrames and Studio's installer (checks 43 and 44)", { skip: notAMac }, () => {
  const OPTIONS = "--machine Sallie's laptop --drop Drop --import light --handoff 2";
  const rootOf = (home) => `${home}/Dropbox/The BRIMM DB/BRIMM Video`;
  const installCalls = (r) => r.ran.split("\n").filter((l) => l.startsWith("install.sh "));
  const NOT_INSTALLED = "tests=SHA\n";

  it("notes HyperFrames' version, or opens its page in Safari and waits", () => {
    const here = moveOn({ hfApp: "1.4.0" });
    assert.equal(here.status, 0, here.out);
    assert.match(here.out, /4\. The HyperFrames app \(check 43\)/);
    assert.match(here.out, /HyperFrames app:\s+.*1\.4\.0/);
    assert.ok(!here.ran.includes("open -a Safari"), here.ran);

    const gone = moveOn({ hfApp: null, hfAppAfterOpen: "1.5.2", answers: "\n" });
    assert.equal(gone.status, 0, gone.out);
    const calls = gone.ran.split("\n");
    assert.ok(calls.includes("open -a Safari https://hyperframes.dev/studio"), gone.ran);
    assert.match(gone.out, /Press Return when that's done/);
    assert.match(gone.out, /sign in to HeyGen/);
    assert.match(gone.out, /Claude Code as the agent, on Auto/);
    assert.match(gone.out, /1\.5\.2/, "it looked again after the wait");

    const stops = moveOn({ hfApp: null, answers: "n\n" });
    assert.equal(stops.status, 1);
    assert.ok(stops.out.endsWith(STOPPED_NOTHING), stops.out);

    // A print says it would open the page, and opens nothing.
    const printed = moveOn({ hfApp: null }, "--print");
    assert.equal(printed.status, 0, printed.out);
    assert.match(printed.out, /Would open .*https:\/\/hyperframes\.dev\/studio/);
    assert.ok(!printed.ran.includes("open -a Safari"));
  });

  it("prints the installer first, with check 44's options and her BRIMM Video, and repeats the lines that matter", () => {
    const r = moveOn({ marks: NOT_INSTALLED, answers: "n\n" });
    assert.equal(r.status, 1);
    assert.match(r.out, /5\. Studio's installer \(check 44\)/);
    assert.deepEqual(installCalls(r), [`install.sh --print ${OPTIONS} ${rootOf(r.home)}`]);
    const at = r.out.indexOf("The lines that matter:");
    assert.ok(at > 0, r.out);
    const after = r.out.slice(at);
    for (const line of [PRINT_LINES.signed, PRINT_LINES.version, PRINT_LINES.app, PRINT_LINES.hdr, PRINT_LINES.lock]) {
      assert.ok(after.includes(line), `${line} is shown again`);
      assert.ok(r.out.slice(0, at).includes(line), `${line} is shown by the print`);
    }
    assert.ok(!after.includes("By hand afterwards"), "only the lines that matter");
  });

  it("stops with the installer's own words when its print refuses, and never runs it for real", () => {
    const words = "A video is in the drop folder, so the installer changed nothing.";
    const r = moveOn({ marks: NOT_INSTALLED, install: { print: words + "\n", printExit: 2 }, answers: "y\ny\ny\n\n" });
    assert.equal(r.status, 1, r.out);
    assert.ok(r.out.includes(words), r.out);
    assert.ok(!r.ran.includes("install.sh --yes"), r.ran);
    assert.ok(r.out.endsWith(STOPPED_NOTHING), r.out);

    // A print stops the same way.
    const printed = moveOn({ marks: NOT_INSTALLED, install: { print: words + "\n", printExit: 2 } }, "--print");
    assert.equal(printed.status, 1);
    assert.ok(printed.out.includes(words));
  });

  it("stops, saying to sign in, when the print says Claude Code is not signed in", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { print: printText("  Claude Code, signed in:  no. In Terminal, run: claude auth login (Sallie signs in), then run this again.") }, answers: "y\n" });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /claude auth login/);
    assert.ok(!r.ran.includes("install.sh --yes"));
  });

  it("on n after the print, runs nothing for real", () => {
    const r = moveOn({ marks: NOT_INSTALLED, answers: "n\n" });
    assert.equal(r.status, 1);
    assert.ok(!r.ran.includes("--yes"), r.ran);
    assert.equal(r.studioNow.marks, `tests=${r.sha}\n`);
    assert.ok(r.out.endsWith(STOPPED_NOTHING), r.out);
  });

  it("on y runs the same line with --yes, then checks the background job's line and the one-shot agent", () => {
    const r = moveOn({ marks: NOT_INSTALLED, answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [`install.sh --print ${OPTIONS} ${rootOf(r.home)}`, `install.sh --yes ${OPTIONS} ${rootOf(r.home)}`]);
    assert.ok(r.out.includes(BACKGROUND), "its output is shown");
    assert.match(r.studioNow.marks, new RegExp(`installed=${r.sha}`));

    const noCheck = moveOn({ marks: NOT_INSTALLED, install: { ran: "Setting up Studio...\nDone.\n" }, answers: "y\n" });
    assert.equal(noCheck.status, 1, noCheck.out);
    assert.match(noCheck.out, /stopped before its check of Claude/);
    assert.ok(!/installed=/.test(noCheck.studioNow.marks), "a stopped install writes no mark");

    const left = moveOn({ marks: NOT_INSTALLED, install: { checkLeft: true }, answers: "y\n" });
    assert.equal(left.status, 1, left.out);
    assert.match(left.out, /launchd would run it at every login/);
    assert.ok(!/installed=/.test(left.studioNow.marks));
  });

  it("offers claude update when the print says Terminal's Claude Code is too old, then prints again", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { print: [printText(PRINT_LINES.signed, PRINT_LINES.older, PRINT_LINES.hdr), DEFAULT_PRINT] }, answers: "y\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.equal((r.out.match(/older than/g) ?? []).length, 1, "the older line is shown once, by the first print");
    assert.ok(r.ran.split("\n").includes("claude update"), r.ran);
    assert.equal(installCalls(r).filter((c) => c.startsWith("install.sh --print")).length, 2);
    assert.ok(r.ran.indexOf("claude update") < r.ran.indexOf("install.sh --yes"));

    const declined = moveOn({ marks: NOT_INSTALLED, install: { print: printText(PRINT_LINES.signed, PRINT_LINES.older) }, answers: "n\n" });
    assert.equal(declined.status, 1);
    assert.ok(!declined.ran.includes("claude update"));

    // Still too old after the update: it stops, and does not run the installer.
    const still = moveOn({ marks: NOT_INSTALLED, install: { print: printText(PRINT_LINES.signed, PRINT_LINES.older) }, answers: "y\ny\ny\ny\n" });
    assert.equal(still.status, 1, still.out);
    assert.ok(!still.ran.includes("install.sh --yes"));
  });

  it("waits for the Claude app's own update when its copy is too old, then prints again", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { print: [printText(PRINT_LINES.signed, PRINT_LINES.version, PRINT_LINES.appOlder), DEFAULT_PRINT] }, answers: "\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /Check for Updates/);
    assert.match(r.out, /Press Return when that's done/);
    assert.equal(installCalls(r).filter((c) => c.startsWith("install.sh --print")).length, 2);
    assert.ok(!r.ran.includes("claude update"), "the app's copy is not updated by claude update");
  });

  it("turns HyperFrames on, asked, unless it is on already, and shows her drop folder in Finder", () => {
    const r = moveOn({ marks: NOT_INSTALLED, settingsChange: { app: undefined }, answers: "y\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.includes("The editing app is now hyperframes (it was off)."), r.out);
    assert.match(r.out, /Make available offline/);
    assert.match(r.out, /Allow/);
    assert.match(r.out, /node/);
    const calls = r.ran.split("\n");
    assert.ok(calls.includes(`open -R ${rootOf(r.home)}/Drop/Sallie's laptop`), r.ran);

    const on = moveOn({ marks: NOT_INSTALLED, answers: "y\n\n" });
    assert.equal(on.status, 0, on.out);
    assert.match(on.out, /Already done: HyperFrames is on/);
    assert.ok(!on.out.includes("is now hyperframes"));

    const declined = moveOn({ marks: NOT_INSTALLED, settingsChange: { app: undefined }, answers: "y\nn\n" });
    assert.equal(declined.status, 1, declined.out);
    assert.ok(!declined.out.includes("is now hyperframes"));
    assert.match(declined.studioNow.marks, /installed=/, "the install itself was finished");
    const after = declined.out.slice(declined.out.lastIndexOf("Stopped."));
    assert.ok(after.includes("  - ran Studio's installer\n"), "a finished install is listed plainly");
    assert.ok(!after.includes("if it stopped"), after);

    // A print turns nothing on and opens nothing.
    const printed = moveOn({ marks: NOT_INSTALLED, settingsChange: { app: undefined } }, "--print");
    assert.equal(printed.status, 0, printed.out);
    assert.match(printed.out, /Would .*set --app hyperframes/);
    assert.ok(!printed.ran.includes("open -R") && !printed.ran.includes("claude update") && !printed.ran.includes("--yes"), printed.ran);
  });

  it("says already done for an install finished at this commit, and runs it again otherwise", () => {
    const done = moveOn({});
    assert.equal(done.status, 0, done.out);
    assert.match(done.out, /Already done: .*installer/);
    assert.deepEqual(installCalls(done), []);

    const other = moveOn({ marks: `tests=SHA\ninstalled=${"0".repeat(40)}\n`, answers: "n\n" });
    assert.equal(other.status, 1);
    assert.equal(installCalls(other).length, 1, "it prints again");

    const fresh = moveOn({ marks: "tests=SHA\n", answers: "y\n\n" });
    assert.equal(fresh.studioNow.marks, `tests=${fresh.sha}\ninstalled=${fresh.sha}\n`, "only its own line is written, the rest kept");
  });

  it("with --print and no checkout, says the exact line it would print first", () => {
    const r = moveOn({ checkout: "absent", gitStandIn: true, noRepo: true }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.includes(`Would run Studio's installer with --print first (it changes nothing): zsh "${r.home}/Claude Code/brimm-video-studio/tool/install.sh" --print --machine "Sallie's laptop" --drop Drop --import light --handoff 2 "${rootOf(r.home)}"`), r.out);
    assert.deepEqual(installCalls(r), []);
    assert.deepEqual(r.tree, r.before);
  });

  it("with --print and the checkout there, shows the installer's print and changes nothing", () => {
    const r = moveOn({ marks: NOT_INSTALLED }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [`install.sh --print ${OPTIONS} ${rootOf(r.home)}`]);
    assert.ok(r.out.includes(PRINT_LINES.hdr));
    assert.match(r.out, /Would run Studio's installer for real/);
    assert.deepEqual(r.tree, r.before);
    assert.equal(r.studioNow.marks, `tests=${r.sha}\n`);
  });

  it("stops, showing its last lines, when the real install fails", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `step ${i + 1} of the install`);
    const r = moveOn({ marks: NOT_INSTALLED, install: { ran: lines.join("\n") + "\nThe install could not go on.\n", ranExit: 1 }, answers: "y\n" });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /The installer stopped/);
    const tail = r.out.slice(r.out.lastIndexOf("The installer stopped"));
    assert.ok(tail.includes("The install could not go on."), tail);
    assert.ok(tail.includes("step 12 of the install"));
    assert.ok(!tail.includes("step 1 of the install"), "only the last lines");
    assert.ok(!/installed=/.test(r.studioNow.marks));
    // The summary lists the installer, worded to be true however far it got.
    const summary = r.out.slice(r.out.lastIndexOf("Stopped."));
    assert.ok(summary.includes("  - ran Studio's installer (if it stopped, its last lines say how far it got)\n"), summary);
  });

  it("looks again at her drop folder and the import right before the real install, and stops, naming no file, if one came since", () => {
    const dropped = moveOn({ marks: NOT_INSTALLED, install: { printDrops: "Client Name Session.mov" }, answers: "y\ny\n" });
    assert.equal(dropped.status, 1, dropped.out);
    assert.ok(!dropped.ran.includes("install.sh --yes"), dropped.ran);
    assert.match(dropped.out, /Her drop folder holds 1 file still to be imported\./);
    assert.equal((dropped.out.match(/Her drop folder is empty\./g) ?? []).length, 1, "step 1 found it empty; the second look found a file");
    for (const text of [dropped.out, dropped.log, dropped.report, dropped.err]) assert.ok(!text.includes("Client Name"), "no file's name anywhere");
    assert.ok(dropped.out.endsWith(STOPPED_NOTHING), dropped.out);

    const running = moveOn({ marks: NOT_INSTALLED, launchctlLater: "1234\\t0\\tcom.thebrimm.unedited", answers: "y\ny\n" });
    assert.equal(running.status, 1, running.out);
    assert.ok(!running.ran.includes("install.sh --yes"), running.ran);
    assert.match(running.out, /An import is running now\. Wait until its window in the top right closes, then double-click Move to Studio again\./);
    assert.ok(running.out.endsWith(STOPPED_NOTHING), running.out);

    // Nothing new in her drop folder and no import: it goes on, and says so a second time.
    const clear = moveOn({ marks: NOT_INSTALLED, answers: "y\n\n" });
    assert.equal(clear.status, 0, clear.out);
    assert.equal((clear.out.match(/Her drop folder is empty\./g) ?? []).length, 2);
    assert.equal((clear.out.match(/No import is running\./g) ?? []).length, 2);
  });

  it("sees a line of the print that comes after 64 KiB", () => {
    const filler = Array.from({ length: 1000 }, (_, i) => `  a line of the print, number ${i}, made long enough to fill the pipe ${"x".repeat(60)}`).join("\n");
    assert.ok(filler.length > 70000);
    const late = moveOn({ marks: NOT_INSTALLED, install: { print: [`${filler}\n${printText(PRINT_LINES.signed, PRINT_LINES.older)}`, DEFAULT_PRINT] }, answers: "y\ny\n\n" });
    assert.equal(late.status, 0, late.out.slice(-600));
    assert.ok(late.ran.split("\n").includes("claude update"), "the older line was seen");
    const early = moveOn({ marks: NOT_INSTALLED, install: { print: [`${printText(PRINT_LINES.signed, PRINT_LINES.older)}\n${filler}`, DEFAULT_PRINT] }, answers: "y\ny\n\n" });
    assert.equal(early.status, 0, early.out.slice(-600));
    assert.ok(early.ran.split("\n").includes("claude update"), "the older line was seen, with more than 64 KiB after it");
  });

  it("leaves her own GIT_SSH alone: the clone's ssh command has a name of its own", () => {
    const hers = moveOn({ marks: NOT_INSTALLED, answers: "y\n\n", env: { GIT_SSH: "/usr/local/bin/her-own-ssh" } });
    assert.equal(hers.status, 0, hers.out);
    assert.equal(hers.installGitSsh.trim(), "/usr/local/bin/her-own-ssh", "the installer sees her own GIT_SSH, as it was");
    const none = moveOn({ marks: NOT_INSTALLED, answers: "y\n\n" });
    assert.equal(none.status, 0, none.out);
    assert.equal(none.installGitSsh.trim(), "unset", "and none when she has none");
  });

  it("takes only 'Claude answered from here' as the installer's check of Claude, and leaves the environment of git out of the installer", () => {
    const ok = moveOn({ marks: NOT_INSTALLED, answers: "y\n\n" });
    assert.equal(ok.status, 0, ok.out);
    assert.equal(ok.installGitEnv.trim(), "unset", "GIT_SSH_COMMAND is for the clone alone");

    for (const said of ["From the background job: Claude could not be asked from here. What it said is in /tmp/check.log.", "From the background job: Claude did not answer within 90 seconds. What it said is in /tmp/check.log."]) {
      const r = moveOn({ marks: NOT_INSTALLED, install: { ran: `Setting up Studio...\n${said}\nDone.\n` }, answers: "y\n\n" });
      assert.equal(r.status, 1, r.out);
      assert.ok(r.out.split(said).length > 2, `its line is shown again by the stop:\n${r.out}`);
      assert.ok(!/installed=/.test(r.studioNow.marks), "no installed mark");
      assert.ok(!r.out.includes("Studio's installer finished."), r.out);
    }
  });

  it("when the install moves her settings and agent to Studio, goes on and marks it", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { moves: true }, answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.tree.includes("Library/LaunchAgents/com.thebrimm.unedited.plist"));
    assert.ok(!r.tree.includes("Library/LaunchAgents/com.thebrimm.claude-check.plist"));
  });
});

describe("the move script, the report and brimm-video's old key (check 48)", { skip: notAMac }, () => {
  const NOT_INSTALLED = "tests=SHA\n";
  const LABELS = [
    "Her macOS:", "Free on her disk:", "Anything unexpected in her settings:", "What the count printed:", "Her Claude account's plan:",
    "Whether the key is on GitHub, and how:", "What the check of the key printed:", "The commit:", "The tests' last lines:",
    "The app's version on each Mac:", "Anything in the print that surprised you, and its HDR line:", "The installer's last lines:",
    "What the look for the one-shot check printed:", "What turning HyperFrames on printed:"
  ];
  const CHECKS = ["41 Before you start", "42 Studio's code on her laptop", "43 The HyperFrames app on her laptop", "44 Studio's installer on her laptop", "48 Afterwards"];

  it("writes the report on her Desktop, one heading a check and one line a box, as the page labels them, and shows it in Finder", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { moves: true }, oldReport: "STALE REPORT\n", answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.tree.includes("Desktop/Studio move report.txt"));
    assert.ok(!r.report.includes("STALE REPORT"), "a run writes it whole again");
    const lines = r.report.split("\n");
    let at = -1;
    for (const heading of [...CHECKS.slice(0, 4)]) {
      const i = lines.indexOf(heading);
      assert.ok(i > at, `${heading} comes in order`);
      at = i;
    }
    assert.ok(lines.indexOf("48 Afterwards") > at);
    let last = -1;
    for (const label of LABELS) {
      const found = lines.map((l, i) => (l.startsWith(label + " ") ? i : -1)).filter((i) => i >= 0);
      assert.equal(found.length, 1, `${label} once`);
      assert.ok(found[0] > last, `${label} in order`);
      last = found[0];
      assert.ok(lines[found[0]].length > label.length + 1, `${label} has a value`);
    }
    const known = (l) => l === "" || CHECKS.includes(l) || LABELS.some((x) => l.startsWith(x + " ")) || l.startsWith("Studio move report:") || l.startsWith("brimm-video's old key: ");
    assert.deepEqual(lines.filter((l) => !known(l)), [], "every line is a heading or a box");
    assert.match(r.report, /^Her macOS: 15\.1$/m);
    assert.match(r.report, /^Free on her disk: 429 GB$/m);
    assert.match(r.report, /^Anything unexpected in her settings: nothing/m);
    assert.match(r.report, /^What the count printed: 0$/m);
    assert.match(r.report, /^Her Claude account's plan: max$/m);
    assert.match(r.report, /^The app's version on each Mac: 1\.4\.0 on Sallie's laptop/m);
    assert.match(r.report, /^Anything in the print that surprised you, and its HDR line: .*HDR video:/m);
    assert.match(r.report, /^The installer's last lines: .*Done\./m);
    assert.match(r.report, new RegExp(`^What the look for the one-shot check printed: ${BACKGROUND}`, "m"));
    assert.match(r.report, /^What turning HyperFrames on printed: .*it was on already|^What turning HyperFrames on printed: .*on already/m);
    assert.match(r.report, /^The commit: [0-9a-f]{7} the stand-in Studio/m);
    assert.ok(r.ran.split("\n").includes(`open -R ${r.home}/Desktop/Studio move report.txt`), r.ran);
    const heading = r.out.indexOf("6. The report");
    assert.ok(heading > r.out.indexOf("5. Studio's installer") && heading < r.out.indexOf("7. brimm-video's old key"));
    for (const secret of [EMAIL, ORG, "PRIVATE-HALF", "OLD-PRIVATE-HALF"]) {
      assert.ok(!r.report.includes(secret), `the report never holds ${secret}`);
      assert.ok(!r.out.includes(secret) && !r.log.includes(secret));
    }
  });

  it("says what is known when earlier steps were already done, never an empty line", () => {
    const r = moveOn({});
    assert.equal(r.status, 0, r.out);
    for (const label of LABELS) {
      const line = r.report.split("\n").find((l) => l.startsWith(label + " "));
      assert.ok(line && line.length > label.length + 1, `${label} has a value: ${line}`);
    }
    assert.match(r.report, /^Whether the key is on GitHub, and how: yes: .*the check of the key worked$/m);
  });

  it("with --print, says 'not checked: this was a print' for what a print cannot check, and claims nothing of an earlier run", () => {
    const r = moveOn({ key: null, marks: "" }, "--print");
    assert.equal(r.status, 0, r.out);
    const not = "not checked: this was a print";
    for (const label of ["What the check of the key printed:", "The tests' last lines:", "What the look for the one-shot check printed:"]) {
      assert.ok(r.out.includes(`${label} ${not}`), `${label}\n${r.out}`);
    }
    assert.ok(!r.out.includes("on an earlier run"), r.out.split("\n").filter((l) => l.includes("earlier run")).join("\n"));
  });

  it("with --print, shows the report and writes no file", () => {
    const r = moveOn({ marks: NOT_INSTALLED, oldKey: true }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(r.tree, r.before);
    assert.equal(r.report, "");
    assert.match(r.out, /Would write this report/);
    for (const label of LABELS) assert.ok(r.out.includes(label), `${label} is shown`);
    assert.ok(!r.ran.includes("open -R"), r.ran);
    assert.ok(!r.out.includes("Has brimm-video's key been deleted"), "a print asks nothing");
    assert.deepEqual(r.oldKeyFiles, [true, true]);
  });

  it("offers to delete brimm-video's old key only once the move is done, and deletes exactly its two files on y", () => {
    const yes = moveOn({ oldKey: true, answers: "y\n" });
    assert.equal(yes.status, 0, yes.out);
    assert.match(yes.out, /7\. brimm-video's old key \(check 48\)/);
    const q = yes.out.slice(yes.out.indexOf("7. brimm-video's old key"));
    assert.ok(q.indexOf("Has brimm-video's key been deleted on GitHub (jogden12/brimm-video › Settings › Deploy keys)?") >= 0, q);
    assert.ok(q.indexOf("GitHub") < q.indexOf(".ssh/brimm_video_deploy"), "GitHub is named first");
    assert.deepEqual(yes.oldKeyFiles, [false, false]);
    assert.ok(yes.ownKeyKept, "her own key stays");
    assert.deepEqual(yes.before.filter((f) => !yes.tree.includes(f)).sort(), [".ssh/brimm_video_deploy", ".ssh/brimm_video_deploy.pub"], "nothing else is taken away");
    assert.ok(yes.tree.includes(".ssh/brimm_video_studio_deploy") && yes.tree.includes(".ssh/config"));
    assert.match(yes.report, /^brimm-video's old key: deleted from this Mac$/m);
    assert.ok(yes.out.trimEnd().endsWith("Done. Next on the By-Hand page: checks 45 to 47, on screen."));

    const no = moveOn({ oldKey: true, answers: "n\n" });
    assert.equal(no.status, 0, no.out);
    assert.deepEqual(no.oldKeyFiles, [true, true]);
    assert.ok(no.out.trimEnd().endsWith("Done. Next on the By-Hand page: checks 45 to 47, on screen."), "an n does not stop the run");
    assert.match(no.report, /^brimm-video's old key: kept for now$/m);

    const eof = moveOn({ oldKey: true, answers: "" });
    assert.equal(eof.status, 0, eof.out);
    assert.deepEqual(eof.oldKeyFiles, [true, true], "the end of input keeps them");

    const notYet = moveOn({ oldKey: true, marks: "tests=SHA\n", install: { moves: true }, answers: "n\n" });
    assert.equal(notYet.status, 1, notYet.out);
    assert.ok(!notYet.out.includes("Has brimm-video's key been deleted"), "not installed: no question");
    assert.deepEqual(notYet.oldKeyFiles, [true, true]);

    const gone = moveOn({});
    assert.equal(gone.status, 0, gone.out);
    assert.ok(!gone.out.includes("Has brimm-video's key been deleted"), "no old key: no question");
    assert.match(gone.report, /^brimm-video's old key: not on this Mac$/m);
  });
});

describe("the move script on either MacBook: Sallie's laptop, or Jason's MacBook moved or set up fresh", { skip: notAMac }, () => {
  const JASON = "Jason's MacBook";
  const JASON_KEY = "brimm-video-studio read-only, Jason's MacBook";
  const OPTIONS = "--machine Jason's MacBook --drop Drop --import light --handoff 2";
  const rootOf = (home) => `${home}/Dropbox/The BRIMM DB/BRIMM Video`;
  const installCalls = (r) => r.ran.split("\n").filter((l) => l.startsWith("install.sh "));
  const NOT_INSTALLED = "tests=SHA\n";
  // A Mac with no brimm-video settings, where Studio's code is already at the pin with its tests passed and Studio's key is made for
  // Jason's MacBook, so a run goes from step 1's question straight to the installer. A brimm-video checkout with no settings (as the
  // transcript tool's standby may have) is there too: the harness always makes one.
  const FRESH = { settings: null, key: JASON_KEY, marks: NOT_INSTALLED };
  // Its answers: set up fresh, the installer, HyperFrames on (a fresh Mac's settings name no editing app), and Return at Finder.
  const FRESH_YES = "y\ny\ny\n\n";

  it("refuses a Mac whose settings name another Mac, changing nothing", () => {
    for (const machine of ["Mac Studio", "Sallie's MacBook Air"]) {
      const r = moveOn({ settingsChange: { machine } });
      assert.equal(r.status, 2, r.out);
      assert.match(r.out, new RegExp(`This app is for Sallie's laptop and Jason's MacBook, and this Mac's settings say it is "${machine}"\\. Nothing was changed\\.`));
      assert.deepEqual(r.tree, r.before);
    }
  });

  it("moves Jason's MacBook from brimm-video under its own name", () => {
    const r = moveOn({ settingsChange: { machine: JASON }, key: JASON_KEY, marks: NOT_INSTALLED, answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [`install.sh --print ${OPTIONS} ${rootOf(r.home)}`, `install.sh --yes ${OPTIONS} ${rootOf(r.home)}`]);
    assert.ok(r.ran.split("\n").includes(`open -R ${rootOf(r.home)}/Drop/${JASON}`), r.ran);
    assert.ok(!/set up fresh/.test(r.out), "a Mac with brimm-video is moved, not set up fresh");
    assert.match(r.report, /^Studio move report: Jason's MacBook, /);
  });

  it("names Studio's key, and its title on GitHub, for the Mac it is on", () => {
    const r = moveOn({ settingsChange: { machine: JASON }, key: null, answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.ran.split("\n").includes(`ssh-keygen -t ed25519 -f ${r.home}/.ssh/brimm_video_studio_deploy -N  -C ${JASON_KEY}`), r.ran);
    assert.equal(r.copied, `ssh-ed25519 AAAAstandin ${JASON_KEY}\n`);
    assert.match(r.out, /Title: Jason's MacBook\./);
    assert.ok(!r.out.includes("Sallie's laptop"), r.out);
  });

  it("on a Mac with no brimm-video, a print says it would set it up fresh as Jason's MacBook, and changes nothing", () => {
    const r = moveOn(FRESH, "--print");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /Would ask to set this Mac up fresh as Jason's MacBook/);
    assert.ok(r.out.includes(rootOf(r.home)), "it says where BRIMM Video is");
    assert.deepEqual(installCalls(r), [`install.sh --print ${OPTIONS} ${rootOf(r.home)}`]);
    assert.deepEqual(r.tree, r.before);
  });

  it("sets a Mac with no brimm-video up fresh as Jason's MacBook on y, and says nothing of Sallie there", () => {
    const r = moveOn({ ...FRESH, install: { writesSettings: true }, answers: FRESH_YES });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /set up fresh, as Jason's MacBook/);
    assert.deepEqual(installCalls(r), [`install.sh --print ${OPTIONS} ${rootOf(r.home)}`, `install.sh --yes ${OPTIONS} ${rootOf(r.home)}`]);
    assert.equal((r.out.match(/No import is running\./g) ?? []).length, 2, "it looked again right before the install");
    assert.ok(!/drop folder (is empty|holds)/i.test(r.out), "a Mac set up fresh has no drop folder to count before the install");
    assert.ok(r.ran.split("\n").includes(`open -R ${rootOf(r.home)}/Drop/${JASON}`), r.ran);
    assert.match(r.report, /^Studio move report: Jason's MacBook, /);
    assert.match(r.report, /1\.4\.0 on Jason's MacBook/);
    assert.match(r.report, /^Anything unexpected in her settings: .*set up fresh/m);
    assert.ok(!/Sallie|[Hh]er (drop folder|settings|Desktop|own Claude|HeyGen|checkout)/.test(r.out), r.out);
    assert.ok(r.tree.includes(join("Claude Code", "BRIMM video", "tool", "settings.js")), "a brimm-video checkout is left as it is");
  });

  it("stops, changing nothing, on n to setting this Mac up fresh", () => {
    const r = moveOn({ ...FRESH, answers: "n\n" });
    assert.equal(r.status, 1, r.out);
    assert.ok(r.out.endsWith(STOPPED_NOTHING), r.out);
    assert.deepEqual(installCalls(r), []);
  });

  it("stops before asking when Dropbox's BRIMM Video folder is not on this Mac, or is there twice", () => {
    const none = moveOn({ ...FRESH, brimmVideo: null });
    assert.equal(none.status, 1, none.out);
    assert.match(none.out, /This Mac has no BRIMM Video folder in Dropbox \(The BRIMM DB › BRIMM Video\)\. Sign in to Dropbox, let The BRIMM DB sync, then run the app again\./);
    assert.ok(none.out.endsWith(STOPPED_NOTHING), none.out);
    assert.ok(!none.out.includes("Go ahead?"), "nothing was asked");

    const two = moveOn({ ...FRESH, brimmVideo: "two" });
    assert.equal(two.status, 1, two.out);
    assert.match(two.out, /This Mac has 2 BRIMM Video folders in Dropbox: /);
    assert.ok(two.out.includes(rootOf(two.home)) && two.out.includes(`${two.home}/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video`), two.out);
    assert.ok(two.out.endsWith(STOPPED_NOTHING), two.out);
    assert.ok(!two.out.includes("Go ahead?"), "nothing was asked");
  });

  it("counts BRIMM Video once when ~/Dropbox is a link to Dropbox's folder in CloudStorage, and names it there", () => {
    const r = moveOn({ ...FRESH, brimmVideo: "linked" }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [`install.sh --print ${OPTIONS} ${r.home}/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video`]);
  });

  it("leaves brimm-video's old key alone on a Mac set up fresh", () => {
    const r = moveOn({ ...FRESH, oldKey: true, install: { writesSettings: true }, answers: FRESH_YES });
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(r.oldKeyFiles, [true, true]);
    assert.ok(r.ownKeyKept);
    assert.ok(!r.out.includes("Has brimm-video's key been deleted"), "no question about it");
    assert.match(r.out, /Not asked: this Mac was set up fresh/);
    assert.match(r.report, /^brimm-video's old key: not asked: this Mac was set up fresh/m);
  });
});
