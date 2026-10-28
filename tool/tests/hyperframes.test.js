// The pinned HyperFrames command line's rules (hyperframes.js; architecture spec 2026-10-27, F3, F6, F7 and sections 4.6, 5.3, 5.5
// and 5.6). The module is pure, so no test here runs a program: what the command line prints is read from the fixtures in
// tests/fixtures/hyperframes-0.8.208/. Four are captures from the pinned version itself, run in a scratch folder (help.txt,
// history-empty.json, catch-up-empty.json, open-not-installed.json). The two that need the Mac app (open-opened.json and
// open-opened-handed-over.json) are what its own code for `open` prints, run with the platform and the opener stubbed, since only
// a Mac with the app can print them; A0b replaces them with captures. app-history.jsonl is made up. A path in a fixture is the
// made-up one of an episode on Sallie's laptop.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SESSION_ID } from "../scan.js";
import { PIN, pinFrom, COMMANDS, toolchainDir, cliPath, openArgs, commandsIn, unclassified, denyRules, settingsFor, childEnv, handoverAllowed, readOpen, turnsOf, plainTurns } from "../hyperframes.js";

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
  const ENV = { HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1", DISABLE_FEEDBACK_COMMAND: "1", CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1" };

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

  it("settingsFor(\"main\") holds the deny rules and four variables, and nothing else", () => {
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
    // Everything main denies a clip denies, the rules are sorted, and the variables are the same four.
    assert.deepEqual(clip.permissions.deny.filter((rule) => rule !== "WebFetch" && rule !== "WebSearch"), main.permissions.deny);
    assert.deepEqual(clip.permissions.deny, [...clip.permissions.deny].sort());
    assert.deepEqual(clip.env, ENV);
    assert.deepEqual(Object.keys(clip), ["permissions", "env"]);
    assert.deepEqual(Object.keys(clip.permissions), ["deny"]);
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
    AWS_SECRET_ACCESS_KEY: "made-up", AWS_ACCESS_KEY_ID: "made-up", GITHUB_TOKEN: "ghp_made-up", OPENROUTER_API_KEY: "made-up", HEYGEN_API_KEY: "made-up",
    CLAUDE_CODE_SESSION_ID: "11111111-2222-4333-8444-555555555555", CODEX_THREAD_ID: "thread-1", GROK_SESSION_ID: "grok-1",
    NODE_OPTIONS: "--require /somewhere/evil.js", NODE_EXTRA_CA_CERTS: "/somewhere/ca.pem", SSH_AUTH_SOCK: "/tmp/agent.1", DYLD_INSERT_LIBRARIES: "/somewhere/lib.dylib",
    HYPERFRAMES_DESKTOP_PROJECT: "/somewhere", XDG_CONFIG_HOME: "/somewhere"
  };
  const NAMES = ["HOME", "HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_SKIP_SKILLS", "LANG", "PATH"];

  it("childEnv holds exactly these names", () => {
    const env = childEnv({ base: BASE, node: NODE });
    assert.deepEqual(Object.keys(env).sort(), NAMES);
    assert.deepEqual(env, { PATH: "/opt/homebrew/bin:/usr/bin:/bin", HOME, LANG: "en_GB.UTF-8", HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1" });
    for (const gone of ["ANTHROPIC_API_KEY", "HTTPS_PROXY", "AWS_SECRET_ACCESS_KEY", "GITHUB_TOKEN", "CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID", "GROK_SESSION_ID"]) assert.ok(!(gone in env), gone);
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

describe("the fixtures are what the pinned command line prints", () => {
  const JSON_FIXTURES = ["catch-up-empty.json", "history-empty.json", "open-not-installed.json", "open-opened.json", "open-opened-handed-over.json"];
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
  it("runs no program, reads nothing from the environment, and reads no disk but its pin file", () => {
    const source = readFileSync(new URL("../hyperframes.js", import.meta.url), "utf8");
    // All it imports: the two modules it builds on, and the two Node ones that make a path and read one file.
    assert.deepEqual([...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort(), ["./scan.js", "./settings.js", "node:fs", "node:path"]);
    assert.doesNotMatch(source, /\bprocess\b|\bimport\(|\beval\(|\bfetch\(|\brequire\(/);
    assert.equal(source.match(/readFileSync\(/g).length, 1);
    assert.match(source, /readFileSync\(new URL\("\.\/hyperframes\.pin\.json", import\.meta\.url\)/);
  });
});
