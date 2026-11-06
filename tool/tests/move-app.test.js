// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop from brimm-video to Studio, one
// asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
    settings   her settings.json (default: as the switch of 26 October left it), or null for none
    settingsChange  values to change in the default settings
    launchctl  what `launchctl list` prints
    dropFiles  names put in her drop folder (it always holds .DS_Store and .brimm-watched-by too)
    claude     { status, version }: what the stand-in prints for `auth status --json` (default signed in, Max), and for --version;
               `auth login` flips it to signed in
    key        the comment of a key already in ~/.ssh (default: KEY_COMMENT, so a key made earlier), or null for none
    sshConfig  text of ~/.ssh/config (default: just the Host entry), or null for none
    knownHosts text of ~/.ssh/known_hosts (default: GitHub's published ed25519 key), or null for none
    ssh        what `ssh -T` answers, one answer a call: "ok", "denied" or a list of them (default "ok"; the last repeats)
    checkout   Studio's checkout in the home folder: "at-pin" (default), "absent", "other-commit", "dirty", "other-remote", "detached", "other-branch" or
               "partial-left" (no checkout, a half-made .partial beside where it goes)
    marks      text of the checkout's .git/move-to-studio (default: the tests passed at the pin, for an at-pin checkout)
    laterCommit  the "GitHub" repo gets a commit after the pin
    testFail   BRIMM_TEST_FAIL=1 for the tests in the checkout
    gitStandIn a stand-in git that notes its arguments and GIT_SSH_COMMAND, and fails; noRepo leaves BRIMM_STUDIO_REPO unset;
               repoMissing points it at nothing
    commit     the commit to pass: the "GitHub" repo's own by default, null for none
    answers    stdin, such as "y\ny\n\n"
    Returns { status, out, ran, home, before, tree, log, report }: `before` and `tree` list every file in the home folder before
    and after, and `log` and `report` are those files' text, or "". */
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
    put(join(github, "tool", "install.sh"), "#!/bin/zsh\nprint -r -- 'stand-in installer'\n", 0o755);
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
      ? { version: 1, machine: "Sallie's laptop", root: join(home, "Dropbox", "The BRIMM DB", "BRIMM Video"), checkout: oldCheckout, import: "light", handoffVersion: 2, drop: "Drop", ...options.settingsChange }
      : options.settings;
    if (settings !== null) {
      put(join(home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify(settings));
      const drop = join(settings.root, settings.drop, settings.machine);
      put(join(drop, ".DS_Store"), "");
      put(join(drop, ".brimm-watched-by"), `${settings.machine}\n`);
      for (const name of options.dropFiles ?? []) put(join(drop, name), "made for the test");
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
      const marks = options.marks ?? (checkout === "at-pin" ? `tests=${sha}\n` : null);
      if (marks !== null) writeFileSync(join(studio, ".git", "move-to-studio"), marks);
    }
    if (checkout === "partial-left") put(`${studio}.partial/half-made`, "cut short\n");

    // The stand-ins: each writes what it was asked into `ran`.
    const stand = (name, body = "") => put(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${ran}"\n${body}`, 0o755);
    stand("launchctl", `[ "$1" = "list" ] && printf '%b\\n' '${options.launchctl ?? "-\\t0\\tcom.thebrimm.unedited"}'\nexit 0\n`);
    for (const name of ["open", "caffeinate", "brew"]) stand(name, name === "brew" ? 'echo "Homebrew 4.5.0"\n' : "");
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
    stand("ssh", `n=$(cat "${asked}" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${asked}"
a=$(sed -n "$n"p "${answers}"); [ -n "$a" ] || a=$(tail -n 1 "${answers}")
case "$a" in
  ok) echo "${HI}"; exit 1 ;;
  denied) echo "git@github.com: Permission denied (publickey)."; exit 255 ;;
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
    }
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
  "auth login") echo in > "${state}" ;;
  --version) echo '${options.claude?.version ?? "2.1.300 (Claude Code)"}' ;;
esac
`);

    const before = readdirSync(home, { recursive: true }).sort();
    // The environment is built from scratch: the stand-ins first, the node that runs these tests last, no Homebrew.
    const env = {
      HOME: home, PATH: `${bin}:/usr/bin:/bin:${dirname(process.execPath)}`, BRIMM_HOMEBREW_DIRS: "",
      BRIMM_CLAUDE: join(bin, "claude"), BRIMM_STUDIO_REPO: options.repoMissing ? join(dir, "nowhere") : github, BRIMM_HYPERFRAMES_APP: join(dir, "Applications", "HyperFrames.app")
    };
    if (options.noRepo) delete env.BRIMM_STUDIO_REPO;
    if (options.testFail) env.BRIMM_TEST_FAIL = "1";
    const commit = options.commit === undefined ? ["--commit", sha] : options.commit === null ? [] : ["--commit", options.commit];
    const r = spawnSync("/bin/zsh", [MOVE, ...commit, ...args], { encoding: "utf8", input: options.answers ?? "", env });
    const text = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
    const mode = (file) => (existsSync(file) ? statSync(file).mode & 0o777 : null);
    const inStudio = (...a) => spawnSync("git", ["-C", studio, ...a], { encoding: "utf8", env: { ...GIT_ENV, HOME: home } }).stdout.trim();
    const studioNow = existsSync(studio)
      ? { branch: inStudio("rev-parse", "--abbrev-ref", "HEAD"), head: inStudio("rev-parse", "HEAD"), upstream: inStudio("rev-parse", "--abbrev-ref", "@{u}"),
          origin: inStudio("remote", "get-url", "origin"), marks: text(join(studio, ".git", "move-to-studio")) }
      : null;
    return {
      sha, github, studioNow, partialLeft: existsSync(`${studio}.partial`),
      copied: text(copied), sshConfig: text(join(ssh, "config")), sshConfigMode: mode(join(ssh, "config")), knownHosts: text(join(ssh, "known_hosts")),
      publicCopy: text(join(home, "Desktop", "Studio key (public half).txt")), sshAsked: Number(text(asked).trim() || 0),
      status: r.status, out: r.stdout, err: r.stderr, home, before, tree: readdirSync(home, { recursive: true }).sort(),
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
    assert.match(other.out, /This app is for Sallie's laptop, and this Mac's settings say it is "Mac Studio"\. Nothing was changed\./);

    const none = moveOn({ settings: null });
    assert.equal(none.status, 2);
    assert.match(none.out, /This Mac has no brimm-video settings \(~\/Library\/Application Support\/BRIMM Video\/settings\.json\), so it isn't a laptop this app moves\. Nothing was changed\./);

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
    const reading = /^(launchctl list|claude auth status --json|claude --version|sw_vers.*|df.*|xcode-select -p|brew --version|ssh-keygen -F github\.com -f .*|ssh -F .* -T git@github-brimm-video-studio)$/;
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
    for (const line of r.out.split("\n")) assert.ok(logged.includes(line) || line === "", `in the log: ${JSON.stringify(line)}`);
    assert.ok(r.log.includes("Stopped. This run changed nothing."));
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
    const line = `ssh -F ${r.home}/.ssh/config -o UserKnownHostsFile=${r.home}/.ssh/known_hosts -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes -T git@github-brimm-video-studio`;
    assert.ok(r.ran.split("\n").includes(line), r.ran);
    assert.ok(r.out.includes(HI), r.out);
    assert.match(r.out, /Settings.*Deploy keys/s);
    assert.match(r.out, /write access off/i);
    assert.equal(r.sshAsked, 1);
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
    const r = moveOn({ checkout: "absent", laterCommit: true, answers: "y\n" });
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
    const r = moveOn({ checkout: "partial-left", answers: "y\n" });
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

    const pass = moveOn({ marks: "installed=abc123\n" });
    assert.equal(pass.status, 0, pass.out);
    assert.match(pass.out, /ℹ pass 1/);
    assert.match(pass.out, /ℹ fail 0/);
    assert.equal(pass.studioNow.marks, `installed=abc123\ntests=${pass.sha}\n`, "only its own line is written, the rest kept");
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
