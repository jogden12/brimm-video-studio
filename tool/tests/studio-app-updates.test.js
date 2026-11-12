// Every decision of a check for updates, from tool/studio-app/Sources/Updates.swift, asked through studio-check (Phase 7, Task 9).
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { CANNOT_TELL } from "../busy.js";
import { check, checkerPath, noChecker } from "./studio-app-check.js";

const APP = "/Applications/BRIMM Video Studio.app";
const NODE = `${APP}/Contents/Resources/node/bin/node`;
const BUSY = `${APP}/Contents/Resources/Studio/tool/busy.js`;

/** studio-check's answer to `command` with `args`, which must have ended with 0. */
function ask(command, args = [], options) {
  const ran = check(command, args, options);
  assert.equal(ran.status, 0, `studio-check ${command} ${args.join(" ")} ended with ${ran.status}: ${ran.stderr}`);
  return ran.json;
}

/** gate-next's answer to one busy.js status and its stdout. */
const gate = (status, out, idleBefore) => ask("gate-next", [String(status), idleBefore ? "yes" : "no"], { input: out });

/** The gate's answers to a run of busy.js answers, each [status, out], with idle-before kept as the app keeps it: an answer is idle
 * before the next one only when its status was 0. */
function walk(answers) {
  let idleBefore = false;
  return answers.map(([status, out]) => {
    const said = gate(status, out, idleBefore);
    idleBefore = status === 0;
    return said;
  });
}

/** may-check's answer: the screen, the quit rule, the failure's code or -, whether the build is a stand-in, and the phase. */
const may = (screen, quit, failure = "-", fake = "no", phase = "none") => ask("may-check", [screen, quit, failure, fake, phase]);

const SCREENS = ["checking", "move", "refused", "setup", "repairing", "updating", "twoCopies", "status", "removed", "updates"];
const PHASES = ["none", "waiting", "offered", "unpacked", "holding", "installing"];

// The first test may wait for the compile, which has its own 180-second limit.
before(() => {
  if (!noChecker) checkerPath();
}, { timeout: 200000 });

describe("the gate before the update's window", { skip: noChecker }, () => {
  it("the gate goes only after two idle answers in a row", () => {
    assert.deepEqual(walk([[0, ""], [0, ""]]), ["again", "go"]);
    assert.deepEqual(walk([[0, ""], [1, "A video is being read.\n"], [0, ""], [0, ""]]), [
      "again",
      { wait: "A video is being read." },
      "again",
      "go"
    ]);
    assert.deepEqual(gate(1, "  The job com.thebrimm.unedited is at work (process 42).\nmore\n", true), {
      wait: "The job com.thebrimm.unedited is at work (process 42)."
    });
    assert.deepEqual(gate(1, "", false), { wait: "Something is at work on this Mac." });
    assert.deepEqual(gate(1, "\n  \n", true), { wait: "Something is at work on this Mac." });
    assert.equal(gate(1, `${CANNOT_TELL}\n`, true), "cannotTell");
    assert.equal(gate(2, "", true), "cannotTell");
    assert.equal(gate(127, "A video is being read.\n", false), "cannotTell");
  });

  it("the cannot-tell line is busy.js's own", () => {
    assert.equal(ask("names").busyCannotTell, CANNOT_TELL);
  });
});

describe("a quit while a check is under way", { skip: noChecker }, () => {
  it("once the update's window has the check, a quit waits for idle", () => {
    const quits = Object.fromEntries(PHASES.map((phase) => [phase, ask("update-quit", [phase])]));
    assert.deepEqual(quits, { none: "now", waiting: "end", offered: "hold", unpacked: "hold", holding: "hold", installing: "now" });
  });
});

describe("where Check for Updates may be chosen", { skip: noChecker }, () => {
  it("where Check for Updates may be chosen", () => {
    assert.equal(may("status", "now"), true);

    // The setup screen at a question, and not once the installer runs or when the run has ended.
    assert.equal(may("setup", "cancel"), true);
    assert.equal(may("setup", "wait"), false);
    assert.equal(may("setup", "now"), false);

    // The updating and repairing screens only once their run has failed.
    for (const screen of ["updating", "repairing"]) {
      assert.equal(may(screen, "now", "install"), true, screen);
      assert.equal(may(screen, "now"), false, screen);
      assert.equal(may(screen, "cancel"), false, screen);
      assert.equal(may(screen, "wait"), false, screen);
      assert.equal(may(screen, "cancel", "install"), false, screen);
    }

    // The refused screen, but for the development Mac and a colon in the app's path.
    assert.equal(may("refused", "now", "translocated"), true);
    assert.equal(may("refused", "now"), true);
    assert.equal(may("refused", "now", "dev"), false);
    assert.equal(may("refused", "now", "colon"), false);

    // No other screen, in any state.
    for (const screen of ["checking", "move", "twoCopies", "removed", "updates"]) {
      for (const quit of ["now", "cancel", "wait"]) {
        assert.equal(may(screen, quit), false, `${screen} ${quit}`);
        assert.equal(may(screen, quit, "install"), false, `${screen} ${quit} install`);
      }
    }

    // Never in a stand-in build, and never while a check is under way.
    assert.equal(may("status", "now", "-", "yes"), false);
    assert.equal(may("setup", "cancel", "-", "yes"), false);
    assert.equal(may("refused", "now", "translocated", "yes"), false);
    for (const phase of PHASES.filter((phase) => phase !== "none")) {
      assert.equal(may("status", "now", "-", "no", phase), false, phase);
      assert.equal(may("setup", "cancel", "-", "no", phase), false, phase);
      assert.equal(may("updating", "now", "install", "no", phase), false, phase);
    }
  });

  it("a link that arrives on a screen that passes by itself is kept", () => {
    const kept = SCREENS.filter((screen) => ask("keeps-ask", [screen]));
    assert.deepEqual(kept, ["checking", "repairing", "updating"]);
  });
});

describe("the marker's times", { skip: noChecker }, () => {
  const due = (now, lastMarked, began, limited) => ask("mark-due", [String(now), String(lastMarked), String(began), limited ? "yes" : "no"]);

  it("the marker is written every thirty seconds, and for half an hour where it is limited", () => {
    assert.equal(due(1029.9, 1000, 1000, true), false);
    assert.equal(due(1030, 1000, 1000, true), true);
    assert.equal(due(1100, 1000, 1000, false), true);
    assert.equal(due(2799.5, 2760, 1000, true), true);
    assert.equal(due(2800, 2760, 1000, true), false);
    assert.equal(due(2800, 2760, 1000, false), true);
    assert.equal(due(9000, 8990, 1000, false), false);
  });

  it("waiting gives up after half an hour", () => {
    assert.equal(ask("waited-too-long", ["2799.5", "1000"]), false);
    assert.equal(ask("waited-too-long", ["2800", "1000"]), true);
    assert.equal(ask("waited-too-long", ["5000", "1000"]), true);
  });
});

describe("the channels and the commands", { skip: noChecker }, () => {
  it("a beta build allows the beta channel, and any other allows none", () => {
    const channels = (text) => ask("channels", [], { input: text });
    assert.deepEqual(channels('{"channel":"beta","version":"1.0.0-beta.2"}'), ["beta"]);
    assert.deepEqual(channels('{"channel":"stable"}'), []);
    assert.deepEqual(channels('{"channel":"Beta"}'), []);
    assert.deepEqual(channels('{"channel":" beta"}'), []);
    assert.deepEqual(channels('{"channel":["beta"]}'), []);
    assert.deepEqual(channels("{}"), []);
    assert.deepEqual(channels('["beta"]'), []);
    assert.deepEqual(channels("not JSON"), []);
    assert.deepEqual(channels(""), []);
  });

  it("the two commands are busy.js's, from the bundle's own node", () => {
    assert.deepEqual(ask("updating-commands", [APP]), {
      begin: { program: NODE, arguments: [BUSY, "updating", "begin"] },
      end: { program: NODE, arguments: [BUSY, "updating", "end", "--look"] }
    });
    assert.equal(ask("updating-commands", ["/Volumes/a:b/BRIMM Video Studio.app"]), null);
    assert.equal(ask("updating-commands", ["Applications/BRIMM Video Studio.app"]), null);
  });
});

describe("the sentences", { skip: noChecker }, () => {
  it("the sentences are the plan's", () => {
    const names = ask("names");
    const expected = {
      busyCannotTell: "Whether anything is at work on this Mac could not be told.",
      updatesHeading: "Check for Updates",
      updatesWaiting:
        "BRIMM Video Studio looks for a newer version once nothing is at work on this Mac. New videos wait in the drop folder until then.",
      updatesOffered: "The check for updates is in its own window.",
      updatesUnpacked: "The update is ready. It is installed when BRIMM Video Studio closes, or when you choose Install now.",
      updatesHolding: "The update is installed once nothing is at work on this Mac.",
      updatesCannotTell: "BRIMM Video Studio could not tell whether it is at work, so it did not look for an update.",
      updatesWaitedTooLong:
        "BRIMM Video Studio waited half an hour for the work on this Mac to end, so it did not look for an update. Choose Check for Updates… again later.",
      updatesCannotStart: "BRIMM Video Studio could not look for updates. Open it again and choose Check for Updates… once more.",
      updatesStandIn: "This build's setup is a stand-in, so it does not look for updates.",
      updatesNotNow: "Not now",
      updatesShowWindow: "Show the update window",
      updatesInstallNow: "Install now",
      updateMarkEvery: 30,
      updateMarkLimit: 1800
    };
    for (const [name, value] of Object.entries(expected)) assert.equal(names[name], value, name);
  });
});
