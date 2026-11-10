// The setup engine's review, setup summary and status (tool/setup/summary.js), on the made-up Mac. The plan is settings.js's own, run
// with the real node; nothing here writes a setting, runs the installer or asks the real launchd.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOf } from "../build.js";
import { dropFolderOf, exportsFolderOf, folderWords } from "../settings.js";
import { eventFault } from "../setup/protocol.js";
import { APPS, claudeState, kindOf } from "../setup/checks.js";
import { planArgs, planOf, reviewSummary, setupSummary, statusSummary, summaryText } from "../setup/summary.js";
import { mac, settingsOf } from "./setup-harness.js";

const INSTALL = readFileSync(fileURLToPath(new URL("../install.sh", import.meta.url)), "utf8");
const HERE = { model: true, cli: false };

/** Runs `check` on a made-up Mac, and takes the Mac away. */
async function withMac(options, check) {
  const m = mac(options);
  try {
    return await check(m);
  } finally {
    m.done();
  }
}
const freshAnswers = (m) => ({ kind: "fresh", machine: "Studio Test", root: m.root, drop: join(m.home, "BRIMM Video Work", "Drop"), exports: join(m.home, "Downloads") });
const heldAnswers = (m) => ({ kind: "held", machine: "Studio Test", root: m.root });
const claudeOf = (m) => claudeState({ home: m.home, tools: m.tools });
/** The review for the Mac `m`, whose plan is settings.js's own. */
function review(m, { answers, printed = { code: 0, text: "Nothing was changed.\n" }, planned, claude = claudeOf(m), here = HERE } = {}) {
  const found = kindOf({ home: m.home, checkout: m.checkout });
  const given = answers ?? (found.kind === "fresh" ? freshAnswers(m) : heldAnswers(m));
  return reviewSummary({ kind: found.kind, moved: found.moved, answers: given, home: m.home, build: buildOf(m.checkout), printed, planned: planned ?? planOf({ answers: given, home: m.home, checkout: m.checkout }), claude, here });
}
const valueOf = (summary, label) => summary.lines.find((line) => line.label === label)?.value;
const labelsOf = (summary) => summary.lines.map((line) => line.label);

describe("the plan's arguments", () => {
  it("name the machine, the root and the checkout, and for a fresh Mac the two folders after them", () => {
    assert.deepEqual(planArgs({ kind: "held", machine: "A", root: "/r" }, { checkout: "/c" }), ["plan", "--machine", "A", "--root", "/r", "--checkout", "/c"]);
    assert.deepEqual(planArgs({ kind: "fresh", machine: "A", root: "/r", drop: "/d", exports: "/e" }, { checkout: "/c" }), ["plan", "--machine", "A", "--root", "/r", "--checkout", "/c", "--drop-folder", "/d", "--exports-folder", "/e"]);
  });

  it("every option the engine gives the plan is one install.sh's settings_plan gives", () => {
    const line = INSTALL.split("\n").find((one) => one.includes('"$HERE/settings.js" plan'));
    assert.ok(line, "settings_plan was not found");
    for (const option of ["--machine", "--root", "--checkout"]) assert.ok(line.includes(`${option} `), option);
    assert.ok(line.includes("${switch_args[@]}"));
    const takes = INSTALL.split("\n").find((one) => one.includes("--drop|--import|--handoff|--drop-folder|--exports-folder"));
    assert.ok(takes, "the options that go into switch_options were not found");
    for (const option of ["--drop-folder", "--exports-folder"]) assert.ok(takes.includes(option), option);
    assert.ok(INSTALL.includes('switch_args+=("${switch_options[@]}")'));
    assert.ok(INSTALL.includes('switch_options+=("$arg" "$1")'));
  });
});

describe("the plan, from settings.js itself", () => {
  it("for a fresh Mac gives code 0, and the settings hold the name and both folders", async () => {
    await withMac({ settings: "none" }, (m) => {
      const planned = planOf({ answers: freshAnswers(m), home: m.home, checkout: m.checkout });
      assert.equal(planned.code, 0);
      assert.equal(planned.settings.machine, "Studio Test");
      assert.equal(dropFolderOf(planned.settings, m.home), join(m.home, "BRIMM Video Work", "Drop"));
      assert.equal(exportsFolderOf(planned.settings, m.home), join(m.home, "Downloads"));
      assert.equal(settingsOf(m.home), null);
    });
  });

  it("for a takeover gives code 0, and the name and both folders are the settings' own", async () => {
    await withMac({ settings: "takeover" }, (m) => {
      const planned = planOf({ answers: heldAnswers(m), home: m.home, checkout: m.checkout });
      assert.equal(planned.code, 0);
      assert.equal(planned.settings.machine, "Studio Test");
      assert.equal(dropFolderOf(planned.settings, m.home), join(m.home, "BRIMM Video Work", "Drop"));
      assert.equal(exportsFolderOf(planned.settings, m.home), join(m.home, "Exports"));
    });
  });

  it("is read from the JSON that comes first, whatever lines follow", () => {
    const run = (program, args, options) => {
      run.seen = { program, args, options };
      return { status: 0, stdout: '{\n  "machine": "Test Mac",\n  "root": "/r"\n}\nThe import will be: light\nThe drop folder will be: /d\nA last plain line\n', stderr: "" };
    };
    const planned = planOf({ answers: { kind: "held", machine: "Test Mac", root: "/r" }, home: "/h", checkout: "/c", node: "/n/node", run });
    assert.deepEqual(planned, { code: 0, settings: { machine: "Test Mac", root: "/r" } });
    assert.equal(run.seen.program, "/n/node");
    assert.deepEqual(run.seen.args, ["/c/tool/settings.js", ...planArgs({ kind: "held", machine: "Test Mac", root: "/r" }, { checkout: "/c" })]);
    assert.equal(run.seen.options.input, "");
    assert.equal(run.seen.options.timeout, 60000);
    assert.equal(run.seen.options.env.HOME, "/h");
  });

  it("gives a code that is never 0, and words, for a refusal, a program that would not start and JSON that does not parse", () => {
    const refused = planOf({ answers: { kind: "held", machine: "A", root: "/r" }, home: "/h", checkout: "/c", run: () => ({ status: 1, stdout: "Not written: the name is taken.\n", stderr: "" }) });
    assert.deepEqual(refused, { code: 1, why: "Not written: the name is taken." });
    const unstarted = planOf({ answers: { kind: "held", machine: "A", root: "/r" }, home: "/h", checkout: "/c", run: () => ({ status: null, error: new Error("spawn ENOENT"), stdout: "", stderr: "" }) });
    assert.notEqual(unstarted.code, 0);
    assert.ok(unstarted.why.length > 0);
    const unread = planOf({ answers: { kind: "held", machine: "A", root: "/r" }, home: "/h", checkout: "/c", run: () => ({ status: 0, stdout: "{ not json\n}\n", stderr: "" }) });
    assert.notEqual(unread.code, 0);
    assert.ok(unread.why.length > 0);
    const silent = planOf({ answers: { kind: "held", machine: "A", root: "/r" }, home: "/h", checkout: "/c", run: () => ({ status: 3, stdout: "", stderr: "" }) });
    assert.equal(silent.code, 3);
    assert.ok(silent.why.length > 0);
  });

  it("refuses a Mac marked as a development Mac, with the plan's own words", async () => {
    await withMac({ settings: "dev" }, (m) => {
      const planned = planOf({ answers: heldAnswers(m), home: m.home, checkout: m.checkout });
      assert.equal(planned.code, 1);
      assert.match(planned.why, /development Mac/);
    });
  });
});

describe("the review", () => {
  it("has the installer's exit code as its ok, and the installer's text as its details", async () => {
    await withMac({ settings: "none" }, (m) => {
      for (const code of [0, 1, 2]) {
        const summary = review(m, { printed: { code, text: `The installer said ${code}.\n` } });
        assert.equal(summary.ok, code === 0);
        assert.equal(summary.exit, code);
        assert.equal(summary.details, `The installer said ${code}.\n`);
        assert.equal(summary.event, "summary");
        assert.equal(summary.id, "review");
      }
    });
  });

  it("has the same lines whatever the installer's text says, and none holds a name from it", async () => {
    await withMac({ settings: "none" }, (m) => {
      const one = review(m, { printed: { code: 0, text: "Nothing was changed.\n" } });
      const other = review(m, { printed: { code: 0, text: "2026-11-01 Client Jane (Old Mac)\nWhatever else it says.\n" } });
      assert.deepEqual(one.lines, other.lines);
      assert.ok(!JSON.stringify(other.lines).includes("Jane"));
    });
  });

  it("names a fresh Mac's name and its three folders in Finder's words", async () => {
    await withMac({ settings: "none" }, (m) => {
      const summary = review(m);
      assert.deepEqual(labelsOf(summary), ["This Mac", "BRIMM Video in Dropbox", "Drop folder", "Exports folder", "BRIMM Video Studio", "Transcription model", "HyperFrames tools", "Claude Code", "Background job"]);
      assert.equal(valueOf(summary, "This Mac"), "Studio Test");
      assert.equal(valueOf(summary, "BRIMM Video in Dropbox"), "Dropbox › The BRIMM DB › BRIMM Video");
      assert.equal(valueOf(summary, "Drop folder"), folderWords(join(m.home, "BRIMM Video Work", "Drop"), m.home));
      assert.equal(valueOf(summary, "Exports folder"), "Downloads, in your home folder");
      assert.equal(valueOf(summary, "BRIMM Video Studio"), "Version 1.4.2 (142)");
      assert.equal(valueOf(summary, "Transcription model"), "Already on this Mac.");
      assert.equal(valueOf(summary, "HyperFrames tools"), "Will be fetched.");
      assert.equal(valueOf(summary, "Background job"), "Watches the drop folder for new videos, and starts when you log in.");
    });
  });

  it("says the model will be downloaded when it is not here", async () => {
    await withMac({ settings: "none" }, (m) => {
      const summary = review(m, { here: { model: false, cli: true } });
      assert.equal(valueOf(summary, "Transcription model"), "Will be downloaded (about 1.6 GB).");
      assert.equal(valueOf(summary, "HyperFrames tools"), "Already on this Mac.");
    });
  });

  it("says a broken build's version cannot be read", async () => {
    await withMac({ settings: "none" }, (m) => {
      const summary = reviewSummary({ ...{ kind: "fresh", answers: freshAnswers(m), home: m.home, printed: { code: 0, text: "" }, planned: planOf({ answers: freshAnswers(m), home: m.home, checkout: m.checkout }), claude: claudeOf(m), here: HERE }, build: { mode: "installed", broken: true, version: "", build: 0 } });
      assert.equal(valueOf(summary, "BRIMM Video Studio"), "This copy's version cannot be read.");
    });
  });

  it("says a takeover moves to this app and keeps its settings", async () => {
    await withMac({ settings: "takeover" }, (m) => {
      const summary = review(m);
      assert.deepEqual(labelsOf(summary), ["This Mac", "BRIMM Video in Dropbox", "Drop folder", "Exports folder", "BRIMM Video Studio", "Transcription model", "HyperFrames tools", "Claude Code", "Background job", "Moving to this app"]);
      assert.equal(valueOf(summary, "Moving to this app"), "This Mac already runs BRIMM Video Studio from an older copy. Installing moves it to this app. Its name, its settings and its drop folder stay as they are.");
      assert.equal(valueOf(summary, "Drop folder"), folderWords(join(m.home, "BRIMM Video Work", "Drop"), m.home));
      assert.equal(valueOf(summary, "Exports folder"), folderWords(join(m.home, "Exports"), m.home));
    });
  });

  it("says an installed Mac whose copy moved is pointed at this one, and a whole one says nothing of moving", async () => {
    await withMac({ settings: "moved" }, (m) => {
      assert.equal(valueOf(review(m), "Moving to this app"), "This Mac was set up from a copy of BRIMM Video Studio that is no longer where it was. Installing points it at this one.");
    });
    await withMac({ settings: "installed" }, (m) => {
      assert.ok(!labelsOf(review(m)).includes("Moving to this app"));
    });
  });

  it("is not ok when the plan refuses, and has the plan's own words first in its details", async () => {
    await withMac({ settings: "none" }, (m) => {
      const planned = { code: 1, why: "Not written: the exports folder is in the drop folder." };
      const summary = review(m, { planned, printed: { code: 0, text: "Nothing was changed.\n" } });
      assert.equal(summary.ok, false);
      assert.equal(summary.exit, 0);
      assert.equal(summary.details, "Not written: the exports folder is in the drop folder.\n\nNothing was changed.\n");
      assert.equal(valueOf(summary, "This Mac"), "Studio Test");
      assert.equal(valueOf(summary, "BRIMM Video in Dropbox"), "Dropbox › The BRIMM DB › BRIMM Video");
      assert.ok(valueOf(summary, "Drop folder"));
      assert.ok(valueOf(summary, "Exports folder"));
    });
  });

  it("has no drop or exports line for a held Mac whose plan refused", async () => {
    await withMac({ settings: "takeover" }, (m) => {
      const summary = review(m, { planned: { code: 1, why: "Not written." } });
      assert.equal(summary.ok, false);
      assert.deepEqual(labelsOf(summary).slice(0, 3), ["This Mac", "BRIMM Video in Dropbox", "BRIMM Video Studio"]);
    });
  });
});

describe("Claude Code's line", () => {
  const states = {
    "signed in": { here: true, where: "/x/claude", version: "2.1.296", enough: true, signedIn: true, plan: "", email: "jane@example.invalid", org: "Example Org", orgName: "Example Org" },
    "signed in on a plan": { here: true, where: "/x/claude", version: "2.1.296", enough: true, signedIn: true, plan: "max", email: "jane@example.invalid", orgName: "Example Org" },
    "not here": { here: false, where: null, version: null, enough: false, signedIn: false, plan: null, email: "jane@example.invalid", orgName: "Example Org" },
    "too old": { here: true, where: "/x/claude", version: "2.0.0", enough: false, signedIn: true, plan: "max", email: "jane@example.invalid", orgName: "Example Org" },
    "not signed in": { here: true, where: "/x/claude", version: "2.1.296", enough: true, signedIn: false, plan: null, email: "jane@example.invalid", orgName: "Example Org" }
  };
  const says = {
    "signed in": "Version 2.1.296, signed in.",
    "signed in on a plan": "Version 2.1.296, signed in, on the max plan.",
    "not here": "Not found on this Mac.",
    "too old": "Version 2.0.0, which is too old for BRIMM Video Studio.",
    "not signed in": "Version 2.1.296, not signed in."
  };

  it("has no Terminal in it, no node, and no email or organisation, in each state, in the review and in the setup summary", async () => {
    await withMac({ settings: "none" }, (m) => {
      for (const [name, claude] of Object.entries(states)) {
        const reviewed = review(m, { claude });
        const done = setupSummary({ kind: "fresh", home: m.home, settings: planOf({ answers: freshAnswers(m), home: m.home, checkout: m.checkout }).settings, build: buildOf(m.checkout), claude, check: { answered: true, line: "Claude answered from here." }, missing: [], old: null });
        for (const summary of [reviewed, done]) {
          assert.equal(valueOf(summary, "Claude Code"), says[name], name);
          const all = JSON.stringify(summary.lines);
          assert.ok(!/jane|example|Terminal|node/i.test(all), name);
        }
      }
    });
  });
});

describe("the setup summary", () => {
  const checked = { answered: true, line: "Claude answered from here. It said hello." };
  async function settled(options, give = () => ({})) {
    return withMac(options, (m) => {
      const found = kindOf({ home: m.home, checkout: m.checkout });
      const settings = found.settings ?? planOf({ answers: freshAnswers(m), home: m.home, checkout: m.checkout }).settings;
      return setupSummary({ kind: found.kind, home: m.home, settings, build: buildOf(m.checkout), claude: claudeOf(m), check: checked, missing: [], old: null, ...give(m) });
    });
  }

  it("has its lines in order, and is ok when Claude answered", async () => {
    const summary = await settled({ settings: "installed" });
    assert.equal(summary.event, "summary");
    assert.equal(summary.id, "setup");
    assert.equal(summary.ok, true);
    assert.equal(summary.details, undefined);
    assert.deepEqual(labelsOf(summary), ["This Mac", "BRIMM Video Studio", "BRIMM Video in Dropbox", "Drop folder", "Exports folder", "Claude Code", "Background job"]);
    assert.equal(valueOf(summary, "Background job"), "Claude answered from the background job.");
  });

  it("is not ok when Claude did not answer, and the check's own line is the details", async () => {
    const summary = await settled({ settings: "installed" }, () => ({ check: { answered: false, line: "Claude could not be asked from here (exit 1)." } }));
    assert.equal(summary.ok, false);
    assert.equal(summary.details, "Claude could not be asked from here (exit 1).");
    assert.equal(valueOf(summary, "Background job"), "Claude did not answer from the background job.");
  });

  it("names what is still to install, with commas between", async () => {
    const summary = await settled({ settings: "installed" }, () => ({ missing: [APPS[0].name, APPS[2].name] }));
    assert.equal(valueOf(summary, "Still to install"), "Claude, Dropbox");
    assert.equal(labelsOf(summary).at(-1), "Still to install");
  });

  it("names the old checkout as no longer used, and never deletes it", async () => {
    const m = mac({ settings: "takeover" });
    try {
      const old = kindOf({ home: m.home, checkout: m.checkout }).settings.checkout;
      assert.ok(existsSync(old));
      const summary = setupSummary({ kind: "takeover", home: m.home, settings: kindOf({ home: m.home, checkout: m.checkout }).settings, build: buildOf(m.checkout), claude: claudeOf(m), check: checked, missing: [], old });
      assert.equal(valueOf(summary, "Older copy"), `${folderWords(old, m.home)} is no longer used, and was left as it is.`);
      assert.equal(labelsOf(summary).at(-1), "Older copy");
      assert.ok(existsSync(old));
      assert.ok(!/\d{4}-\d\d-\d\d/.test(JSON.stringify(summary)));
    } finally {
      m.done();
    }
  });
});

describe("the status", () => {
  const statusOf = (m) => {
    const found = kindOf({ home: m.home, checkout: m.checkout });
    return statusSummary({ found, home: m.home, build: buildOf(m.checkout) });
  };

  it("of a whole Mac needs nothing", async () => {
    await withMac({ settings: "installed" }, (m) => {
      const summary = statusOf(m);
      assert.equal(summary.needs, "nothing");
      assert.equal(summary.ok, true);
      assert.equal(summary.id, "status");
      assert.deepEqual(labelsOf(summary), ["This Mac", "BRIMM Video Studio", "Setup"]);
      assert.equal(valueOf(summary, "Setup"), "BRIMM Video Studio is set up on this Mac.");
      assert.equal(valueOf(summary, "This Mac"), "Studio Test");
    });
  });

  it("of a Mac whose app has moved needs a repair", async () => {
    await withMac({ settings: "moved" }, (m) => {
      const summary = statusOf(m);
      assert.equal(summary.needs, "repair");
      assert.equal(summary.ok, false);
      assert.equal(valueOf(summary, "Setup"), "This Mac was set up from a copy of BRIMM Video Studio that is no longer where it was. Repair points it at this one.");
    });
  });

  it("of a fresh Mac needs setup, and has no name", async () => {
    await withMac({ settings: "none" }, (m) => {
      const summary = statusOf(m);
      assert.equal(summary.needs, "setup");
      assert.equal(summary.ok, false);
      assert.deepEqual(labelsOf(summary), ["BRIMM Video Studio", "Setup"]);
      assert.equal(valueOf(summary, "Setup"), "BRIMM Video Studio is not set up on this Mac yet.");
    });
  });

  it("of a takeover needs setup", async () => {
    await withMac({ settings: "takeover" }, (m) => {
      const summary = statusOf(m);
      assert.equal(summary.needs, "setup");
      assert.equal(valueOf(summary, "Setup"), "This Mac runs BRIMM Video Studio from an older copy. Setup moves it to this app.");
    });
  });
});

describe("the text for Copy setup summary", () => {
  it("is label: value, one to a line, in the summary's order, without the details", () => {
    const summary = { event: "summary", id: "setup", ok: true, lines: [{ label: "This Mac", value: "Studio Test" }, { label: "Drop folder", value: "Drop" }], details: "Secret details\nmore" };
    assert.equal(summaryText(summary), "This Mac: Studio Test\nDrop folder: Drop");
  });
});

describe("every summary", () => {
  it("passes eventFault, and no value holds a line break", async () => {
    const made = [];
    for (const settings of ["none", "takeover", "installed", "moved"]) {
      await withMac({ settings }, (m) => {
        const found = kindOf({ home: m.home, checkout: m.checkout });
        made.push(review(m), review(m, { planned: { code: 1, why: "Not written.\nSecond line." }, printed: { code: 2, text: "a\nb\n" } }));
        made.push(statusSummary({ found, home: m.home, build: buildOf(m.checkout) }));
        if (found.settings) made.push(setupSummary({ kind: found.kind, home: m.home, settings: found.settings, build: buildOf(m.checkout), claude: claudeOf(m), check: { answered: false, line: "Claude could not be asked from here." }, missing: ["Dropbox"], old: found.kind === "takeover" ? found.settings.checkout : null }));
      });
    }
    assert.ok(made.length >= 10);
    for (const summary of made) {
      assert.equal(eventFault(summary), "", JSON.stringify(summary));
      for (const line of summary.lines) assert.ok(!/[\r\n]/.test(line.value) && !/[\r\n]/.test(line.label));
    }
  });
});
