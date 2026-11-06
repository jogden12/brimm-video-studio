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
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

    // The stand-ins: each writes what it was asked into `ran`.
    const stand = (name, body = "") => put(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${ran}"\n${body}`, 0o755);
    stand("launchctl", `[ "$1" = "list" ] && printf '%b\\n' '${options.launchctl ?? "-\\t0\\tcom.thebrimm.unedited"}'\nexit 0\n`);
    for (const name of ["ssh-keygen", "ssh", "open", "pbcopy", "caffeinate", "brew"]) stand(name, name === "brew" ? 'echo "Homebrew 4.5.0"\n' : "");
    stand("sw_vers", '[ "$1" = "-productVersion" ] && echo 15.1\n');
    stand("df", 'echo "Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on"\necho "/dev/disk3s1s1 971350180 400000000 450000000 47% 400000 4000000000 0% /"\n');
    stand("xcode-select", '[ "$1" = "-p" ] && echo /Library/Developer/CommandLineTools\n');
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
      BRIMM_CLAUDE: join(bin, "claude"), BRIMM_STUDIO_REPO: github, BRIMM_HYPERFRAMES_APP: join(dir, "Applications", "HyperFrames.app")
    };
    const commit = options.commit === undefined ? ["--commit", sha] : options.commit === null ? [] : ["--commit", options.commit];
    const r = spawnSync("/bin/zsh", [MOVE, ...commit, ...args], { encoding: "utf8", input: options.answers ?? "", env });
    const text = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
    return {
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
    const reading = /^(launchctl list|claude auth status --json|claude --version|sw_vers.*|df.*|xcode-select -p|brew --version)$/;
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
