// The setup engine's questions, and the reading of each answer (tool/setup/questions.js), on the made-up Mac.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lookerOf } from "../access.js";
import { defaultDropFolder, downloadsFolder, folderWords } from "../settings.js";
import { APPS, GUARD_CLAUDE, NO_BRIMM_VIDEO, appsHere, claudeState } from "../setup/checks.js";
import { answerFault, eventFault } from "../setup/protocol.js";
import { appsQuestion, folderQuestion, nameQuestion, permissionQuestion, read, reviewQuestion, rootQuestion, sentence, signInQuestion, welcomeQuestion } from "../setup/questions.js";
import { mac } from "./setup-harness.js";

const withMac = (options, check) => {
  const m = mac(options);
  try {
    return check(m);
  } finally {
    m.done();
  }
};

/** Every string a question or a reading gave, for the test that no line says node or Terminal. */
const SEEN = [];
const strings = (x) => (typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === "object" ? Object.entries(x).filter(([k]) => !["value", "suggested", "words", "link", "id", "kind", "event"].includes(k)).flatMap(([, v]) => strings(v)) : []);
const seen = (x) => {
  SEEN.push(...strings(x));
  return x;
};
const PIN = { version: "2.1.296", url: "https://example.invalid/claude", sha256: "ab".repeat(32) };
const state = (m) => ({ here: appsHere({ home: m.home, system: join(m.dir, "none") }), claude: claudeState({ home: m.home, tools: join(m.dir, "none") }) });
const row = (q, id) => q.apps.find((a) => a.id === id);

describe("the welcome and the name", () => {
  it("the welcome is a confirm whose button says Continue", () => {
    const q = seen(welcomeQuestion());
    assert.deepEqual(q, { event: "question", id: "welcome", kind: "confirm", prompt: "Set up BRIMM Video Studio on this Mac?", ok: "Continue" });
    assert.equal(eventFault(q), "");
    assert.deepEqual(read(q, true, {}), { value: true });
  });

  it("a name that machineFault refuses is a fault, in its own words as a sentence", () => {
    const q = seen(nameQuestion({ suggested: "Studio" }));
    assert.equal(q.prompt, "What should this Mac be called?");
    assert.deepEqual(seen(read(q, "", {})), { fault: "A Mac's name cannot be empty." });
    assert.deepEqual(seen(read(q, "x".repeat(41), {})), { fault: "A Mac's name can be 40 characters long at most." });
    assert.deepEqual(read(q, "  Studio  ", {}), { value: "Studio" });
  });

  it("a name another Mac uses is taken with a warning, and without one when no BRIMM Video is known yet", () => {
    withMac({}, (m) => {
      const q = nameQuestion({ suggested: "Studio" });
      const got = seen(read(q, "old mac", { root: m.root }));
      assert.equal(got.value, "old mac");
      assert.match(got.warning, /Another Mac already uses the name "old mac"/);
      assert.deepEqual(read(q, "old mac", {}), { value: "old mac" });
      assert.deepEqual(read(q, "New Mac", { root: m.root }), { value: "New Mac" });
    });
  });

  it("a question has its warning and fault only when given and not empty", () => {
    assert.equal("warning" in nameQuestion({ suggested: "a", warning: "", fault: "" }), false);
    assert.equal("fault" in nameQuestion({ suggested: "a", warning: "w", fault: "" }), false);
    const q = nameQuestion({ suggested: "a", warning: "w", fault: "f" });
    assert.equal(q.warning, "w");
    assert.equal(q.fault, "f");
  });
});

describe("the apps question", () => {
  it("gives a link for each app that has one, and here as appsHere says", () => {
    withMac({ apps: ["dropbox"] }, (m) => {
      const q = seen(appsQuestion(state(m), { pin: PIN }));
      assert.equal(eventFault(q), "");
      assert.deepEqual(q.apps.map((a) => a.id), APPS.map((a) => a.id));
      for (const app of APPS) {
        const r = row(q, app.id);
        assert.equal(r.name, app.name);
        assert.equal(r.link, app.link);
      }
      assert.equal(row(q, "dropbox").here, true);
      assert.equal(row(q, "claude-app").here, false);
      assert.equal(row(q, "dropbox").note, undefined);
      assert.match(row(q, "claude-app").note, /administrator's password/);
      assert.match(row(q, "hyperframes").note, /sign in to HeyGen/);
      assert.match(row(q, "hyperframes").note, /administrator's password/);
    });
    withMac({ apps: ["hyperframes"] }, (m) => {
      const r = row(appsQuestion(state(m), { pin: PIN }), "hyperframes");
      assert.equal(r.note, "HyperFrames asks you to sign in to HeyGen the first time it opens.");
    });
  });

  for (const [claude, here, note, action, noPinAction] of [
    ["none", false, "Not installed.", "install-claude-code", undefined],
    ["old", false, `Version 2.0.0 is too old: BRIMM Video Studio needs ${GUARD_CLAUDE} or later.`, "install-claude-code", undefined],
    ["signed-out", false, "Not signed in yet.", "sign-in", "sign-in"],
    ["signed-in", true, undefined, undefined, undefined]
  ]) {
    it(`Claude Code's row, ${claude}: install only with a whole pin, sign in only when it is here and new enough`, () => {
      withMac({ claude }, (m) => {
        const s = { here: appsHere({ home: m.home, system: join(m.dir, "none") }), claude: claudeState({ home: m.home, tools: join(m.dir, "none") }) };
        const withPin = row(seen(appsQuestion(s, { pin: PIN })), "claude-code");
        const noPin = row(appsQuestion(s, {}), "claude-code");
        const partial = row(appsQuestion(s, { pin: { version: "2.1.296" } }), "claude-code");
        assert.equal(withPin.here, here);
        assert.equal(withPin.action, action);
        assert.equal(noPin.action, noPinAction);
        assert.equal(partial.action, noPinAction);
        assert.equal(withPin.link, undefined);
        if (note) assert.equal(withPin.note, note);
        else assert.equal(withPin.note, undefined);
      });
    });
  }

  it("with no pin and Claude Code missing, the note ends with the support sentence when there is one", () => {
    withMac({ claude: "none" }, (m) => {
      const s = { here: {}, claude: claudeState({ home: m.home, tools: join(m.dir, "none") }) };
      assert.equal(row(seen(appsQuestion(s, { support: "help@example.invalid" })), "claude-code").note, "Not installed. Write to help@example.invalid for help.");
      assert.equal(row(appsQuestion(s, { support: "" }), "claude-code").note, "Not installed.");
    });
  });

  it("working stands as Claude Code's note, with no action on that row", () => {
    withMac({ claude: "none" }, (m) => {
      const s = { here: {}, claude: claudeState({ home: m.home, tools: join(m.dir, "none") }) };
      const r = row(seen(appsQuestion(s, { pin: PIN, working: "Installing Claude Code." })), "claude-code");
      assert.equal(r.note, "Installing Claude Code.");
      assert.equal(r.action, undefined);
    });
  });
});

describe("reading the apps answer", () => {
  const stateOf = (m, apps) => ({ here: appsHere({ home: m.home, system: join(m.dir, "none") }), claude: claudeState({ home: m.home, tools: join(m.dir, "none") }), apps });
  const ask = (m, value, ctx) => read(appsQuestion(stateOf(m), { pin: ctx.pin }), value, { state: stateOf(m), ...ctx });
  const ALL = ["claude-app", "dropbox", "hyperframes"];

  it("check, install-claude-code and sign-in pass as they are", () => {
    withMac({ claude: "signed-out" }, (m) => {
      for (const value of ["check", "sign-in"]) assert.deepEqual(ask(m, value, { pin: PIN }), { value });
    });
    withMac({ claude: "none" }, (m) => assert.deepEqual(ask(m, "install-claude-code", { pin: PIN }), { value: "install-claude-code" }));
  });

  it("continue is refused, in one line, for Claude Code missing, too old or signed out, and for Dropbox missing", () => {
    const fault = (claude, apps, ctx) => withMac({ claude, apps }, (m) => seen(ask(m, "continue", ctx)).fault);
    assert.equal(fault("none", ALL, { pin: PIN }), "Claude Code is not installed yet. Choose Install Claude Code.");
    assert.equal(fault("old", ALL, { pin: PIN }), `Claude Code 2.0.0 is too old: BRIMM Video Studio needs ${GUARD_CLAUDE} or later. Choose Install Claude Code.`);
    assert.equal(fault("signed-out", ALL, { pin: PIN }), "Claude Code is not signed in yet. Choose Sign in.");
    assert.equal(fault("signed-in", ["claude-app", "hyperframes"], { pin: PIN }), "Dropbox is not installed yet. Install it, sign in to The BRIMM's account, then choose Continue.");
    for (const text of [fault("none", ALL, { pin: PIN }), fault("old", ALL, {}), fault("signed-in", [], {})]) assert.doesNotMatch(text, /\n/);
  });

  it("with no pin, the refusal says this copy cannot install Claude Code and names the support contact", () => {
    const fault = (claude, support) => withMac({ claude, apps: ALL }, (m) => seen(ask(m, "continue", { support })).fault);
    assert.equal(fault("none", "help@example.invalid"), "This copy of BRIMM Video Studio cannot install Claude Code. Write to help@example.invalid for help.");
    assert.equal(fault("none", ""), "This copy of BRIMM Video Studio cannot install Claude Code.");
    assert.equal(fault("old", "help@example.invalid"), `Claude Code 2.0.0 is too old: BRIMM Video Studio needs ${GUARD_CLAUDE} or later. Write to help@example.invalid for help.`);
    assert.equal(fault("old", ""), `Claude Code 2.0.0 is too old: BRIMM Video Studio needs ${GUARD_CLAUDE} or later.`);
  });

  it("a missing Claude app or HyperFrames app is a warning, and continue is taken", () => {
    const got = (apps) => withMac({ claude: "signed-in", apps }, (m) => seen(ask(m, "continue", { pin: PIN })));
    assert.deepEqual(got(["dropbox", "hyperframes"]), { value: "continue", warning: "Claude is not installed yet. You can go on: the Getting Started guide lists what is still to install." });
    assert.equal(got(["dropbox", "claude-app"]).warning, "HyperFrames is not installed yet. You can go on: the Getting Started guide lists what is still to install.");
    assert.equal(got(["dropbox"]).warning, "Claude and HyperFrames are not installed yet. You can go on: the Getting Started guide lists what is still to install.");
    assert.deepEqual(got(ALL), { value: "continue" });
  });
});

describe("the sign-in", () => {
  it("a pasted code is given back and is in no fault and no warning", () => {
    const q = seen(signInQuestion({ link: "https://claude.ai/login" }));
    assert.equal(q.paste, true);
    assert.equal(q.link, "https://claude.ai/login");
    assert.equal("link" in signInQuestion({}), false);
    assert.equal(q.prompt, "Sign in to Claude in the browser. If it gives a code, paste it here.");
    assert.deepEqual(read(q, { code: " 9f3a-code " }, {}), { value: { code: "9f3a-code" } });
    assert.deepEqual(read(q, {}, {}), { value: {} });
    assert.doesNotMatch(JSON.stringify(signInQuestion({ fault: "Not signed in." })), /9f3a/);
  });
});

describe("the BRIMM Video folder", () => {
  it("several folders make a choice in Finder's words, with Look again; exactly one asks nothing", () => {
    withMac({}, (m) => {
      const a = join(m.home, "Library", "CloudStorage", "Dropbox-One", "The BRIMM DB", "BRIMM Video");
      const b = join(m.home, "Dropbox", "The BRIMM DB", "BRIMM Video");
      const q = seen(rootQuestion([a, b], m.home));
      assert.equal(q.id, "dropbox");
      assert.equal(q.kind, "choice");
      assert.equal(q.prompt, "Which BRIMM Video folder is The BRIMM's?");
      assert.deepEqual(q.options, [{ value: a, label: folderWords(a, m.home) }, { value: b, label: folderWords(b, m.home) }, { value: "look-again", label: "Look again" }]);
      assert.equal(eventFault(q), "");
      assert.deepEqual(read(q, b, {}), { value: b });
      assert.deepEqual(read(q, "look-again", {}), { value: "look-again" });
      assert.match(read(q, "/elsewhere", {}).fault, /./);
      assert.equal(rootQuestion([a], m.home), null);
    });
  });

  it("no BRIMM Video folder: the only choice is Look again", () => {
    const q = seen(rootQuestion([], "/home/x"));
    assert.equal(q.prompt, NO_BRIMM_VIDEO[0]);
    assert.equal(q.options.length, 1);
    assert.equal(q.options[0].value, "look-again");
    assert.equal(q.options[0].label, "Look again");
    assert.equal(eventFault(q), "");
  });
});

describe("the folders", () => {
  it("the drop folder's suggestion is BRIMM Video Work's Drop, and the exports folder's is Downloads", () => {
    withMac({}, (m) => {
      const drop = seen(folderQuestion("drop", { suggested: defaultDropFolder(m.home), home: m.home }));
      const exp = seen(folderQuestion("exports", { suggested: downloadsFolder(m.home), home: m.home }));
      assert.equal(drop.id, "drop-folder");
      assert.equal(drop.purpose, "drop");
      assert.equal(drop.prompt, "Where will videos be dropped on this Mac?");
      assert.equal(drop.words, folderWords(defaultDropFolder(m.home), m.home));
      assert.equal(exp.id, "exports-folder");
      assert.equal(exp.prompt, "Where does HyperFrames save its exports on this Mac?");
      assert.equal(exp.suggested, downloadsFolder(m.home));
      assert.equal(exp.words, folderWords(downloadsFolder(m.home), m.home));
      assert.equal(eventFault(drop), "");
      assert.equal(eventFault(exp), "");
    });
  });

  it("a drop folder that dropFolderFault refuses is a fault, in its own words as a sentence", () => {
    withMac({}, (m) => {
      const q = folderQuestion("drop", { suggested: defaultDropFolder(m.home), home: m.home });
      assert.deepEqual(seen(read(q, m.root, { home: m.home, root: m.root })), { fault: "The drop folder cannot be BRIMM Video, or inside it, or hold it." });
      assert.deepEqual(seen(read(q, "Drop", { home: m.home, root: m.root })), { fault: "The drop folder must be a whole path." });
    });
  });

  it("a drop folder in a cloud folder is taken with a warning that names the cloud", () => {
    withMac({}, (m) => {
      const q = folderQuestion("drop", { suggested: defaultDropFolder(m.home), home: m.home });
      const path = join(m.home, "Library", "CloudStorage", "Dropbox", "Videos");
      mkdirSync(path, { recursive: true });
      const got = seen(read(q, path, { home: m.home, root: m.root }));
      assert.equal(got.value, path);
      assert.equal(got.warning, "This folder is kept in Dropbox: every video dropped here would be uploaded there too. A folder on this Mac itself, such as BRIMM Video Work › Drop, is better.");
      const ok = join(m.home, "BRIMM Video Work", "Drop");
      mkdirSync(ok, { recursive: true });
      assert.deepEqual(read(q, ok, { home: m.home, root: m.root }), { value: ok });
    });
  });

  it("an exports folder is checked against the drop folder that was chosen, and a cloud folder is allowed there", () => {
    withMac({}, (m) => {
      const drop = join(m.home, "BRIMM Video Work", "Drop");
      mkdirSync(drop, { recursive: true });
      const q = folderQuestion("exports", { suggested: downloadsFolder(m.home), home: m.home });
      assert.deepEqual(seen(read(q, drop, { home: m.home, root: m.root, drop })), { fault: "The drop folder cannot be the exports folder, or inside it, or hold it." });
      const cloud = join(m.home, "Library", "CloudStorage", "Dropbox", "Exports");
      mkdirSync(cloud, { recursive: true });
      assert.deepEqual(read(q, cloud, { home: m.home, root: m.root, drop }), { value: cloud });
    });
  });
});

describe("the permissions", () => {
  it("the permission question names the folder in Finder's words, its switch and BRIMM Video Studio", () => {
    withMac({}, (m) => {
      const folder = join(m.home, "Downloads");
      const q = seen(permissionQuestion("downloads", { folder, home: m.home }));
      assert.equal(q.id, "permission-downloads");
      assert.equal(q.kind, "choice");
      assert.equal(q.prompt, `This Mac does not let BRIMM Video Studio look in ${folderWords(folder, m.home)}. In System Settings, under Privacy & Security, Files and Folders, turn on Downloads Folder under "BRIMM Video Studio". Then choose Look again.`);
      assert.ok(q.prompt.includes(`"${lookerOf({ mode: "installed" })}"`));
      assert.doesNotMatch(q.prompt, /node/);
      assert.deepEqual(q.options, [{ value: "again", label: "Look again" }, { value: "skip", label: "Go on without it" }]);
      assert.equal(permissionQuestion("drop", { folder, home: m.home }).id, "permission-drop");
      assert.equal(permissionQuestion("episodes", { folder, home: m.home }).id, "permission-episodes");
      assert.equal(eventFault(q), "");
      assert.deepEqual(read(q, "skip", {}), { value: "skip" });
      assert.deepEqual(read(q, "again", {}), { value: "again" });
      assert.match(read(q, "later", {}).fault, /./);
    });
  });
});

describe("the review", () => {
  it("a review that is ok is a confirm whose button says Install; one that is not offers only Check again", () => {
    const yes = seen(reviewQuestion(true));
    assert.deepEqual(yes, { event: "question", id: "review", kind: "confirm", prompt: "Install BRIMM Video Studio on this Mac?", ok: "Install" });
    const no = seen(reviewQuestion(false));
    assert.equal(no.kind, "choice");
    assert.equal(no.prompt, "This Mac is not ready to install yet. What stands in the way is under Details.");
    assert.deepEqual(no.options, [{ value: "again", label: "Check again" }]);
    assert.deepEqual(read(yes, true, {}), { value: true });
    assert.deepEqual(read(no, "again", {}), { value: "again" });
    assert.match(read(yes, "again", {}).fault, /./);
    assert.match(read(no, true, {}).fault, /./);
  });
});

describe("every question and answer", () => {
  it("every question passes eventFault, with and without a warning and a fault, and each value read takes passes answerFault", () => {
    withMac({ claude: "signed-out", apps: ["dropbox"] }, (m) => {
      const s = { here: appsHere({ home: m.home, system: join(m.dir, "none") }), claude: claudeState({ home: m.home, tools: join(m.dir, "none") }) };
      const extra = { warning: "A warning.", fault: "A fault." };
      const folder = join(m.home, "Downloads");
      mkdirSync(defaultDropFolder(m.home), { recursive: true });
      const found = [join(m.home, "Dropbox", "The BRIMM DB", "BRIMM Video"), m.root];
      const made = [
        [welcomeQuestion(), true], [nameQuestion({ suggested: "Studio" }), "Studio"], [nameQuestion({ suggested: "Studio", ...extra }), "Studio"],
        [appsQuestion(s, { pin: PIN }), "check"], [appsQuestion(s, { pin: PIN, ...extra, working: "Working." }), "check"],
        [signInQuestion({}), {}], [signInQuestion({ link: "https://claude.ai", ...extra }), { code: "abc" }],
        [rootQuestion(found, m.home), "look-again"], [rootQuestion([], m.home), "look-again"], [rootQuestion(found, m.home), found[0]],
        [folderQuestion("drop", { suggested: defaultDropFolder(m.home), home: m.home, ...extra }), defaultDropFolder(m.home)], [folderQuestion("exports", { suggested: folder, home: m.home }), folder],
        [permissionQuestion("drop", { folder, home: m.home }), "skip"], [reviewQuestion(true), true], [reviewQuestion(false), "again"]
      ];
      for (const [q, value] of made) {
        assert.equal(eventFault(q), "", q.id);
        assert.equal(answerFault(q, { answer: q.id, value }), "", q.id);
        const ctx = { home: m.home, root: m.root, drop: join(m.home, "Drop"), state: s, pin: PIN };
        const got = read(q, value, ctx);
        assert.equal("fault" in got, false, `${q.id}: ${got.fault}`);
        assert.equal(answerFault(q, { answer: q.id, value: got.value }), "", q.id);
      }
    });
  });

  it("no prompt, label, fault or warning says node or Terminal", () => {
    assert.ok(SEEN.length > 40);
    for (const text of SEEN.filter((t) => !t.startsWith("/"))) assert.doesNotMatch(text, /\bnode\b|Terminal/i, text);
  });

  it("questions.js starts no program and writes nothing", () => {
    const text = readFileSync(fileURLToPath(new URL("../setup/questions.js", import.meta.url)), "utf8");
    assert.doesNotMatch(text, /child_process/);
    assert.doesNotMatch(text, /writeFile|appendFile|mkdirSync|rmSync|unlinkSync|renameSync|copyFile|symlinkSync|process\.std/);
  });
});
