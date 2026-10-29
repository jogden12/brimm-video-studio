// The pinned HyperFrames command line's rules (hyperframes.js; architecture spec 2026-10-27, F3, F6, F7 and sections 4.6, 5.3, 5.5
// and 5.6). The module is pure, so no test here runs a program: what the command line prints is read from the fixtures in
// tests/fixtures/hyperframes-0.8.208/. Four are captures from the pinned version itself, run in a scratch folder (help.txt,
// history-empty.json, catch-up-empty.json, open-not-installed.json). The two that need the Mac app (open-opened.json and
// open-opened-handed-over.json) are what its own code for `open` prints, run with the platform and the opener stubbed, since only
// a Mac with the app can print them; A0b replaces them with captures. app-history.jsonl is made up. history-entries.json (plan
// PR 6) has the keys, their order and the kinds of `who` that the pinned `history --json` printed in a run in a scratch home on
// 2026-10-28 (a labelled turn, a change made outside it, an undo and a pin); its ids, times, labels and files are made up, and the
// one `person` entry, which only the app makes, is written by hand in the same shape. A path in a fixture is the made-up one of an
// episode on Sallie's laptop.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SESSION_ID } from "../scan.js";
import { PIN, pinFrom, COMMANDS, toolchainDir, cliPath, openArgs, commandsIn, unclassified, denyRules, settingsFor, childEnv, handoverAllowed, readOpen, turnsOf, plainTurns, historyArgs, readHistory, plainText, plainVersions, VERSIONS_LIMIT, QUOTE_MOST, FILES_MOST } from "../hyperframes.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/hyperframes-0.8.208/${name}`, import.meta.url), "utf8");
const help = fixture("help.txt");
const HOME = "/Users/sallie";
const NODE = "/opt/homebrew/bin/node";
/** A chat's id, in the shape SESSION_ID (scan.js) accepts. */
const CHAT = "5b1f0c8e-2d47-4a93-b6e1-7c9a3f2d8e04";

/** The classes of spec 5.5, typed out again here so that a command moved from one class to another fails a test. */
const AGENT = ["preview", "render", "lint", "check", "validate", "inspect", "keyframes", "snapshot", "info", "compositions", "timeline", "history", "docs", "doctor", "beats", "audio", "media-treatment", "normalize-audio", "grade-compare", "compare"];
const EDIT = ["open", "catch-up"];
const DENIED = ["init", "add", "catalog", "capture", "present", "publish", "cloud", "lambda", "cloudrun", "auth", "feedback", "telemetry", "skills", "models", "browser", "upgrade", "benchmark", "clean", "transcribe", "tts", "remove-background"];
const classOf = (c) => Object.keys(COMMANDS).filter((name) => COMMANDS[name].class === c).sort();
/** The variables by which version 0.8.208 takes a HeyGen key or token, in the order it looks (resolveCredential), and then at its own
    file, ~/.heygen/credentials. An empty value counts as unset. A project's settings blank all three, since whether the app hands
    its assistant one is not known, and Studio's own runs (childEnv) carry none of them. */
const HEYGEN = ["HEYGEN_API_KEY", "HYPERFRAMES_API_KEY", "HEYGEN_ACCESS_TOKEN"];

describe("the pinned command line", () => {
  it("is version 0.8.208, with the registry's integrity string", () => {
    assert.equal(PIN.version, "0.8.208");
    assert.match(PIN.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  });
  it("is run by absolute path, never by npx", () => {
    const { file, args } = openArgs({ home: HOME, node: NODE, project: `${HOME}/BRIMM Video Work/E/P` });
    assert.equal(file, NODE);
    assert.deepEqual(args, [`${HOME}/BRIMM Video Work/.toolchain/hyperframes-0.8.208/node_modules/hyperframes/bin/hyperframes.mjs`, "open", `${HOME}/BRIMM Video Work/E/P`, "--json"]);
    assert.ok(!args.includes("npx"));
  });
  it("has the integrity string the registry gave for it on 2026-10-28", () => {
    assert.equal(PIN.integrity, "sha512-a019TOERCx/qj9NtUc7D69gGPguXR97Vbs8CjUUq6KKS+FqlaUBob6CG2KT8ohHhHvHTc1K3mie2hyxZLqt+8w==");
  });
  it("is kept in a folder of its version in the toolchain folder of the work folder, on this Mac's own disk", () => {
    assert.equal(toolchainDir(HOME), `${HOME}/BRIMM Video Work/.toolchain/hyperframes-${PIN.version}`);
    assert.equal(cliPath(HOME), `${toolchainDir(HOME)}/node_modules/hyperframes/bin/hyperframes.mjs`);
  });
  it("is given only absolute paths, so that a path can never be taken for an option", () => {
    const given = { home: HOME, node: NODE, project: `${HOME}/BRIMM Video Work/E/P` };
    for (const project of ["", "BRIMM Video Work/E/P", "./P", "--json", "-x", undefined, null, 5]) assert.throws(() => openArgs({ ...given, project }), /absolute/, String(project));
    for (const node of ["node", "", undefined]) assert.throws(() => openArgs({ ...given, node }), /absolute/, String(node));
    for (const home of ["Users/sallie", "", undefined]) assert.throws(() => openArgs({ ...given, home }), /absolute/, String(home));
  });
  it("cannot be changed from outside the module", () => {
    assert.ok(Object.isFrozen(PIN));
    assert.throws(() => { PIN.version = "0.9.0"; }, TypeError);
  });
  it("is read from the pin file only if it holds a version and an integrity string, and then frozen, with whatever else it holds", () => {
    const good = { version: "0.8.208", integrity: PIN.integrity };
    assert.deepEqual(pinFrom(JSON.stringify(good)), good);
    const more = pinFrom(JSON.stringify({ ...good, gsap: { version: "3.14.2" } }));
    assert.equal(more.gsap.version, "3.14.2");
    assert.ok(Object.isFrozen(more) && Object.isFrozen(more.gsap));
    for (const bad of [
      { ...good, version: "latest" }, { ...good, version: "0.8" }, { ...good, version: "../../x" }, { ...good, version: "0.8.208 " }, { ...good, version: 208 }, { integrity: good.integrity },
      { ...good, integrity: "sha512-abc" }, { ...good, integrity: good.integrity.slice(0, -2) }, { ...good, integrity: good.integrity.replace("sha512", "sha1") }, { ...good, integrity: `${good.integrity}\n` }, { version: good.version },
      null, [], "0.8.208", 5, {}
    ]) assert.throws(() => pinFrom(JSON.stringify(bad)), /hyperframes\.pin\.json must hold/, JSON.stringify(bad));
    assert.throws(() => pinFrom("{"), SyntaxError);
  });
});

describe("every command of the pinned help is classified", () => {
  it("finds the 43 commands in the help", () => assert.equal(commandsIn(help).length, 43));
  it("leaves none unclassified", () => assert.deepEqual(unclassified(help), []));
  it("reports one that no class names", () => assert.deepEqual(unclassified(`${help}\n  frobnicate         Does a thing\n`), ["frobnicate"]));
  it("has 20 the agent may run, 2 for edit.js only and 21 denied", () => {
    const count = (c) => Object.values(COMMANDS).filter((x) => x.class === c).length;
    assert.deepEqual([count("agent"), count("edit"), count("denied")], [20, 2, 21]);
  });
  it("puts no command in two classes, and gives each a reason", () => {
    for (const [name, c] of Object.entries(COMMANDS)) assert.ok(["agent", "edit", "denied"].includes(c.class) && c.why, name);
  });

  // What the tests above do not pin: which command is in which class (spec 5.5), that the table holds no command the help does
  // not, and that the help the tests read is the pinned version's own, so that the pin cannot move without it.
  it("puts each command in the class spec 5.5 gives it", () => {
    assert.deepEqual(classOf("agent"), [...AGENT].sort());
    assert.deepEqual(classOf("edit"), [...EDIT].sort());
    assert.deepEqual(classOf("denied"), [...DENIED].sort());
  });
  it("names exactly the commands of the help, so that no entry is misspelled or left behind", () => {
    assert.deepEqual(Object.keys(COMMANDS).sort(), [...commandsIn(help)].sort());
  });
  it("gives each command a reason with some words in it, not a placeholder", () => {
    for (const [name, c] of Object.entries(COMMANDS)) assert.ok(typeof c.why === "string" && c.why.split(/\s+/).length >= 3, name);
  });
  it("cannot be changed from outside the module", () => {
    assert.ok(Object.isFrozen(COMMANDS) && Object.isFrozen(COMMANDS.publish));
    assert.throws(() => { COMMANDS.publish.class = "agent"; }, TypeError);
  });
  it("lists the help's commands in its order, from the first category on, and not the examples", () => {
    const found = commandsIn(help);
    assert.deepEqual(found.slice(0, 4), ["init", "add", "capture", "catalog"]);
    assert.deepEqual(found.slice(-3), ["auth", "feedback", "telemetry"]);
    assert.equal(new Set(found).size, 43);
    assert.ok(!found.includes("hyperframes"));
  });
  it("reads a help whose lines end the Windows way as it reads the same help", () => {
    assert.deepEqual(commandsIn(help.replace(/\n/g, "\r\n")), commandsIn(help));
  });
  it("finds nothing in what is not a help", () => {
    for (const nothing of ["", "   ", "no categories here\n  init   Scaffold\n", null, undefined]) assert.deepEqual(commandsIn(nothing), [], String(nothing));
  });
  it("says a new command once, in the help's order, and is not fooled by a name every object has", () => {
    const more = `${help}\n  zeta               Last\n  alpha              First\n  zeta               Again\n  constructor        Not a class either\n`;
    assert.deepEqual(unclassified(more), ["zeta", "alpha", "constructor"]);
  });
  it("does not take a line of prose, or an example, for a command", () => {
    const prose = `${help}\n  see the guide for more\n  $ hyperframes frobnicate     Does a thing\n    nested  words here\nfrobnicate   at the margin\n`;
    assert.deepEqual(unclassified(prose), []);
    assert.equal(commandsIn(prose).length, 43);
  });
  it("is the help of the version that is pinned, and the history fixture says the same version", () => {
    assert.ok(help.startsWith(`hyperframes v${PIN.version} `), help.split("\n")[0]);
    assert.equal(JSON.parse(fixture("history-empty.json"))._meta.version, PIN.version);
  });
});

describe("the deny rules and the project's settings", () => {
  const spellings = (c) => [`Bash(npx hyperframes ${c}:*)`, `Bash(npx --yes hyperframes@0.8.208 ${c}:*)`, `Bash(hyperframes ${c}:*)`];
  // The command line's own update check, its background install of a newer version and its install of a missing optional package are
  // off too (version 0.8.208 does each unless told not to): nothing is installed on a Mac without Jason's yes. The last three are
  // blank: HEYGEN, above.
  const ENV = {
    HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1", HYPERFRAMES_NO_UPDATE_CHECK: "1", HYPERFRAMES_NO_AUTO_INSTALL: "1", HYPERFRAMES_NO_OPTIONAL_INSTALL: "1",
    DISABLE_FEEDBACK_COMMAND: "1", CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
    HEYGEN_API_KEY: "", HYPERFRAMES_API_KEY: "", HEYGEN_ACCESS_TOKEN: ""
  };

  it("denyRules has a rule for each denied command in each spelling", () => {
    const rules = denyRules();
    for (const c of DENIED) for (const rule of spellings(c)) assert.ok(rules.includes(rule), rule);
    // One command spelled out: `publish` in its three spellings, and the script of the same name.
    for (const rule of ["Bash(npx hyperframes publish:*)", "Bash(npx --yes hyperframes@0.8.208 publish:*)", "Bash(hyperframes publish:*)", "Bash(npm run publish:*)"]) assert.ok(rules.includes(rule), rule);
  });
  // Only edit.js runs open and catch-up, by absolute path and outside a project's settings: a project's own agent is denied them.
  it("denyRules also has a rule for each command only edit.js runs, in each spelling", () => {
    const rules = denyRules();
    for (const c of EDIT) for (const rule of spellings(c)) assert.ok(rules.includes(rule), rule);
  });
  it("denyRules has none for a command the agent may run, and nothing else", () => {
    assert.deepEqual(denyRules(), [...[...DENIED, ...EDIT].flatMap(spellings), "Bash(npm run publish:*)"].sort());
    assert.equal(denyRules().length, 23 * 3 + 1);
    for (const c of AGENT) assert.ok(!denyRules().some((rule) => rule.includes(` ${c}:`)), c);
  });
  it("denyRules names the pinned version in the spelling that has one", () => {
    const pinned = denyRules().filter((rule) => rule.includes("--yes"));
    assert.equal(pinned.length, 23);
    for (const rule of pinned) assert.match(rule, new RegExp(`^Bash\\(npx --yes hyperframes@${PIN.version.replace(/\./g, "\\.")} [a-z-]+:\\*\\)$`));
  });
  it("denyRules are sorted and without repeats, so the settings file is the same every time", () => {
    const rules = denyRules();
    assert.deepEqual(rules, [...rules].sort());
    assert.equal(new Set(rules).size, rules.length);
  });
  it("denyRules include every rule A0 tried by hand", () => {
    const a0 = [...["publish", "cloud", "lambda", "cloudrun", "auth", "feedback"].map((c) => `Bash(npx hyperframes ${c}:*)`), "Bash(npm run publish:*)"];
    for (const rule of a0) assert.ok(denyRules().includes(rule), rule);
  });
  it("denyRules are a new list each time", () => {
    const mine = denyRules();
    mine.push("Bash(anything:*)");
    assert.ok(!denyRules().includes("Bash(anything:*)"));
  });

  it("settingsFor(\"main\") holds the deny rules and ten variables, and nothing else", () => {
    const settings = settingsFor("main");
    assert.deepEqual(Object.keys(settings), ["permissions", "env"]);
    assert.deepEqual(Object.keys(settings.permissions), ["deny"]);
    assert.deepEqual(settings.permissions.deny, denyRules());
    assert.deepEqual(settings.env, ENV);
    assert.ok(!("allow" in settings.permissions));
  });
  it("settingsFor(\"clip\") also denies WebFetch and WebSearch", () => {
    const clip = settingsFor("clip");
    const main = settingsFor("main");
    assert.ok(clip.permissions.deny.includes("WebFetch") && clip.permissions.deny.includes("WebSearch"));
    assert.ok(!main.permissions.deny.includes("WebFetch") && !main.permissions.deny.includes("WebSearch"));
    // Everything main denies a clip denies, the rules are sorted, and the variables are the same ten.
    assert.deepEqual(clip.permissions.deny.filter((rule) => rule !== "WebFetch" && rule !== "WebSearch"), main.permissions.deny);
    assert.deepEqual(clip.permissions.deny, [...clip.permissions.deny].sort());
    assert.deepEqual(clip.env, ENV);
    assert.deepEqual(Object.keys(clip), ["permissions", "env"]);
    assert.deepEqual(Object.keys(clip.permissions), ["deny"]);
  });
  it("settingsFor blanks all three variables by which the command line takes a HeyGen key or token, in a main project's settings and a clip's", () => {
    for (const kind of ["main", "clip"]) {
      const { env } = settingsFor(kind);
      for (const name of HEYGEN) {
        assert.ok(Object.hasOwn(env, name), `${kind}: ${name} is there`);
        assert.strictEqual(env[name], "", `${kind}: ${name} is blank, not unset and not a value`);
      }
    }
  });
  it("settingsFor is the same text each time, and a new object each time", () => {
    assert.equal(JSON.stringify(settingsFor("main")), JSON.stringify(settingsFor("main")));
    assert.equal(JSON.stringify(settingsFor("clip")), JSON.stringify(settingsFor("clip")));
    settingsFor("main").permissions.deny.push("Bash(anything:*)");
    settingsFor("main").env.EXTRA = "1";
    assert.ok(!settingsFor("main").permissions.deny.includes("Bash(anything:*)") && !("EXTRA" in settingsFor("main").env));
  });
  it("settingsFor refuses any other kind of project", () => {
    for (const kind of ["reel", "session", "Main", "clip ", "", undefined, null, 1, {}]) assert.throws(() => settingsFor(kind), /main.*clip/, String(kind));
  });
});

describe("the environment the command line is run in", () => {
  /** What a Mac's chat might hold, with every kind of thing that must not reach the command line. */
  const BASE = {
    PATH: "/usr/local/bin:/somewhere/else", HOME, LANG: "en_GB.UTF-8", SHELL: "/bin/zsh", USER: "sallie", TMPDIR: "/var/folders/x/",
    ANTHROPIC_API_KEY: "sk-ant-made-up", ANTHROPIC_BASE_URL: "https://proxy.example", ANTHROPIC_AUTH_TOKEN: "made-up",
    HTTPS_PROXY: "http://proxy.example:3128", HTTP_PROXY: "http://proxy.example:3128", https_proxy: "http://proxy.example:3128", ALL_PROXY: "socks5://x", NO_PROXY: "x",
    AWS_SECRET_ACCESS_KEY: "made-up", AWS_ACCESS_KEY_ID: "made-up", GITHUB_TOKEN: "ghp_made-up", OPENROUTER_API_KEY: "made-up",
    HEYGEN_API_KEY: "made-up", HYPERFRAMES_API_KEY: "made-up", HEYGEN_ACCESS_TOKEN: "made-up",
    CLAUDE_CODE_SESSION_ID: "11111111-2222-4333-8444-555555555555", CODEX_THREAD_ID: "thread-1", GROK_SESSION_ID: "grok-1",
    NODE_OPTIONS: "--require /somewhere/evil.js", NODE_EXTRA_CA_CERTS: "/somewhere/ca.pem", SSH_AUTH_SOCK: "/tmp/agent.1", DYLD_INSERT_LIBRARIES: "/somewhere/lib.dylib",
    HYPERFRAMES_DESKTOP_PROJECT: "/somewhere", XDG_CONFIG_HOME: "/somewhere"
  };
  const NAMES = ["HOME", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"];

  it("childEnv holds exactly these names", () => {
    const env = childEnv({ base: BASE, node: NODE });
    assert.deepEqual(Object.keys(env).sort(), NAMES);
    assert.deepEqual(env, {
      PATH: "/opt/homebrew/bin:/usr/bin:/bin", HOME, LANG: "en_GB.UTF-8",
      HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1", HYPERFRAMES_NO_UPDATE_CHECK: "1", HYPERFRAMES_NO_AUTO_INSTALL: "1", HYPERFRAMES_NO_OPTIONAL_INSTALL: "1"
    });
    // Not a HeyGen key either, in any of the three variables the command line takes one from: Studio's own runs have none to find.
    for (const gone of ["ANTHROPIC_API_KEY", "HTTPS_PROXY", "AWS_SECRET_ACCESS_KEY", "GITHUB_TOKEN", "CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID", "GROK_SESSION_ID", ...HEYGEN]) assert.ok(!(gone in env), gone);
    assert.ok(!Object.keys(env).some((name) => /^ANTHROPIC_|PROXY/i.test(name)));
  });
  it("childEnv takes PATH from node's own folder, then /usr/bin and /bin", () => {
    assert.equal(childEnv({ base: BASE, node: "/usr/local/bin/node" }).PATH, "/usr/local/bin:/usr/bin:/bin");
    assert.equal(childEnv({ base: BASE, node: "/Users/sallie/.nvm/versions/node/v22.1.0/bin/node" }).PATH, "/Users/sallie/.nvm/versions/node/v22.1.0/bin:/usr/bin:/bin");
  });
  it("childEnv gives LANG as en_US.UTF-8 when the base has none", () => {
    assert.equal(childEnv({ base: { HOME }, node: NODE }).LANG, "en_US.UTF-8");
    assert.equal(childEnv({ base: { HOME, LANG: "" }, node: NODE }).LANG, "en_US.UTF-8");
    assert.equal(childEnv({ base: { HOME, LANG: "C" }, node: NODE }).LANG, "C");
  });
  it("childEnv is a plain object, and leaves the base as it was", () => {
    const base = Object.freeze({ ...BASE });
    const env = childEnv({ base, node: NODE });
    assert.equal(Object.getPrototypeOf(env), Object.prototype);
    assert.deepEqual(base, BASE);
    env.EXTRA = "1";
    assert.ok(!("EXTRA" in childEnv({ base, node: NODE })));
  });
  it("childEnv refuses a base with no HOME, and a node that is not an absolute path", () => {
    for (const home of [undefined, "", "sallie", null, 5]) assert.throws(() => childEnv({ base: { ...BASE, HOME: home }, node: NODE }), /HOME/, String(home));
    assert.throws(() => childEnv({ node: NODE }), /HOME/);
    for (const node of [undefined, "", "node", "./node"]) assert.throws(() => childEnv({ base: BASE, node }), /absolute/, String(node));
  });

  it("childEnv({ handover: true, sessionId }) adds CLAUDE_CODE_SESSION_ID and nothing else", () => {
    const without = childEnv({ base: BASE, node: NODE });
    const { CLAUDE_CODE_SESSION_ID, ...rest } = childEnv({ base: BASE, node: NODE, handover: true, sessionId: CHAT });
    assert.equal(CLAUDE_CODE_SESSION_ID, CHAT);
    assert.deepEqual(rest, without);
    assert.equal(Object.keys(without).length + 1, Object.keys(childEnv({ base: BASE, node: NODE, handover: true, sessionId: CHAT })).length);
  });
  it("childEnv never adds it unless the handover is true, and the id is a chat's", () => {
    for (const handover of [false, undefined, null, "true", "yes", 1, 0, {}]) assert.ok(!("CLAUDE_CODE_SESSION_ID" in childEnv({ base: BASE, node: NODE, handover, sessionId: CHAT })), String(handover));
    for (const sessionId of [undefined, null, "", "not-a-chat", CHAT.toUpperCase(), `${CHAT}\n`, ` ${CHAT}`, `${CHAT}0`, CHAT.slice(1), 5, [CHAT]]) {
      assert.ok(!("CLAUDE_CODE_SESSION_ID" in childEnv({ base: BASE, node: NODE, handover: true, sessionId })), String(sessionId));
    }
  });
  it("childEnv gives the id it is told, never the one the base holds", () => {
    assert.equal(childEnv({ base: BASE, node: NODE, handover: true, sessionId: CHAT }).CLAUDE_CODE_SESSION_ID, CHAT);
    assert.ok(!("CLAUDE_CODE_SESSION_ID" in childEnv({ base: BASE, node: NODE, handover: false, sessionId: CHAT })));
  });
});

describe("when the app may take over the chat", () => {
  /** All five conditions of spec 5.6 hold. */
  const CLEAR = { setting: true, sessionId: CHAT, held: false, episode: { session: false, unanswered: false }, project: { clip: false } };
  /** One row for each way it is refused: the change to the clear case, and the reason given. */
  const ROWS = [
    ["the setting is off", { setting: false }, "off"],
    ["the id is not a chat's", { sessionId: "not-a-chat" }, "no chat"],
    ["there is no id", { sessionId: undefined }, "no chat"],
    ["the chat is held", { held: true }, "held"],
    ["the episode is a session", { episode: { session: true, unanswered: false } }, "session"],
    ["the episode is unanswered", { episode: { session: false, unanswered: true } }, "unanswered"],
    ["the project is a session clip", { project: { clip: true } }, "clip"]
  ];

  it("is allowed when none of the five holds, and says no reason", () => {
    assert.deepEqual(handoverAllowed(CLEAR), { allowed: true, why: "" });
  });
  for (const [name, change, why] of ROWS) {
    it(`handoverAllowed is refused when ${name}, with the reason "${why}"`, () => {
      assert.deepEqual(handoverAllowed({ ...CLEAR, ...change }), { allowed: false, why });
    });
  }
  it("says the first that fails, in the order of spec 5.6", () => {
    const worst = { setting: false, sessionId: "x", held: true, episode: { session: true, unanswered: true }, project: { clip: true } };
    const steps = [["off", { setting: true }], ["no chat", { sessionId: CHAT }], ["held", { held: false }], ["session", { episode: { session: false, unanswered: true } }], ["unanswered", { episode: { session: false, unanswered: false } }], ["clip", { project: { clip: false } }]];
    let facts = worst;
    for (const [why, fix] of steps) {
      assert.deepEqual(handoverAllowed(facts), { allowed: false, why });
      facts = { ...facts, ...fix };
    }
    assert.deepEqual(handoverAllowed(facts), { allowed: true, why: "" });
  });
  it("fails closed: a flag that is missing, or not a boolean, is the unsafe answer", () => {
    const UNSAFE = [
      [{ setting: "on" }, "off"], [{ setting: 1 }, "off"], [{ setting: undefined }, "off"], [{ setting: null }, "off"], [{ setting: "true" }, "off"],
      [{ sessionId: 5 }, "no chat"], [{ sessionId: null }, "no chat"], [{ sessionId: `${CHAT}\n` }, "no chat"], [{ sessionId: CHAT.toUpperCase() }, "no chat"], [{ sessionId: "" }, "no chat"],
      [{ held: undefined }, "held"], [{ held: null }, "held"], [{ held: "no" }, "held"], [{ held: "false" }, "held"], [{ held: 0 }, "held"],
      [{ episode: undefined }, "session"], [{ episode: null }, "session"], [{ episode: {} }, "session"], [{ episode: { unanswered: false } }, "session"],
      [{ episode: { session: "no", unanswered: false } }, "session"], [{ episode: { session: "false", unanswered: false } }, "session"], [{ episode: { session: 0, unanswered: false } }, "session"],
      [{ episode: { session: false } }, "unanswered"], [{ episode: { session: false, unanswered: "no" } }, "unanswered"], [{ episode: { session: false, unanswered: null } }, "unanswered"],
      [{ project: undefined }, "clip"], [{ project: null }, "clip"], [{ project: {} }, "clip"], [{ project: { clip: "no" } }, "clip"], [{ project: { clip: "false" } }, "clip"], [{ project: { clip: 0 } }, "clip"]
    ];
    for (const [change, why] of UNSAFE) assert.deepEqual(handoverAllowed({ ...CLEAR, ...change }), { allowed: false, why }, JSON.stringify(change));
    for (const nothing of [undefined, null, {}, "yes", 5]) assert.deepEqual(handoverAllowed(nothing), { allowed: false, why: "off" }, String(nothing));
    assert.deepEqual(handoverAllowed(), { allowed: false, why: "off" });
  });
});

describe("what the open command printed, in her words", () => {
  const OPEN = "It's open in HyperFrames.";
  const PICKS_UP = "It's open in HyperFrames, and it picks up this conversation.";
  const NEW_CHAT = "It's open in HyperFrames. It starts a new conversation.";
  const NOT_INSTALLED = "HyperFrames isn't installed on this Mac: ask Jason.";
  const WOULD_NOT = "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason.";
  const CANNOT = "HyperFrames can't be opened from here: ask Jason.";
  const notOpened = (reason) => JSON.stringify({ ...JSON.parse(fixture("open-not-installed.json")), reason });

  it("readOpen says it is open", () => {
    assert.deepEqual(readOpen(fixture("open-opened.json"), 0, { handoverWanted: false }), { opened: true, handedOver: false, reason: null, words: OPEN });
    assert.deepEqual(readOpen(fixture("open-opened.json"), 0), { opened: true, handedOver: false, reason: null, words: OPEN });
    // Only a handover that is wanted for certain is said to be wanted.
    assert.equal(readOpen(fixture("open-opened.json"), 0, { handoverWanted: "yes" }).words, OPEN);
  });
  it("readOpen says it is open and picks up the conversation when it was handed over", () => {
    assert.deepEqual(readOpen(fixture("open-opened-handed-over.json"), 0, { handoverWanted: true }), { opened: true, handedOver: true, reason: null, words: PICKS_UP });
    // It was handed over, so that is what is true, whatever was wanted.
    assert.deepEqual(readOpen(fixture("open-opened-handed-over.json"), 0, { handoverWanted: false }), { opened: true, handedOver: true, reason: null, words: PICKS_UP });
  });
  it("readOpen says it starts a new conversation when a handover was wanted and not made", () => {
    assert.deepEqual(readOpen(fixture("open-opened.json"), 0, { handoverWanted: true }), { opened: true, handedOver: false, reason: null, words: NEW_CHAT });
  });
  it("readOpen says HyperFrames isn't installed", () => {
    assert.deepEqual(readOpen(fixture("open-not-installed.json"), 1, { handoverWanted: true }), {
      opened: false, handedOver: false, reason: "not-installed", words: NOT_INSTALLED, downloadUrl: "https://hyperframes.dev/studio/download?os=linux&src=cli"
    });
  });
  it("readOpen says each other reason in its words", () => {
    for (const [reason, words] of [["open-failed", WOULD_NOT], ["unsupported-platform", CANNOT], ["handoff-unavailable", CANNOT]]) {
      const read = readOpen(notOpened(reason), 1, {});
      assert.deepEqual([read.opened, read.handedOver, read.reason, read.words], [false, false, reason, words], reason);
    }
  });
  it("readOpen says anything else as it says a failure to open, and does not repeat what it was told", () => {
    for (const reason of ["something-new", "", "Not-Installed", "__proto__", "constructor", 5, null, ["not-installed"], { reason: "not-installed" }]) {
      const read = readOpen(JSON.stringify({ project: "/p", opened: false, reason }), 1, {});
      assert.deepEqual([read.opened, read.reason, read.words], [false, "unknown", WOULD_NOT], String(reason));
    }
  });
  it("readOpen gives the download address only as an address", () => {
    assert.equal(readOpen(fixture("open-not-installed.json"), 1, {}).downloadUrl, "https://hyperframes.dev/studio/download?os=linux&src=cli");
    for (const downloadUrl of [undefined, null, "", "not a link", "javascript:alert(1)", "http://hyperframes.dev/studio", "https://a.example/ b", 5]) {
      const read = readOpen(JSON.stringify({ project: "/p", opened: false, reason: "not-installed", downloadUrl }), 1, {});
      assert.ok(!("downloadUrl" in read), String(downloadUrl));
      assert.equal(read.words, NOT_INSTALLED);
    }
    assert.ok(!("downloadUrl" in readOpen(fixture("open-opened.json"), 0, {})));
  });
  it("readOpen holds no path, no flag and no command name in what it says", () => {
    const every = [readOpen(fixture("open-opened.json"), 0, { handoverWanted: true }), readOpen(fixture("open-opened-handed-over.json"), 0, {}), readOpen(fixture("open-not-installed.json"), 1, {}), readOpen("", 0, {}),
      ...["open-failed", "unsupported-platform", "handoff-unavailable", "other"].map((reason) => readOpen(notOpened(reason), 1, {}))];
    for (const { words } of every) assert.ok(!/[/\\]|(^|\s)--?[a-z]|npx|catch-up|hyperframes\.mjs|\.json/i.test(words), words);
  });

  it("readOpen takes what it cannot read as \"wouldn't open\"", () => {
    const UNREADABLE = ["", "   \n", "not json", "{", "null", "[]", "5", "\"opened\"", "true", "{}", "{\"project\":\"/p\"}", "{\"opened\":\"yes\"}", "{\"opened\":1}", "{\"opened\":null}",
      JSON.stringify({ ok: false, error: { code: "invalid-project", message: "No such folder" } }), undefined, null, 5, {},
      // Not a text, though it would read as one: an array of one text, and a text object.
      ['{"project":"/p","opened":true,"app":"the HyperFrames desktop app","handedOver":null}'], Object("{\"opened\":true}")];
    for (const stdout of UNREADABLE) {
      for (const code of [0, 1]) {
        assert.deepEqual(readOpen(stdout, code, { handoverWanted: true }), { opened: false, handedOver: false, reason: "unknown", words: WOULD_NOT }, `${String(stdout)} / ${code}`);
      }
    }
  });
  it("readOpen takes opened that the exit status contradicts as \"wouldn't open\"", () => {
    for (const code of [1, 2, null, undefined, "0"]) {
      assert.deepEqual(readOpen(fixture("open-opened.json"), code, {}), { opened: false, handedOver: false, reason: "unknown", words: WOULD_NOT }, String(code));
      assert.equal(readOpen(fixture("open-opened-handed-over.json"), code, {}).opened, false, String(code));
    }
    // A failure it was told of stays one, whatever the exit status.
    assert.equal(readOpen(fixture("open-not-installed.json"), 0, {}).opened, false);
    assert.equal(readOpen(fixture("open-not-installed.json"), 0, {}).reason, "not-installed");
  });
  it("readOpen counts a hand-over of any shape as a hand-over, and none as none", () => {
    const opened = (handedOver) => JSON.stringify({ project: "/p", opened: true, app: "the HyperFrames desktop app", handedOver });
    for (const handedOver of [{ engine: "claude", sessionId: CHAT }, {}, true, "claude", 1]) assert.equal(readOpen(opened(handedOver), 0, {}).handedOver, true, JSON.stringify(handedOver));
    for (const handedOver of [null, false, 0, "", undefined]) assert.equal(readOpen(opened(handedOver), 0, {}).handedOver, false, JSON.stringify(handedOver));
  });
});

describe("the app's history", () => {
  const AT = "2026-10-27T19:41:08.000Z";
  const line = (fields) => JSON.stringify({ at: AT, engine: "claude", asked: "a", did: "b", files: [], ...fields });

  it("turnsOf reads the app's history lines", () => {
    const turns = turnsOf(fixture("app-history.jsonl"));
    assert.equal(turns.length, 3);
    assert.deepEqual(turns[0], { at: AT, engine: "claude", asked: "Make the title bigger and move it up a little", did: "I made the title larger and moved it up about 40 pixels.", files: ["index.html"] });
    assert.deepEqual(turns.map((turn) => turn.at), [AT, "2026-10-27T19:52:30.000Z", "2026-10-27T20:05:02.000Z"]);
    assert.deepEqual(turns.map((turn) => turn.files), [["index.html"], ["compositions/logo.html", "assets/logos/brimm-logo.png"], []]);
    assert.deepEqual(Object.keys(turns[2]), ["at", "engine", "asked", "did", "files"]);
  });
  it("turnsOf passes over a line that is not JSON, and one with a date that is not a date", () => {
    // A date with a space round it is not one to the command line either.
    const text = ["not json at all", '{"at":"not a date","asked":"x"}', '{"asked":"no date"}', line({ asked: "kept" }), "{", "", '{"at":""}', '{"at":5}', line({ at: ` ${AT}`, asked: "padded" })].join("\n");
    assert.deepEqual(turnsOf(text).map((turn) => turn.asked), ["kept"]);
  });
  it("turnsOf passes over a line that is JSON but not a turn", () => {
    assert.deepEqual(turnsOf(["5", "null", "true", '"text"', "[]", "[1,2]", "{}"].join("\n")), []);
  });
  it("turnsOf cuts a text at 2,000 characters", () => {
    const long = "x".repeat(2500);
    const [turn] = turnsOf(line({ asked: long, did: long, files: [long, "short.html"], engine: long }));
    assert.deepEqual([turn.asked.length, turn.did.length, turn.engine.length, turn.files[0].length], [2000, 2000, 2000, 2000]);
    assert.equal(turn.files[1], "short.html");
    const exact = "y".repeat(2000);
    assert.equal(turnsOf(line({ asked: exact }))[0].asked, exact);
  });
  it("turnsOf takes a field that is not a text as none, and keeps the rest of the line", () => {
    const [turn] = turnsOf(JSON.stringify({ at: AT, engine: 7, asked: null, did: ["x"], files: ["ok.html", 5, null, "", {}, "also.html"] }));
    assert.deepEqual(turn, { at: AT, engine: "", asked: "", did: "", files: ["ok.html", "also.html"] });
    assert.deepEqual(turnsOf(JSON.stringify({ at: AT, files: "index.html" }))[0].files, []);
    assert.deepEqual(turnsOf(JSON.stringify({ at: AT }))[0], { at: AT, engine: "", asked: "", did: "", files: [] });
  });
  it("turnsOf reads a file with Windows line ends, blank lines and no newline at the end, in the order it is written", () => {
    const text = `${line({ asked: "one" })}\r\n\r\n${line({ asked: "two" })}\r\n${line({ asked: "three" })}`;
    assert.deepEqual(turnsOf(text).map((turn) => turn.asked), ["one", "two", "three"]);
  });

  it("turnsOf of nothing is []", () => {
    for (const nothing of ["", null, undefined, "\n\n", "   "]) assert.deepEqual(turnsOf(nothing), [], String(nothing));
    for (const notText of [5, {}, [], true]) assert.deepEqual(turnsOf(notText), [], String(notText));
    // Not a text, though it would read as one.
    for (const notText of [[line()], Object(line())]) assert.deepEqual(turnsOf(notText), [], typeof notText);
  });
});

describe("what was done in the app, in her words", () => {
  const NEW_YORK = "America/New_York";
  const turns = turnsOf(fixture("app-history.jsonl"));
  /** A turn at a moment, with something to say. */
  const turn = (at, fields = {}) => ({ at, engine: "claude", asked: "make it blue", did: "", files: [], ...fields });

  it("plainTurns says a turn in her words, newest first", () => {
    assert.deepEqual(plainTurns(turns, { tz: NEW_YORK }), [
      "4:05 pm: you asked What font is the title in?; HyperFrames did It's Josefin Sans, medium weight.",
      "3:52 pm: you asked Add the BRIMM logo in the bottom right corner for the whole video; HyperFrames did I added the logo at the bottom right and kept it on for the whole video.; changed logo.html, brimm-logo.png",
      "3:41 pm: you asked Make the title bigger and move it up a little; HyperFrames did I made the title larger and moved it up about 40 pixels.; changed index.html"
    ]);
  });
  it("plainTurns says no path and no flag", () => {
    for (const said of plainTurns(turns, { tz: NEW_YORK })) assert.ok(!/\/|(^|\s)--?[a-z]|npx/.test(said), said);
    const [said] = plainTurns([turn("2026-10-27T19:41:08.000Z", { files: ["/Users/sallie/BRIMM Video Work/E/P/index.html", "compositions/sub/intro.html", "../x/y.css", "assets/fonts/"] })], { tz: NEW_YORK });
    assert.equal(said, "3:41 pm: you asked make it blue; changed index.html, intro.html, y.css");
  });
  it("plainTurns tells the time in the time zone it is given", () => {
    assert.deepEqual(plainTurns(turns, { tz: "UTC" }).map((said) => said.slice(0, 7)), ["8:05 pm", "7:52 pm", "7:41 pm"]);
    assert.deepEqual(plainTurns(turns, { tz: "Asia/Tokyo" }).map((said) => said.slice(0, 7)), ["5:05 am", "4:52 am", "4:41 am"]);
  });
  it("plainTurns writes the hour as a person does, noon and midnight too, in lower case", () => {
    const at = (iso) => plainTurns([turn(iso)], { tz: NEW_YORK })[0].match(/^(\d{1,2}:\d{2} [ap]m): /)[1];
    assert.equal(at("2026-10-27T16:00:00.000Z"), "12:00 pm");
    assert.equal(at("2026-10-27T04:05:00.000Z"), "12:05 am");
    assert.equal(at("2026-10-27T14:07:00.000Z"), "10:07 am");
    assert.equal(at("2026-10-28T03:59:00.000Z"), "11:59 pm");
    for (const said of plainTurns(turns, { tz: NEW_YORK })) assert.match(said, /^\d{1,2}:\d{2} (am|pm): /);
  });
  it("plainTurns puts the newest first whatever order it is given, and leaves what it is given as it was", () => {
    const given = Object.freeze([...turns].reverse());
    const said = plainTurns(given, { tz: NEW_YORK });
    assert.deepEqual(said.map((s) => s.slice(0, 7)), ["4:05 pm", "3:52 pm", "3:41 pm"]);
    assert.equal(given[0].at, "2026-10-27T20:05:02.000Z");
  });
  it("plainTurns puts the later line first when two turns have the same time", () => {
    const said = plainTurns([turn("2026-10-27T19:41:08.000Z", { asked: "first" }), turn("2026-10-27T19:41:08.000Z", { asked: "second" })], { tz: NEW_YORK });
    assert.deepEqual(said, ["3:41 pm: you asked second", "3:41 pm: you asked first"]);
  });
  it("plainTurns says only what there is to say", () => {
    const AT = "2026-10-27T19:41:08.000Z";
    assert.deepEqual(plainTurns([turn(AT, { asked: "", did: "I tidied the captions.", files: [] })], { tz: NEW_YORK }), ["3:41 pm: HyperFrames did I tidied the captions."]);
    assert.deepEqual(plainTurns([turn(AT, { asked: "make it blue", did: "", files: [] })], { tz: NEW_YORK }), ["3:41 pm: you asked make it blue"]);
    assert.deepEqual(plainTurns([turn(AT, { asked: "", did: "", files: ["a/index.html"] })], { tz: NEW_YORK }), ["3:41 pm: changed index.html"]);
    // A turn with nothing in it says nothing, rather than something that is not so.
    assert.deepEqual(plainTurns([turn(AT, { asked: "", did: "", files: [] }), turn(AT, { asked: " \n ", did: "\t", files: ["", "dir/"] })], { tz: NEW_YORK }), []);
  });
  it("plainTurns puts a turn on one line, and names each file once", () => {
    const [said] = plainTurns([turn("2026-10-27T19:41:08.000Z", { asked: "make it\n\nblue,\n  then bigger", did: "Done.\r\nBoth.", files: ["a/index.html", "b/index.html", "index.html", "x/two.css"] })], { tz: NEW_YORK });
    assert.equal(said, "3:41 pm: you asked make it blue, then bigger; HyperFrames did Done. Both.; changed index.html, two.css");
    assert.ok(!/[\r\n]/.test(said));
  });
  it("plainTurns passes over a turn it cannot date, and takes nothing for nothing", () => {
    const AT = "2026-10-27T19:41:08.000Z";
    assert.deepEqual(plainTurns([turn("not a date"), turn(undefined), turn(5), null, undefined, "text", turn(AT)], { tz: NEW_YORK }), ["3:41 pm: you asked make it blue"]);
    for (const nothing of [[], null, undefined, "text", 5]) assert.deepEqual(plainTurns(nothing, { tz: NEW_YORK }), [], String(nothing));
  });
  it("plainTurns refuses a time zone that is not one, rather than tell a wrong time", () => {
    assert.throws(() => plainTurns(turns, { tz: "Not/AZone" }), RangeError);
  });
});

// --- PR 6: what the app's history holds, in her words ---

/** The pattern every test of what she reads holds a line to: no path, no flag, no command (tests/edit-app.test.js has the same). */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs/;
const NEW_YORK = "America/New_York";

describe("the pinned history call", () => {
  const given = { home: HOME, node: NODE, project: `${HOME}/BRIMM Video Work/E/P` };
  it("is `node <the pinned program> history --json --limit 20 --dir <project>`, in that order, with nothing of npx in it", () => {
    const { file, args } = historyArgs(given);
    assert.equal(file, NODE);
    assert.deepEqual(args, [cliPath(HOME), "history", "--json", "--limit", "20", "--dir", given.project]);
    assert.equal(VERSIONS_LIMIT, 20);
    assert.ok(!args.includes("npx"));
  });
  it("is given only absolute paths, so that a path can never be taken for an option", () => {
    for (const project of ["", "BRIMM Video Work/E/P", "./P", "--json", undefined, null, 5]) assert.throws(() => historyArgs({ ...given, project }), /absolute/, String(project));
    for (const node of ["node", "", undefined]) assert.throws(() => historyArgs({ ...given, node }), /absolute/, String(node));
    for (const home of ["Users/sallie", "", undefined]) assert.throws(() => historyArgs({ ...given, home }), /absolute/, String(home));
    assert.throws(() => historyArgs(undefined), /absolute/);
  });
});

describe("what `history --json` printed", () => {
  const printed = fixture("history-entries.json");
  const entry = (over = {}) => ({ id: "x", who: { kind: "agent", name: "Framey" }, label: "l", startedAt: 1793130068000, endedAt: 1793130091906, files: ["a.html"], undone: false, pinned: false, ...over });
  const printing = (...entries) => JSON.stringify({ entries, _meta: { version: PIN.version, updateAvailable: false } });

  it("reads the fixture into six entries, in the command line's order, newest first", () => {
    const read = readHistory(printed, 0);
    assert.equal(read.ok, true);
    assert.equal(read.entries.length, 6);
    assert.deepEqual(read.entries[0], { kind: "agent", label: "Undid: Make the title bigger and move it up a little", endedAt: 1793131961120, files: ["index.html"], undone: false, pinned: false });
    assert.deepEqual(Object.keys(read.entries[0]), ["kind", "label", "endedAt", "files", "undone", "pinned"]);
    assert.deepEqual(read.entries.map((e) => e.kind), ["agent", "person", "outside", "agent", "agent", "agent"]);
    assert.deepEqual(read.entries.map((e) => [e.undone, e.pinned]), [[false, false], [false, false], [false, false], [false, true], [false, false], [true, false]]);
    assert.deepEqual(read.entries[3].files, ["compositions/logo.html", "assets/logos/brimm-logo.png"]);
    assert.deepEqual(read.entries.map((e) => e.endedAt), [...read.entries.map((e) => e.endedAt)].sort((a, b) => b - a));
  });
  it("reads no entries as none, when the command line says so with status 0", () => {
    assert.deepEqual(readHistory(fixture("history-empty.json"), 0), { ok: true, entries: [] });
  });
  it("cannot read an exit status other than 0, an empty or bad output, or one that is not the list it prints", () => {
    for (const code of [1, 2, null, undefined, "0", -1]) assert.deepEqual(readHistory(printed, code), { ok: false }, String(code));
    const outputs = ["", "   ", "not json", "{", "[]", "null", "5", '"text"', "{}", '{"entries": 5}', '{"entries": {}}', '{"entries": null}', '{"ok": false, "error": "No entry"}', '{"ok": false, "entries": [], "error": "x"}',
      undefined, null, 5, {}, [], Buffer.from(printed)];
    for (const stdout of outputs) assert.deepEqual(readHistory(stdout, 0), { ok: false }, String(stdout).slice(0, 30));
  });
  it("cannot read a list whose entries none can be read, which is not the same as a list with none", () => {
    assert.deepEqual(readHistory(JSON.stringify({ entries: [5, null, "x", [], {}, { label: "no time" }, { endedAt: "soon" }, { endedAt: null }, { endedAt: true }] }), 0), { ok: false });
    assert.deepEqual(readHistory(printing(), 0), { ok: true, entries: [] });
  });
  it("passes over an entry it cannot date and keeps the others, in the order given", () => {
    const read = readHistory(printing(entry({ label: "kept" }), entry({ endedAt: "soon" }), entry({ endedAt: null }), entry({ endedAt: undefined }), 5, null, entry({ label: "also kept" })), 0);
    assert.deepEqual(read.entries.map((e) => e.label), ["kept", "also kept"]);
  });
  it("passes over an entry whose time no date can hold and keeps the others: a Date goes no further than 8.64e15 milliseconds either way", () => {
    const far = [1e20, -1e20, 8.64e15 + 1, -8.64e15 - 1, 1e300, -1e300, Number.MAX_VALUE];
    const read = readHistory(printing(entry({ label: "kept" }), ...far.map((endedAt) => entry({ label: `far ${endedAt}`, endedAt })), entry({ label: "also kept" })), 0);
    assert.deepEqual(read.entries.map((e) => e.label), ["kept", "also kept"]);
    // The edges are times: they are kept.
    const edges = readHistory(printing(entry({ label: "late", endedAt: 8.64e15 }), entry({ label: "early", endedAt: -8.64e15 })), 0);
    assert.deepEqual(edges.entries.map((e) => [e.label, e.endedAt]), [["late", 8.64e15], ["early", -8.64e15]]);
  });
  it("cannot read a list whose every entry has such a time, as it cannot read one whose entries have no time", () => {
    const far = [1e20, -1e20, 8.64e15 + 1, 1e300];
    for (const endedAt of far) assert.deepEqual(readHistory(printing(entry({ endedAt })), 0), { ok: false }, String(endedAt));
    assert.deepEqual(readHistory(printing(...far.map((endedAt) => entry({ endedAt }))), 0), { ok: false });
  });
  it("takes a part that is not what it should be as none, and keeps the rest", () => {
    const [bare] = readHistory(printing({ endedAt: 1793130091906 }), 0).entries;
    assert.deepEqual(bare, { kind: "", label: "", endedAt: 1793130091906, files: [], undone: false, pinned: false });
    const [odd] = readHistory(printing(entry({ who: "Framey", label: 7, files: "index.html", undone: "yes", pinned: 1 })), 0).entries;
    assert.deepEqual(odd, { kind: "", label: "", endedAt: 1793130091906, files: [], undone: false, pinned: false });
    const [mixed] = readHistory(printing(entry({ who: { kind: 5, name: "x" }, files: ["ok.html", 5, null, "", {}, "also.html"] })), 0).entries;
    assert.deepEqual([mixed.kind, mixed.files], ["", ["ok.html", "also.html"]]);
    // Only a true is a flag: whether it was undone is not guessed at.
    const [flags] = readHistory(printing(entry({ undone: true, pinned: true })), 0).entries;
    assert.deepEqual([flags.undone, flags.pinned], [true, true]);
  });
  it("cuts a label, a kind and a file at 2,000 characters, as the command line cuts a turn's texts", () => {
    const long = "x".repeat(2500);
    const [cut] = readHistory(printing(entry({ who: { kind: long, name: "n" }, label: long, files: [long, "short.html"] })), 0).entries;
    assert.deepEqual([cut.kind.length, cut.label.length, cut.files[0].length, cut.files[1]], [2000, 2000, 2000, "short.html"]);
  });
});

describe("what she or the app wrote, in a line of hers", () => {
  it("puts it on one line, takes markdown's marks off and says a link as its words", () => {
    assert.equal(plainText("Made the **title** bigger.\n\nNow `index` is\r\n  updated"), "Made the title bigger. Now index is updated");
    assert.equal(plainText("See [the logo](computer://files/logo.png) and [more](https://example.com/a/b)."), "See the logo and more.");
    assert.equal(plainText("a *slanted* and **bold** word, and an address https://example.com/a/b?c=d in it"), "a slanted and bold word, and an address in it");
  });
  it("says a path as its file's name", () => {
    assert.equal(plainText("I moved assets/logos/brimm-logo.png and /Users/x/Work/index.html, ../up/y.css and ~/a.mov"), "I moved brimm-logo.png and index.html, y.css and a.mov");
    assert.equal(plainText("Cut media/recording.mp4 now"), "Cut recording.mp4 now");
    assert.equal(plainText("the assets/fonts/ folder and file:///Users/x/a.png"), "the fonts folder and a.png");
  });
  it("says any other slash as a space, and leaves a bare one out", () => {
    assert.equal(plainText("a 9/16 frame, and/or square, w/ captions"), "a 9 16 frame, and or square, w captions");
    assert.equal(plainText("red / blue // green"), "red blue green");
  });
  it("leaves a flag out and makes any other double hyphen one", () => {
    assert.equal(plainText("Run it with --limit 20 or --dir=/x/y now"), "Run it with 20 or now");
    assert.equal(plainText("wait -- no, a--b and ---"), "wait - no, a-b and -");
    assert.equal(plainText("keep -20% and -y"), "keep -20% and -y");
  });
  it("says nothing of a text with a command in it, since nothing can be made plain of it", () => {
    for (const text of ["I ran npx hyperframes lint", "then npm install", "run node something", "Node was slow", "see edit.js", "open hyperframes.mjs", "/usr/local/bin/node"]) assert.equal(plainText(text), "", text);
    // A word that only holds one of them is a word.
    assert.equal(plainText("node_modules, nodes and an npxy thing"), "node_modules, nodes and an npxy thing");
  });
  it("cuts a long text at a word and ends it with an ellipsis, and leaves exactly that long alone", () => {
    assert.equal(QUOTE_MOST, 200);
    const exact = `${"word ".repeat(39)}wordy`;
    assert.equal(exact.length, 200);
    assert.equal(plainText(exact), exact);
    const cut = plainText("word ".repeat(100));
    assert.equal(cut, `${"word ".repeat(39)}word…`);
    assert.ok(cut.length <= QUOTE_MOST + 1);
    assert.equal(plainText("x".repeat(201)), `${"x".repeat(200)}…`);
    assert.equal(plainText("short, and cut at nothing."), "short, and cut at nothing.");
    assert.equal(plainText("a b c d e f", 5), "a b c…");
    assert.equal(plainText("lots of words here", 8), "lots of…");
  });
  it("says nothing for what is not a text, or has nothing in it", () => {
    for (const nothing of [undefined, null, 5, {}, ["a"], true, "", "   ", "\n\t", "**", "``", "/", "//", "--"]) assert.equal(plainText(nothing), "", String(nothing));
  });
  it("never gives a path, a flag or a command, whatever it is given", () => {
    const nasty = [
      "see assets/fonts/a.ttf and compositions/x.html", "/Users/sallie/BRIMM Video Work/E/P/index.html", "C:\\Users\\x\\a.png", "npx hyperframes lint --fix", "node edit.js app",
      "run `npx hyperframes history --limit 20`", "[go](file:///Users/x/a.png)", "a//b///c", "--", "---", "a --b -- c--d", "9/16 and 16/9, w/o, and/or", "http://example.com/a?b=c",
      "https://example.com", "hyperframes.mjs open", "~/Movies/x.mp4", "../../etc/passwd", "./a", "a/", "/", "//", "node_modules/.bin/hyperframes", "x".repeat(5000), "\u0000/\u0000",
      "end /", "/ start", "a/b c/d.e f/g/h", "**bold/path.txt**", "`code --flag`", "[a](b) [c](d/e)", "\n/\n--\n", "Node.js and NPM", "see 1/2 and 3/4/5", "mid--dash--dash", "-- --flag --- -- x"
    ];
    for (const text of nasty) {
      const said = plainText(text);
      assert.doesNotMatch(said, PLAIN, `${JSON.stringify(text)} -> ${JSON.stringify(said)}`);
      assert.doesNotMatch(said, /\bnpm\b/i, said);
      assert.doesNotMatch(said, /[\r\n]/, said);
    }
  });
});

describe("what was done in the app, in her words, with what the real history has in it", () => {
  const AT = "2026-10-27T19:41:08.000Z";
  const turn = (fields = {}) => ({ at: AT, engine: "claude", asked: "make it blue", did: "", files: [], ...fields });
  const say = (fields) => plainTurns([turn(fields)], { tz: NEW_YORK });

  it("says what she asked and what the app did without a path, a link's address, a flag or markdown", () => {
    assert.deepEqual(say({ asked: "Move **it** to assets/logos/a.png --now", did: "Done: see [it](x://y/z.html).\n\n- the title\n- the logo" }), ["3:41 pm: you asked Move it to a.png; HyperFrames did Done: see it. - the title - the logo"]);
  });
  it("leaves out a text it cannot make plain, and says the rest", () => {
    assert.deepEqual(say({ asked: "run npx hyperframes lint", did: "I checked it.", files: ["index.html"] }), ["3:41 pm: HyperFrames did I checked it.; changed index.html"]);
    assert.deepEqual(say({ asked: "run npx hyperframes lint", did: "node said so", files: [] }), []);
  });
  it("cuts what she asked and what the app did at 200 characters", () => {
    const [said] = say({ asked: "ask ".repeat(100), did: "did ".repeat(100) });
    assert.equal(said, `3:41 pm: you asked ${"ask ".repeat(49)}ask…; HyperFrames did ${"did ".repeat(49)}did…`);
  });
  it("names up to five files, and says how many when there are more", () => {
    assert.equal(FILES_MOST, 5);
    const names = (n) => Array.from({ length: n }, (_, i) => `compositions/c${i + 1}.html`);
    assert.deepEqual(say({ asked: "", files: names(5) }), ["3:41 pm: changed c1.html, c2.html, c3.html, c4.html, c5.html"]);
    assert.deepEqual(say({ asked: "", files: names(6) }), ["3:41 pm: changed 6 files"]);
    assert.deepEqual(say({ asked: "", files: [...names(6), "a/c1.html", "b/c2.html"] }), ["3:41 pm: changed 6 files"], "each file is counted once");
  });
  it("leaves out a file whose name holds a command or a double hyphen", () => {
    assert.deepEqual(say({ asked: "", files: ["node.html", "a--b.png", "x/npx.js", "ok.html", "edit.js"] }), ["3:41 pm: changed ok.html"]);
  });
  it("never says a path, a flag or a command, whatever the turn holds", () => {
    const said = plainTurns(turnsOf(fixture("app-history.jsonl")), { tz: NEW_YORK });
    for (const line of said) assert.doesNotMatch(line, PLAIN, line);
    const odd = plainTurns([turn({ asked: "move /Users/x/a.png --now and a/b", did: "see [x](/y/z) -- ok", files: ["/a/--b.html", "node_modules/.bin/x"] })], { tz: NEW_YORK });
    for (const line of odd) assert.doesNotMatch(line, PLAIN, line);
  });
});

describe("the versions, in her words", () => {
  const { entries } = readHistory(fixture("history-entries.json"), 0);
  const one = (over = {}) => ({ kind: "agent", label: "make it blue", endedAt: Date.parse("2026-10-27T19:41:08.000Z"), files: [], undone: false, pinned: false, ...over });
  const say = (...over) => plainVersions(over.map((o) => one(o)), { tz: NEW_YORK });

  it("says the fixture's six entries, newest first: the label, then who it was, and whether it was undone or is kept, and which files", () => {
    assert.deepEqual(plainVersions(entries, { tz: NEW_YORK }), [
      "4:12 pm: Undid: Make the title bigger and move it up a little (HyperFrames; changed index.html)",
      "4:07 pm: Imported media (you; changed theme-song.mp3)",
      "4:06 pm: Changed outside the app (outside HyperFrames; changed recording.transcript.json)",
      "3:52 pm: recording.mp4 Add the BRIMM logo in the bottom right corner for the whole video (HyperFrames; kept; changed logo.html, brimm-logo.png)",
      "3:47 pm: 1. Remove “um,”: Cut recording.mp4 from 12.4s to 12.8s so the take is clean. (HyperFrames; changed index.html)",
      "3:41 pm: Make the title bigger and move it up a little (HyperFrames; undone; changed index.html)"
    ]);
  });
  it("says who from the kind (readHistory keeps no name), and nothing of a kind it does not know", () => {
    // The same time for all of them, so that they stay in the order given.
    assert.deepEqual(say({ kind: "agent" }, { kind: "person" }, { kind: "outside" }, { kind: "robot" }, { kind: "" }), [
      "3:41 pm: make it blue (HyperFrames)", "3:41 pm: make it blue (you)", "3:41 pm: make it blue (outside HyperFrames)", "3:41 pm: make it blue", "3:41 pm: make it blue"
    ]);
  });
  it("says undone before kept, and each only when it is so", () => {
    assert.deepEqual(say({ undone: true, pinned: true }, { undone: true }, { pinned: true }, {}), [
      "3:41 pm: make it blue (HyperFrames; undone; kept)", "3:41 pm: make it blue (HyperFrames; undone)", "3:41 pm: make it blue (HyperFrames; kept)", "3:41 pm: make it blue (HyperFrames)"
    ]);
  });
  it("says a label that is empty or not plain as a change, and still tells the entry", () => {
    assert.deepEqual(say({ label: "" }, { label: "   " }, { label: "ran npx hyperframes lint", files: ["index.html"] }, { label: "", kind: "", files: [] }), [
      "3:41 pm: a change (HyperFrames)", "3:41 pm: a change (HyperFrames)", "3:41 pm: a change (HyperFrames; changed index.html)", "3:41 pm: a change"
    ]);
  });
  it("puts a long label, a path and markdown in a label as a line of hers has them", () => {
    assert.deepEqual(say({ label: `**${"word ".repeat(100)}** in assets/fonts/a.ttf` }), [`3:41 pm: ${"word ".repeat(39)}word… (HyperFrames)`]);
    assert.deepEqual(say({ label: "Put it in compositions/lt/card.html --now" }), ["3:41 pm: Put it in card.html (HyperFrames)"]);
  });
  it("names up to five files, and says how many when there are more", () => {
    const names = (n) => Array.from({ length: n }, (_, i) => `assets/a${i + 1}.png`);
    assert.deepEqual(say({ files: names(5) }), ["3:41 pm: make it blue (HyperFrames; changed a1.png, a2.png, a3.png, a4.png, a5.png)"]);
    assert.deepEqual(say({ files: names(30) }), ["3:41 pm: make it blue (HyperFrames; changed 30 files)"]);
    assert.deepEqual(say({ files: ["a/x.png", "b/x.png"] }), ["3:41 pm: make it blue (HyperFrames; changed x.png)"]);
  });
  it("puts the newest first whatever order it is given, and the given order for the same time", () => {
    const given = [one({ label: "old", endedAt: Date.parse("2026-10-27T19:00:00.000Z") }), one({ label: "new", endedAt: Date.parse("2026-10-27T20:00:00.000Z") }), one({ label: "a" }), one({ label: "b" })];
    const frozen = Object.freeze(given.map((e) => Object.freeze(e)));
    assert.deepEqual(plainVersions(frozen, { tz: NEW_YORK }).map((line) => line.match(/^\d+:\d\d [ap]m: (\w+)/)[1]), ["new", "a", "b", "old"]);
  });
  it("tells the time in the time zone it is given, and refuses one that is not one", () => {
    assert.equal(plainVersions([one()], { tz: "UTC" })[0].slice(0, 7), "7:41 pm");
    assert.equal(plainVersions([one()], { tz: "Asia/Tokyo" })[0].slice(0, 7), "4:41 am");
    assert.throws(() => plainVersions([one()], { tz: "Not/AZone" }), RangeError);
  });
  it("passes over an entry it cannot date, and takes nothing for nothing", () => {
    assert.deepEqual(plainVersions([one({ endedAt: "soon" }), one({ endedAt: undefined }), null, 5, "text", one()], { tz: NEW_YORK }), ["3:41 pm: make it blue (HyperFrames)"]);
    for (const nothing of [[], null, undefined, "text", 5, {}]) assert.deepEqual(plainVersions(nothing, { tz: NEW_YORK }), [], String(nothing));
  });
  it("passes over an entry whose time no date can hold, which would otherwise stop the whole list, and tells those at the edges", () => {
    const far = [1e20, -1e20, 8.64e15 + 1, -8.64e15 - 1, 1e300, -1e300, Number.MAX_VALUE, Infinity, -Infinity, NaN];
    assert.deepEqual(plainVersions([...far.map((endedAt) => one({ endedAt })), one()], { tz: NEW_YORK }), ["3:41 pm: make it blue (HyperFrames)"]);
    assert.deepEqual(plainVersions(far.map((endedAt) => one({ endedAt })), { tz: NEW_YORK }), []);
    // The edges are times a Date holds, and are told.
    assert.deepEqual(plainVersions([one({ endedAt: 8.64e15 }), one({ endedAt: -8.64e15 })], { tz: "UTC" }), ["12:00 am: make it blue (HyperFrames)", "12:00 am: make it blue (HyperFrames)"]);
  });
  it("never says a path, a flag or a command, whatever the entries hold", () => {
    for (const line of plainVersions(entries, { tz: NEW_YORK })) assert.doesNotMatch(line, PLAIN, line);
    for (const line of say({ label: "move /Users/x/a.png --now and a/b", files: ["/a/--b.html", "node_modules/.bin/x", "node.html"] }, { label: "npx hyperframes history --limit 20" })) assert.doesNotMatch(line, PLAIN, line);
  });
});

describe("the fixture of the versions is what the pinned command line prints", () => {
  const parsed = JSON.parse(fixture("history-entries.json"));
  it("holds the keys of the command line's entries, in its order, for each kind of who", () => {
    assert.deepEqual(Object.keys(parsed), ["entries", "_meta"]);
    assert.deepEqual(Object.keys(parsed._meta), ["version", "updateAvailable"]);
    assert.equal(parsed._meta.version, PIN.version);
    for (const entry of parsed.entries) {
      assert.deepEqual(Object.keys(entry), ["id", "who", "label", "startedAt", "endedAt", "files", "undone", "pinned"]);
      assert.deepEqual(Object.keys(entry.who), ["kind", "name"]);
      assert.ok(entry.files.every((file) => typeof file === "string"));
      assert.ok(Number.isFinite(entry.startedAt) && entry.endedAt >= entry.startedAt);
    }
    assert.deepEqual(parsed.entries.map((e) => `${e.who.kind}:${e.who.name}`), ["agent:Framey", "person:You", "outside:Outside", "agent:Framey", "agent:Framey", "agent:Framey"]);
    assert.deepEqual([parsed.entries.filter((e) => e.undone).length, parsed.entries.filter((e) => e.pinned).length], [1, 1]);
    assert.deepEqual(parsed.entries.map((e) => e.endedAt), [...parsed.entries.map((e) => e.endedAt)].sort((a, b) => b - a), "newest first, as the command line lists them");
  });
  it("holds made-up ids in the shape of a chat's, no scratch or real path, and the day of the history fixture's turns", () => {
    for (const entry of parsed.entries) assert.match(entry.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(new Set(parsed.entries.map((e) => e.id)).size, parsed.entries.length);
    assert.ok(!/\/tmp\/|\/home\/|\/root\/|\/Users\/|pr1-scratch|\/private\/var|BRIMM Video Work/.test(fixture("history-entries.json")));
    const day = (ms) => new Date(ms).toISOString().slice(0, 10);
    assert.deepEqual([...new Set(parsed.entries.map((e) => day(e.endedAt)))], [day(Date.parse(turnsOf(fixture("app-history.jsonl"))[0].at))]);
  });
});

describe("the fixtures are what the pinned command line prints", () => {
  const JSON_FIXTURES =["catch-up-empty.json", "history-empty.json", "open-not-installed.json", "open-opened.json", "open-opened-handed-over.json"];
  const PROJECT = "/Users/sallie/BRIMM Video Work/Pricing talk/Pricing talk main 3fa9c1";

  it("hold the shapes the command line's own code gives them", () => {
    const parse = (name) => JSON.parse(fixture(name));
    assert.deepEqual(Object.keys(parse("history-empty.json")), ["entries", "_meta"]);
    assert.deepEqual(parse("history-empty.json").entries, []);
    assert.deepEqual(parse("catch-up-empty.json"), { project: PROJECT, turns: [], files: [] });
    assert.deepEqual(Object.keys(parse("open-not-installed.json")), ["project", "opened", "reason", "downloadUrl"]);
    assert.deepEqual(Object.keys(parse("open-opened.json")), ["project", "opened", "app", "handedOver"]);
    assert.equal(parse("open-opened.json").handedOver, null);
    // catchUp comes last, and only when the app was handed the conversation.
    assert.deepEqual(Object.keys(parse("open-opened-handed-over.json")), ["project", "opened", "app", "handedOver", "catchUp"]);
    assert.deepEqual(Object.keys(parse("open-opened-handed-over.json").handedOver), ["engine", "sessionId"]);
    assert.equal(parse("open-opened-handed-over.json").handedOver.engine, "claude");
  });
  it("name the made-up project of an episode on Sallie's laptop, and no real or scratch path", () => {
    for (const name of JSON_FIXTURES.filter((n) => n !== "history-empty.json")) assert.equal(JSON.parse(fixture(name)).project, PROJECT, name);
    for (const name of [...JSON_FIXTURES, "help.txt", "app-history.jsonl"]) assert.ok(!/\/tmp\/|\/home\/|\/root\/|pr1-scratch|\/private\/var/.test(fixture(name)), name);
  });
  it("hold a made-up chat id, in the shape SESSION_ID accepts, which is the one the other tests use", () => {
    assert.match(CHAT, SESSION_ID);
    assert.equal(JSON.parse(fixture("open-opened-handed-over.json")).handedOver.sessionId, CHAT);
  });
});

describe("hyperframes.js", () => {
  it("runs no program, reads nothing from the environment, and reads no disk but its pin file and, in toolchainHolds alone, the toolchain's folder, which it only looks at", () => {
    const source = readFileSync(new URL("../hyperframes.js", import.meta.url), "utf8");
    // All it imports: the two modules it builds on, and the two Node ones that make a path and read files.
    assert.deepEqual([...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort(), ["./scan.js", "./settings.js", "node:fs", "node:path"]);
    assert.doesNotMatch(source, /\bprocess\b|\bimport\(|\beval\(|\bfetch\(|\brequire\(/);
    // It reads twice: its pin file, and in toolchainHolds a file of the toolchain's folder; it looks at one more path, the program's.
    // It writes, moves, removes and makes nothing, and starts nothing.
    assert.equal(source.match(/readFileSync\(/g).length, 2);
    assert.match(source, /readFileSync\(new URL\("\.\/hyperframes\.pin\.json", import\.meta\.url\)/);
    const holds = source.slice(source.indexOf("export function toolchainHolds"), source.indexOf("/** What a version looks like"));
    assert.ok(holds.includes("readFileSync(join(dir, file)") && holds.includes("statSync(cliPath(home))"), holds);
    assert.equal(source.match(/statSync\(/g).length, 1);
    assert.doesNotMatch(source, /writeFileSync|appendFileSync|mkdirSync|renameSync|rmSync|unlinkSync|copyFileSync|chmodSync|symlinkSync|spawn|exec(?:Sync|File)?\(/);
  });
});
