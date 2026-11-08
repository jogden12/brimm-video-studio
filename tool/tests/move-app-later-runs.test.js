// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop or Jason's MacBook from brimm-video
// to Studio, or sets up fresh, as Jason's MacBook, a Mac with no brimm-video, one asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  notAMac,
  STOPPED_NOTHING,
  put,
  moveOn,
  NOT_INSTALLED,
  suggested,
  count
} from "./move-app-harness.js";

describe("the move script, later runs, the marks, the stop summary and the end of the run (2 of 2: the drop folder, Finder, last lines)", { skip: notAMac }, () => {
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
  // The run the Finder test and the "at 0" test both make: a local drop folder, the install finished.
  const localRun = () => once("local", () => moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" }));
  it("step 1 takes a dropPath as a drop folder of its own, counts it, and stops only when it is watched", () => {
    const ok = moveOn({ marks: NOT_INSTALLED, settingsChange: OWN, answers: "y\ny\nn\n" });
    assert.equal(ok.status, 1, ok.out);
    assert.ok(ok.out.includes(`drop folder: its own, ${ok.home}/My Drop`), ok.out);
    assert.ok(!ok.out.includes("should be \"Drop\""), ok.out);
    assert.ok(ok.out.includes("The drop folder is empty."), ok.out);
    assert.ok(ok.out.includes("Type y and press Return to keep it"), "it got as far as step 5");

    // Its folder is not there yet: that counts as empty, the installer makes it.
    const gone = moveOn({ marks: NOT_INSTALLED, settingsChange: OWN, dropGone: true, answers: "y\ny\ny\n\n" });
    assert.equal(gone.status, 0, gone.out);
    assert.ok(gone.out.includes("The drop folder is empty."), gone.out);
    assert.match(gone.report, /^What the count printed: 0$/m);

    // Files in it, loaded and watched: stop. Nothing is named.
    const watched = moveOn({ marks: NOT_INSTALLED, settingsChange: OWN, dropFiles: ["Client Name.mov"] });
    assert.equal(watched.status, 1, watched.out);
    assert.ok(watched.out.includes("The drop folder holds 1 file still to be imported."), watched.out);
    assert.ok(watched.out.endsWith(STOPPED_NOTHING), watched.out);
    for (const text of [watched.out, watched.log, watched.err]) assert.ok(!text.includes("Client Name"));

    // Not loaded, or loaded and not naming it: go on, with the spec's line.
    const line = "2 files or folders wait in My Drop, in your home folder. Nothing watches it yet: the install starts the watching, and they are imported then.";
    for (const change of [{ agentLoaded: false }, { agentWatches: ["<HOME>/Elsewhere"] }]) {
      const r = moveOn({ marks: NOT_INSTALLED, settingsChange: OWN, dropFiles: ["a.mov", "b.mov"], answers: "y\ny\nn\n", ...change });
      assert.equal(r.status, 1, r.out);
      assert.ok(r.out.includes(line), r.out);
      assert.ok(r.out.includes("Type y and press Return to keep it"), "it went on to step 5");
      assert.ok(!r.out.includes("still to be imported"), r.out);
    }
    // The line for a single one.
    const one = moveOn({ marks: NOT_INSTALLED, settingsChange: OWN, dropFiles: ["a.mov"], agentLoaded: false, answers: "y\ny\nn\n" });
    assert.ok(one.out.includes("1 file or folder waits in My Drop, in your home folder. Nothing watches it yet: the install starts the watching, and it is imported then."), one.out);
  });

  it("Drop › <Mac> holding a file stops: 'still to be imported' when watched, 'Tell Jason' when not", () => {
    const held = { folderFiles: { [OLD_DROP]: ["a.mov", "b.mov"] } };
    const watched = moveOn({ marks: NOT_INSTALLED, settingsChange: MOVED, ...held });
    assert.equal(watched.status, 1, watched.out);
    assert.ok(watched.out.includes("The drop folder holds 2 files still to be imported."), watched.out);
    assert.ok(watched.out.endsWith(STOPPED_NOTHING), watched.out);

    const not = moveOn({ marks: NOT_INSTALLED, settingsChange: MOVED, agentLoaded: false, ...held });
    assert.equal(not.status, 1, not.out);
    assert.ok(not.out.includes("2 files or folders wait in the old drop folder, Drop › Sallie's laptop, and nothing imports them now. Tell Jason."), not.out);
    assert.ok(not.out.endsWith(STOPPED_NOTHING), not.out);
    for (const text of [watched.out, not.out, not.log]) assert.ok(!text.includes("a.mov"));

    // Once the install has finished at this commit, the old folder is not counted for the run, and a file in the drop folder does not stop it.
    const finished = moveOn({ settingsChange: { ...MOVED }, dropFiles: ["a.mov"], ...held });
    assert.equal(finished.status, 0, finished.out);
    assert.ok(!finished.out.includes("Tell Jason"), finished.out);
    assert.ok(!finished.out.includes("still to be imported"), finished.out);
  });

  it("a later run after the install finished at this commit, with a file in the drop folder: counted for the report, no stop", () => {
    const r = moveOn({ settingsChange: OWN, dropFiles: ["Client Name.mov", "b.mov"] });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.includes("The drop folder holds 2 files or folders."), r.out);
    assert.match(r.report, /^What the count printed: 2$/m);
    for (const text of [r.out, r.log, r.report, r.err]) assert.ok(!text.includes("Client Name"), "counted and never named");
    // Unreadable: said, and the run goes on.
    const unreadable = moveOn({ settingsChange: OWN, dropMode: 0o000 });
    assert.equal(unreadable.status, 0, unreadable.out);
    assert.match(unreadable.report, /^What the count printed: could not be read/m);
  });

  it("a stale exports= mark is taken out when a run gives no --exports-folder", () => {
    const unsetExports = (home) => {
      const file = join(home, "Library", "Application Support", "BRIMM Video", "settings.json");
      const s = JSON.parse(readFileSync(file, "utf8"));
      delete s.exportsPath;
      writeFileSync(file, JSON.stringify(s));
    };
    const one = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Exports"], install: { ranExit: 1 }, answers: "y\nc\ny\n" });
    assert.match(one.studioNow.marks, /exports=/);
    unsetExports(one.home); // the first run failed before the settings were written
    const two = one.again({ answers: "y\nc\ny\n", picks: ["<HOME>/Downloads"], install: { ranExit: 1 } });
    assert.ok(two.out.includes("Last time, this folder was picked: Exports, in your home folder."), two.out);
    assert.ok(!two.ran.includes("--exports-folder"), two.ran);
    assert.ok(!/exports=/.test(two.studioNow.marks), two.studioNow.marks);
    unsetExports(two.home);
    const three = two.again({ answers: "y\ny\nn\n" });
    assert.ok(!three.out.includes("Last time, this folder was picked: Exports"), three.out);
  });

  it("the set-up-fresh question's new words", () => {
    const r = moveOn({ ...FRESH_MAC, answers: "n\n" });
    assert.equal(r.status, 1, r.out);
    assert.ok(r.out.includes("a drop folder picked in step 5 (suggested: BRIMM Video Work › Drop, on this Mac)"), r.out);
    assert.ok(!r.out.includes("its own drop folder"), r.out);
  });

  it("the Finder step: a local drop folder gets the sidebar words, one in Dropbox Make available offline, and a later run shows it until it is done", () => {
    const local = localRun();
    assert.equal(local.status, 0, local.out);
    assert.ok(local.out.includes(FINDER_LOCAL(LOCAL_DROP)), local.out);
    assert.ok(local.ran.split("\n").includes(`open -R ${local.home}/BRIMM Video Work/Drop`), local.ran);
    assert.ok(!local.out.includes("Make available offline"), local.out);
    assert.match(local.studioNow.marks, /finder=/);

    // In Dropbox on a moved Mac: Make available offline, and no sentence about node.
    const inDropbox = { marks: NOT_INSTALLED, picks: ["<HOME>/Dropbox/My Drops"], folderFiles: { "<HOME>/Dropbox/My Drops": [] } };
    const moved = moveOn({ ...inDropbox, answers: "c\ny\ny\n\n" });
    assert.equal(moved.status, 0, moved.out);
    assert.ok(moved.out.includes("The drop folder is shown in Finder: Dropbox › My Drops, in your home folder. In Finder, Control-click it, choose Make available offline."), moved.out);
    assert.ok(!moved.out.includes("node may read the Dropbox folder"), moved.out);
    assert.ok(!moved.out.includes("Drag it into Finder's sidebar"), moved.out);
    // And on a Mac set up fresh, with the node sentence.
    const fresh = moveOn({ ...FRESH_MAC, ...inDropbox, install: { writesSettings: true }, answers: "y\nc\ny\ny\ny\n\n" });
    assert.equal(fresh.status, 0, fresh.out);
    assert.ok(fresh.out.includes("The drop folder is shown in Finder: Dropbox › My Drops, in your home folder. In Finder, Control-click it, choose Make available offline, and click Allow if macOS asks whether node may read the Dropbox folder."), fresh.out);
    assert.ok(!fresh.out.includes("Drop › Jason's MacBook"), "the folder is named in Finder's words, not by the Mac's name");

    // An n at Finder leaves the step undone; the next run shows it again, and Return marks it.
    const first = moveOn({ marks: NOT_INSTALLED, install: { moves: true }, answers: "y\ny\ny\nn\n" });
    assert.equal(first.status, 1, first.out);
    assert.ok(!/finder=/.test(first.studioNow.marks), first.studioNow.marks);
    const second = first.again({ answers: "\n" });
    assert.equal(second.status, 0, second.out);
    assert.ok(second.out.includes(FINDER_LOCAL(LOCAL_DROP)), second.out);
    assert.ok(second.ran.split("\n").includes(`open -R ${second.home}/BRIMM Video Work/Drop`), second.ran);
    assert.match(second.studioNow.marks, /finder=/);
    const third = second.again({ answers: "" });
    assert.equal(third.status, 0, third.out);
    assert.ok(!third.out.includes("Drag it into Finder's sidebar"), "done: not shown again");
    assert.ok(!third.ran.includes("open -R " + third.home + "/BRIMM Video Work/Drop"), third.ran);
  });

  describe("the last lines on a moved Mac", () => {
    const LINE_0 = "The old drop folder, Drop › Sallie's laptop in Dropbox, is empty and no longer watched. Jason checks it is still empty, then deletes it by hand, and takes it out of Finder's sidebar.";
    const DONE = "Done. Next on the By-Hand page: checks 45 to 47, on screen.";

    it("at 0: said before Done., once", () => {
      const r = localRun();
      assert.equal(r.status, 0, r.out);
      assert.equal(r.out.split(LINE_0).length - 1, 1, r.out);
      assert.ok(r.out.indexOf(LINE_0) > r.out.indexOf("7. brimm-video's old key") && r.out.indexOf(LINE_0) < r.out.lastIndexOf(DONE), r.out);
      assert.ok(r.out.trimEnd().endsWith(DONE), r.out);
      // A later run (the install finished at this commit) says it too, while the folder is there.
      const later = moveOn({ settingsChange: MOVED });
      assert.equal(later.status, 0, later.out);
      assert.ok(later.out.includes(LINE_0), later.out);
    });

    it("at 2: counted, never named, said once, with no wait", () => {
      const r = moveOn({ marks: NOT_INSTALLED, install: { ranDrops: "Client-Name.mov b.mov" }, answers: "y\ny\ny\n\n" });
      assert.equal(r.status, 0, r.out);
      const line = `The old drop folder, Drop › Sallie's laptop in Dropbox, holds 2 files or folders that nothing imports now. Drag each video in it into ${LOCAL_DROP}, with a plain drag, which moves it out of Dropbox, and it is imported there. Jason deletes the folder by hand once it is empty.`;
      assert.equal(r.out.split(line).length - 1, 1, r.out);
      assert.ok(r.out.indexOf(line) < r.out.lastIndexOf(DONE));
      assert.ok(r.out.trimEnd().endsWith(DONE), r.out);
      for (const text of [r.out, r.log, r.report, r.err]) assert.ok(!text.includes("Client-Name"), "never named");
      const one = moveOn({ marks: NOT_INSTALLED, install: { ranDrops: "b.mov" }, answers: "y\ny\ny\n\n" });
      assert.ok(one.out.includes("holds 1 file or folder that nothing imports now."), one.out);
    });

    it("unreadable: said once, without a stop", () => {
      const r = moveOn({ marks: NOT_INSTALLED, install: { ranUnreadable: true }, answers: "y\ny\ny\n\n" });
      assert.equal(r.status, 0, r.out);
      const line = "The old drop folder, Drop › Sallie's laptop in Dropbox, could not be read, so it was not counted. Jason counts it from the Mac Studio before deleting it.";
      assert.equal(r.out.split(line).length - 1, 1, r.out);
      assert.ok(r.out.trimEnd().endsWith(DONE), r.out);
    });

    it("none once the folder is gone, none on a print, and none on a Mac set up fresh", () => {
      const gone = moveOn({ settingsChange: OWN });
      assert.equal(gone.status, 0, gone.out);
      assert.ok(!gone.out.includes("The old drop folder"), gone.out);
      const printed = moveOn({ marks: NOT_INSTALLED }, "--print");
      assert.ok(!printed.out.includes("The old drop folder"), printed.out);
    });

    it("a stop after the install, with a file in the old folder, says no last lines, and ends 1 at once", () => {
      const r = moveOn({ marks: NOT_INSTALLED, settingsChange: { app: undefined }, install: { ranDrops: "a.mov" }, answers: "y\ny\ny\nn\n" });
      assert.equal(r.status, 1, r.out);
      assert.ok(!r.out.includes("The old drop folder"), r.out);
      assert.ok(r.out.endsWith(STOP_TAIL), r.out);
    });
  });

});
