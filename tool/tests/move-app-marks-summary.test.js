// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop or Jason's MacBook from brimm-video
// to Studio, or sets up fresh, as Jason's MacBook, a Mac with no brimm-video, one asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  notAMac,
  STOPPED_NOTHING,
  put,
  moveOn,
  NOT_INSTALLED,
  installCalls
} from "./move-app-harness.js";

describe("the move script, later runs, the marks, the stop summary and the end of the run (1 of 2: marks, stop summary, report)", { skip: notAMac }, () => {
  const JASON = "Jason's MacBook";
  const JASON_KEY = "brimm-video-studio read-only, Jason's MacBook";
  const STUDIO_AT = "<HOME>/Claude Code/brimm-video-studio";
  // A moved Mac as Studio's installer leaves it: its checkout is Studio's, and it has a drop folder of its own beside drop "Drop".
  const MOVED = { checkout: STUDIO_AT, dropPath: "<HOME>/My Drop" };
  // A Mac set up with a drop folder of its own and no drop.
  const OWN = { ...MOVED, drop: undefined };
  const OLD_DROP = "<HOME>/Dropbox/The BRIMM DB/BRIMM Video/Drop/Sallie's laptop";
  const FRESH_MAC = { settings: null, key: JASON_KEY, marks: NOT_INSTALLED };
  const NOT_FINISHED = "Move to Studio has not finished, so a video dropped now may not be imported. Drop no video until it has finished: double-click it again now.";
  const NOW = (words) => `This Mac's drop folder is now ${words}.`;
  const NO_LONGER = "Videos put in Drop › Sallie's laptop in Dropbox are no longer imported.";
  const LOCAL_DROP = "BRIMM Video Work › Drop, in your home folder";
  const FINDER_LOCAL = (words) => `This is the drop folder from now on: ${words}. Drag it into Finder's sidebar now, under Favorites, so it is one click away. To bring in a video that is in Dropbox, hold Option as you drag it, so that Dropbox keeps its copy. Never export into the drop folder.`;
  const STOP_TAIL = "Double-click Move to Studio again to go on from here.\n";
  const summaryOf = (r) => r.out.slice(r.out.lastIndexOf("Stopped."));

  // A whole run is shared by the tests of this file that make the same one (same options, same answers); each keeps all its assertions.
  const memo = new Map();
  const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key); };
  // The runs three tests here make alike: the marks test and the report test (an Exports pick), the marks test, the partial-install test and the
  // stop-summary test (a failed install), and the marks test and the stop-summary test (a Mac set up fresh).
  const exportsRun = () => once("exports", () => moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Exports"], answers: "y\nc\ny\n\n" }));
  const endedRun = () => once("ended", () => moveOn({ marks: NOT_INSTALLED, install: { ranExit: 1 }, answers: "y\ny\ny\n" }));
  const freshRun = () => once("fresh", () => moveOn({ ...FRESH_MAC, install: { writesSettings: true, ranExit: 1 }, answers: "y\ny\ny\ny\n" }));
  it("the marks are written right before the real install, and not on n", () => {
    const r = exportsRun();
    assert.equal(r.status, 0, r.out);
    assert.equal(r.studioNow.marks, `tests=${r.sha}\ndrop=${r.home}/BRIMM Video Work/Drop\nexports=${r.home}/Exports\ninstalled=${r.sha}\nfinder=${r.sha}\n`);

    const no = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Exports"], answers: "y\nc\nn\n" });
    assert.equal(no.status, 1, no.out);
    assert.equal(no.studioNow.marks, `tests=${no.sha}\n`, "an n writes no mark");

    // Written before the installer runs: a failed install has them, and is not marked finished.
    const failed = endedRun();
    assert.equal(failed.status, 1, failed.out);
    assert.equal(failed.studioNow.marks, `tests=${failed.sha}\ndrop=${failed.home}/BRIMM Video Work/Drop\n`, "no exports= for a y to Downloads");

    // A stop at the look right before the install writes none.
    const dropped = moveOn({ marks: NOT_INSTALLED, install: { printDrops: "x.mov" }, answers: "y\ny\ny\n" });
    assert.equal(dropped.status, 1, dropped.out);
    assert.equal(dropped.studioNow.marks, `tests=${dropped.sha}\n`);

    // The settings' own drop folder, kept by y, is given to the installer with no option, so no drop= mark.
    const kept = moveOn({ marks: NOT_INSTALLED, settingsChange: MOVED, answers: "y\ny\ny\n\n" });
    assert.equal(kept.status, 0, kept.out);
    assert.equal(kept.studioNow.marks, `tests=${kept.sha}\ninstalled=${kept.sha}\nfinder=${kept.sha}\n`);

    // A Mac set up fresh is marked.
    const fresh = freshRun();
    assert.equal(fresh.status, 1, fresh.out);
    assert.equal(fresh.studioNow.marks, `tests=${fresh.sha}\ndrop=${fresh.home}/BRIMM Video Work/Drop\nfresh=yes\n`);
  });

  it("a run after a partial install offers to keep the folder, and gives no drop option", () => {
    const first = endedRun();
    assert.equal(first.status, 1, first.out);
    const second = first.again({ answers: "y\ny\ny\n\n" });
    assert.equal(second.status, 0, second.out);
    assert.ok(second.out.includes(`This Mac's drop folder is ${LOCAL_DROP}.`), second.out);
    assert.ok(second.out.includes("Type y and press Return to keep it, or c and press Return to choose another."), second.out);
    assert.ok(!second.ran.includes("--drop-folder"), second.ran);
    assert.deepEqual(installCalls(second).map((l) => l.split(" ")[1]), ["--print", "--yes"]);
  });

  it("a Mac set up fresh, run again after a partial install, is still fresh", () => {
    const first = moveOn({ ...FRESH_MAC, oldKey: true, install: { writesSettings: true, ranExit: 1 }, answers: "y\ny\ny\ny\n" });
    assert.equal(first.status, 1, first.out);
    const second = first.again({ answers: "y\ny\ny\ny\n\n" });
    assert.equal(second.status, 0, second.out);
    assert.ok(second.out.includes("set up fresh on an earlier run"), second.out);
    assert.ok(!second.out.includes("This Mac has no brimm-video settings"), "no fresh question");
    assert.ok(!second.out.includes("Today the drop folder is"), second.out);
    assert.match(second.out, /Not asked: this Mac was set up fresh/);
    assert.deepEqual(second.oldKeyFiles, [true, true], "step 7 leaves the old key");
    assert.ok(existsSync(join(second.home, "Dropbox", "The BRIMM DB", "BRIMM Video", "Drop", JASON)), "the installer's stand-in made an old folder");
    assert.ok(!second.out.includes("The old drop folder"), second.out);
    assert.ok(second.out.trimEnd().endsWith("Done. Next on the By-Hand page: the rest of the check for Jason's MacBook."), second.out.slice(-300));
    // No Dropbox search: with Dropbox gone, a third run still does not stop for it.
    rmSync(join(second.home, "Dropbox"), { recursive: true, force: true });
    const third = second.again({ answers: "" });
    assert.equal(third.status, 0, third.out);
    assert.ok(!third.out.includes("no BRIMM Video folder in Dropbox"), third.out);
    assert.ok(!third.out.includes("The old drop folder"), third.out);
  });

  it("a stop after the installer started says whether the drop folder changed, and never counts the old folder", () => {
    // The background line, then an n at the HyperFrames question: the folder is now the new one.
    const n = moveOn({ marks: NOT_INSTALLED, settingsChange: { app: undefined }, install: { ranDrops: "a.mov b.mov" }, answers: "y\ny\ny\nn\n" });
    assert.equal(n.status, 1, n.out);
    const tail = summaryOf(n);
    assert.ok(tail.includes(NOW(LOCAL_DROP)), tail);
    assert.ok(tail.includes(NO_LONGER), tail);
    assert.ok(tail.indexOf(NOW(LOCAL_DROP)) < tail.indexOf(NO_LONGER), "the Dropbox sentence follows");
    assert.ok(!tail.includes("has not finished"), tail);
    assert.ok(n.out.endsWith(STOP_TAIL), n.out);
    assert.ok(!n.out.includes("The old drop folder"), "a stop says no last lines");
    assert.ok(!n.out.includes("nothing imports now"), n.out);

    // The installer ended 1 after its background line: the same words.
    const ended = endedRun();
    assert.equal(ended.status, 1, ended.out);
    assert.ok(summaryOf(ended).includes(NOW(LOCAL_DROP)), ended.out);
    assert.ok(summaryOf(ended).includes(NO_LONGER), ended.out);
    assert.ok(!summaryOf(ended).includes("has not finished"));

    // No background line: not finished, whether or not the folder changed, and with or without an end status.
    for (const install of [{ noBackground: true }, { noBackground: true, ranExit: 1 }]) {
      const r = moveOn({ marks: NOT_INSTALLED, install, answers: "y\ny\ny\n" });
      assert.equal(r.status, 1, r.out);
      assert.ok(summaryOf(r).includes(NOT_FINISHED), r.out);
      assert.ok(!summaryOf(r).includes("drop folder is now"), summaryOf(r));
      assert.ok(r.out.endsWith(STOP_TAIL), r.out);
    }
    // A kept drop folder did not change, and the installer had not finished.
    const keptStop = moveOn({ marks: NOT_INSTALLED, settingsChange: MOVED, install: { noBackground: true }, answers: "y\ny\ny\n" });
    assert.ok(summaryOf(keptStop).includes(NOT_FINISHED), keptStop.out);
    // And a kept one, finished, says nothing of a change.
    const keptDone = moveOn({ marks: NOT_INSTALLED, settingsChange: { ...MOVED, app: undefined }, answers: "y\ny\ny\nn\n" });
    assert.equal(keptDone.status, 1, keptDone.out);
    assert.ok(!summaryOf(keptDone).includes("drop folder is now"), summaryOf(keptDone));
    assert.ok(!summaryOf(keptDone).includes("has not finished"), summaryOf(keptDone));

    // Before the installer started, the summary says nothing of it.
    const before = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\nn\n" });
    assert.ok(before.out.endsWith(STOPPED_NOTHING), before.out);

    // A Mac set up fresh has no Dropbox sentence.
    const fresh = freshRun();
    assert.equal(fresh.status, 1, fresh.out);
    assert.ok(summaryOf(fresh).includes(NOW(LOCAL_DROP)), fresh.out);
    assert.ok(!summaryOf(fresh).includes("no longer imported"), fresh.out);
  });

  it("the report's three lines on a first run, on a later run, and under --print", () => {
    const lines = (r) => r.report.split("\n");
    const three = (r) => {
      const at = lines(r).findIndex((l) => l.startsWith("Drop folder: "));
      assert.ok(at > 0, r.report);
      assert.ok(lines(r)[at - 1].startsWith("What turning HyperFrames on printed: "), "after check 44's existing lines");
      assert.ok(lines(r)[at + 1].startsWith("Exports folder: ") && lines(r)[at + 2].startsWith("Cloud warning: "), r.report);
      return lines(r).slice(at, at + 3);
    };
    const first = exportsRun();
    assert.equal(first.status, 0, first.out);
    assert.deepEqual(three(first), [`Drop folder: ${first.home}/BRIMM Video Work/Drop`, `Exports folder: ${first.home}/Exports`, "Cloud warning: none"]);

    const cloud = moveOn({ marks: NOT_INSTALLED, settingsChange: { ...MOVED, dropPath: "<HOME>/Dropbox/Drop" }, answers: "y\ny\ny\n\n" });
    assert.deepEqual(three(cloud), [`Drop folder: ${cloud.home}/Dropbox/Drop`, `Exports folder: ${cloud.home}/Downloads`, "Cloud warning: Dropbox, kept on a y on an earlier run"]);

    // A later run, the install finished earlier: filled from Studio's settings, the cloud's name kept from the earlier run.
    const later = moveOn({ settingsChange: { ...OWN, exportsPath: "<HOME>/Exports" } });
    assert.equal(later.status, 0, later.out);
    assert.deepEqual(three(later), [`Drop folder: ${later.home}/My Drop`, `Exports folder: ${later.home}/Exports`, "Cloud warning: none"]);
    const laterCloud = moveOn({ settingsChange: { ...OWN, dropPath: "<HOME>/Dropbox/Drop" } });
    assert.deepEqual(three(laterCloud), [`Drop folder: ${laterCloud.home}/Dropbox/Drop`, `Exports folder: ${laterCloud.home}/Downloads`, "Cloud warning: Dropbox, kept on a y on an earlier run"]);

    // A print claims nothing.
    const p = moveOn({ marks: NOT_INSTALLED }, "--print");
    assert.equal(p.status, 0, p.out);
    for (const label of ["Drop folder:", "Exports folder:", "Cloud warning:"]) assert.ok(p.out.includes(`${label} not checked: this was a print`), `${label}\n${p.out}`);
  });
});
