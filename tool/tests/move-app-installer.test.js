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
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
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
} from "./move-app-harness.js";

describe("the move script, HyperFrames and Studio's installer (checks 43 and 44)", { skip: notAMac }, () => {
  const optionsOf = (home) => `--machine Sallie's laptop --drop-folder ${home}/BRIMM Video Work/Drop --import light --handoff 2`;
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
    const r = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\nn\n" });
    assert.equal(r.status, 1);
    assert.match(r.out, /5\. Studio's installer \(check 44\)/);
    assert.deepEqual(installCalls(r), [`install.sh --print ${optionsOf(r.home)} ${rootOf(r.home)}`]);
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
    const r = moveOn({ marks: NOT_INSTALLED, install: { print: printText("  Claude Code, signed in:  no. In Terminal, run: claude auth login (Sallie signs in), then run this again.") }, answers: "y\ny\ny\n" });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /claude auth login/);
    assert.ok(!r.ran.includes("install.sh --yes"));
  });

  it("on n after the print, runs nothing for real", () => {
    const r = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\nn\n" });
    assert.equal(r.status, 1);
    assert.ok(!r.ran.includes("--yes"), r.ran);
    assert.equal(r.studioNow.marks, `tests=${r.sha}\n`);
    assert.ok(r.out.endsWith(STOPPED_NOTHING), r.out);
  });

  it("on y runs the same line with --yes, then checks the background job's line and the one-shot agent", () => {
    const r = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [`install.sh --print ${optionsOf(r.home)} ${rootOf(r.home)}`, `install.sh --yes ${optionsOf(r.home)} ${rootOf(r.home)}`]);
    assert.ok(r.out.includes(BACKGROUND), "its output is shown");
    assert.match(r.studioNow.marks, new RegExp(`installed=${r.sha}`));

    const noCheck = moveOn({ marks: NOT_INSTALLED, install: { ran: "Setting up Studio...\nDone.\n" }, answers: "y\ny\ny\n" });
    assert.equal(noCheck.status, 1, noCheck.out);
    assert.match(noCheck.out, /stopped before its check of Claude/);
    assert.ok(!/installed=/.test(noCheck.studioNow.marks), "a stopped install writes no mark");

    const left = moveOn({ marks: NOT_INSTALLED, install: { checkLeft: true }, answers: "y\ny\ny\n" });
    assert.equal(left.status, 1, left.out);
    assert.match(left.out, /launchd would run it at every login/);
    assert.ok(!/installed=/.test(left.studioNow.marks));
  });

  it("offers claude update when the print says Terminal's Claude Code is too old, then prints again", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { print: [printText(PRINT_LINES.signed, PRINT_LINES.older, PRINT_LINES.hdr), DEFAULT_PRINT] }, answers: "y\ny\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.equal((r.out.match(/older than/g) ?? []).length, 1, "the older line is shown once, by the first print");
    assert.ok(r.ran.split("\n").includes("claude update"), r.ran);
    assert.equal(installCalls(r).filter((c) => c.startsWith("install.sh --print")).length, 2);
    assert.ok(r.ran.indexOf("claude update") < r.ran.indexOf("install.sh --yes"));

    const declined = moveOn({ marks: NOT_INSTALLED, install: { print: printText(PRINT_LINES.signed, PRINT_LINES.older) }, answers: "y\ny\nn\n" });
    assert.equal(declined.status, 1);
    assert.ok(!declined.ran.includes("claude update"));

    // Still too old after the update: it stops, and does not run the installer.
    const still = moveOn({ marks: NOT_INSTALLED, install: { print: printText(PRINT_LINES.signed, PRINT_LINES.older) }, answers: "y\ny\ny\ny\ny\ny\n" });
    assert.equal(still.status, 1, still.out);
    assert.ok(!still.ran.includes("install.sh --yes"));
  });

  it("waits for the Claude app's own update when its copy is too old, then prints again", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { print: [printText(PRINT_LINES.signed, PRINT_LINES.version, PRINT_LINES.appOlder), DEFAULT_PRINT] }, answers: "y\ny\n\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /Check for Updates/);
    assert.match(r.out, /Press Return when that's done/);
    assert.equal(installCalls(r).filter((c) => c.startsWith("install.sh --print")).length, 2);
    assert.ok(!r.ran.includes("claude update"), "the app's copy is not updated by claude update");
  });

  it("turns HyperFrames on, asked, unless it is on already, and shows her drop folder in Finder", () => {
    const r = moveOn({ marks: NOT_INSTALLED, settingsChange: { app: undefined }, answers: "y\ny\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.includes("The editing app is now hyperframes (it was off)."), r.out);
    assert.match(r.out, /Drag it into Finder's sidebar now, under Favorites/);
    const calls = r.ran.split("\n");
    assert.ok(calls.includes(`open -R ${r.home}/BRIMM Video Work/Drop`), r.ran);

    const on = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
    assert.equal(on.status, 0, on.out);
    assert.match(on.out, /Already done: HyperFrames is on/);
    assert.ok(!on.out.includes("is now hyperframes"));

    const declined = moveOn({ marks: NOT_INSTALLED, settingsChange: { app: undefined }, answers: "y\ny\ny\nn\n" });
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

    const other = moveOn({ marks: `tests=SHA\ninstalled=${"0".repeat(40)}\n`, answers: "y\ny\nn\n" });
    assert.equal(other.status, 1);
    assert.equal(installCalls(other).length, 1, "it prints again");

    const fresh = moveOn({ marks: "tests=SHA\n", answers: "y\ny\ny\n\n" });
    assert.equal(fresh.studioNow.marks, `tests=${fresh.sha}\ndrop=${fresh.home}/BRIMM Video Work/Drop\ninstalled=${fresh.sha}\nfinder=${fresh.sha}\n`, "only its own lines are written, the rest kept");
  });

  it("with --print and no checkout, says the exact line it would print first", () => {
    const r = moveOn({ checkout: "absent", gitStandIn: true, noRepo: true }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.includes(`Would run Studio's installer with --print first (it changes nothing): zsh "${r.home}/Claude Code/brimm-video-studio/tool/install.sh" --print --machine "Sallie's laptop" --drop-folder "${r.home}/BRIMM Video Work/Drop" --import light --handoff 2 "${rootOf(r.home)}"`), r.out);
    assert.deepEqual(installCalls(r), []);
    assert.deepEqual(r.tree, r.before);
  });

  it("with --print and the checkout there, shows the installer's print and changes nothing", () => {
    const r = moveOn({ marks: NOT_INSTALLED }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [`install.sh --print ${optionsOf(r.home)} ${rootOf(r.home)}`]);
    assert.ok(r.out.includes(PRINT_LINES.hdr));
    assert.match(r.out, /Would run Studio's installer for real/);
    assert.deepEqual(r.tree, r.before);
    assert.equal(r.studioNow.marks, `tests=${r.sha}\n`);
  });

  it("stops, showing its last lines, when the real install fails", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `step ${i + 1} of the install`);
    const r = moveOn({ marks: NOT_INSTALLED, install: { ran: lines.join("\n") + "\nThe install could not go on.\n", ranExit: 1 }, answers: "y\ny\ny\n" });
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
    const dropped = moveOn({ marks: NOT_INSTALLED, install: { printDrops: "Client Name Session.mov" }, answers: "y\ny\ny\n" });
    assert.equal(dropped.status, 1, dropped.out);
    assert.ok(!dropped.ran.includes("install.sh --yes"), dropped.ran);
    assert.match(dropped.out, /The drop folder holds 1 file still to be imported\./);
    assert.equal((dropped.out.match(/The drop folder is empty\./g) ?? []).length, 1, "step 1 found it empty; the second look found a file");
    for (const text of [dropped.out, dropped.log, dropped.report, dropped.err]) assert.ok(!text.includes("Client Name"), "no file's name anywhere");
    assert.ok(dropped.out.endsWith(STOPPED_NOTHING), dropped.out);

    const running = moveOn({ marks: NOT_INSTALLED, launchctlLater: "1234\\t0\\tcom.thebrimm.unedited", answers: "y\ny\ny\n" });
    assert.equal(running.status, 1, running.out);
    assert.ok(!running.ran.includes("install.sh --yes"), running.ran);
    assert.match(running.out, /An import is running now\. Wait until its window in the top right closes, then double-click Move to Studio again\./);
    assert.ok(running.out.endsWith(STOPPED_NOTHING), running.out);

    // Nothing new in her drop folder and no import: it goes on, and says so a second time.
    const clear = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
    assert.equal(clear.status, 0, clear.out);
    assert.equal((clear.out.match(/The drop folder is empty\./g) ?? []).length, 2);
    assert.equal((clear.out.match(/No import is running\./g) ?? []).length, 2);
  });

  it("sees a line of the print that comes after 64 KiB", () => {
    const filler = Array.from({ length: 1000 }, (_, i) => `  a line of the print, number ${i}, made long enough to fill the pipe ${"x".repeat(60)}`).join("\n");
    assert.ok(filler.length > 70000);
    const late = moveOn({ marks: NOT_INSTALLED, install: { print: [`${filler}\n${printText(PRINT_LINES.signed, PRINT_LINES.older)}`, DEFAULT_PRINT] }, answers: "y\ny\ny\ny\n\n" });
    assert.equal(late.status, 0, late.out.slice(-600));
    assert.ok(late.ran.split("\n").includes("claude update"), "the older line was seen");
    const early = moveOn({ marks: NOT_INSTALLED, install: { print: [`${printText(PRINT_LINES.signed, PRINT_LINES.older)}\n${filler}`, DEFAULT_PRINT] }, answers: "y\ny\ny\ny\n\n" });
    assert.equal(early.status, 0, early.out.slice(-600));
    assert.ok(early.ran.split("\n").includes("claude update"), "the older line was seen, with more than 64 KiB after it");
  });

  it("leaves her own GIT_SSH alone: the clone's ssh command has a name of its own", () => {
    const hers = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n", env: { GIT_SSH: "/usr/local/bin/her-own-ssh" } });
    assert.equal(hers.status, 0, hers.out);
    assert.equal(hers.installGitSsh.trim(), "/usr/local/bin/her-own-ssh", "the installer sees her own GIT_SSH, as it was");
    const none = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
    assert.equal(none.status, 0, none.out);
    assert.equal(none.installGitSsh.trim(), "unset", "and none when she has none");
  });

  it("takes only 'Claude answered from here' as the installer's check of Claude, and leaves the environment of git out of the installer", () => {
    const ok = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
    assert.equal(ok.status, 0, ok.out);
    assert.equal(ok.installGitEnv.trim(), "unset", "GIT_SSH_COMMAND is for the clone alone");

    for (const said of ["From the background job: Claude could not be asked from here. What it said is in /tmp/check.log.", "From the background job: Claude did not answer within 90 seconds. What it said is in /tmp/check.log."]) {
      const r = moveOn({ marks: NOT_INSTALLED, install: { ran: `Setting up Studio...\n${said}\nDone.\n` }, answers: "y\ny\ny\n\n" });
      assert.equal(r.status, 1, r.out);
      assert.ok(r.out.split(said).length > 2, `its line is shown again by the stop:\n${r.out}`);
      assert.ok(!/installed=/.test(r.studioNow.marks), "no installed mark");
      assert.ok(!r.out.includes("Studio's installer finished."), r.out);
    }
  });

  it("when the install moves her settings and agent to Studio, goes on and marks it", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { moves: true }, answers: "y\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.tree.includes("Library/LaunchAgents/com.thebrimm.unedited.plist"));
    assert.ok(!r.tree.includes("Library/LaunchAgents/com.thebrimm.claude-check.plist"));
  });
});
