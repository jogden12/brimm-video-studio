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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  MOVE,
  notAMac,
  STOPPED_NOTHING,
  PRINT_LINES,
  printText,
  moveOn,
  NOT_INSTALLED,
  installCalls,
  rootOf,
  suggested,
  count,
  DROP_QUESTION,
  EXPORTS_QUESTION,
  TERMINAL_LINE,
  DROP_MESSAGE,
  EXPORTS_MESSAGE,
  NOT_SHOWN,
  EXPORTS_NOTE,
  sourced
} from "./move-app-harness.js";

describe("the move script, step 5's two questions, the chooser and the installer's options (1 of 3: the questions)", { skip: notAMac }, () => {
  // The installer's options for Sallie's laptop: --drop-folder unless it is kept (drop === ""), --exports-folder when given.
  const optionsOf = (home, drop = suggested(home), exports = "") => `--machine Sallie's laptop${drop ? ` --drop-folder ${drop}` : ""}${exports ? ` --exports-folder ${exports}` : ""} --import light --handoff 2`;
  const printed = (r, drop, exports) => `install.sh --print ${optionsOf(r.home, drop, exports)} ${rootOf(r.home)}`;
  const real = (r, drop, exports) => `install.sh --yes ${optionsOf(r.home, drop, exports)} ${rootOf(r.home)}`;



  it("takes c, C and ' c ' as choose, and y as before", () => {
    const cases = [["y", "y"], ["Y", "y"], ["yes", "y"], ["YES", "y"], [" y ", "y"], ["c", "c"], ["C", "c"], [" c ", "c"], ["choose", "c"], ["CHOOSE", "c"], [" Choose ", "c"],
      ["", ""], ["n", ""], ["cc", ""], ["yy", ""], ["yes please", ""], ["ok", ""], ["c y", ""], ["y c", ""]];
    const r = spawnSync("/bin/zsh", ["-c", 'source "$1"; shift; for l in "$@"; do print -r -- "[$(answer_of "$l")]"; done', "t", MOVE, ...cases.map(([line]) => line)], { encoding: "utf8", env: { HOME: "/tmp", PATH: "/usr/bin:/bin" } });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trimEnd().split("\n"), cases.map(([, want]) => `[${want}]`));
  });

  it("y and y give --drop-folder <HOME>/BRIMM Video Work/Drop and no --exports-folder, in the print and in the real run", () => {
    const r = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [printed(r), real(r)]);
    assert.ok(!r.ran.includes("--exports-folder"), r.ran);
    assert.ok(!r.ran.includes("--drop Drop"), "never --drop");
    // The two questions come in this order, before the installer's print, in the app's own words.
    const at = (line) => r.out.indexOf(line);
    for (const line of [...DROP_QUESTION, ...EXPORTS_QUESTION]) assert.ok(at(line) >= 0, `${line}\n${r.out}`);
    assert.ok(at(DROP_QUESTION[0]) < at(EXPORTS_QUESTION[0]) && at(EXPORTS_QUESTION[0]) < at("Studio's installer, with --print first"), r.out);
    // On a Mac moved from brimm-video the drop question first says what is true today.
    assert.ok(at("Today the drop folder is Drop › Sallie's laptop in Dropbox. Once the install has run, it is no longer watched.") < at(DROP_QUESTION[0]), r.out);
    assert.ok(!r.ran.includes("chooser"), "y opens no chooser");
    assert.ok(r.tree.includes("BRIMM Video Work/Drop"), "the installer (here, the stand-in) made the suggested folder");
  });

  it("c opens the chooser in the home folder with the drop message, says the pick in Finder's words, and gives it to the installer", () => {
    const r = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Videos to Drop"], answers: "c\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    const at = (s) => r.out.indexOf(s);
    const chooser = `chooser ${DROP_MESSAGE} | ${r.home}`;
    assert.ok(at(TERMINAL_LINE) >= 0, r.out);
    assert.ok(at(TERMINAL_LINE) < at(chooser) && at(chooser) < at("Picked: Videos to Drop, in your home folder") && at("Picked: Videos to Drop, in your home folder") < at("Studio's installer, with --print first"), r.out);
    const calls = r.ran.split("\n");
    assert.ok(calls.indexOf(chooser) >= 0 && calls.indexOf("open -a Terminal") > calls.indexOf(chooser), "Terminal is brought back after the chooser:\n" + r.ran);
    // It is opened the way Finder opens an app, with the arguments in order: the message, the start folder, a result file, a process id.
    const args = calls.filter((l) => l.startsWith("chooser-arg: ")).map((l) => l.slice("chooser-arg: ".length));
    assert.deepEqual(args.slice(0, 4), ["-n", "-W", join(dirname(r.home), "Applications", "Choose a Folder.app"), "--args"]);
    assert.equal(args[4], DROP_MESSAGE);
    assert.equal(args[5], r.home);
    assert.match(args[6], /\/result$/);
    assert.match(args[7], /^\d+$/);
    assert.deepEqual(installCalls(r), [printed(r, `${r.home}/Videos to Drop`), real(r, `${r.home}/Videos to Drop`)]);
    assert.ok(!r.out.includes("Keys typed while the window was open"), "nothing was typed meanwhile");
  });

  it("Cancel asks again; the end of input then stops with nothing run for real", () => {
    const r = moveOn({ marks: NOT_INSTALLED, picks: ["cancel"], answers: "c\n" });
    assert.equal(r.status, 1, r.out);
    assert.equal(count(r.out, DROP_QUESTION[0]), 2, "the question is asked again");
    assert.equal(r.ran.split("\n").filter((l) => l.startsWith("chooser ")).length, 1);
    assert.deepEqual(installCalls(r), [], "stopped before the print");
    assert.ok(r.out.endsWith(STOPPED_NOTHING), r.out);
    // Cancel at the exports question asks the exports question again.
    const exports = moveOn({ marks: NOT_INSTALLED, picks: ["cancel"], answers: "y\nc\n" });
    assert.equal(exports.status, 1, exports.out);
    assert.equal(count(exports.out, EXPORTS_QUESTION[0]), 2);
    assert.equal(count(exports.out, DROP_QUESTION[0]), 1);
    assert.ok(exports.out.endsWith(STOPPED_NOTHING), exports.out);
  });

  it("a pick that arrives after `open` has ended 1 is still taken", () => {
    const r = moveOn({ marks: NOT_INSTALLED, picks: ["late:<HOME>/Late Folder"], answers: "c\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [printed(r, `${r.home}/Late Folder`), real(r, `${r.home}/Late Folder`)]);
    assert.ok(!r.ran.split("\n").some((l) => l.startsWith("program ")), "the second way was never called:\n" + r.ran);
    assert.ok(!r.out.includes(NOT_SHOWN), r.out);
  });

  it("the first way not shown: the second way is tried", () => {
    for (const picks of [["nofile"], ["fail"]]) {
      const path = moveOn({ marks: NOT_INSTALLED, picks, program: ["<HOME>/Second Way"], answers: "c\ny\nn\n" });
      assert.equal(path.status, 1, path.out);
      assert.deepEqual(installCalls(path), [printed(path, `${path.home}/Second Way`)], picks.join());
      assert.ok(path.ran.split("\n").includes(`program ${DROP_MESSAGE} | ${path.home}`), path.ran);
      assert.ok(path.ran.split("\n").indexOf("open -a Terminal") > path.ran.split("\n").indexOf(`program ${DROP_MESSAGE} | ${path.home}`), "Terminal is brought back after the second way too");
      assert.ok(!path.out.includes(NOT_SHOWN), path.out);

      const cancel = moveOn({ marks: NOT_INSTALLED, picks, program: ["cancel"], answers: "c\n" });
      assert.equal(cancel.status, 1, cancel.out);
      assert.equal(count(cancel.out, DROP_QUESTION[0]), 2, "Cancel of the second way asks again");
      assert.ok(!cancel.out.includes(NOT_SHOWN), "a Cancel is not a chooser that could not be shown");
    }
  });

  it("neither way shown: asked again, and y takes the suggested folder", () => {
    for (const [picks, program] of [[["nofile"], ["two"]], [["fail"], ["missing"]]]) {
      const r = moveOn({ marks: NOT_INSTALLED, picks, program, answers: "c\ny\ny\nn\n" });
      assert.equal(r.status, 1, r.out);
      assert.equal(count(r.out, NOT_SHOWN), 1, r.out);
      assert.equal(count(r.out, DROP_QUESTION[0]), 2);
      assert.deepEqual(installCalls(r), [printed(r)], "y took the suggested folder");
      assert.ok(r.out.indexOf(NOT_SHOWN) > r.out.indexOf(TERMINAL_LINE));
    }
  });

  it("a name with a space, an apostrophe, an accent and an emoji reaches the installer whole", () => {
    const name = "Dröp's folder 🎬  two spaces";
    const r = moveOn({ marks: NOT_INSTALLED, picks: [`<HOME>/${name}`], answers: "c\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    const lines = r.ran.split("\n");
    assert.equal(lines.filter((l) => l === `install-arg: ${r.home}/${name}`).length, 2, "whole, in the print and in the real run:\n" + r.ran);
    assert.ok(lines.includes("install-arg: --drop-folder"));
    assert.ok(r.out.includes(`Picked: ${name}, in your home folder`), r.out);
    assert.ok(r.log.includes(name), "and kept in the log");
  });

  it("a name with a leading space, a curly apostrophe, an accent and an emoji reaches the installer whole", () => {
    const name = " Lead’s café 🎬";
    const r = moveOn({ marks: NOT_INSTALLED, picks: [`<HOME>/${name}`], answers: "c\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.equal(r.ran.split("\n").filter((l) => l === `install-arg: ${r.home}/${name}`).length, 2, r.ran);
  });

  it("a line break from the chooser is refused by the app's line, and asked again", () => {
    const r = moveOn({ marks: NOT_INSTALLED, picks: ["linebreak", "<HOME>/After Line"], answers: "c\nc\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.equal(count(r.out, "A folder whose name holds a line break can't be used. Choose another."), 1, r.out);
    assert.equal(count(r.out, DROP_QUESTION[0]), 2);
    assert.deepEqual(installCalls(r), [printed(r, `${r.home}/After Line`), real(r, `${r.home}/After Line`)]);
    // The second way ends 3 for it too.
    const second = moveOn({ marks: NOT_INSTALLED, picks: ["nofile"], program: ["linebreak", "<HOME>/After Line"], answers: "c\nc\ny\nn\n" });
    assert.equal(count(second.out, "A folder whose name holds a line break can't be used. Choose another."), 1, second.out);
    assert.ok(!second.out.includes(NOT_SHOWN), "a line break is never mistaken for a chooser that could not be shown");
    assert.deepEqual(installCalls(second), [printed(second, `${second.home}/After Line`)]);
  });

  it("answers piped after the chooser are still read", () => {
    const r = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Videos to Drop", "<HOME>/Exports"], answers: "c\nc\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(installCalls(r), [printed(r, `${r.home}/Videos to Drop`, `${r.home}/Exports`), real(r, `${r.home}/Videos to Drop`, `${r.home}/Exports`)]);
    assert.equal(r.ran.split("\n").filter((l) => l.startsWith("chooser ")).length, 2);
  });

  it("keeps the spec's block for the keys typed meanwhile", () => {
    const code = readFileSync(MOVE, "utf8");
    for (const line of ["local thrown=0 _key last=\"\"", "if [[ -t 0 ]]; then", "while read -t 0 -k 1 -s _key; do thrown=$(( thrown + 1 )); last=$_key; done", "if [[ \"$last\" != $'\\n' && \"$last\" != $'\\r' ]]; then print -r -- \"\"; fi", "THROWN=$(( THROWN + thrown ))", "Keys typed while the window was open were not taken as answers."]) {
      assert.ok(code.includes(line), line);
    }
    // Piped answers are not a keyboard: nothing is thrown away, and nothing said.
    const r = sourced('THROWN=0; throw_away_typed_keys; print -r -- "THROWN=$THROWN"', { input: "y\n" });
    assert.equal(r.out, "THROWN=0\n");
  });

  describe("the exports question", () => {
    it("Downloads picked through a link gives no option; another folder gives --exports-folder and the note", () => {
      const link = moveOn({ marks: NOT_INSTALLED, links: { "<HOME>/dl-link": "<HOME>/Downloads" }, picks: ["<HOME>/dl-link"], answers: "y\nc\nn\n" });
      assert.equal(link.status, 1, link.out);
      assert.deepEqual(installCalls(link), [printed(link)]);
      assert.ok(link.out.includes("Picked: Downloads, in your home folder"), link.out);
      assert.ok(!link.out.includes(EXPORTS_NOTE), "Downloads brings no note");

      const other = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Exports"], answers: "y\nc\nn\n" });
      assert.equal(other.status, 1, other.out);
      assert.deepEqual(installCalls(other), [printed(other, undefined, `${other.home}/Exports`)]);
      assert.ok(other.ran.split("\n").includes(`chooser ${EXPORTS_MESSAGE} | ${other.home}`), other.ran);
      assert.ok(other.out.includes(EXPORTS_NOTE), other.out);
      assert.ok(other.out.indexOf(EXPORTS_NOTE) > other.out.indexOf("Picked: Exports, in your home folder"));
    });

    it("an exportsPath naming Downloads is not a kept folder", () => {
      const r = moveOn({ marks: NOT_INSTALLED, settingsChange: { exportsPath: "<HOME>/Downloads" }, answers: "y\ny\nn\n" });
      assert.equal(r.status, 1, r.out);
      for (const line of EXPORTS_QUESTION) assert.ok(r.out.includes(line), line);
      assert.ok(!r.out.includes("looked for in"), r.out);
      assert.deepEqual(installCalls(r), [printed(r, undefined, undefined)]);
    });

    it("an exportsPath of its own is kept by y, and going back to Downloads gives --exports-folder <HOME>/Downloads", () => {
      const kept = moveOn({ marks: NOT_INSTALLED, settingsChange: { exportsPath: "<HOME>/Old Exports" }, answers: "y\ny\nn\n" });
      assert.equal(kept.status, 1, kept.out);
      assert.ok(kept.out.includes("HyperFrames' exports are looked for in Old Exports, in your home folder and in Downloads."), kept.out);
      assert.ok(kept.out.includes("Type y and press Return to keep it, or c and press Return to choose another."), kept.out);
      assert.deepEqual(installCalls(kept), [printed(kept)], "kept: no exports option");

      const back = moveOn({ marks: NOT_INSTALLED, settingsChange: { exportsPath: "<HOME>/Old Exports" }, picks: ["<HOME>/Downloads"], answers: "y\nc\nn\n" });
      assert.equal(back.status, 1, back.out);
      assert.deepEqual(installCalls(back), [printed(back, undefined, `${back.home}/Downloads`)]);
    });
  });

  describe("later runs", () => {
    it("a Mac whose settings have dropPath: y keeps it with no drop option; c gives --drop-folder", () => {
      const kept = moveOn({ marks: NOT_INSTALLED, settingsChange: { dropPath: "<HOME>/My Drop" }, answers: "y\ny\nn\n" });
      assert.equal(kept.status, 1, kept.out);
      assert.ok(kept.out.includes("This Mac's drop folder is My Drop, in your home folder."), kept.out);
      assert.ok(kept.out.includes("Type y and press Return to keep it, or c and press Return to choose another."), kept.out);
      assert.ok(!kept.out.includes("Today the drop folder is"), "it is not the old folder any more");
      assert.deepEqual(installCalls(kept), [printed(kept, "")]);

      const other = moveOn({ marks: NOT_INSTALLED, settingsChange: { dropPath: "<HOME>/My Drop" }, picks: ["<HOME>/Another"], answers: "c\ny\nn\n" });
      assert.equal(other.status, 1, other.out);
      assert.deepEqual(installCalls(other), [printed(other, `${other.home}/Another`)]);
    });

    it("a folder picked last time is offered again, and, when another is picked, named with its count", () => {
      const again = moveOn({ marks: "tests=SHA\ndrop=<HOME>/Last Time\n", folderFiles: { "<HOME>/Last Time": [] }, answers: "y\ny\nn\n" });
      assert.equal(again.status, 1, again.out);
      assert.ok(again.out.includes("Last time, this folder was picked: Last Time, in your home folder."), again.out);
      assert.ok(again.out.includes("Type y and press Return to use it again, or c and press Return to choose another."), again.out);
      assert.deepEqual(installCalls(again), [printed(again, `${again.home}/Last Time`)]);

      const other = moveOn({ marks: "tests=SHA\ndrop=<HOME>/Last Time\n", folderFiles: { "<HOME>/Last Time": ["a.mov", "Client Name.mov"] }, picks: ["<HOME>/Another"], answers: "c\ny\nn\n" });
      assert.equal(other.status, 1, other.out);
      assert.deepEqual(installCalls(other), [printed(other, `${other.home}/Another`)]);
      assert.ok(other.out.includes("The folder picked last time, Last Time, in your home folder, was left as it is, and holds 2 files or folders. Jason checks it is empty, then deletes it by hand if it is not wanted."), other.out);
      for (const text of [other.out, other.log, other.err]) assert.ok(!text.includes("Client Name"), "counted and never listed");

      const exports = moveOn({ marks: "tests=SHA\nexports=<HOME>/Last Exports\n", answers: "y\ny\nn\n" });
      assert.ok(exports.out.includes("Last time, this folder was picked: Last Exports, in your home folder."), exports.out);
      assert.deepEqual(installCalls(exports), [printed(exports, undefined, `${exports.home}/Last Exports`)]);

      const exportsOther = moveOn({ marks: "tests=SHA\nexports=<HOME>/Last Exports\n", folderFiles: { "<HOME>/Last Exports": ["a.mov"] }, picks: ["<HOME>/Exports"], answers: "y\nc\nn\n" });
      assert.deepEqual(installCalls(exportsOther), [printed(exportsOther, undefined, `${exportsOther.home}/Exports`)]);
      assert.ok(!exportsOther.out.includes("was left as it is"), "the exports question says nothing of the folder left behind");
    });
  });

  it("stops, when c alone is offered and the chooser cannot be shown, with the words that fit the refusal", () => {
    // The checks come in Task 3; here a refusal is made up, to see what the question does with it.
    const script = 'MACHINE="Sallie\'s laptop"; SETTINGS="$HOME/none.json"; MARKS="$HOME/none"; ROOT="$HOME/root"; STUDIO="$HOME/studio"\n'
      + 'drop_folder_fault() { FAULT_KIND=$KIND; FAULT_WORDS="The folder is no good."; FAULT_REASON="the folder is no good"; }\nask_drop_folder';
    const stops = (kind, input) => sourced(`KIND=${kind}\n${script}`, { picks: ["fail"], program: ["two"], input });
    const full = stops("not-empty", "y\nc\n");
    assert.equal(full.status, 1, full.out);
    assert.ok(full.out.includes("Type c and press Return to choose another folder. Anything else stops:"), full.out);
    assert.ok(full.out.includes(`The window to choose a folder could not be shown, and ${full.home}/BRIMM Video Work/Drop is not empty. Empty it in Finder, or tell Jason, then double-click Move to Studio again.`), full.out);
    const other = stops("transcript", "y\nc\n");
    assert.equal(other.status, 1, other.out);
    assert.ok(other.out.includes(`The window to choose a folder could not be shown, and ${other.home}/BRIMM Video Work/Drop can't be used: the folder is no good. Tell Jason, then double-click Move to Studio again.`), other.out);
    // With c alone offered, a y stops, and no chooser is opened.
    const y = stops("not-empty", "y\ny\n");
    assert.equal(y.status, 1, y.out);
    assert.ok(!y.ran.includes("chooser"), y.ran);
    // A refusal that allowing Terminal cures keeps its y.
    const keeps = stops("cannot-look", "y\ny\n");
    assert.equal(keeps.status, 1);
    assert.ok(!keeps.out.includes("Type c and press Return to choose another folder."), keeps.out);
  });

  it("(the test's own stand-in) the installer's print texts and exit statuses are indexed by the call, each on its own list", () => {
    const older = printText(PRINT_LINES.signed, PRINT_LINES.older, PRINT_LINES.hdr);
    const r = moveOn({ marks: NOT_INSTALLED, install: { print: older, printExit: [0, 2] }, answers: "y\ny\ny\n" });
    assert.equal(r.status, 1, r.out);
    assert.equal(installCalls(r).length, 2);
    assert.match(r.out, /Studio's installer refused/, "the second call exits 2 though the print list has one text");
  });

  it("under --print: no chooser and no question, the would line, and the installer's print with the folders y would give", () => {
    const r = moveOn({ marks: NOT_INSTALLED }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.includes("Would ask where videos are dropped (suggested: BRIMM Video Work › Drop) and where HyperFrames' exports go (suggested: Downloads)"), r.out);
    assert.ok(!r.out.includes(DROP_QUESTION[0]) && !r.ran.includes("chooser"), "nothing is asked, and no chooser opens");
    assert.deepEqual(installCalls(r), [printed(r)]);
    assert.deepEqual(r.tree, r.before);

    // A Mac with dropPath and exportsPath keeps them, as a y would.
    const kept = moveOn({ marks: NOT_INSTALLED, settingsChange: { dropPath: "<HOME>/My Drop", exportsPath: "<HOME>/Old Exports" } }, "--print");
    assert.equal(kept.status, 0, kept.out);
    assert.deepEqual(installCalls(kept), [printed(kept, "")]);
    assert.ok(!kept.ran.includes("--exports-folder") && !kept.ran.includes("--drop-folder"), kept.ran);
  });

});
