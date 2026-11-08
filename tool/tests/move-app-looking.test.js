// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop or Jason's MacBook from brimm-video
// to Studio, or sets up fresh, as Jason's MacBook, a Mac with no brimm-video, one asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  MOVE,
  notAMac,
  EMAIL,
  ORG,
  SIGNED_OUT,
  STOPPED_NOTHING,
  HEADINGS,
  dirsToClean,
  moveOn,
  NOT_INSTALLED,
  installCalls,
  rootOf,
  count
} from "./move-app-harness.js";

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

    for (const r of [other, unknown, missing, malformed]) {
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
    const r = moveOn({ marks: "tests=SHA\n", dropFiles: ["Client Name Session.mov"] });
    assert.equal(r.status, 1);
    assert.match(r.out, /The drop folder holds 1 file still to be imported\./);
    assert.ok(!r.out.includes("Client Name") && !r.log.includes("Client Name") && !r.err.includes("Client Name"));
    const two = moveOn({ marks: "tests=SHA\n", dropFiles: ["a.mov", "b.mov"] });
    assert.match(two.out, /The drop folder holds 2 files still to be imported\./);
  });

  it("stops, saying to allow Terminal, when her drop folder cannot be read, and does not take it for empty", () => {
    const r = moveOn({ marks: "tests=SHA\n", dropMode: 0o000 });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /The drop folder could not be read\. macOS may have asked whether Terminal may read it, and the answer may have been no\./);
    assert.ok(!r.out.includes("may read Dropbox"), "it names no cloud");
    assert.match(r.out, /Allow it in System Settings › Privacy & Security › Files and Folders, then run the app again\./);
    assert.ok(!r.out.includes("The drop folder is empty."), r.out);
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
    const reading = /^(launchctl list|claude auth status --json|claude --version|sw_vers.*|df.*|xcode-select -p|brew --version|ssh-keygen -F github\.com -f .*|ssh -F .* -T git@github-brimm-video-studio|install\.sh --print .*|install-arg: .*)$/;
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

describe("the move script on either MacBook: Sallie's laptop, or Jason's MacBook moved or set up fresh", { skip: notAMac }, () => {
  const JASON = "Jason's MacBook";
  const JASON_KEY = "brimm-video-studio read-only, Jason's MacBook";
  const optionsOf = (home) => `--machine Jason's MacBook --drop-folder ${home}/BRIMM Video Work/Drop --import light --handoff 2`;
  // A Mac with no brimm-video settings, where Studio's code is already at the pin with its tests passed and Studio's key is made for
  // Jason's MacBook, so a run goes from step 1's question straight to the installer. A brimm-video checkout with no settings (as the
  // transcript tool's standby may have) is there too: the harness always makes one.
  const FRESH = { settings: null, key: JASON_KEY, marks: NOT_INSTALLED };
  // Its answers: set up fresh, the drop folder and the exports folder (y to each), the installer, HyperFrames on (a fresh Mac's settings name no editing app), and Return at Finder.
  const FRESH_YES = "y\ny\ny\ny\ny\n\n";

  it("refuses a Mac whose settings name another Mac, changing nothing", () => {
    for (const machine of ["Mac Studio", "Sallie's MacBook Air"]) {
      const r = moveOn({ settingsChange: { machine } });
      assert.equal(r.status, 2, r.out);
      assert.match(r.out, new RegExp(`This app is for Sallie's laptop and Jason's MacBook, and this Mac's settings say it is "${machine}"\\. Nothing was changed\\.`));
      assert.deepEqual(r.tree, r.before);
    }
  });

  it("moves Jason's MacBook from brimm-video under its own name", () => {
    const r = moveOn({ settingsChange: { machine: JASON }, key: JASON_KEY, marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [`install.sh --print ${optionsOf(r.home)} ${rootOf(r.home)}`, `install.sh --yes ${optionsOf(r.home)} ${rootOf(r.home)}`]);
    assert.ok(r.ran.split("\n").includes(`open -R ${r.home}/BRIMM Video Work/Drop`), r.ran);
    assert.ok(!/set up fresh/.test(r.out), "a Mac with brimm-video is moved, not set up fresh");
    assert.ok(r.out.trimEnd().endsWith("Done. Next on the By-Hand page: the rest of the check for Jason's MacBook."), r.out.slice(-300));
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
    assert.match(r.out, /Would leave brimm-video's old key as it is, if there is one: this Mac is set up fresh/);
    assert.ok(!r.out.includes("only once Studio's installer has finished"), "a fresh Mac's step 7 is never asked");
    assert.deepEqual(installCalls(r), [`install.sh --print ${optionsOf(r.home)} ${rootOf(r.home)}`]);
    assert.deepEqual(r.tree, r.before);
  });

  it("sets a Mac with no brimm-video up fresh as Jason's MacBook on y, and says nothing of Sallie there", () => {
    const r = moveOn({ ...FRESH, install: { writesSettings: true }, answers: FRESH_YES });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /set up fresh, as Jason's MacBook/);
    assert.deepEqual(installCalls(r), [`install.sh --print ${optionsOf(r.home)} ${rootOf(r.home)}`, `install.sh --yes ${optionsOf(r.home)} ${rootOf(r.home)}`]);
    assert.equal((r.out.match(/No import is running\./g) ?? []).length, 2, "it looked again right before the install");
    assert.ok(!/drop folder (is empty|holds)/i.test(r.out), "a Mac set up fresh has no drop folder to count before the install");
    assert.ok(r.ran.split("\n").includes(`open -R ${r.home}/BRIMM Video Work/Drop`), r.ran);
    assert.match(r.report, /^Studio move report: Jason's MacBook, /);
    assert.match(r.report, /1\.4\.0 on Jason's MacBook/);
    assert.match(r.report, /^Anything unexpected in her settings: .*set up fresh/m);
    assert.ok(r.out.trimEnd().endsWith("Done. Next on the By-Hand page: the rest of the check for Jason's MacBook."), r.out.slice(-300));
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
    assert.deepEqual(installCalls(r), [`install.sh --print ${optionsOf(r.home)} ${r.home}/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video`]);
  });

  it("finds BRIMM Video a level deeper, in a team Dropbox's member folder, as the Mac Studio has it", () => {
    const r = moveOn({ ...FRESH, brimmVideo: "team" }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [`install.sh --print ${optionsOf(r.home)} ${r.home}/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB/BRIMM Video`]);
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

describe("the move script, the try mode (--try-chooser)", { skip: notAMac }, () => {
  const TRY_HEADING = "Trying the folder questions. Nothing is changed.";
  const TRY_STOP = /This was a try of the folder questions: nothing was changed\. To try again: open -a "Move to Studio" --args --try-chooser/;
  const PATHS_LINE = "Studio's code is not on this Mac yet, so folders are given as paths here. Finder's words come at the move.";
  const END_LINE = "Nothing was changed. Studio's installer checks more at the move.";
  const studioSettings = { version: 1, machine: "Mac Studio", root: "<HOME>/Dropbox/The BRIMM DB/BRIMM Video", checkout: "<HOME>/Claude Code/brimm-video-studio",
    import: "light", handoffVersion: 2, dropPath: "<HOME>/BRIMM Video Work/Drop", exportsPath: "<HOME>/Exports" };
  const tryOn = (options = {}, ...args) => moveOn({ commit: null, ...options }, "--try-chooser", ...args);
  const unchanged = (r) => {
    assert.deepEqual(r.tree, r.before, "the home's files are unchanged");
    assert.equal(r.log, "", "no log");
    assert.equal(r.report, "", "no report");
    assert.ok(!r.tree.some((f) => f.endsWith(".lock")), "no lock");
    assert.ok(!r.ran.includes("install.sh"), r.ran);
    assert.ok(!r.ran.includes("ssh") && !r.ran.includes("git "), r.ran);
  };

  it("--try-chooser on the Mac Studio's settings: asks the two questions, opens the chooser, says the picks, the version and the chip, and changes nothing", () => {
    const r = tryOn({ settings: studioSettings, picks: ["<HOME>/Picked exports"], answers: "y\nc\n" });
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(r.out.includes(TRY_HEADING), r.out);
    assert.ok(r.out.includes("This Mac's drop folder is "), r.out);
    assert.ok(r.out.includes("HyperFrames' exports are looked for in "), r.out);
    assert.ok(r.ran.includes("chooser Move to Studio: choose the folder HyperFrames' exports will go into, or make a new one with New Folder."), r.ran);
    assert.equal(count(r.ran, "chooser Move to Studio"), 1, "only the exports question opened the chooser");
    assert.ok(r.out.includes("A window to choose the folder is opening."), r.out);
    assert.ok(!/double-click/i.test(r.out), r.out);
    assert.ok(r.out.includes(`Picked: Picked exports, in your home folder`), r.out);
    assert.match(r.out, /Drop folder: +BRIMM Video Work › Drop, in your home folder/);
    assert.match(r.out, /Exports folder: +Picked exports, in your home folder/);
    assert.match(r.out, /macOS: +15\.1/);
    assert.match(r.out, /Chip: +\S+/);
    assert.ok(r.out.includes(END_LINE), r.out);
    assert.ok(!r.out.includes(PATHS_LINE), "Studio's code answers, so no line about paths");
    assert.ok(!/Stopped\./.test(r.out), r.out);
    unchanged(r);
  });

  it("--try-chooser on the Mac Studio is not refused, and does not run which_mac, nor needs --commit", () => {
    const r = tryOn({ settings: { ...studioSettings, machine: "Some other Mac" }, answers: "y\ny\n" });
    assert.equal(r.status, 0, r.out + r.err);
    unchanged(r);
  });

  it("--try-chooser with no Studio checkout and no node on PATH says paths and its line, and ends 0", () => {
    const r = tryOn({ settings: studioSettings, checkout: "absent", noNode: true, answers: "y\ny\n" });
    assert.equal(r.status, 0, r.out + r.err);
    assert.equal(count(r.out, PATHS_LINE), 1, r.out);
    assert.match(r.out, new RegExp(`Drop folder: +${r.home.replaceAll(".", "\\.")}/BRIMM Video Work/Drop\\n`));
    assert.ok(r.out.includes(END_LINE), r.out);
    unchanged(r);
  });

  it("--try-chooser with no settings finds BRIMM Video with no question", () => {
    const r = tryOn({ settings: null, checkout: "absent", answers: "y\ny\n" });
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(!r.out.includes("set up fresh"), "no set-up-fresh question");
    assert.ok(r.out.includes(`BRIMM Video: ${r.home}/Dropbox/The BRIMM DB/BRIMM Video`), r.out);
    assert.ok(r.out.includes("Where videos are dropped for Studio: the drop folder."), r.out);
    assert.ok(r.out.includes("Where HyperFrames' exports go: the exports folder."), r.out);
    unchanged(r);
  });

  it("--try-chooser with no BRIMM Video says so, and still asks", () => {
    const r = tryOn({ settings: null, brimmVideo: null, checkout: "absent", answers: "y\ny\n" });
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(r.out.includes("BRIMM Video: not found in Dropbox on this Mac, so the checks that need it are passed over."), r.out);
    assert.ok(r.out.includes("Where videos are dropped for Studio: the drop folder."), r.out);
    assert.ok(r.out.includes(END_LINE), r.out);
    unchanged(r);
  });

  it("--try-chooser --second-way uses the program first", () => {
    const r = tryOn({ settings: studioSettings, program: ["<HOME>/Picked exports"], picks: ["<HOME>/Wrong"], answers: "y\nc\n" }, "--second-way");
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(r.ran.includes("program Move to Studio: choose the folder HyperFrames' exports will go into"), r.ran);
    assert.ok(!r.ran.includes("chooser Move"), "the app way was not needed");
    assert.match(r.out, /Exports folder: +Picked exports, in your home folder/);
    unchanged(r);
  });

  it("--try-chooser with --commit, or with --print, is refused with 2", () => {
    for (const extra of [["--commit", "a".repeat(40)], ["--print"]]) {
      const r = moveOn({ commit: null, settings: studioSettings }, "--try-chooser", ...extra);
      assert.equal(r.status, 2, r.out + r.err);
      assert.ok(r.out.includes("The try of the folder questions (--try-chooser) takes neither --commit nor --print."), r.out);
      assert.ok(!r.out.includes("Not an option this app knows"), r.out);
      assert.ok(!r.out.includes(TRY_HEADING), r.out);
      assert.deepEqual(r.tree, r.before);
      assert.ok(!r.ran.includes("chooser"), r.ran);
    }
    const alone = moveOn({ commit: null, settings: studioSettings }, "--second-way");
    assert.equal(alone.status, 2, alone.out);
  });

  it("--try-chooser stopped at its first question says the try's own stop words, with the open … --args --try-chooser line, and no double-click advice", () => {
    const r = tryOn({ settings: studioSettings, answers: "" });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, TRY_STOP);
    assert.ok(!/double-click|Stopped\./i.test(r.out), r.out);
    assert.ok(!r.out.includes(END_LINE), r.out);
    unchanged(r);
  });

  it("--try-chooser stopped when c alone is offered and no chooser can be shown says the try's own stop words too", () => {
    const r = tryOn({ settings: { ...studioSettings, dropPath: undefined }, agentWatches: [], folderFiles: { "<HOME>/BRIMM Video Work/Drop": ["a.mov"] }, picks: ["fail"], program: ["two"], answers: "y\nc\n" });
    assert.equal(r.status, 1, r.out);
    assert.ok(r.out.includes("is not empty. Empty it in Finder, or tell Jason."), r.out);
    assert.match(r.out, TRY_STOP);
    assert.ok(!/double-click/i.test(r.out), r.out);
    unchanged(r);
  });

  it("--try-chooser with two BRIMM Video folders says more than one was found, and with a linked Dropbox prints no stray assignment", () => {
    const two = tryOn({ settings: null, brimmVideo: "two", checkout: "absent", answers: "y\ny\n" });
    assert.equal(two.status, 0, two.out + two.err);
    assert.ok(two.out.includes("2 folders of that name were found in Dropbox, so the checks that need it are passed over."), two.out);
    assert.ok(!two.out.includes("not found in Dropbox"), two.out);
    assert.ok(!/^(f|same|p)=/m.test(two.out), two.out);
    const linked = tryOn({ settings: null, brimmVideo: "linked", checkout: "absent", answers: "y\ny\n" });
    assert.equal(linked.status, 0, linked.out + linked.err);
    assert.ok(!/^(f|same|p)=/m.test(linked.out), linked.out);
    assert.ok(linked.out.includes("  BRIMM Video: "), linked.out);
  });

  it("--try-chooser's stop line names the app in app.txt, and without it says open -a", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-try-app-")));
    dirsToClean.add(dir);
    const home = join(dir, "home");
    mkdirSync(home);
    const copy = join(dir, "copy");
    mkdirSync(copy);
    writeFileSync(join(copy, "move.zsh"), readFileSync(MOVE));
    const go = () => spawnSync("/bin/zsh", [join(copy, "move.zsh"), "--try-chooser"], { encoding: "utf8", input: "", env: { HOME: home, PATH: "/usr/bin:/bin", TMPDIR: dir, BRIMM_HOMEBREW_DIRS: "", BRIMM_CHOOSER_APP: join(dir, "no-chooser.app") } });
    const without = go();
    assert.equal(without.status, 1, without.stdout);
    assert.ok(without.stdout.includes('To try again: open -a "Move to Studio" --args --try-chooser'), without.stdout);
    writeFileSync(join(copy, "app.txt"), "/Users/x/Downloads/Move to Studio.app\n");
    const withApp = go();
    assert.equal(withApp.status, 1, withApp.stdout);
    assert.ok(withApp.stdout.includes('To try again: open "/Users/x/Downloads/Move to Studio.app" --args --try-chooser'), withApp.stdout);
  });

  it("--try-chooser's stop line falls back to open -a for a translocated app, and carries --second-way after a try of the second way", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-try-app-")));
    dirsToClean.add(dir);
    const home = join(dir, "home");
    mkdirSync(home);
    const copy = join(dir, "copy");
    mkdirSync(copy);
    writeFileSync(join(copy, "move.zsh"), readFileSync(MOVE));
    const go = (...args) => spawnSync("/bin/zsh", [join(copy, "move.zsh"), "--try-chooser", ...args], { encoding: "utf8", input: "", env: { HOME: home, PATH: "/usr/bin:/bin", TMPDIR: dir, BRIMM_HOMEBREW_DIRS: "", BRIMM_CHOOSER_APP: join(dir, "no-chooser.app") } });
    writeFileSync(join(copy, "app.txt"), "/private/var/folders/xx/AppTranslocation/ABC/d/Move to Studio.app\n");
    const moved = go();
    assert.ok(moved.stdout.includes('To try again: open -a "Move to Studio" --args --try-chooser'), moved.stdout);
    assert.ok(!moved.stdout.includes("AppTranslocation"), moved.stdout);
    const second = go("--second-way");
    assert.ok(second.stdout.includes('To try again: open -a "Move to Studio" --args --try-chooser --second-way'), second.stdout);
    writeFileSync(join(copy, "app.txt"), "/Users/x/Downloads/Move to Studio.app\n");
    const both = go("--second-way");
    assert.ok(both.stdout.includes('To try again: open "/Users/x/Downloads/Move to Studio.app" --args --try-chooser --second-way'), both.stdout);
  });

  it("the chooser's temp folder lands inside TMPDIR, and is taken away on a stop and on Ctrl-C", () => {
    const r = tryOn({ settings: studioSettings, picks: ["<HOME>/Picked exports"], answers: "y\nc\n" });
    assert.equal(r.status, 0, r.out + r.err);
    const tmp = join(dirname(r.home), "tmp");
    assert.deepEqual(readdirSync(tmp), [], "nothing left in TMPDIR");
    const resultArgs = r.ran.split("\n").filter((l) => l.startsWith("chooser-arg: ") && l.endsWith("/result")).map((l) => l.slice("chooser-arg: ".length));
    assert.equal(resultArgs.length, 1, r.ran);
    assert.ok(resultArgs[0].startsWith(`${tmp}/`), `the chooser's result path ${resultArgs[0]} is inside ${tmp}`);
    // Stop and interrupt with the chooser's folder made: it goes.
    for (const call of ["stop_here", "on_int"]) {
      const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-move-chooser-")));
      dirsToClean.add(dir);
      const made = join(dir, "chooser-tmp");
      mkdirSync(made);
      const q = spawnSync("/bin/zsh", ["-c", `source "$1"; changed=(); CHOOSER_TMP="$2"; ${call}`, "move", MOVE, made], { encoding: "utf8", env: { HOME: dir, PATH: "/usr/bin:/bin" } });
      assert.equal(q.status, call === "stop_here" ? 1 : 130, q.stdout + q.stderr);
      assert.ok(!existsSync(made), `${call} takes the chooser's folder away`);
    }
    const m = readFileSync(MOVE, "utf8");
    assert.ok(!/mktemp(?! (-d )?"\$\{TMPDIR)/.test(m), "every mktemp has a template in TMPDIR");
  });
});
