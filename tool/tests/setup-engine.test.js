// The setup engine's whole run (tool/setup/engine.js) on the made-up Mac, as the app's shell sees it: from its arguments to `done` or
// `error`. Every program it reaches is a stand-in, its three stages are stand-ins that download nothing (Decided 37), and the installer
// is the stand-in that writes down what it was given. One test asks the real install.sh what it would do, through printOnly's guard;
// none downloads, or calls npm or the real claude.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { accessFile } from "../access.js";
import { DEV_REFUSAL, defaultDropFolder, downloadsFolder, episodesFolder, folderWords } from "../settings.js";
import { studioFolder } from "../studio.js";
import { DAMAGED, NO_BRIMM_VIDEO, nameClash } from "../setup/checks.js";
import { GUIDE_NAME } from "../setup/guide.js";
import { LABELS } from "../setup/install.js";
import { PARTS, STEPS, eventFault } from "../setup/protocol.js";
import { permissionQuestion } from "../setup/questions.js";
import { summaryText } from "../setup/summary.js";
import { WHOLE } from "./app-copy.js";
import { drive, installCalls, mac, notAMac, printOnly, settingsOf } from "./setup-harness.js";

const INSTALL = readFileSync(fileURLToPath(new URL("../install.sh", import.meta.url)), "utf8");
const ENGINE = fileURLToPath(new URL("../setup/engine.js", import.meta.url));
const SUPPORT = WHOLE.support;

/** The events of every run in this file, a list for each run, checked against the protocol at the end. */
const RUNS = [];

/** Runs `check` on a made-up Mac, and takes the Mac away. */
async function withMac(options, check) {
  const m = mac(options);
  try {
    return await check(m);
  } finally {
    m.done();
  }
}
/** Runs the engine on `m`, keeping its events for the last test. */
async function go(m, options) {
  const result = await drive(m, options);
  RUNS.push(result.events);
  return result;
}
const stepsOf = (events) => events.filter((e) => e.event === "step").map((e) => e.id);
const questionsOf = (events) => events.filter((e) => e.event === "question");
const lastOf = (events) => events[events.length - 1];

describe("the start: the arguments, the kind of Mac and the copy", () => {
  it("a repair on a fresh Mac ends with error no-settings, and nothing ran", async () => {
    for (const run of ["repair", "update"]) {
      await withMac({ settings: "none" }, async (m) => {
        const { code, events } = await go(m, { run });
        assert.equal(code, 1);
        assert.equal(events.length, 1);
        assert.deepEqual(events[0], { event: "error", code: "no-settings", message: "BRIMM Video Studio is not set up on this Mac yet, so there is nothing to repair or update. Set it up first.", contact: SUPPORT });
        assert.equal(m.ran(), "");
        assert.equal(settingsOf(m.home), null);
      });
    }
  });

  it("a dev Mac: every run ends with error dev, and nothing ran", async () => {
    for (const run of ["setup", "repair", "update", "status"]) {
      await withMac({ settings: "dev" }, async (m) => {
        const before = settingsOf(m.home);
        const { code, events } = await go(m, { run });
        assert.equal(code, 1, run);
        assert.deepEqual(events, [{ event: "error", code: "dev", message: DEV_REFUSAL, contact: SUPPORT }], run);
        assert.equal(m.ran(), "", run);
        assert.equal(settingsOf(m.home), before, run);
      });
    }
  });

  it("settings that cannot be read: error settings, with the support contact, and the file is as it was", async () => {
    for (const run of ["setup", "repair", "update", "status"]) {
      await withMac({ settings: "unusable" }, async (m) => {
        const { code, events } = await go(m, { run });
        assert.equal(code, 1, run);
        assert.equal(events.length, 1, run);
        const [error] = events;
        assert.equal(error.event, "error");
        assert.equal(error.code, "settings");
        assert.equal(error.message, "This Mac's BRIMM Video settings cannot be read, so setup stopped and changed nothing.");
        assert.equal(error.contact, SUPPORT);
        assert.equal(typeof error.details, "string");
        assert.equal(m.ran(), "", run);
        assert.equal(settingsOf(m.home), "{", run);
      });
    }
  });

  it("a damaged copy: error damaged with install.sh's own words, before any question", async () => {
    assert.equal(INSTALL.includes(DAMAGED), true);
    for (const [run, settings] of [["setup", "none"], ["setup", "installed"], ["repair", "installed"], ["update", "takeover"]]) {
      await withMac({ settings }, async (m) => {
        rmSync(join(m.tools, "ffmpeg"));
        const { code, events } = await go(m, { run });
        assert.equal(code, 1);
        assert.deepEqual(events, [{ event: "error", code: "damaged", message: DAMAGED, contact: SUPPORT, details: "ffmpeg is missing" }]);
        assert.equal(m.ran(), "");
      });
    }
  });

  it("an error has no contact when this copy names no support", async () => {
    await withMac({ settings: "none" }, async (m) => {
      writeFileSync(join(m.checkout, "build.json"), JSON.stringify({ ...WHOLE, support: "" }));
      const { events } = await go(m, { run: "repair" });
      assert.equal(events.length, 1);
      assert.equal(events[0].code, "no-settings");
      assert.equal("contact" in events[0], false);
    });
  });

  it("status: a summary and done, and nothing ran but the reads", async () => {
    for (const [settings, needs] of [["none", "setup"], ["takeover", "setup"], ["installed", "nothing"], ["moved", "repair"]]) {
      await withMac({ settings }, async (m) => {
        const before = settingsOf(m.home);
        const { code, events } = await go(m, { run: "status" });
        assert.equal(code, 0, settings);
        assert.deepEqual(events.map((e) => e.event), ["summary", "done"], settings);
        const [summary, done] = events;
        assert.equal(summary.id, "status");
        assert.equal(summary.needs, needs, settings);
        assert.deepEqual(done, { event: "done", outcome: "status", summary: summary.lines.map((l) => `${l.label}: ${l.value}`).join("\n"), studio: studioFolder(m.home), guide: null, notes: [] });
        assert.equal(m.ran(), "", settings);
        assert.equal(settingsOf(m.home), before, settings);
      });
    }
  });

  it("a wrong protocol number is error protocol, exit 2", async () => {
    await withMac({}, async (m) => {
      const { code, events } = await go(m, { argv: ["--run", "setup", "--app", m.app, "--tools", m.tools, "--protocol", "2"] });
      assert.equal(code, 2);
      assert.equal(events.length, 1);
      const [error] = events;
      assert.equal(error.code, "protocol");
      assert.equal(error.message, "BRIMM Video Studio's window and its setup did not understand each other.");
      assert.equal(error.advice, "Close BRIMM Video Studio and open it again.");
      assert.equal(error.contact, SUPPORT);
      assert.equal(m.ran(), "");
    });
  });

  it("arguments the engine does not know are error arguments, exit 2", async () => {
    await withMac({}, async (m) => {
      for (const argv of [["--run", "nonsense", "--app", m.app, "--tools", m.tools, "--protocol", "1"], ["--run", "setup"], ["--run", "setup", "--app", m.app, "--tools", `${m.tools}:/x`, "--protocol", "1"]]) {
        const { code, events } = await go(m, { argv });
        assert.equal(code, 2);
        assert.equal(events.length, 1);
        assert.equal(events[0].code, "arguments");
        assert.equal(events[0].message, "BRIMM Video Studio's setup was started in a way it does not know.");
      }
      assert.equal(m.ran(), "");
    });
  });

  it("the engine as a program: bad arguments give one error line on stdout and exit 2", () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "brimm-engine-")));
    try {
      const ran = spawnSync(process.execPath, [ENGINE, "--run", "nonsense"], { env: { HOME: home, PATH: "/usr/bin:/bin" }, input: "", encoding: "utf8", timeout: 20000 });
      assert.equal(ran.status, 2, ran.stderr);
      const lines = ran.stdout.split("\n").filter((line) => line !== "");
      assert.equal(lines.length, 1);
      const error = JSON.parse(lines[0]);
      assert.equal(error.event, "error");
      assert.equal(error.code, "arguments");
      assert.equal(eventFault(error), "");
      RUNS.push([error]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

const EVERY_APP = ["claude-app", "dropbox", "hyperframes"];
/** Has the installer's own check of Claude, in the stand-in, say that Claude answered from the background job. */
const answering = (m, line = "Claude answered from here.") => writeFileSync(join(m.dir, "says", "check-log"), `${line}\n`);
/** Each part's events, in the order the parts first came. */
const partsOf = (events) => {
  const parts = new Map();
  for (const e of events.filter((one) => one.event === "progress")) {
    if (!parts.has(e.part)) parts.set(e.part, []);
    parts.get(e.part).push(e);
  }
  return parts;
};
const lastStates = (events) => Object.fromEntries([...partsOf(events)].map(([part, list]) => [part, list[list.length - 1].state]));
const INSTALL_BODY = ["Setting up this Mac. The download is the longest part: leave this window open."];

describe("a repair and an update", () => {
  for (const [run, outcome, said] of [["repair", "repaired", "BRIMM Video Studio was repaired on this Mac."], ["update", "updated", "BRIMM Video Studio was updated on this Mac."]]) {
    it(`${run}: no question, the parts in order, the Mac's own settings to the installer, and outcome ${outcome}`, async () => {
      await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
        answering(m);
        const { code, events, errors } = await go(m, { run });
        assert.equal(code, 0, JSON.stringify(lastOf(events)));
        assert.deepEqual(questionsOf(events), []);
        const steps = events.filter((e) => e.event === "step");
        assert.deepEqual(steps, [
          { event: "step", id: "install", n: 1, of: 2, title: "Install", body: INSTALL_BODY },
          { event: "step", id: "done", n: 2, of: 2, title: "Done", body: [said] }
        ]);
        assert.deepEqual([...partsOf(events).keys()], PARTS);
        for (const [part, list] of partsOf(events)) for (const e of list) assert.equal(e.label, LABELS[part]);
        assert.deepEqual(lastStates(events), Object.fromEntries(PARTS.map((part) => [part, "done"])));
        assert.deepEqual(installCalls(m.ran()), [["--yes", "--machine", "Studio Test", "--tools", m.tools, "--app", m.app, m.root]]);
        assert.match(m.ran(), /^codesign --verify --deep --strict /m);
        const summary = events[events.length - 2];
        const done = lastOf(events);
        assert.equal(summary.event, "summary");
        assert.equal(summary.id, "setup");
        assert.equal(summary.ok, true);
        assert.equal(summary.lines.find((l) => l.label === "Drop folder").value, folderWords(join(m.home, "BRIMM Video Work", "Drop"), m.home));
        assert.equal(summary.lines.find((l) => l.label === "Exports folder").value, folderWords(join(m.home, "Exports"), m.home));
        assert.equal(done.event, "done");
        assert.equal(done.outcome, outcome);
        assert.equal(done.summary, summaryText(summary));
        assert.equal(done.studio, studioFolder(m.home));
        assert.equal(done.guide.html, join(m.home, "BRIMM Video Work", `${GUIDE_NAME}.html`));
        assert.equal(done.guide.pdf, join(m.home, "BRIMM Video Work", `${GUIDE_NAME}.pdf`));
        assert.equal(existsSync(done.guide.html), true);
        assert.deepEqual(done.notes, run === "update" ? ["Start a new chat in Claude so it reads this version."] : []);
        assert.deepEqual(errors, []);
      });
    });
  }

  it("a repair of a takeover names the older copy, which stays, and the apps still to install", async () => {
    await withMac({ settings: "takeover", apps: ["dropbox"] }, async (m) => {
      answering(m);
      const clone = JSON.parse(settingsOf(m.home)).checkout;
      const { code, events } = await go(m, { run: "repair" });
      assert.equal(code, 0, JSON.stringify(lastOf(events)));
      const done = lastOf(events);
      assert.deepEqual(done.notes, ["Still to install: Claude, HyperFrames.", "The older copy of BRIMM Video Studio on this Mac is no longer used, and was left as it is."]);
      const summary = events[events.length - 2];
      assert.equal(summary.lines.find((l) => l.label === "Older copy").value, `${folderWords(clone, m.home)} is no longer used, and was left as it is.`);
      assert.equal(summary.lines.find((l) => l.label === "Still to install").value, "Claude, HyperFrames");
      assert.equal(existsSync(join(clone, ".git")), true);
      const guide = readFileSync(done.guide.html, "utf8");
      assert.equal(guide.includes("HyperFrames"), true);
    });
  });
});

/** Answers each question by its id from `table`: a value, or a function of the question giving one (undefined gives no answer).
    `first` is asked first, with every event, and a line it gives is sent instead. No id is answered more than 30 times, so that a
    run that asks again and again ends with a cancel rather than never. */
const reply = (table, first = () => undefined) => {
  const times = new Map();
  return (event, input) => {
    const own = first(event, input);
    if (own !== undefined) return own;
    if (event.event !== "question" || !Object.hasOwn(table, event.id)) return undefined;
    times.set(event.id, (times.get(event.id) ?? 0) + 1);
    if (times.get(event.id) > 30) return { cancel: true };
    const given = table[event.id];
    const value = typeof given === "function" ? given(event, input) : given;
    return value === undefined ? undefined : { answer: event.id, value };
  };
};
/** A `first` that cancels when the question `id` is asked. */
const cancelAt = (id) => (event) => (event.event === "question" && event.id === id ? { cancel: true } : undefined);
const FRESH = { welcome: true, name: "Studio Test", apps: "continue", "drop-folder": (q) => q.suggested, "exports-folder": (q) => q.suggested, review: true };
const HELD = { welcome: true, apps: "continue", review: true };
const TITLE = { welcome: "Welcome", name: "This Mac's name", apps: "Apps", dropbox: "BRIMM Video in Dropbox", folders: "Folders", permissions: "Permissions", review: "Review", install: "Install", done: "Done" };
const SIGNED_IN = JSON.stringify({ loggedIn: true, authMethod: "claude.ai", email: "jane@example.invalid", orgName: "Example Org", subscriptionType: "max" });
const LINK = "https://claude.ai/oauth/authorize?code=true";
const withLink = (m) => writeFileSync(join(m.dir, "says", "claude-login"), `Open ${LINK} to sign in.\nPaste the code here if the browser does not open.\n`);
const valueOf = (summary, label) => summary.lines.find((l) => l.label === label)?.value;
/** What the Dropbox step says of Dropbox itself, whatever it found: the spec's step 4. */
const DROPBOX_SAYS = [
  "Make the BRIMM Video folder available offline in Finder, so it opens without a connection.",
  "When you drag a video from Dropbox into your drop folder, hold Option, so Dropbox keeps its copy.",
  "Never export a video into the drop folder: BRIMM Video Studio would take it in as a new video."
];

describe("a setup, step by step", () => {
  it("a fresh Mac: nine steps in order, and the installer gets the answers", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      answering(m);
      writeFileSync(join(m.dir, "says", "scutil"), "Sallie's MacBook\n");
      const { code, events, errors } = await go(m, { run: "setup", answers: reply(FRESH) });
      assert.equal(code, 0, JSON.stringify(lastOf(events)));
      const steps = events.filter((e) => e.event === "step");
      assert.deepEqual(steps.map((s) => [s.id, s.n, s.of, s.title]), STEPS.map((id, i) => [id, i + 1, 9, TITLE[id]]));
      const body = Object.fromEntries(steps.map((s) => [s.id, s.body]));
      assert.deepEqual(body.welcome, [
        "BRIMM Video Studio takes in a video, reads it, and makes it ready to edit in HyperFrames.",
        "Setup puts on this Mac: a transcription model (about 1.6 GB), the HyperFrames tools, and a background job that watches one folder for new videos.",
        "It takes about ten minutes, most of it the download.",
        "Nothing is ever posted, sent or published by BRIMM Video Studio."
      ]);
      assert.deepEqual(body.name, ["Each Mac that runs BRIMM Video Studio has its own name, so its videos can be told apart."]);
      assert.deepEqual(body.apps, ["BRIMM Video Studio works with these apps. Install the ones that are missing, then continue."]);
      assert.deepEqual(body.dropbox, [`BRIMM Video is at ${folderWords(m.root, m.home)}.`, ...DROPBOX_SAYS]);
      assert.deepEqual(body.folders, ["The drop folder is where you put a video for BRIMM Video Studio to take in.", "The exports folder is where HyperFrames saves a finished video, and where BRIMM Video Studio looks for it."]);
      assert.deepEqual(body.permissions, ["BRIMM Video Studio looks in three folders: the drop folder, the Episodes folder in BRIMM Video, and the exports folder.", 'If macOS asks whether "BRIMM Video Studio" may look in a folder, choose Allow.']);
      assert.deepEqual(body.review, ["This is what Install will do. Nothing has been changed yet."]);
      assert.deepEqual(body.install, INSTALL_BODY);
      assert.deepEqual(body.done, ["BRIMM Video Studio is set up on this Mac."]);
      const questions = questionsOf(events);
      assert.deepEqual(questions.map((q) => q.id), ["welcome", "name", "apps", "drop-folder", "exports-folder", "review"]);
      const drop = defaultDropFolder(m.home);
      const exports = downloadsFolder(m.home);
      assert.equal(questions[1].suggested, "Sallie's MacBook");
      assert.deepEqual([questions[3].suggested, questions[3].purpose, questions[3].words], [drop, "drop", folderWords(drop, m.home)]);
      assert.deepEqual([questions[4].suggested, questions[4].purpose], [exports, "exports"]);
      const review = events.find((e) => e.event === "summary" && e.id === "review");
      assert.equal(review.ok, true);
      assert.equal(review.exit, 0);
      assert.equal(events.indexOf(review), events.indexOf(questions[5]) - 1);
      assert.deepEqual([questions[5].kind, questions[5].ok], ["confirm", "Install"]);
      const given = ["--machine", "Studio Test", "--tools", m.tools, "--app", m.app, "--drop-folder", drop, "--exports-folder", exports, m.root];
      assert.deepEqual(installCalls(m.ran()), [["--print", ...given], ["--yes", ...given]]);
      const done = lastOf(events);
      assert.equal(done.outcome, "installed");
      assert.deepEqual(done.notes, []);
      assert.equal(existsSync(done.guide.html), true);
      const summary = events[events.length - 2];
      assert.equal(valueOf(summary, "This Mac"), "Studio Test");
      assert.equal(valueOf(summary, "Drop folder"), folderWords(drop, m.home));
      assert.equal(settingsOf(m.home), null);
      assert.deepEqual(errors, []);
    });
  });

  it("a takeover: nothing is asked of the name or the folders, and the settings' own go to the installer", async () => {
    for (const settings of ["takeover", "installed"]) {
      await withMac({ settings, apps: EVERY_APP }, async (m) => {
        answering(m);
        const { code, events } = await go(m, { run: "setup", answers: reply(HELD) });
        assert.equal(code, 0, JSON.stringify(lastOf(events)));
        const steps = events.filter((e) => e.event === "step");
        assert.deepEqual(steps.map((s) => [s.id, s.n, s.of]), ["welcome", "apps", "permissions", "review", "install", "done"].map((id, i) => [id, i + 1, 6]));
        assert.deepEqual(questionsOf(events).map((q) => q.id), ["welcome", "apps", "review"]);
        const calls = installCalls(m.ran());
        assert.deepEqual(calls, [["--print", "--machine", "Studio Test", "--tools", m.tools, "--app", m.app, m.root], ["--yes", "--machine", "Studio Test", "--tools", m.tools, "--app", m.app, m.root]]);
        for (const call of calls) assert.equal(call.includes("--drop-folder"), false);
        const done = lastOf(events);
        assert.equal(done.outcome, "installed");
        assert.deepEqual(done.notes, settings === "takeover" ? ["The older copy of BRIMM Video Studio on this Mac is no longer used, and was left as it is."] : []);
        const review = events.find((e) => e.event === "summary" && e.id === "review");
        assert.equal(Boolean(valueOf(review, "Moving to this app")), settings === "takeover");
        assert.equal(valueOf(events[events.length - 2], "Exports folder"), folderWords(join(m.home, "Exports"), m.home));
      });
    }
  });

  it("the name's warning is given once, and the same name again is taken", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, name: "Old Mac" }, cancelAt("drop-folder")) });
      const names = questionsOf(events).filter((q) => q.id === "name");
      assert.equal(names.length, 2);
      assert.equal(names[0].warning, undefined);
      assert.equal(names[1].warning, nameClash("Old Mac", m.root));
      assert.equal(names[1].suggested, "Old Mac");
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "dropbox", "folders"]);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("a name that is not one a Mac can have is refused, and asked again with its fault", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      let tries = 0;
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, name: () => (tries++ === 0 ? "A/B" : "Studio Test") }, cancelAt("apps")) });
      const names = questionsOf(events).filter((q) => q.id === "name");
      assert.equal(names.length, 2);
      assert.equal(typeof names[1].fault, "string");
      assert.equal(names[1].suggested, "A/B");
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("a name that clashes only once BRIMM Video is found brings the name step again, once", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const other = join(m.home, "Library", "CloudStorage", "Dropbox-Other", "The BRIMM DB", "BRIMM Video");
      mkdirSync(other, { recursive: true });
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, name: "Old Mac", dropbox: m.root }, cancelAt("drop-folder")) });
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "dropbox", "name", "folders"]);
      const steps = events.filter((e) => e.event === "step");
      assert.deepEqual(steps.map((s) => s.n), [1, 2, 3, 4, 2, 5]);
      assert.deepEqual(steps[3].body, ["More than one BRIMM Video folder is on this Mac. Choose the one to use.", ...DROPBOX_SAYS]);
      const dropbox = questionsOf(events).find((q) => q.id === "dropbox");
      assert.deepEqual(dropbox.options.map((o) => o.value), [m.root, other, "look-again"]);
      const names = questionsOf(events).filter((q) => q.id === "name");
      assert.equal(names.length, 2);
      assert.equal(names[0].warning, undefined);
      assert.equal(names[1].warning, nameClash("Old Mac", m.root));
      assert.equal(names[1].suggested, "Old Mac");
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("with no BRIMM Video in Dropbox the step asks to look again, and goes on once it is there", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, dropbox: false }, async (m) => {
      const root = join(m.home, "Library", "CloudStorage", "Dropbox", "The BRIMM DB", "BRIMM Video");
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, dropbox: () => (mkdirSync(root, { recursive: true }), "look-again") }, cancelAt("drop-folder")) });
      const dropboxes = events.filter((e) => e.event === "step" && e.id === "dropbox");
      assert.deepEqual(dropboxes.map((s) => s.body), [[...NO_BRIMM_VIDEO, ...DROPBOX_SAYS], [`BRIMM Video is at ${folderWords(root, m.home)}.`, ...DROPBOX_SAYS]]);
      assert.deepEqual(questionsOf(events).find((q) => q.id === "dropbox").options.map((o) => o.value), ["look-again"]);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("continue is refused while Claude Code is not signed in, and taken once it is", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, claude: "signed-out" }, async (m) => {
      withLink(m);
      let continued = false;
      const apps = (q) => {
        if (q.apps.find((a) => a.id === "claude-code").here) return "continue";
        if (!continued) return ((continued = true), "continue");
        return "sign-in";
      };
      const signIn = () => (writeFileSync(join(m.dir, "says", "claude-status"), SIGNED_IN), { code: "PASTED-CODE-123" });
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps, "sign-in": signIn }, cancelAt("drop-folder")) });
      const asked = questionsOf(events).filter((q) => q.id === "apps" || q.id === "sign-in");
      assert.deepEqual(asked.map((q) => q.id), ["apps", "apps", "sign-in", "apps"]);
      assert.equal(asked[0].fault, undefined);
      assert.equal(asked[1].fault, "Claude Code is not signed in yet. Choose Sign in.");
      assert.deepEqual(asked[1].apps.find((a) => a.id === "claude-code").action, "sign-in");
      assert.equal(asked[2].link, LINK);
      assert.equal(asked[2].paste, true);
      assert.equal(asked[3].apps.find((a) => a.id === "claude-code").here, true);
      assert.equal(asked[3].fault, undefined);
      assert.equal(readFileSync(join(m.dir, "claude-got"), "utf8"), "PASTED-CODE-123\n");
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "dropbox", "folders"]);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("a refusal of continue stays through the window's check, and goes when the check finds what it asked for", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, claude: "signed-out" }, async (m) => {
      let checks = 0;
      const apps = (q) => {
        if (!q.fault && checks === 0) return "continue";
        checks += 1;
        // Before the third check, Claude Code is signed in, as if in Terminal.
        if (checks === 3) writeFileSync(join(m.dir, "says", "claude-status"), SIGNED_IN);
        return "check";
      };
      const first = (e) => (e.event === "question" && e.id === "apps" && checks === 3 ? { cancel: true } : undefined);
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps }, first) });
      const asked = questionsOf(events).filter((q) => q.id === "apps");
      assert.equal(asked.length, 5);
      const refusal = "Claude Code is not signed in yet. Choose Sign in.";
      assert.deepEqual(asked.map((q) => q.fault), [undefined, refusal, refusal, refusal, undefined]);
      assert.equal(asked[4].apps.find((a) => a.id === "claude-code").here, true);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("a refusal that Continue would still give stays when another row changes", async () => {
    await withMac({ settings: "none", apps: ["claude-app", "hyperframes"], claude: "signed-out" }, async (m) => {
      let checked = false;
      const apps = (q) => {
        if (!q.fault) return "continue";
        // The Dropbox app appears before the check: a row the refusal is not about.
        mkdirSync(join(m.home, "Applications", "Dropbox.app"), { recursive: true });
        checked = true;
        return "check";
      };
      const first = (e) => (e.event === "question" && e.id === "apps" && checked ? { cancel: true } : undefined);
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps }, first) });
      const asked = questionsOf(events).filter((q) => q.id === "apps");
      assert.equal(asked.length, 3);
      assert.equal(asked[1].apps.find((a) => a.id === "dropbox").here, false);
      assert.equal(asked[2].apps.find((a) => a.id === "dropbox").here, true);
      assert.equal(asked[2].fault, "Claude Code is not signed in yet. Choose Sign in.");
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("the apps warning stays through a check, and continue after it goes on", async () => {
    await withMac({ settings: "none", apps: ["dropbox"] }, async (m) => {
      let checked = false;
      const apps = (q) => {
        if (q.warning && !checked) return ((checked = true), "check");
        return "continue";
      };
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps }, cancelAt("drop-folder")) });
      const asked = questionsOf(events).filter((q) => q.id === "apps");
      const warning = "Claude and HyperFrames are not installed yet. You can go on: the Getting Started guide lists what is still to install.";
      assert.deepEqual(asked.map((q) => q.warning), [undefined, warning, warning]);
      assert.deepEqual(asked.map((q) => q.fault), [undefined, undefined, undefined]);
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "dropbox", "folders"]);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  /** Has Claude Code's install at the Apps step fail: a pin, and a download that is not the pinned one. */
  const failingInstall = (m) => {
    writeFileSync(join(m.checkout, "tool", "claude-code.pin.json"), JSON.stringify({ version: "2.1.300", url: "https://example.invalid/claude", sha256: "0".repeat(64) }));
    writeFileSync(join(m.dir, "says", "curl"), `#!/bin/sh\necho ran > "${join(m.dir, "was-run")}"\n`);
  };
  const FAILED_INSTALL = "The copy of Claude Code that was downloaded is not the one BRIMM Video Studio expects. Nothing of it was kept.";

  it("a failed Claude Code install comes back as the apps question's fault, and the run goes on", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, claude: "none" }, async (m) => {
      failingInstall(m);
      const apps = (q) => (q.apps.find((a) => a.id === "claude-code").action && !q.fault ? "install-claude-code" : undefined);
      const first = (e) => (e.event === "question" && e.id === "apps" && e.fault ? { cancel: true } : undefined);
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps }, first) });
      const asked = questionsOf(events).filter((q) => q.id === "apps");
      const rows = asked.map((q) => q.apps.find((a) => a.id === "claude-code"));
      assert.deepEqual(rows[0], { id: "claude-code", name: "Claude Code", here: false, note: "Not installed.", action: "install-claude-code" });
      assert.deepEqual(rows[1], { id: "claude-code", name: "Claude Code", here: false, note: "Downloading Claude Code." });
      const failed = asked[asked.length - 1];
      assert.equal(failed.fault, FAILED_INSTALL);
      assert.deepEqual(failed.apps.find((a) => a.id === "claude-code"), rows[0]);
      assert.equal(existsSync(join(m.dir, "was-run")), false);
      assert.match(m.ran(), /^curl --fail /m);
      const done = lastOf(events);
      assert.equal(done.outcome, "cancelled");
      assert.deepEqual(done.notes, []);
      assert.deepEqual(installCalls(m.ran()), []);
    });
  });

  it("a failed install's sentence stays through a check while the apps are as they were", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, claude: "none" }, async (m) => {
      failingInstall(m);
      let checked = false;
      const apps = (q) => {
        if (!q.apps.find((a) => a.id === "claude-code").action) return undefined;
        if (!q.fault) return "install-claude-code";
        checked = true;
        return "check";
      };
      const first = (e) => (e.event === "question" && e.id === "apps" && checked ? { cancel: true } : undefined);
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps }, first) });
      const faulted = questionsOf(events).filter((q) => q.id === "apps" && q.fault);
      assert.equal(faulted.length, 2);
      assert.deepEqual(faulted.map((q) => q.fault), [FAILED_INSTALL, FAILED_INSTALL]);
      assert.deepEqual(faulted[1].apps, faulted[0].apps);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("a place this Mac refuses is asked about, and a missing one is passed over", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      answering(m);
      const looked = [];
      const look = (place, folder, options) => {
        looked.push([place, folder, options.home]);
        return { drop: { state: "missing", code: "ENOENT" }, episodes: { state: "refused", code: "EPERM" }, downloads: { state: "locked", code: "EACCES" } }[place];
      };
      let asks = 0;
      const { code, events } = await go(m, { run: "setup", look, answers: reply({ ...FRESH, "permission-episodes": () => (asks++ === 0 ? "again" : "skip") }) });
      assert.equal(code, 0, JSON.stringify(lastOf(events)));
      const drop = defaultDropFolder(m.home);
      const exports = downloadsFolder(m.home);
      const episodes = episodesFolder(m.root);
      assert.deepEqual(looked, [["drop", drop, m.home], ["episodes", episodes, m.home], ["episodes", episodes, m.home], ["downloads", exports, m.home]]);
      const permissions = questionsOf(events).filter((q) => q.id.startsWith("permission-"));
      assert.deepEqual(permissions.map((q) => q.id), ["permission-episodes", "permission-episodes"]);
      assert.deepEqual(permissions[0], permissionQuestion("episodes", { folder: episodes, home: m.home }));
      assert.deepEqual(lastOf(events).notes, [
        `BRIMM Video Studio is not yet allowed to look in ${folderWords(episodes, m.home)}. Allow it in System Settings, under Privacy & Security, then Files and Folders.`,
        `BRIMM Video Studio could not look in ${folderWords(exports, m.home)}.`
      ]);
    });
  });

  it("the Permissions step writes no note of its looks: a takeover's note is as it was after a cancel, and a fresh Mac has none", async () => {
    await withMac({ settings: "takeover", apps: EVERY_APP }, async (m) => {
      const note = `${JSON.stringify({ version: 1, places: { drop: { state: "ok", node: "/opt/homebrew/bin/node", okNode: "/opt/homebrew/bin/node" } }, looking: null, told: {} }, null, 2)}\n`;
      mkdirSync(dirname(accessFile(m.home)), { recursive: true });
      writeFileSync(accessFile(m.home), note);
      const { events } = await go(m, { run: "setup", answers: reply(HELD, cancelAt("review")) });
      assert.deepEqual(stepsOf(events), ["welcome", "apps", "permissions", "review"]);
      assert.equal(lastOf(events).outcome, "cancelled");
      assert.equal(readFileSync(accessFile(m.home), "utf8"), note);
    });
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const { events } = await go(m, { run: "setup", answers: reply(FRESH, cancelAt("review")) });
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "dropbox", "folders", "permissions", "review"]);
      assert.deepEqual(questionsOf(events).filter((q) => q.id.startsWith("permission-")), []);
      assert.equal(existsSync(accessFile(m.home)), false);
    });
  });

  it("a review that is not ok offers no Install", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      writeFileSync(join(m.dir, "exits", "installer"), "2");
      writeFileSync(join(m.dir, "says", "installer"), "This drop folder is another Mac's.\nNothing was changed.\n");
      let reviews = 0;
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, review: () => (reviews++ === 0 ? "again" : undefined) }, (e) => (e.event === "question" && e.id === "review" && reviews >= 1 ? { cancel: true } : undefined)) });
      const summaries = events.filter((e) => e.event === "summary" && e.id === "review");
      assert.equal(summaries.length, 2);
      for (const summary of summaries) {
        assert.equal(summary.ok, false);
        assert.equal(summary.exit, 2);
        assert.equal(summary.details.includes("This drop folder is another Mac's."), true);
      }
      const asked = questionsOf(events).filter((q) => q.id === "review");
      for (const q of asked) assert.deepEqual([q.kind, q.options], ["choice", [{ value: "again", label: "Check again" }]]);
      assert.deepEqual(installCalls(m.ran()).map((call) => call[0]), ["--print", "--print"]);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });
});

/** A Claude Code stand-in whose sign-in prints the link, writes its own process number into claude-pid and waits for a line. */
const waitingClaude = (m) => {
  const mine = join(m.home, ".local", "bin", "claude");
  writeFileSync(mine, `#!/bin/sh\ncase "$*" in\n  "auth login") echo "Open ${LINK}"; echo $$ > "${join(m.dir, "claude-pid")}"; read -r line; printf '%s\\n' "$line" > "${join(m.dir, "claude-got")}" ;;\n  "auth status --json") cat "${join(m.dir, "says", "claude-status")}"; exit 1 ;;\n  --version) cat "${join(m.dir, "says", "claude-version")}" ;;\nesac\n`);
  chmodSync(mine, 0o755);
};
/** Whether the process the stand-in wrote into claude-pid has ended, given a moment. */
const claudeGone = async (m) => {
  const pid = Number(readFileSync(join(m.dir, "claude-pid"), "utf8"));
  for (let i = 0; i < 40; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
};
const line = (object) => `${JSON.stringify(object)}\n`;
const CANCELLED = (m, notes = []) => ({ event: "done", outcome: "cancelled", summary: "", studio: studioFolder(m.home), guide: null, notes });

describe("back, cancel, and the answers the engine drops or refuses", () => {
  it("back from the apps returns to the name, with the answer kept as the suggestion", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      let apps = 0;
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps: () => undefined }, (e) => (e.event === "question" && e.id === "apps" ? (apps++ === 0 ? { back: true } : { cancel: true }) : undefined)) });
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "name", "apps"]);
      const names = questionsOf(events).filter((q) => q.id === "name");
      assert.equal(names.length, 2);
      assert.equal(names[1].suggested, "Studio Test");
      assert.deepEqual(lastOf(events), CANCELLED(m));
    });
  });

  it("back from the folders passes over a Dropbox step that asked nothing", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      let drops = 0;
      const first = (e) => (e.event === "question" && e.id === "drop-folder" && drops++ === 0 ? { back: true } : cancelAt("drop-folder")(e));
      const { events } = await go(m, { run: "setup", answers: reply(FRESH, first) });
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "dropbox", "folders", "apps", "dropbox", "folders"]);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("back at the exports folder goes to the step before the folders, and back from the review keeps both folders as suggestions", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const exports = join(m.home, "Exports");
      let exportsAsked = 0;
      let reviews = 0;
      const first = (e) => {
        if (e.event !== "question") return undefined;
        if (e.id === "exports-folder" && exportsAsked++ === 0) return { back: true };
        if (e.id === "review") return reviews++ === 0 ? { back: true } : { cancel: true };
        return undefined;
      };
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, "exports-folder": exports }, first) });
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "dropbox", "folders", "apps", "dropbox", "folders", "permissions", "review", "folders", "permissions", "review"]);
      const drops = questionsOf(events).filter((q) => q.id === "drop-folder");
      const exportsAsk = questionsOf(events).filter((q) => q.id === "exports-folder");
      assert.equal(drops[drops.length - 1].suggested, defaultDropFolder(m.home));
      assert.equal(exportsAsk[exportsAsk.length - 1].suggested, exports);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("back at the first question of the run sends that question again", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      let welcomes = 0;
      const { events } = await go(m, { run: "setup", answers: (e) => (e.event === "question" && e.id === "welcome" ? (welcomes++ === 0 ? { back: true } : { cancel: true }) : undefined) });
      assert.deepEqual(events.map((e) => e.event), ["step", "question", "question", "done"]);
      assert.deepEqual(events[1], events[2]);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
  });

  it("back from a takeover's review passes over permissions that asked nothing, to the apps", async () => {
    await withMac({ settings: "takeover", apps: EVERY_APP }, async (m) => {
      let apps = 0;
      const first = (e) => (e.event === "question" && e.id === "review" ? { back: true } : e.event === "question" && e.id === "apps" && apps++ > 0 ? { cancel: true } : undefined);
      const { events } = await go(m, { run: "setup", answers: reply(HELD, first) });
      assert.deepEqual(stepsOf(events), ["welcome", "apps", "permissions", "review", "apps"]);
      assert.equal(lastOf(events).outcome, "cancelled");
      assert.deepEqual(installCalls(m.ran()).map((call) => call[0]), ["--print"]);
    });
  });

  it("a cancel before Install: done cancelled, and the installer never ran", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const { code, events } = await go(m, { run: "setup", answers: reply(FRESH, cancelAt("apps")) });
      assert.equal(code, 0);
      assert.deepEqual(lastOf(events), CANCELLED(m));
      assert.deepEqual(installCalls(m.ran()), []);
      assert.equal(settingsOf(m.home), null);
    });
  });

  it("stdin closing counts as a cancel", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const { code, events } = await go(m, { run: "setup", answers: reply(FRESH, (e, input) => (e.event === "question" && e.id === "apps" ? (input.end(), null) : undefined)) });
      assert.equal(code, 0);
      assert.deepEqual(lastOf(events), CANCELLED(m));
      assert.deepEqual(installCalls(m.ran()), []);
    });
  });

  it("an input that breaks counts as a cancel, never a crash", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const { code, events, errors } = await go(m, { run: "setup", answers: reply(FRESH, (e, input) => (e.event === "question" && e.id === "name" ? (input.destroy(Object.assign(new Error("gone"), { code: "EPIPE" })), null) : undefined)) });
      assert.equal(code, 0);
      assert.deepEqual(lastOf(events), CANCELLED(m));
      assert.deepEqual(errors, ["The shell's input failed (EPIPE), which counts as a cancel."]);
    });
  });

  it("an answer to a question since replaced is dropped, and an answer to an id never asked is error protocol", async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const stale = (e, input) => (e.event === "question" && e.id === "apps" ? (input.write(line({ answer: "name", value: "Other Mac" })), undefined) : undefined);
      const { events } = await go(m, { run: "setup", answers: reply(FRESH, (e, input) => stale(e, input) ?? cancelAt("drop-folder")(e)) });
      assert.deepEqual(stepsOf(events), ["welcome", "name", "apps", "dropbox", "folders"]);
      assert.equal(lastOf(events).outcome, "cancelled");
    });
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      const { code, events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps: undefined }, (e) => (e.event === "question" && e.id === "apps" ? { answer: "review", value: true } : undefined)) });
      assert.equal(code, 1);
      const error = lastOf(events);
      assert.equal(error.code, "protocol");
      assert.equal(error.message, "BRIMM Video Studio's window and its setup did not understand each other.");
      assert.equal(error.advice, "Close BRIMM Video Studio and open it again.");
      assert.equal(error.contact, SUPPORT);
      assert.equal(error.details, "An answer was to a question that was never asked in this run.");
    });
  });

  it("a line that is no JSON object, or an answer of the wrong shape, is error protocol", async () => {
    for (const [wrong, details] of [["not json", "A line was not a JSON object."], [line({ answer: "name", value: 3 }).trim(), "A text takes a string of one line."], [line({ back: true, cancel: true }).trim(), "A line must hold exactly one of answer, back and cancel."]]) {
      await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
        const { code, events } = await go(m, { run: "setup", answers: reply(FRESH, (e) => (e.event === "question" && e.id === "name" ? wrong : undefined)) });
        assert.equal(code, 1);
        assert.deepEqual([lastOf(events).code, lastOf(events).details], ["protocol", details]);
        assert.deepEqual(installCalls(m.ran()), []);
      });
    }
  });

  it("back from an open sign-in ends claude auth login and brings the apps question again", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, claude: "signed-out" }, async (m) => {
      waitingClaude(m);
      let apps = 0;
      const first = (e) => {
        if (e.event !== "question") return undefined;
        if (e.id === "sign-in") return { back: true };
        if (e.id === "apps") return apps++ === 0 ? { answer: "apps", value: "sign-in" } : { cancel: true };
        return undefined;
      };
      const { events } = await go(m, { run: "setup", answers: reply(FRESH, first) });
      assert.deepEqual(questionsOf(events).map((q) => q.id), ["welcome", "name", "apps", "sign-in", "apps"]);
      const again = questionsOf(events)[4];
      assert.equal(again.fault, undefined);
      assert.equal(again.apps.find((a) => a.id === "claude-code").action, "sign-in");
      assert.equal(await claudeGone(m), true);
      assert.equal(existsSync(join(m.dir, "claude-got")), false);
      assert.deepEqual(lastOf(events), CANCELLED(m));
    });
  });

  it("a cancel while signing in ends claude auth login first, and ends done cancelled", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, claude: "signed-out" }, async (m) => {
      waitingClaude(m);
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps: "sign-in" }, cancelAt("sign-in")) });
      assert.equal(await claudeGone(m), true);
      assert.equal(existsSync(join(m.dir, "claude-got")), false);
      assert.deepEqual(lastOf(events), CANCELLED(m));
    });
  });

  it("a cancel after Claude Code was installed at the Apps step says that it stays", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, claude: "none" }, async (m) => {
      const script = `#!/bin/sh\nif [ "$1" = install ]; then\n  mkdir -p "$HOME/.local/bin"\n  printf '#!/bin/sh\\necho "2.1.300 (Claude Code)"\\n' > "$HOME/.local/bin/claude"\n  chmod 755 "$HOME/.local/bin/claude"\nfi\n`;
      writeFileSync(join(m.dir, "says", "curl"), script);
      writeFileSync(join(m.checkout, "tool", "claude-code.pin.json"), JSON.stringify({ version: "2.1.300", url: "https://example.invalid/claude", sha256: createHash("sha256").update(script).digest("hex") }));
      const apps = (q) => (q.apps.find((a) => a.id === "claude-code").action === "install-claude-code" ? "install-claude-code" : undefined);
      const first = (e) => (e.event === "question" && e.id === "apps" && e.apps.find((a) => a.id === "claude-code").action === "sign-in" ? { cancel: true } : undefined);
      const { events } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps }, first) });
      const notes = ["Downloading Claude Code.", "Installing Claude Code."];
      assert.deepEqual(questionsOf(events).filter((q) => q.id === "apps").map((q) => q.apps.find((a) => a.id === "claude-code").note), ["Not installed.", ...notes, "Not signed in yet."]);
      assert.deepEqual(lastOf(events), CANCELLED(m, ["Claude Code was installed on this Mac during setup, and stays."]));
    });
  });

  it("once Install has started, a back and an answer to an old question are dropped", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      answering(m);
      const first = (e, input) => (e.event === "progress" && e.part === "installer" && e.state === "running" ? (input.write(line({ answer: "review", value: true })), { back: true }) : undefined);
      const { code, events } = await go(m, { run: "setup", answers: reply(HELD, first) });
      assert.equal(code, 0, JSON.stringify(lastOf(events)));
      assert.equal(lastOf(events).outcome, "installed");
    });
  });
});

const STOPPED = () => Object.assign(new Error("This part was stopped."), { code: "stopped" });
/** A model stage of the test's own that says it is running and then waits until its signal is aborted. */
const waitingModel = (seen) => async ({ progress, signal }) => {
  progress({ part: "model", label: LABELS.model, done: 0, total: 100, state: "running" });
  await new Promise((_resolve, reject) => signal.addEventListener("abort", () => ((seen.aborted = true), reject(STOPPED())), { once: true }));
};
const statesOf = (events, part) => (partsOf(events).get(part) ?? []).map((e) => e.state);

describe("the Install's parts, and how each can end", () => {
  it("a cancel while a stage runs stops it, and ends done cancelled", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      const seen = {};
      const first = (e) => (e.event === "progress" && e.part === "model" && e.state === "running" ? { cancel: true } : undefined);
      const { code, events } = await go(m, { run: "repair", stages: { model: waitingModel(seen) }, answers: first });
      assert.equal(code, 0);
      assert.equal(seen.aborted, true);
      const model = partsOf(events).get("model");
      assert.deepEqual(model[model.length - 1], { event: "progress", part: "model", label: LABELS.model, done: 0, total: null, state: "failed", detail: "Stopped, since setup was cancelled." });
      assert.deepEqual([...partsOf(events).keys()], ["programs", "model"]);
      assert.deepEqual(lastOf(events), CANCELLED(m, ["What setup had already put on this Mac stays, and the next run uses it."]));
      assert.deepEqual(installCalls(m.ran()), []);
    });
  });

  it("a cancel sent while the copy's signature is checked is seen before anything is staged", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      const first = (e) => (e.event === "progress" && e.part === "programs" && e.state === "running" ? { cancel: true } : undefined);
      const { code, events } = await go(m, { run: "repair", answers: first });
      assert.equal(code, 0);
      assert.deepEqual([...partsOf(events).keys()], ["programs"]);
      assert.deepEqual(statesOf(events, "programs"), ["running", "done"]);
      assert.deepEqual(lastOf(events), CANCELLED(m));
      assert.deepEqual(installCalls(m.ran()), []);
    });
  });

  it("a cancel while the installer runs is answered after it ends", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      answering(m);
      const hold = join(m.dir, "hold");
      const review = () => (writeFileSync(hold, ""), true);
      const first = (e) => (e.event === "progress" && e.part === "installer" && e.state === "running" ? (setTimeout(() => rmSync(hold, { force: true }), 300), { cancel: true }) : undefined);
      const { code, events } = await go(m, { run: "setup", answers: reply({ ...HELD, review }, first) });
      assert.equal(code, 0, JSON.stringify(lastOf(events)));
      assert.equal(lastOf(events).outcome, "installed");
      assert.deepEqual(statesOf(events, "installer"), ["running", "done"]);
      assert.deepEqual(installCalls(m.ran()).map((call) => call[0]), ["--print", "--yes"]);
    });
  });

  it("a line that cannot be taken while the installer runs is dropped, with a line on stderr, and a good install ends done", async () => {
    for (const bad of ["not json", { answer: "never-asked", value: true }, { back: true, cancel: true }]) {
      await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
        answering(m);
        const hold = join(m.dir, "hold");
        const review = () => (writeFileSync(hold, ""), true);
        const first = (e) => (e.event === "progress" && e.part === "installer" && e.state === "running" ? (setTimeout(() => rmSync(hold, { force: true }), 300), bad) : undefined);
        const { code, events, errors } = await go(m, { run: "setup", answers: reply({ ...HELD, review }, first) });
        assert.equal(code, 0, JSON.stringify(lastOf(events)));
        assert.deepEqual([lastOf(events).event, lastOf(events).outcome], ["done", "installed"]);
        assert.equal(events[events.length - 2].ok, true);
        assert.deepEqual(statesOf(events, "installer"), ["running", "done"]);
        assert.deepEqual(statesOf(events, "claude"), ["running", "done"]);
        assert.deepEqual(installCalls(m.ran()).map((call) => call[0]), ["--print", "--yes"]);
        assert.equal(errors.length, 1, JSON.stringify(bad));
        assert.match(errors[0], /^A line from the shell could not be taken while the installer ran, so it was dropped: /);
        assert.equal(errors[0].includes("never-asked"), false);
      });
    }
  });

  it("a failed download ends with error download, and the installer never ran", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      const said = "The transcription model could not be downloaded (curl 22). Check this Mac's internet connection, then choose Repair.";
      const model = async ({ progress }) => {
        progress({ part: "model", label: LABELS.model, done: 0, total: 100, state: "running" });
        throw Object.assign(new Error(said), { code: "download" });
      };
      const { code, events } = await go(m, { run: "setup", stages: { model }, answers: reply(HELD) });
      assert.equal(code, 1);
      assert.deepEqual(lastOf(events), { event: "error", code: "download", message: said, advice: "Check this Mac's internet connection, then open BRIMM Video Studio and choose Repair.", contact: SUPPORT });
      assert.deepEqual(statesOf(events, "model"), ["running", "failed"]);
      assert.equal(partsOf(events).has("installer"), false);
      assert.deepEqual(installCalls(m.ran()).map((call) => call[0]), ["--print"]);
    });
  });

  it("a download that could not be saved ends with error download, and its own advice of making room", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      const said = "The transcription model could not be saved on this Mac (curl 23): its disk may be full. Make room on it, then choose Repair.";
      const advice = "Make room on this Mac's disk, then open BRIMM Video Studio and choose Repair.";
      const model = async ({ progress }) => {
        progress({ part: "model", label: LABELS.model, done: 0, total: 100, state: "running" });
        throw Object.assign(new Error(said), { code: "download", advice });
      };
      const { code, events } = await go(m, { run: "repair", stages: { model } });
      assert.equal(code, 1);
      assert.deepEqual(lastOf(events), { event: "error", code: "download", message: said, advice, contact: SUPPORT });
    });
  });

  it("the installer's exit 1 ends with error install and its text in details", async () => {
    for (const [exit, message] of [["1", "BRIMM Video Studio could not be set up on this Mac."], ["2", "Setup was refused, and nothing was changed."]]) {
      await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
        writeFileSync(join(m.dir, "says", "installer"), "The background job could not be loaded.\n");
        const review = () => (writeFileSync(join(m.dir, "exits", "installer"), exit), true);
        const { code, events } = await go(m, { run: "setup", answers: reply({ ...HELD, review }) });
        assert.equal(code, 1);
        assert.deepEqual(lastOf(events), { event: "error", code: "install", message, advice: "Open BRIMM Video Studio and choose Repair.", contact: SUPPORT, details: "The background job could not be loaded.\n" });
        assert.deepEqual(statesOf(events, "installer"), ["running", "failed"]);
        assert.equal(partsOf(events).has("claude"), false);
      });
    }
  });

  it("a Mac at work is waited for, and after five tries the run ends with error busy", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      const busy = "The import is at work: its background job, com.thebrimm.unedited, is running (process 42).";
      const { code, events } = await go(m, { run: "repair", why: () => busy });
      assert.equal(code, 1);
      const error = lastOf(events);
      assert.deepEqual([error.code, error.message], ["busy", "BRIMM Video Studio is at work on this Mac, so setup cannot finish yet. Wait until it is done, then choose Repair."]);
      assert.deepEqual(statesOf(events, "installer"), ["running", "waiting", "waiting", "waiting", "waiting", "waiting", "failed"]);
      assert.equal(partsOf(events).get("installer")[1].detail, busy);
      assert.deepEqual(installCalls(m.ran()), []);
    });
  });

  it("a Mac at work at first: the bar waits, and runs again once nothing is at work", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      answering(m);
      let asked = 0;
      const why = () => (asked++ < 2 ? "An import is at work: it holds its lock (process 42)." : "");
      const { code, events } = await go(m, { run: "repair", why });
      assert.equal(code, 0, JSON.stringify(lastOf(events)));
      assert.deepEqual(statesOf(events, "installer"), ["running", "waiting", "waiting", "running", "done"]);
      assert.equal(installCalls(m.ran()).length, 1);
    });
  });

  it("Claude that did not answer from the background job: the part fails, the run is still done, and a note says so", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      answering(m, "Claude could not be asked from here: no answer.");
      const { code, events } = await go(m, { run: "repair" });
      assert.equal(code, 0);
      assert.deepEqual(statesOf(events, "claude"), ["running", "failed"]);
      const summary = events[events.length - 2];
      assert.deepEqual([summary.id, summary.ok, summary.details], ["setup", false, "Claude could not be asked from here: no answer."]);
      const done = lastOf(events);
      assert.equal(done.outcome, "repaired");
      assert.deepEqual(done.notes, ["Claude did not answer from the background job. Open BRIMM Video Studio and choose Repair."]);
    });
  });

  it("a repair after a good check: install.sh's new check log is read whole, though the old one was as long", async () => {
    const said = [
      ["Claude answered from here.", "done", true, []],
      ["Claude could not be asked from here: nope", "failed", false, ["Claude did not answer from the background job. Open BRIMM Video Studio and choose Repair."]]
    ];
    for (const [line, state, ok, notes] of said) {
      await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
        const log = join(m.home, "Library", "Logs", "brimm-video-claude-check.log");
        mkdirSync(dirname(log), { recursive: true });
        writeFileSync(log, "Claude answered from here.\n");
        writeFileSync(join(m.dir, "says", "check-log-new"), `${line}\n`);
        const { code, events } = await go(m, { run: "repair" });
        assert.equal(code, 0, JSON.stringify(lastOf(events)));
        assert.equal(readFileSync(log, "utf8"), `${line}\n`);
        assert.deepEqual(statesOf(events, "claude"), ["running", state], line);
        const summary = events[events.length - 2];
        assert.deepEqual([summary.id, summary.ok], ["setup", ok], line);
        if (!ok) assert.equal(summary.details, line);
        assert.deepEqual(lastOf(events).notes, notes, line);
      });
    }
  });

  it("a signature that does not verify at Install ends with error damaged, and nothing is staged", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      writeFileSync(join(m.dir, "exits", "codesign"), "1");
      const { code, events } = await go(m, { run: "repair" });
      assert.equal(code, 1);
      assert.deepEqual(lastOf(events), { event: "error", code: "damaged", message: DAMAGED, contact: SUPPORT, details: "the signature does not verify" });
      assert.deepEqual([...partsOf(events).keys()], ["programs"]);
      assert.deepEqual(statesOf(events, "programs"), ["running", "failed"]);
    });
  });

  it("an error event that cannot be made still ends the run with one last line, a fixed error engine", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      const model = async ({ progress }) => {
        progress({ part: "model", label: LABELS.model, done: 0, total: null, state: "running" });
        throw Object.assign(new Error(""), { code: "download" });
      };
      const { code, events, errors } = await go(m, { run: "repair", stages: { model } });
      assert.equal(code, 1);
      assert.deepEqual(lastOf(events), { event: "error", code: "engine", message: "BRIMM Video Studio's setup stopped on a fault of its own.", advice: "Open BRIMM Video Studio and choose Repair." });
      assert.equal(events.filter((e) => e.event === "error" || e.event === "done").length, 1);
      assert.ok(errors.some((line) => line.includes("The engine made a faulty event.")), errors.join("\n"));
    });
  });

  it("a fault the engine did not expect ends with error engine, with its stack on stderr only", async () => {
    await withMac({ settings: "installed", apps: EVERY_APP }, async (m) => {
      const model = async ({ progress }) => {
        progress({ part: "model", label: LABELS.model, done: 0, total: null, state: "running" });
        throw Object.assign(new TypeError("the stage tripped over secret-words"), { code: "ERR_TEST" });
      };
      const { code, events, errors } = await go(m, { run: "repair", stages: { model } });
      assert.equal(code, 1);
      assert.deepEqual(lastOf(events), { event: "error", code: "engine", message: "BRIMM Video Studio's setup stopped on a fault of its own.", advice: "Open BRIMM Video Studio and choose Repair.", contact: SUPPORT, details: "TypeError, code ERR_TEST" });
      assert.deepEqual(statesOf(events, "model"), ["running", "failed"]);
      assert.equal(JSON.stringify(events).includes("secret-words"), false);
      assert.equal(errors[0], "TypeError: the stage tripped over secret-words");
      assert.ok(errors.some((one) => /^\s+at /.test(one)));
    });
  });
});

describe("what a whole run never says", () => {
  it("no event of a whole run holds an episode folder's name", async () => {
    for (const [settings, table] of [["none", FRESH], ["takeover", HELD]]) {
      await withMac({ settings, apps: EVERY_APP }, async (m) => {
        answering(m);
        assert.equal(existsSync(join(m.root, "Episodes", "2026-11-01 Client Jane (Old Mac)")), true);
        const { code, events, errors } = await go(m, { run: "setup", answers: reply(table) });
        assert.equal(code, 0, JSON.stringify(lastOf(events)));
        const said = [JSON.stringify(events), errors.join("\n"), readFileSync(lastOf(events).guide.html, "utf8")].join("\n");
        assert.equal(said.includes("Client Jane"), false, settings);
      });
    }
  });

  it("nor does the review of the real install.sh, asked only what it would do", { skip: notAMac }, async () => {
    await withMac({ settings: "none", apps: EVERY_APP }, async (m) => {
      m.programs.installer = printOnly(m);
      const { events } = await go(m, { run: "setup", answers: reply(FRESH, cancelAt("review")) });
      const review = events.find((e) => e.event === "summary" && e.id === "review");
      assert.equal(review.exit, 0, review.details);
      assert.equal(review.ok, true);
      assert.equal(JSON.stringify(events).includes("Client Jane"), false);
      assert.equal(lastOf(events).outcome, "cancelled");
      assert.equal(m.ran().includes("refused"), false);
      assert.equal(settingsOf(m.home), null);
    });
  });

  it("no event and no stderr of a whole run holds the pasted code, the email or the organisation", async () => {
    await withMac({ settings: "none", apps: EVERY_APP, claude: "signed-out" }, async (m) => {
      answering(m);
      withLink(m);
      const apps = (q) => (q.apps.find((a) => a.id === "claude-code").here ? "continue" : "sign-in");
      const signIn = () => (writeFileSync(join(m.dir, "says", "claude-status"), SIGNED_IN), { code: "PASTED-CODE-123" });
      const { code, events, errors } = await go(m, { run: "setup", answers: reply({ ...FRESH, apps, "sign-in": signIn }) });
      assert.equal(code, 0, JSON.stringify(lastOf(events)));
      assert.equal(readFileSync(join(m.dir, "claude-got"), "utf8"), "PASTED-CODE-123\n");
      const said = [JSON.stringify(events), errors.join("\n"), readFileSync(lastOf(events).guide.html, "utf8"), m.ran()].join("\n");
      for (const secret of ["PASTED-CODE-123", "jane@example.invalid", "Example Org"]) assert.equal(said.includes(secret), false, secret);
      assert.equal(valueOf(events[events.length - 2], "Claude Code"), "Version 2.1.296, signed in, on the max plan.");
    });
  });

  it("every event of every run above passes eventFault, and each run ends with one done or one error", () => {
    assert.ok(RUNS.length > 40);
    for (const events of RUNS) {
      for (const event of events) assert.equal(eventFault(event), "", JSON.stringify(event));
      const ends = events.filter((e) => e.event === "done" || e.event === "error");
      assert.equal(ends.length, 1, JSON.stringify(events.map((e) => e.event)));
      assert.equal(lastOf(events), ends[0]);
    }
  });
});
