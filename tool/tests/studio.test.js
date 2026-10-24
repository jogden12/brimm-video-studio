// Sallie's folder for Claude, ~/BRIMM Video Studio (studio.js): its CLAUDE.md, its settings, its skill and Pictures/, and the
// guard hook that lets her session run brimm-video's edit.js and nothing else. Each test writes into a home folder of its own.
// The hook is run here as Claude Code runs it, by /bin/sh and node, on made-up tool calls: nothing it allows is run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { studioFiles, writeStudio, guardDecision, studioFolder } from "../studio.js";
import { COMMAND_NAMES, HELP, LOCK_CHANGED, editMain } from "../edit.js";
import { EDITS } from "../sessions.js";
import { episodeAs, FOLDER as FOLDER_NAME } from "./episodes.js";
import { episode } from "./phase4.js";

const CHECKOUT = "/Users/sallie/Claude Code/BRIMM video";
const FOLDER = "/Users/sallie/BRIMM Video Studio";
const NODE = "/opt/homebrew/bin/node";
const EDIT = `${NODE} "${CHECKOUT}/tool/edit.js"`;
const bash = (command) => guardDecision({ tool_name: "Bash", tool_input: { command } }, { checkout: CHECKOUT, node: NODE }).decision;
const tool = (tool_name) => guardDecision({ tool_name, tool_input: {} }, { checkout: CHECKOUT, node: NODE }).decision;
/** The guard as Claude Code runs it, in exec form: /bin/sh, the guard's own script in this checkout, and a node. */
const GUARD = join(dirname(fileURLToPath(import.meta.url)), "..", "studio", "guard.sh");
const THIS_CHECKOUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const hook = (input, node = process.execPath, folder = "/Users/sallie/BRIMM Video Studio") => spawnSync("/bin/sh", [GUARD, node, folder], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8" });

/** zsh and bash, either of which may run her session's commands, each without this Mac's own start-up files. */
const SHELLS = [["/bin/zsh", ["-f", "-c"]], ["/bin/bash", ["-c"]]];
/** Runs `check` once for each shell, as a step of its own. A Mac has both shells, but the Linux that runs these tests on
    GitHub has no /bin/zsh: there the zsh step is skipped, saying why, and the bash step still runs. Each shell is a step of
    its own because a test that calls t.skip is counted as skipped even when it then fails, so a skip of the zsh half inside
    one test would hide a failure of the bash half. */
const inEachShell = async (t, check) => {
  for (const shell of SHELLS) {
    const missing = !existsSync(shell[0]) && `${shell[0]} is not on this computer (the Linux that runs the tests on GitHub has no zsh)`;
    await t.test(`in ${shell[0]}`, { skip: missing }, () => check(shell));
  }
};
/** What follows edit.js in `command`. */
const tailOf = (command) => command.slice(command.indexOf('/tool/edit.js"') + '/tool/edit.js"'.length);
/** The words `shell` would give edit.js for `command`, with printf standing in for node and edit.js: the rest of the command
    is run as it is, and printf gives back each word it is given on a line of its own. */
const shellWords = ([shell, flags], command) => {
  const r = spawnSync(shell, [...flags, `printf '%s\\n'${tailOf(command)}`], { encoding: "utf8", env: { PATH: process.env.PATH } });
  assert.equal(r.status, 0, `${shell}: ${r.stderr}`);
  return r.stdout.split("\n").slice(0, -1);
};
/** The words the guard's grammar reads after edit.js in a command it lets through: a space, then a word, again and again; a
    word in quotes runs to the next quote of its kind, and is read without its quotes, and a plain word runs to the next space. */
const grammarWords = (command) => {
  const tail = tailOf(command);
  const words = [];
  for (let at = 1; at <= tail.length; ) {
    const quote = tail[at] === '"' || tail[at] === "'" ? tail[at] : "";
    const end = quote ? tail.indexOf(quote, at + 1) + 1 : tail.indexOf(" ", at) === -1 ? tail.length : tail.indexOf(" ", at);
    words.push(quote ? tail.slice(at + 1, end - 1) : tail.slice(at, end));
    at = end + 1;
  }
  return words;
};
/** The words `shell` gives edit.js for each of `commands`, all in one run of the shell, each command run as Claude Code's
    Bash tool runs it (eval of the command in single quotes, its input from /dev/null), with printf standing in for node
    and edit.js. The shell runs in `dir`, an empty folder that is also its PATH, so a command let through by mistake finds no
    program to run, and a file it makes is seen there. */
const shellWordsOfAll = ([shell, flags], commands, dir) => {
  const END = "\u0001"; // A line that ends each command's words: no word made by randomCommand holds this letter.
  const quoted = (text) => `'${text.replaceAll("'", `'"'"'`)}'`;
  const script = commands.map((c) => `eval ${quoted(`printf '%s\\n'${tailOf(c)}`)} < /dev/null; printf '%s\\n' '${END}'`).join("\n");
  const r = spawnSync(shell, [...flags, script], { cwd: dir, encoding: "utf8", env: { PATH: dir } });
  return r.stdout.split(`${END}\n`).slice(0, -1).map((words) => words.split("\n").slice(0, -1));
};
/** A source of numbers from 0 up to 1, the same ones on every run from the same seed (mulberry32), so a failure can be
    seen again. */
const numbersFrom = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
};
/** A command of node, edit.js and one to four words of random letters, plain, in double quotes or in single quotes, most of
    them a space apart. Most letters are ones a plain word may hold; about one in seven is one the shells read in a way of
    their own, or a quote; and now and then words are joined by nothing, or by ; | & # or a line break. */
const randomCommand = (next) => {
  const pick = (list) => list[Math.floor(next() * list.length)];
  const ODD = ["'", '"', "$", "`", "\\", ";", "&", "|", "(", ")", "<", ">", "{", "}", "[", "]", "*", "?", "~", "=", "#", "!", "^", "\t", "\n", "\r",
    "\u2028", "$(", "${", "$'", "''", "'\\''", "\\\""];
  const letters = (count, plain) => Array.from({ length: count }, () => next() < 0.15 ? pick(ODD) : pick(plain ? "abXY09_.,:+=@%/-" : "abXY09_.,:+=@%/- ")).join("");
  const word = () => {
    const form = pick(["plain", "double", "single"]);
    const count = Math.floor(next() * 6);
    return form === "plain" ? letters(count + 1, true) : form === "double" ? `"${letters(count, false)}"` : `'${letters(count, false)}'`;
  };
  let command = EDIT;
  for (let words = 1 + Math.floor(next() * 4); words > 0; words--) command += (next() < 0.9 ? " " : pick(["", ";", "|", "&", "#", "\n"])) + word();
  return command;
};
/** Commands the guard lets through, each with the words edit.js must be given, in zsh and in bash. */
const ALLOWED = [
  [`${EDIT} episodes`, ["episodes"]],
  [`${EDIT} open "Pricing talk"`, ["open", "Pricing talk"]],
  [`node "${CHECKOUT}/tool/edit.js" open "Talk (Sallie's laptop)"`, ["open", "Talk (Sallie's laptop)"]],
  [`${EDIT} title "Pricing talk" --words "Price it right" --approve`, ["title", "Pricing talk", "--words", "Price it right", "--approve"]],
  [`${EDIT} finish "Pricing talk" --take "main=this Mac"`, ["finish", "Pricing talk", "--take", "main=this Mac"]],
  // Every letter a plain word may hold.
  [`${EDIT} open a_b.c,d:e+f=g@h%i/j-k9`, ["open", "a_b.c,d:e+f=g@h%i/j-k9"]],
  // Words in single quotes, with what would run something outside them: inside, each is only a letter.
  [`${EDIT} title "Pricing talk" --words 'Charge $99 \`now\` \\ok'`, ["title", "Pricing talk", "--words", "Charge $99 `now` \\ok"]],
  [`${EDIT} name "Pricing talk" '"Real" ~/x *? {a,b} (c) ; & | < > =d #e !f $(g) \${h}'`, ["name", "Pricing talk", `"Real" ~/x *? {a,b} (c) ; & | < > =d #e !f $(g) \${h}`]],
  [`${EDIT} name "Pricing talk" ''`, ["name", "Pricing talk", ""]]
];

/** The command lines a skill's text runs: every backticked span that starts with a lowercase word. Flags start with - and are
    not among them. */
const commandsIn = (text) => [...text.matchAll(/`([a-z][^`]*)`/g)].map((m) => m[1]);
/** A skill's section, from its heading to the next heading of its level. */
const sectionOf = (text, heading) => {
  const at = text.indexOf(`\n${heading}`);
  assert.ok(at >= 0, `the skill has no section ${heading}`);
  const end = text.indexOf("\n## ", at + 1);
  return text.slice(at + 1, end < 0 ? undefined : end);
};

describe("her folder's settings", () => {
  it("allow only edit.js, deny the editing and web tools, turn Auto and Bypass off, and start in the default mode, with no read block", () => {
    // Claude Code's read block (blockReadsOutsideWorkingDirectories) takes edit.js's own path for a read outside the folder,
    // and stops every call of it (the review of PR 21, finding 1): the guard decides reads itself.
    // The mode is "default", not dontAsk: dontAsk denies AskUserQuestion, the card she answers what a video is on (spec
    // 2026-10-22, section 7), and the guard refuses everything else in any mode. It leaves the card to Claude Code ("pass"):
    // a hook's "allow" alone changes how the card behaves.
    const s = JSON.parse(studioFiles({ checkout: CHECKOUT, node: NODE, folder: FOLDER })[".claude/settings.json"]);
    assert.equal(tool("AskUserQuestion"), "pass");
    assert.deepEqual(s.permissions, {
      defaultMode: "default",
      allow: [`Bash(${EDIT} *)`],
      deny: ["Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "mcp__*", "Monitor", "RemoteTrigger", "SendMessage"],
      disableBypassPermissionsMode: "disable",
      disableAutoMode: "disable"
    });
  });
  it("turn no hook off: disableAllHooks false beside the permissions and the hook, since the mode rests on the hook (spec 7)", () => {
    const s = JSON.parse(studioFiles({ checkout: CHECKOUT, node: NODE, folder: FOLDER })[".claude/settings.json"]);
    assert.deepEqual(Object.keys(s), ["permissions", "disableAllHooks", "hooks"]);
    assert.equal(s.disableAllHooks, false);
  });
  it("guard every tool with the hook, run without a shell so the paths' spaces and apostrophes stay whole, and block a call when the hook cannot run", () => {
    const s = JSON.parse(studioFiles({ checkout: "/Users/o'hara/Claude Code/BRIMM video", node: NODE, folder: "/Users/o'hara/BRIMM Video Studio" })[".claude/settings.json"]);
    assert.deepEqual(s.hooks, {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "/bin/sh", args: ["/Users/o'hara/Claude Code/BRIMM video/tool/studio/guard.sh", NODE, "/Users/o'hara/BRIMM Video Studio"], onFailure: "block" }] }]
    });
  });
  it("name the checkout in the skill, with its spaces, and leave no {{ }} behind", () => {
    const files = studioFiles({ checkout: CHECKOUT, node: NODE });
    assert.deepEqual(Object.keys(files).sort(), [".claude/settings.json", ".claude/skills/brimm-edit/SKILL.md", "CLAUDE.md"]);
    assert.ok(files[".claude/skills/brimm-edit/SKILL.md"].includes(EDIT));
    for (const text of Object.values(files)) assert.ok(!text.includes("{{"), text);
  });
  it("have the skill show the Reels and ask Claude again for them, now that both are ready (phase 3)", () => {
    const skill = studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/skills/brimm-edit/SKILL.md"];
    assert.ok(skill.includes('| "Show me the Reels" | `reels "<episode>"`'), skill);
    assert.ok(skill.includes('| "Ask Claude again for Reels" | `ask "<episode>"`'), skill);
    assert.ok(!/Not ready yet[\s\S]*Showing the Reels/.test(skill), skill);
  });
  it("have the skill run only commands edit.js has, and say the ones it has not yet are not ready", () => {
    const skill = studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/skills/brimm-edit/SKILL.md"];
    const given = commandsIn(skill);
    assert.ok(given.length >= 10, given.join(" "));
    for (const span of given) assert.ok(COMMAND_NAMES.includes(span.split(" ")[0]), `the skill runs "${span}", which edit.js does not have`);
    // A session's commands are among them: its teachings, its principles and its Reel ideas. Each is run with the label in quotes
    // after it; the bare word in a span, as `principles` in a sentence of prose, does not count as running it.
    for (const command of ["teachings", "principles", "ideas"]) assert.ok(given.some((span) => span.startsWith(`${command} "`)), `the skill does not run ${command}`);
    assert.match(skill, /^---\nname: brimm-edit\ndescription: [^\n]+\n---\n/);
    assert.ok(skill.split("\n").length < 160, "the skill is short");
  });
  it("have the skill ask her once about a take-over, and take it over again unasked only in the conversation she said yes in", () => {
    // A take-over on the Mac without the files brings them first and says to say "take it over" again; so does a take-over
    // Dropbox undid. Asked a second time, she would be asked the same question twice (the review of the follow-ups plan, P8).
    // But it is taken over again unasked only for the take-over she said yes to, and for a bring only once it has ended well:
    // "how far is it?" says to take it over again only while that claim stands and she has not been asked again since (the
    // fold's check of P8, and review #24-1).
    const skill = studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/skills/brimm-edit/SKILL.md"];
    const row = skill.split("\n").find((line) => line.startsWith('| "Open the Pricing episode" |'));
    assert.match(row, /If it says another Mac has it, ask her whether to take it over; if yes, `open "<episode>" --take-over`\./);
    assert.match(row, /If that take-over says Dropbox undid the claim and to say "take it over" again, run `open "<episode>" --take-over` again without asking her again\./);
    assert.match(row, /If it is bringing files over first, wait until "how far is it\?" says the bring has ended; if it then says to say "take it over" again, run `open "<episode>" --take-over` again without asking her again;/);
    // A bring that failed says why, and to open it: she is told, and nothing is run again until she says so (review #24-2).
    assert.match(row, /; if it says some files are not here, tell her why, in plain words, and try again only when she says to\./);
    // Her yes is for that conversation only: in a later one she may have changed her mind, so she is asked again (review #24-1).
    assert.match(row, /Take it over again unasked only in the conversation in which she said yes, and only if she has not said not to since; in a later one, run `open "<episode>"` and ask her as above\. Never take an episode over unasked otherwise\./);
    // A no she gives later in that same conversation stops it too (the fold's check of #24-1).
    assert.doesNotMatch(row, /When it, or "how far is it\?", says/);
    assert.doesNotMatch(row, /says so only while/);
  });
  it("have the skill say which quotes a word with a $, a backtick, a backslash or a straight double quote goes in, and what to do when none will do", () => {
    // A straight double quote can be passed only in single quotes: the guard refuses it inside double quotes, escaped or not.
    const skill = studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/skills/brimm-edit/SKILL.md"];
    for (const line of ["Words with a `$`, a backtick, a backslash or a straight double quote go in single quotes instead of double.", "Words with an apostrophe stay in double quotes.",
      `Words with both cannot be passed: ask her to say them another way (for example "99 dollars").`]) assert.ok(skill.includes(line), line);
  });
});

describe("her skill, and the card she answers what a video is on (spec 2026-10-22, section 2)", () => {
  const files = studioFiles({ checkout: CHECKOUT, node: NODE });
  const skill = files[".claude/skills/brimm-edit/SKILL.md"];
  const commands = commandsIn(skill);
  /** The card's section of the skill. */
  const card = () => sectionOf(skill, "## The card");
  /** The source of one of edit.js's own files, for the words it tells her to say. */
  const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  /** The row of the skill's tables that starts with these words. */
  const rowOf = (start) => {
    const row = skill.split("\n").find((line) => line.startsWith(`| ${start} |`));
    assert.ok(row, `the skill has no row ${start}`);
    return row;
  };

  it("runs every command of the fork: kind with its flags, leave, which, the teachings, the principles and ideas, the spellings card, a client's agreement", () => {
    for (const [what, form] of [
      ["kind, finished", /^kind "<label>" finished --private no$/],
      ["kind, raw", /^kind "<label>" raw --private no$/],
      ["kind, an iPhone clip", /^kind "<label>" clip --private no$/],
      ["kind, a session", /^kind "<label>" session --private yes$/],
      ["kind, a new version of a video", /^kind "<label>" (finished|clip) --private no --version-of <id>$/],
      ["kind, a new raw start of a raw video", /^kind "<label>" raw --private no --version-of <id>$/],
      ["kind, a Zoom download or sound alone that is not a session", /^kind "<label>" \S+ --private no --not-a-session$/],
      ["kind, answered again", /^kind "<video>" raw --private no --again$/],
      ["kind, a session after all", /^kind "<video>" session --private yes --again$/],
      ["kind, the session mark cleared", /^kind "<label>" <kind> --private no --again --clear-session$/],
      ["kind, a raw video read on this Mac though it is not here yet", /^kind "<label>" raw --private no --here$/],
      ["kind, a raw video answered again and read here", /^kind "<video>" raw --private no --again --here$/],
      ["leave", /^leave "<label>"$/],
      ["which", /^which "<label>"$/],
      ["the teachings", /^teachings "<label>"$/],
      ["the transcript only", /^teachings "<label>" --transcript-only$/],
      ["the principles", /^principles "<label>"$/],
      ["principles kept", /^principles "<label>" keep 1 3$/],
      ["a principle dropped", /^principles "<label>" drop 2$/],
      ["a principle changed", /^principles "<label>" edit 3 --name "<words>"$/],
      ["a recurring principle kept", /^principles "<label>" recurring keep 1$/],
      ["the Reel ideas", /^ideas "<label>"$/],
      ["a Reel idea kept", /^ideas "<label>" keep 1$/],
      ["a session finished", /^finish "<label>"$/],
      ["what the reading left", /^status "<video>"$/],
      ["the spellings card", /^spell "<video>" offers$/],
      ["the spellings answered", /^spell "<video>" offers all$/],
      ["some spellings answered", /^spell "<video>" offers 1 3$/],
      ["a client's agreement", /^reel "<label>" 2 --client-agreed$/]
    ]) assert.ok(commands.some((c) => form.test(c)), `the skill does not run ${what}`);
  });
  it("gives kind both answers every time it runs it, and they agree: a session with yes, anything else with no", () => {
    const kinds = commands.filter((c) => c.startsWith("kind "));
    assert.ok(kinds.length >= 10, kinds.join("\n"));
    for (const c of kinds) {
      const both = /^kind "[^"]+" (\S+) --private (yes|no)(?: |$)/.exec(c);
      assert.ok(both, `the skill runs kind without both answers: ${c}`);
      assert.equal(both[2], both[1] === "session" ? "yes" : "no", `the two answers disagree: ${c}`);
    }
  });
  it("asks with one AskUserQuestion card for each video, never two videos in one, with both questions, its words marked a proposal", () => {
    for (const words of ["`AskUserQuestion`", "never two videos in one card", '"What is <label>?"', '"Is it a private session with a client or a group?": "Yes", "No"',
      "The card's words are a proposal, for Jason and Sallie to settle"]) assert.ok(card().includes(words), words);
  });
  it("offers Client or group session in every order it writes out, never first but for a new version of a session, each order led by its own guess or new version", () => {
    // Each order is a line of the card's section: "- <when>: "<answer>", "<answer>", …", <when> being a Guess line, a Maybe line
    // or neither, in the words episodes gives them (Ruling 1).
    const orders = card().split("\n").filter((line) => /^\s+- [^"]+: "/.test(line)).map((line) => {
      const at = line.indexOf(': "');
      return { when: line.slice(line.indexOf("- ") + 2, at), answers: [...line.slice(at).matchAll(/"([^"]+)"/g)].map((m) => m[1]) };
    });
    const BASE = ["Finished by your editor", "Raw with retakes", "iPhone clip"];
    const SESSION = "Client or group session";
    /** The answer each Guess line puts first. */
    const GUESSED = { "finished by your editor": "Finished by your editor", "raw with retakes": "Raw with retakes", "an iPhone clip": "iPhone clip" };
    const seen = new Set();
    for (const { when, answers } of orders) {
      const said = `${when}: ${answers.join(", ")}`;
      assert.ok(answers.length <= 4, said);
      assert.equal(new Set(answers).size, answers.length, said);
      assert.ok(answers.includes(SESSION), said);
      // A video that may be a new version of a session is offered as a session first (final fix 2): kind takes no other answer.
      if (when.startsWith("Maybe a new version of a client or group session")) {
        assert.deepEqual(answers, [SESSION, ...BASE], said);
        seen.add("maybe session");
        continue;
      }
      assert.notEqual(answers[0], SESSION, said);
      const guess = /^Guess (.+)$/.exec(when);
      const maybe = /^Maybe a new version of a video (.+)$/.exec(when);
      if (guess) {
        // The guess first, then the other two of finished, raw and iPhone clip in that order.
        assert.ok(Object.hasOwn(GUESSED, guess[1]), said);
        assert.deepEqual(answers, [GUESSED[guess[1]], ...BASE.filter((a) => a !== GUESSED[guess[1]]), SESSION], said);
        seen.add(`guess ${guess[1]}`);
      } else if (maybe) {
        // A raw video's new version is offered as finished by the editor, or as a new raw start (spec 1); any other as itself.
        const raw = maybe[1] === "raw with retakes";
        assert.deepEqual(answers, [raw ? "A finished version of <name>" : "A new version of <name>", "Finished by your editor", "Raw with retakes", SESSION], said);
        seen.add(raw ? "maybe raw" : "maybe other");
      } else {
        assert.equal(when, "No Guess line", said);
        assert.deepEqual(answers, [...BASE, SESSION], said);
        seen.add("none");
      }
    }
    assert.deepEqual([...seen].sort(), ["guess an iPhone clip", "guess finished by your editor", "guess raw with retakes", "maybe other", "maybe raw", "maybe session", "none"]);
    // The skill listens for the line as edit.js says it.
    assert.match(source("edit.js"), /lines\.push\("    Maybe a new version of a client or group session\."\)/);
  });
  it("says the Seen and Came lines above the card, and that she can ask which one it is first", () => {
    for (const words of ["say its Seen and Came lines, when given, in one line", 'she can say "which one is it?" first']) assert.ok(card().includes(words), words);
  });
  it("asks about a Zoom download or sound alone on a card with two plain answers, only when she answered other than a session (Ruling 26a)", () => {
    const zoom = card().split("\n").find((line) => line.includes("`--not-a-session`"));
    assert.ok(zoom, "the card does not say when --not-a-session is added");
    for (const words of ['When she answered anything but "Client or group session"', "on one `AskUserQuestion`", '"It is a client or group session", "It is not a session"',
      "It came from Zoom (or: it is sound alone), which is often a client or group session.", "It may be a Zoom download or sound alone, which is often a client or group session.",
      "A bare yes or no in the chat is unclear: ask again.", 'Only on "It is not a session", run the same `kind` with `--not-a-session` added']) assert.ok(zoom.includes(words), words);
    assert.doesNotMatch(zoom, /really not one/);
  });
  it("knows what edit.js and the reading tell her to say: what did Claude find, clear the session mark, and show me the spellings", () => {
    const notice = /const noticeOf = \(name\) => `Claude has read \$\{name\}: say "([^"]+)"`/.exec(source("reading.js"));
    const mark = /: say "(clear the session mark)"\./.exec(source("edit.js"));
    const spellings = /Say "(show me the spellings)"\./.exec(source("edit.js"));
    assert.ok(notice && mark && spellings, "the words to say are not where they were");
    // Each begins its row's "She says" cell; her own plain words for it may follow there.
    for (const phrase of [notice[1], mark[1], spellings[1]]) assert.ok(skill.split("\n").some((line) => /^\| "[^|]*\|/.test(line) && line.toLowerCase().startsWith(`| "${phrase.toLowerCase()}"`)), phrase);
  });
  it("runs behind, then episodes, then the cards, at the start of each session, and episodes then the cards for what's waiting", () => {
    const start = sectionOf(skill, "## At the start of each session");
    assert.ok(start.indexOf("`behind`") >= 0 && start.indexOf("`behind`") < start.indexOf("`episodes`"), start);
    assert.match(start.slice(start.indexOf("`episodes`")), /card/);
    assert.match(skill, /^\| "What's waiting\?" \| `episodes`, then the card/m);
  });
  it("stops when behind says the folder's lock is changed: tells her to ask Jason, and runs nothing else (spec 2026-10-22, section 7)", () => {
    const start = sectionOf(skill, "## At the start of each session");
    // The skill names what behind says by its first words, which edit.js says word for word.
    const trigger = /If it says "([^"]+)"/.exec(start);
    assert.ok(trigger, start);
    assert.ok(LOCK_CHANGED.startsWith(trigger[1]), `the skill listens for "${trigger[1]}", and edit.js says "${LOCK_CHANGED}"`);
    for (const words of [`tell her: "Something in this Claude folder's setup has changed; ask Jason before going on."`, "Then stop: run nothing else, not even `episodes`"]) assert.ok(start.includes(words), words);
    // It comes before the card, which is shown only when the lock holds, and never shows her what the lock was changed to.
    assert.ok(start.indexOf(trigger[0]) < start.indexOf("Then run `episodes`"), start);
    assert.doesNotMatch(start, /settings\.local|disableAllHooks/);
  });
  /** HELP's usage lines, each as { command, keys, text }: a line starts at "  node edit.js <command>", its usage runs to the column where
      the description starts (two spaces or more), and goes on in the lines indented 21 spaces ("                     [--again]").
      The description lines (indented 40) are not usage. `keys` are the subcommands the usage is for: "pick" and "drop" for
      "reel pick|drop …", and "" for a usage that goes on with a quoted word, a bracket or nothing ("reel "<label>" …"). */
  const subcommandsOf = (words) => (/^[a-z]+(\|[a-z]+)*$/.test(words[0] || "") ? words[0].split("|") : [""]);
  const usages = (() => {
    const found = [];
    for (const line of HELP.split("\n")) {
      const head = /^  node edit\.js (\S+)\s?(.*)$/.exec(line);
      if (head) {
        const text = head[2].split(/\s{2,}/)[0];
        found.push({ command: head[1], keys: subcommandsOf(text.split(" ")), text });
      } else if (/^ {21}\S/.test(line) && found.length) found[found.length - 1].text += ` ${line.trim()}`;
    }
    return found;
  })();
  const flagsIn = (text) => [...text.matchAll(/(?<![\w-])--[a-z][a-z_-]*/g)].map((m) => m[0]);
  /** Which list of items a command edits with "--<what>" (HELP's placeholder): principles and ideas have their own fields, and the recurring
      principles theirs (sessions.js EDITS). */
  const listOf = (command, words) => (command === "ideas" ? "reelIdeas" : command === "principles" ? (words.includes("recurring") ? "recurringPrinciples" : "principles") : null);
  /** The flags HELP gives `command` run with `words` (the words after it): those of its usage lines for that subcommand, and for
      "--<what>" the fields she may change in that list. */
  const flagsHelpGives = (command, words) => {
    const [key] = subcommandsOf(words);
    const mine = usages.filter((u) => u.command === command && u.keys.includes(key));
    const list = listOf(command, words);
    return new Set(mine.flatMap((u) => [...flagsIn(u.text), ...(u.text.includes("--<what>") && list ? EDITS[list].map((field) => `--${field}`) : [])]));
  };
  it("uses only the flags edit.js's help gives each command's usage, by subcommand, so that a flag renamed there fails here", () => {
    const seen = new Set();
    for (const span of commands) {
      const [command, ...words] = span.split(" ");
      assert.ok(usages.some((u) => u.command === command), `edit.js's help has no usage for ${command}, which the skill runs`);
      const given = flagsHelpGives(command, words);
      for (const flag of flagsIn(span)) {
        assert.ok(given.has(flag), `the skill runs ${command} with ${flag}, which the usage of ${command}${subcommandsOf(words)[0] ? ` ${subcommandsOf(words)[0]}` : ""} in edit.js's help does not give it: ${span}`);
        seen.add(`${command} ${flag}`);
      }
    }
    // The flags of the fork are among those checked, so that this cannot go blind.
    for (const used of ["kind --private", "kind --version-of", "kind --not-a-session", "kind --again", "kind --clear-session", "kind --here", "teachings --transcript-only", "reel --client-agreed", "principles --name", "open --take-over", "title --approve", "text --line", "graphic --at-words", "cut --words", "finish --yes"]) {
      assert.ok(seen.has(used), `the skill's use of ${used} was not checked`);
    }
    // A flag the skill names on its own, in a row's words, is one edit.js's help gives some command (or a field she may change).
    const anywhere = new Set([...usages.flatMap((u) => flagsIn(u.text)), ...Object.values(EDITS).flat().map((field) => `--${field}`)]);
    const alone = [...new Set([...skill.matchAll(/`(--[a-z][a-z_-]*)[^`]*`/g)].map((m) => m[1]))];
    assert.ok(alone.length >= 15, alone.join(" "));
    for (const flag of alone) assert.ok(anywhere.has(flag), `the skill names ${flag}, which edit.js's help does not give`);
  });
  it("gives a flag to the subcommand whose usage has it, and the editable fields to the list that has them", () => {
    // reel pick|drop has no --client-agreed, though another usage of reel has; and --name is a principle's field, not a Reel idea's.
    assert.ok(flagsHelpGives("reel", ['"<label>"', "2", "--client-agreed"]).has("--client-agreed"));
    assert.ok(!flagsHelpGives("reel", ["pick", '"<episode>"', "1"]).has("--client-agreed"));
    assert.ok(!flagsHelpGives("reel", ["drop", '"<episode>"', "1"]).has("--client-agreed"));
    assert.ok(flagsHelpGives("principles", ['"<label>"', "edit", "3"]).has("--name"));
    assert.ok(!flagsHelpGives("principles", ['"<label>"', "recurring", "edit", "1"]).has("--name"));
    assert.ok(flagsHelpGives("principles", ['"<label>"', "recurring", "edit", "1"]).has("--text"));
    assert.ok(!flagsHelpGives("ideas", ['"<label>"', "edit", "1"]).has("--text"));
    assert.ok(flagsHelpGives("ideas", ['"<label>"', "edit", "1"]).has("--why"));
    // The usage lines stop where the description starts: a flag that only the description names is not given.
    assert.ok(!flagsHelpGives("kind", ['"<label>"']).has("--clear-sess"));
    assert.ok(flagsHelpGives("kind", ['"<label>"']).has("--clear-session"));
  });
  it("runs every command of the skill in a world holding its video: none prints the help or ends with 2, and each flag changes what edit.js does, bar the known few", async () => {
    // A flag renamed only in a parser, with HELP left as it was, is not seen by the help's usage lines above. So each command is run
    // in a world of its own (phase4.js's made-up episode, with stand-ins for every program) holding the video it names: a video
    // waiting for its answer for kind, leave and which; a session for what a session is asked (teachings, principles, ideas, finish,
    // a client's agreement, and clearing a mark); and the made-up episode for the rest. It must be taken (no help, no exit 2), and
    // run again with each of its flags put for a flag edit.js has not got (--zzz), it must do something else: a flag the parser no
    // longer knows is the same as that one. Flags that change nothing in these worlds are the known exceptions, listed below: a
    // flag that joins them, or leaves them, fails here.
    const AT = "2026-10-20T15:00:00-05:00";
    const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "yes" };
    const UNANSWERED = { label: "Video of 14 Oct, 09:12 (Mac Studio)", record: { version: 3, kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:23", came: "camera", match: null }, label: "Video of 14 Oct, 09:12 (Mac Studio)" } };
    const SESSION = { label: "Session, 2026-10-14", record: { version: 3, kind: "session", answer: ANSWERED, label: "Video of 14 Oct, 09:12 (Mac Studio)", name: { text: "Session, 2026-10-14", placeholder: false }, session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } } };
    const KNOWN_INERT = [
      'kind "<label>" finished --private no --not-a-session [--not-a-session]', // a camera video is no Zoom download
      'open "<episode>" --take-over [--take-over]', // no other Mac has the episode
      'finish "<episode>" --yes [--yes]', // the main video was never shown in Final Cut, which it says first
      'resolve "<episode>" --keep A [--keep]', // there is no conflict, whatever is kept
      'principles "<label>" edit 3 --name "<words>" [--name]' // teachings are not turned on in this world
    ];
    const inWorld = (span) => {
      const command = span.split(" ")[0];
      if (!span.includes("<label>")) return { made: null, name: FOLDER_NAME };
      return span.includes("--clear-session") || !["kind", "leave", "which"].includes(command) ? { made: SESSION, name: SESSION.label } : { made: UNANSWERED, name: UNANSWERED.label };
    };
    /** A command of the skill as the words Claude would pass: its placeholders filled with made-up ones, its quotes taken off. */
    const argvOf = (span, name) => [...span.matchAll(/"[^"]*"|'[^']*'|\S+/g)].map((m) => m[0].replace(/^"(.*)"$|^'(.*)'$/s, "$1$2").replace(/<kind>/g, "finished").replace(/<id>/g, "0d0d0d").replace(/<(label|video|episode)>/g, name).replace(/<[^>]*>/g, "Pricing talk"));
    /** What edit.js does with `span`, its words changed by `change`, in a world of its own: its exit code and what it says. */
    async function run(span, change = (words) => words) {
      const { t } = episode();
      const { made, name } = inWorld(span);
      if (made) episodeAs(t, { id: "e-20261014-5a5a5a", name: "2026-10-14 Talk (Mac Studio)", record: made.record });
      const deps = {
        ...t.ctx.deps, statfs: () => ({ bavail: 300 * 2 ** 18, bsize: 4096 }), kickstart: () => {}, agentRunning: () => false, running: async () => false,
        // A raw video read "here" is one not whole on this Mac, which only --here reads: elsewhere every file is whole.
        ...(span.includes("--here") ? { isWhole: (path) => !path.endsWith(".mp4") } : {}),
        run: async (cmd, args, asked) => (cmd === "/usr/bin/git" ? { code: 0, stdout: "0\n", stderr: "" } : t.ctx.deps.run(cmd, args, asked))
      };
      const said = [];
      const code = await editMain(change(argvOf(span, name)), { ...deps, say: (line) => said.push(line) });
      const text = said.join("\n").split(t.dir).join("<dir>");
      t.done();
      return { code, text };
    }
    const inert = [];
    const ran = [];
    for (const span of [...new Set(commands.filter((c) => c.includes(" ") || ["episodes", "behind", "status"].includes(c)))]) {
      const base = await run(span);
      assert.ok(base.code !== 2 && !base.text.startsWith("The command line for episodes on this Mac"), `edit.js does not take what the skill runs: ${span}: ${base.code} ${base.text.split("\n")[0]}`);
      assert.deepEqual(await run(span), base, `${span} does not do the same twice`);
      ran.push(span);
      const words = argvOf(span, "X");
      for (const [at, word] of words.entries()) {
        if (!/^--[a-z]/.test(word)) continue;
        const other = await run(span, (given) => given.map((w, i) => (i === at ? "--zzz" : w)));
        if (other.code === base.code && other.text === base.text) inert.push(`${span} [${word}]`);
      }
    }
    assert.ok(ran.length >= 60, `${ran.length} commands run`);
    for (const span of ['kind "<label>" <kind> --private no --again --clear-session', 'reel "<label>" 2 --client-agreed', 'teachings "<label>" --transcript-only', 'principles "<label>" edit 3 --name "<words>"']) assert.ok(ran.includes(span), span);
    assert.deepEqual(inert, KNOWN_INERT, "the flags that change nothing in these worlds are not the known ones");
  });
  it("has the comment at the top of studio.js name the check behind makes of her folder's lock, which edit.js has", () => {
    const head = source("studio.js").split("\n").filter((line) => line.startsWith("//")).join("\n");
    for (const words of ["`behind`", "lockLoosened", ".claude/settings.local.json", "turn hooks off"]) assert.ok(head.includes(words), words);
    assert.match(source("edit.js"), /\nfunction lockLoosened\(/);
  });
  it("tells her never to rate, report or share a chat about a session, in the skill and in her CLAUDE.md", () => {
    for (const text of [skill, files["CLAUDE.md"]]) assert.match(text, /Never rate, report or share a chat about a session/);
  });
  it("tells her before a dialog command what the dialog asks of her, and afterwards only what edit.js said (Ruling 23)", () => {
    for (const [start, command, click] of [['"The client agreed to Reel 2"', '`reel "<label>" 2 --client-agreed`', '"They agreed"'], [`"Clear the session mark" / "It isn't a session" / "Take the session mark off"`, '`kind "<label>" <kind> --private no --again --clear-session`', '"Clear it"']]) {
      const row = rowOf(start);
      assert.ok(row.includes(command), row);
      const before = row.slice(0, row.indexOf(command));
      for (const words of ["Before running it, tell her a dialog will open on her Mac", click, "Claude cannot press it", "Return presses Cancel"]) assert.ok(before.includes(words), `${start}: ${words}`);
      // edit.js says a dialog is open before it waits for her click, so Claude reads that line only once the dialog has closed
      // (Ruling 27): it is never passed on, and she is told only how it ended.
      assert.ok(row.slice(row.indexOf(command)).includes("Its line that a dialog is open is printed before it waits for her click, so once it has returned the dialog has closed: never pass that line on, and tell her only how it ended, from what it printed after that line"), start);
    }
    const agreed = rowOf('"The client agreed to Reel 2"');
    for (const words of ["types who agreed and when", "Never ask who agreed in the chat", "never repeat it or pass it into a command", "it goes in the dialog only"]) assert.ok(agreed.includes(words), words);
    const sessions = sectionOf(skill, "## A client or group session");
    assert.ok(sessions.includes("Never say a dialog is open once a command has returned, and never say the mark is cleared or the agreement noted unless edit.js says so after the dialog has closed."), sessions);
    assert.doesNotMatch(sessions, /Never say a dialog is open, the mark cleared or the agreement noted unless/);
    assert.doesNotMatch(skill, /tell her a dialog is open/i);
  });
  it("clears a session mark in her own words, telling her first that the dialog shows the label, and that she clicks within a minute (Ruling 30)", () => {
    // F8a's dialog opens with the video's label, then the spec's question; a click too late is "Not cleared … click within a minute".
    const row = rowOf(`"Clear the session mark" / "It isn't a session" / "Take the session mark off"`);
    const command = row.indexOf('`kind "<label>" <kind> --private no --again --clear-session`');
    assert.ok(command > 0, row);
    const before = row.slice(0, command);
    for (const words of ["finished by your editor, raw with retakes or an iPhone clip, never a session", "it shows the video's label first, then asks whether to clear its session mark, so she checks it is the video she means",
      'she clicks "Clear it" herself, within a minute', "Claude cannot press it", "Return presses Cancel"]) assert.ok(before.includes(words), words);
  });
  it("says a hand-off was shown in Finder only when edit.js says it showed one (Ruling 23)", () => {
    for (const start of ["The spellings card", '"It was a session after all"', '"Done"']) {
      const row = rowOf(start);
      assert.match(row, /when it says it showed [^|]*in Finder/i, start);
      assert.doesNotMatch(row, /(it shows|written and shown) in Finder/, start);
    }
  });
  it("asks the card's second question again before a correction, and corrects only a video she has answered (Ruling 24)", () => {
    const row = rowOf(`"It's actually raw" (or finished, or an iPhone clip)`);
    const asked = row.indexOf('on one `AskUserQuestion`: "Is it a private session with a client or a group?": "Yes", "No"');
    const command = row.indexOf('`kind "<video>" raw --private no --again`');
    assert.ok(asked >= 0 && command > asked, row);
    assert.ok(row.slice(0, asked).includes("Only for a video she has answered: one `episodes` lists as waiting for her answer gets the card instead"), row);
    // A session is not asked the second question: kind would refuse it, and only the dialog clears its mark (Ruling 28).
    assert.ok(row.slice(0, asked).includes('For a video `episodes` lists as a client or group session, go straight to "Clear the session mark", below, without asking again.'), row);
    assert.ok(row.slice(asked).includes('No: `kind "<video>" raw --private no --again`'), row);
    assert.ok(row.slice(asked).includes('Yes: as "It was a session after all", below'), row);
  });
  it("shows her a session's principles and Reel ideas as brimm-video printed them wherever they are shown, and names every field she may change (Ruling 25)", () => {
    // The rule is the session section's own, so it holds wherever principles or ideas prints, and the rows that run them point
    // to it: "Show me the principles" and "What did Claude find?", which the reading's notice sends her to.
    const RULE = "Wherever `principles` or `ideas` prints, show her each item exactly as brimm-video printed it, field by field, example and key phrases first, never summarised or shortened, with its line about the names it took out.";
    const prose = sectionOf(skill, "## A client or group session").split("\n").filter((line) => !line.startsWith("|"));
    assert.ok(prose.some((line) => line.includes(RULE)), prose.join("\n"));
    const shown = rowOf('"Show me the principles" / "Show me the Reel ideas"');
    const found = rowOf('"What did Claude find?"');
    const session = found.slice(found.indexOf("a session,"));
    assert.ok(found.indexOf("a session,") >= 0, found);
    for (const [row, pointer] of [[shown, "as above"], [session, '"A client or group session"']]) for (const words of ["exactly as brimm-video printed it", "never summarised", pointer]) assert.ok(row.includes(words), `${row.slice(0, 40)}: ${words}`);
    // The plain-words rule at the top makes room for it.
    assert.ok(skill.includes("say what it did, in plain words, except a session's principles and Reel ideas, which are shown as printed (\"A client or group session\")."));
    // Every field sessions.js lets her change, of each list.
    const edits = rowOf('"Keep 1 and 3" / "Drop 2" / "Change 3"');
    for (const [list, fields] of Object.entries(EDITS)) for (const field of fields) assert.ok(edits.includes(`--${field}`), `${list}: --${field}`);
  });
  it("tells her a teachings refusal plainly, never which account, and once a video is a session calls it by its label, or the name she gave it (Ruling 26c, d)", () => {
    assert.ok(rowOf('"Its teachings" / "Get the teachings of <label>"').includes("never say which account"));
    const sessions = sectionOf(skill, "## A client or group session");
    assert.ok(sessions.includes("call it only by its label, or the name she gave it, and never repeat anything the chat holds of it (its file's name, its suggestions, its spellings)"), sessions);
    // Each "Once …" paragraph is one of its own.
    assert.ok(sessions.includes("\n\nOnce a video is a session"), sessions);
    assert.ok(rowOf('"It was a session after all"').includes("From then on call it only by its label, or the name she gave it, and never repeat anything the chat holds of it."));
    // Her given name is shown as the session's name (episode.js shownName), so the skill has no other word for it than these two.
    assert.doesNotMatch(skill, /only by its label(?!, or the name she gave it)/);
  });
  it("keeps out of the chat a session's and an unanswered video's words, and who agreed to a Reel", () => {
    for (const words of ["Never read, quote or ask her to paste such a file", "Never ask who agreed in the chat", "Claude cannot press it"]) assert.ok(skill.includes(words), words);
  });
});

describe("the guard", () => {
  it("lets edit.js run with plain or quoted words, which zsh and bash give it letter for letter", async (t) => {
    // Every command the guard lets through is run in each shell, so the guard's words and the shells' cannot drift apart.
    for (const [c] of ALLOWED) assert.equal(bash(c), "allow", c);
    await inEachShell(t, (shell) => { for (const [c, words] of ALLOWED) assert.deepEqual(shellWords(shell, c), words, `${shell[0]}: ${c}`); });
  });
  it("lets single-quoted words through, and they reach edit.js letter for letter in zsh and bash", async (t) => {
    const words = ["title", "Pricing talk", "--words", "Charge $99 `now` \\ok"];
    const command = `${EDIT} title "Pricing talk" --words 'Charge $99 \`now\` \\ok'`;
    assert.equal(bash(command), "allow");
    await inEachShell(t, (shell) => assert.deepEqual(shellWords(shell, command), words, shell[0]));
  });
  it("lets random words of every form through only when zsh and bash give edit.js the words it read", async (t) => {
    // ALLOWED checks its own rows only; random commands check the grammar as a whole (the build review of the single-quote
    // fix). Of these 3000 the guard lets about 1350 through, and for each of those each shell must give back the words the
    // guard read, and make nothing.
    const next = numbersFrom(20261015);
    const allowed = Array.from({ length: 3000 }, () => randomCommand(next)).filter((c) => bash(c) === "allow");
    assert.ok(allowed.length >= 500, `only ${allowed.length} random commands were let through`);
    for (const form of [/ [^ "']/, / "/, / '/]) assert.ok(allowed.some((c) => form.test(tailOf(c))), `none let through has a word like ${form}`);
    const dir = mkdtempSync(join(tmpdir(), "guard-words-"));
    try {
      await inEachShell(t, (shell) => {
        const given = shellWordsOfAll(shell, allowed, dir);
        allowed.forEach((c, i) => assert.deepEqual(given[i], grammarWords(c), `${shell[0]}: ${JSON.stringify(c)}`));
        assert.equal(given.length, allowed.length, `${shell[0]} gave words for more commands than it was given`);
        assert.deepEqual(readdirSync(dir), [], `${shell[0]} made a file`);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("still refuses a single quote that is not a whole word", () => {
    for (const c of [`${EDIT} open 'a'b`, `${EDIT} open 'a`, `${EDIT} open 'a''b'`, `${EDIT} open 'a\nb'`, `${EDIT} open 'a\rb'`, `${EDIT} open 'x' ; date`,
      `${EDIT} open b'a'`, `${EDIT} open "a"'b'`, `${EDIT} open 'a'"b"`, `${EDIT} open 'a'\\''b'`, `${EDIT} open $'a'`, `${EDIT} open $'\\x27; date'`, `${EDIT} open $"x"`,
      `${EDIT} open 'a' 'b`])
      assert.equal(bash(c), "deny", JSON.stringify(c));
  });
  it("refuses anything else, and edit.js with anything that could run more", () => {
    for (const c of ["date", "cat /etc/hosts", `ls "${CHECKOUT}"`, `${NODE} -e "1"`, `${NODE} "${CHECKOUT}/tool/unedited.js" --from-plan x`,
      `${NODE} "/other/tool/edit.js" open x`, `${NODE} "${CHECKOUT}/tool/edit.jsx" open x`, `/usr/local/bin/node "${CHECKOUT}/tool/edit.js" episodes`,
      `${EDIT} open x; cat /etc/hosts`, `${EDIT} open x && date`, `${EDIT} open x | sh`, `${EDIT} open x &`,
      `${EDIT} open $(date)`, `${EDIT} open "$(cat ~/.ssh/id_ed25519)"`, `${EDIT} open "\`date\`"`, `${EDIT} open '"' ; date ; '"'`, `${EDIT} open "a\\" ; date ; \\""`, `${EDIT} open "a\\b"`, `${EDIT} open "x\\" "; date; " "y"`,
      `${EDIT} open x > /tmp/y`, `${EDIT} open < /etc/hosts`,
      // A quote of a word's own kind, with nothing else in it, that would end the word early and let what follows run (the
      // review of the single-quote fix).
      `${EDIT} open "a" ; date ; "b"`, `${EDIT} open 'a' ; date ; 'b'`,
      // The same, glued to a word (the review of PR 21, finding 15).
      `${EDIT} episodes|sh`, `${EDIT} episodes||date`, `${EDIT} episodes&&date`, `${EDIT} episodes&`, `${EDIT} open x>/tmp/y`, `${EDIT} open x<y`,
      `${EDIT} open x$(date)`, `${EDIT} open x\`date\``, `${EDIT} open x(y)`, `${EDIT} open x{a,b}`, `${EDIT} open x*`, `${EDIT} open x?`, `${EDIT} open =date`, `${EDIT} open x;date`, `${EDIT} open ~/x`, `${EDIT} open *`, `${EDIT} open "a\nb"`, `${EDIT} open x\ndate`, ` ${EDIT} episodes`, `${EDIT}  episodes`, `${EDIT} episodes `, ""])
      assert.equal(bash(c), "deny", JSON.stringify(c));
    assert.equal(guardDecision({ tool_name: "Bash", tool_input: {} }, { checkout: CHECKOUT, node: NODE }).decision, "deny");
  });
  it("leaves reads and Claude's own bookkeeping to Claude Code's own rules, and refuses every other tool, with a reason in plain words", () => {
    for (const t of ["TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "ToolSearch", "AskUserQuestion"]) assert.equal(tool(t), "pass", t);
    for (const t of ["Glob", "Grep", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "Monitor", "Artifact", "Workflow", "RemoteTrigger", "SendMessage", "Agent", "LSP",
      "mcp__gmail__send_message", "mcp__terminal__run_in_terminal", "mcp__ccd_directory__change_directory", "mcp__computer-use__app_click", "SomethingNew", undefined]) assert.equal(tool(t), "deny", t);
    assert.equal(guardDecision({ tool_name: "Write", tool_input: {} }, { checkout: CHECKOUT, node: NODE }).reason, "In this folder Claude runs only brimm-video's own commands. Ask Jason for anything else.");
  });
});

describe("the guard and paths that hold a regular expression's own characters", () => {
  it("matches the checkout and node letter for letter", () => {
    const checkout = "/Users/o.hara/Claude Code/BRIMM video (1)+";
    const node = "/Users/o.hara/.nvm/versions/node/v22.11.0/bin/node";
    const decide = (command) => guardDecision({ tool_name: "Bash", tool_input: { command } }, { checkout, node }).decision;
    assert.equal(decide(`${node} "${checkout}/tool/edit.js" episodes`), "allow");
    assert.equal(decide(`node "${checkout}/tool/edit.js" episodes`), "allow");
    for (const c of [`node "/Users/oXhara/Claude Code/BRIMM video (1)+/tool/edit.js" episodes`, `node "/Users/o.hara/Claude Code/BRIMM video 1/tool/edit.js" episodes`,
      `node "${checkout}/tool/editXjs" episodes`, `/Users/oXhara/.nvm/versions/node/v22X11X0/bin/node "${checkout}/tool/edit.js" episodes`])
      assert.equal(decide(c), "deny", c);
  });
});

describe("the guard and reading", () => {
  /** Her folder, a file outside it, a link in Pictures to that file, and a session's own folder of tool results, in a
      folder of the test's own. */
  const place = () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-guard-read-")));
    const folder = join(dir, "BRIMM Video Studio");
    mkdirSync(join(folder, "Pictures"), { recursive: true });
    writeFileSync(join(folder, "CLAUDE.md"), "hers");
    writeFileSync(join(dir, "outside.txt"), "not hers");
    symlinkSync(join(dir, "outside.txt"), join(folder, "Pictures", "link.png"));
    const transcript = join(dir, "projects", "her-folder", "abc123.jsonl");
    mkdirSync(join(dir, "projects", "her-folder", "abc123", "tool-results"), { recursive: true });
    writeFileSync(join(dir, "projects", "her-folder", "abc123", "tool-results", "out.txt"), "a long answer");
    // Where Claude Code writes what a command run in the background prints: <its temp folder>/claude-<uid>/<the transcript's
    // folder>/<session>/tasks/.
    const tmp = join(dir, "tmp");
    const tasks = join(tmp, `claude-${process.getuid()}`, "her-folder", "abc123", "tasks");
    mkdirSync(tasks, { recursive: true });
    writeFileSync(join(tasks, "b1.output"), "Sallie's laptop has it open. Say \"take it over\".");
    mkdirSync(join(tmp, `claude-${process.getuid()}`, "her-folder", "other", "tasks"), { recursive: true });
    writeFileSync(join(tmp, `claude-${process.getuid()}`, "her-folder", "other", "tasks", "b2.output"), "another session's");
    const read = (file_path, more = {}) => guardDecision({ tool_name: "Read", tool_input: { file_path }, cwd: folder, transcript_path: transcript, session_id: "abc123", ...more }, { checkout: CHECKOUT, node: NODE, folder, tmp }).decision;
    return { dir, folder, tasks, tmp, read, done: () => rmSync(dir, { recursive: true, force: true }) };
  };
  it("leaves a read inside her folder, or of the session's own saved tool results, to Claude Code", () => {
    const p = place();
    for (const path of ["CLAUDE.md", join(p.folder, "CLAUDE.md"), "Pictures/new.png", join(p.folder, "Pictures", "not there yet.png"), join(p.dir, "projects", "her-folder", "abc123", "tool-results", "out.txt")]) assert.equal(p.read(path), "pass", path);
    p.done();
  });
  it("refuses a read anywhere else: outside, by .., by ~, by a link, another session's results, or with no path", () => {
    const p = place();
    for (const path of ["/etc/hosts", join(p.dir, "outside.txt"), "../outside.txt", join(p.folder, "..", "outside.txt"), "~/.ssh/id_ed25519", "~", "Pictures/link.png", join(p.dir, "missing", "file.txt"), join(p.dir, "projects", "her-folder", "other", "tool-results", "out.txt"), join(p.dir, "projects", "her-folder", "abc123", "x.jsonl"), CHECKOUT + "/tool/edit.js"])
      assert.equal(p.read(path), "deny", path);
    assert.equal(p.read(undefined), "deny");
    assert.equal(p.read(join(p.dir, "projects", "her-folder", "abc123", "tool-results", "out.txt"), { session_id: undefined }), "deny");
    assert.equal(guardDecision({ tool_name: "Read", tool_input: { file_path: "CLAUDE.md" }, cwd: p.folder }, { checkout: CHECKOUT, node: NODE }).decision, "deny");
    p.done();
  });
  it("leaves a read of what a command run in the background printed, in this session's own tasks folder, to Claude Code", () => {
    const p = place();
    assert.equal(p.read(join(p.tasks, "b1.output")), "pass");
    for (const path of [join(p.tmp, `claude-${process.getuid()}`, "her-folder", "other", "tasks", "b2.output"), join(p.tasks, "..", "x.txt"), join(p.tmp, "elsewhere.txt")]) assert.equal(p.read(path), "deny", path);
    assert.equal(p.read(join(p.tasks, "b1.output"), { session_id: undefined }), "deny");
    p.done();
  });
  it("refuses a link in her folder whose target cannot be found, to a file or through a folder", () => {
    const p = place();
    symlinkSync(join(p.dir, "outside", "later.txt"), join(p.folder, "Pictures", "dangle.txt"));
    symlinkSync("/Volumes/Not Mounted/folder", join(p.folder, "Pictures", "drive-folder"));
    for (const path of ["Pictures/dangle.txt", join(p.folder, "Pictures", "drive-folder", "pic.png"), "Pictures/drive-folder"]) assert.equal(p.read(path), "deny", path);
    // A file not there yet, in a real folder of hers, still reaches Claude Code, which says it is not there.
    assert.equal(p.read("Pictures/not there yet.png"), "pass");
    p.done();
  });
  it("expands ~ to the home folder", () => {
    const p = place();
    const home = homedir();
    assert.equal(guardDecision({ tool_name: "Read", tool_input: { file_path: "~/notes.txt" }, cwd: home }, { checkout: CHECKOUT, node: NODE, folder: home }).decision, "pass");
    p.done();
  });
});

describe("the guard and her skill", () => {
  it("allows her skill and refuses any other", () => {
    const skill = (name) => guardDecision({ tool_name: "Skill", tool_input: { skill: name } }, { checkout: CHECKOUT, node: NODE }).decision;
    assert.equal(skill("brimm-edit"), "allow");
    for (const other of ["something-else", "brimm-edit-2", "", undefined]) assert.equal(skill(other), "deny", other);
  });
});

describe("the guard, run as Claude Code runs the hook", () => {
  const decision = (r) => JSON.parse(r.stdout).hookSpecificOutput;
  it("answers allow and deny as a PreToolUse decision, and ends with 0", () => {
    const allowed = hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: `${process.execPath} "${THIS_CHECKOUT}/tool/edit.js" episodes` } });
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.deepEqual({ ...decision(allowed), permissionDecisionReason: "" }, { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "" });
    const refused = hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "date" } });
    assert.equal(refused.status, 0, refused.stderr);
    assert.deepEqual(decision(refused), { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "In this folder Claude runs only brimm-video's own commands. Ask Jason for anything else." });
  });
  it("says nothing of a read inside her folder, so Claude Code's own rules decide, and refuses one outside it", () => {
    const folder = realpathSync(mkdtempSync(join(tmpdir(), "brimm-guard-hook-")));
    writeFileSync(join(folder, "CLAUDE.md"), "hers");
    const inside = hook({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: join(folder, "CLAUDE.md") }, cwd: folder }, process.execPath, folder);
    assert.deepEqual([inside.status, inside.stdout], [0, ""]);
    const outside = hook({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "/etc/hosts" }, cwd: folder }, process.execPath, folder);
    assert.equal(outside.status, 0);
    assert.equal(decision(outside).permissionDecision, "deny");
    rmSync(folder, { recursive: true, force: true });
  });
  it("refuses what it cannot read", () => {
    const r = hook("not JSON");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(decision(r).permissionDecision, "deny");
  });
  it("blocks the call, with exit 2, when its node cannot run", () => {
    const r = hook({ tool_name: "Bash", tool_input: { command: "date" } }, "/no/such/node");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /brimm-video's guard could not check this\. Ask Jason\./);
  });
  it("can be run by /bin/sh from the checkout as it is committed", () => {
    assert.ok(statSync(GUARD).mode & 0o100, "guard.sh can be run");
  });
});

describe("writing her folder, when it is there already in another case", () => {
  it("gives the hook the folder as the disk spells it, which is the folder Claude Code runs in", (ctx) => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "brimm-studio-case-")));
    mkdirSync(join(home, "BRIMM video studio"));
    // On a disk that tells case apart, as Linux's, there is no other spelling to take.
    if (!existsSync(join(home, "BRIMM Video Studio"))) {
      rmSync(home, { recursive: true, force: true });
      return ctx.skip("this disk tells case apart");
    }
    const folder = writeStudio(home, { checkout: CHECKOUT, node: NODE });
    assert.equal(folder, join(home, "BRIMM video studio"));
    const s = JSON.parse(readFileSync(join(folder, ".claude", "settings.json"), "utf8"));
    assert.equal(s.hooks.PreToolUse[0].hooks[0].args[2], join(home, "BRIMM video studio"));
    rmSync(home, { recursive: true, force: true });
  });
});

describe("writing her folder", () => {
  it("writes the three files and Pictures, and keeps whatever else is there", () => {
    const home = mkdtempSync(join(tmpdir(), "brimm-studio-"));
    const folder = studioFolder(home);
    assert.equal(folder, join(home, "BRIMM Video Studio"));
    mkdirSync(join(folder, "Pictures"), { recursive: true });
    writeFileSync(join(folder, "Pictures", "chart.png"), "x");
    writeFileSync(join(folder, "notes.txt"), "hers");
    assert.equal(writeStudio(home, { checkout: CHECKOUT, node: NODE }), realpathSync(folder));
    for (const f of ["CLAUDE.md", ".claude/settings.json", ".claude/skills/brimm-edit/SKILL.md", "Pictures/chart.png", "notes.txt"]) assert.ok(existsSync(join(folder, f)), f);
    const files = studioFiles({ checkout: CHECKOUT, node: NODE, folder: realpathSync(folder) });
    for (const [name, text] of Object.entries(files)) assert.equal(readFileSync(join(folder, name), "utf8"), text, name);
    assert.equal(readFileSync(join(folder, "notes.txt"), "utf8"), "hers");
    // Written again, as a later install does, it is the same.
    writeStudio(home, { checkout: CHECKOUT, node: NODE });
    assert.equal(readFileSync(join(folder, "Pictures", "chart.png"), "utf8"), "x");
    rmSync(home, { recursive: true, force: true });
  });
  it("tells Claude in its CLAUDE.md to use the skill, run nothing else, and speak plainly", () => {
    const text = studioFiles({ checkout: CHECKOUT, node: NODE })["CLAUDE.md"];
    for (const line of ["Use the brimm-edit skill for everything here.", "do not run any other program", "Nothing here posts, sends or publishes anything.", "Never show her command names, paths or flags."]) assert.ok(text.includes(line), line);
  });
});
