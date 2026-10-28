// Sallie's folder for Claude, ~/BRIMM Video Studio (studio.js): its CLAUDE.md, its settings, its skill and Pictures/, and the
// guard hook that lets her session run brimm-video's edit.js and nothing else. Each test writes into a home folder of its own.
// The hook is run here as Claude Code runs it, by /bin/sh and node, on made-up tool calls: nothing it allows is run.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { studioFiles, writeStudio, guardDecision, studioFolder } from "../studio.js";
import { COMMAND_NAMES, HELP, LOCK_CHANGED, editMain, wordsLine } from "../edit.js";
import { HELD_NARROWED, HELD_REFUSED } from "../held.js";
import { UNTRUSTED } from "../loosened.js";
import { NO_RECEIPT } from "../receipts.js";
import { EDITS } from "../sessions.js";
import { episodeAs, FOLDER as FOLDER_NAME } from "./episodes.js";
import { episode } from "./phase4.js";
import { CHECKOUT, NODE, EDIT, ALLOWED } from "./guard-cases.js";
import { openWorld } from "./open-world.js";

const FOLDER = "/Users/sallie/BRIMM Video Studio";
const bash = (command) => guardDecision({ tool_name: "Bash", tool_input: { command } }, { checkout: CHECKOUT, node: NODE }).decision;
const tool = (tool_name) => guardDecision({ tool_name, tool_input: {} }, { checkout: CHECKOUT, node: NODE }).decision;
/** The guard as Claude Code runs it, in exec form: /bin/sh, the guard's own script in this checkout, and a node. */
const GUARD = join(dirname(fileURLToPath(import.meta.url)), "..", "studio", "guard.sh");
const THIS_CHECKOUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** A made-up home with no settings, so that the hook, which takes the home from the folder above hers, keeps today's lock: on her
    laptop /Users/sallie may be her real home, with the open lock, and the hook would then read her settings and run ps and lsof. */
const HOOK_HOME = realpathSync(mkdtempSync(join(tmpdir(), "brimm-guard-home-")));
after(() => rmSync(HOOK_HOME, { recursive: true, force: true }));
const hook = (input, node = process.execPath, folder = join(HOOK_HOME, "BRIMM Video Studio")) => spawnSync("/bin/sh", [GUARD, node, folder], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8" });

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
  it("have the skill say, where she would be sent to make a Reel brimm-video cannot make yet, that she cuts it in OpusClip and BRIMM Ops writes its post text (Sallie's walkthrough, 25 Oct)", () => {
    // "Show me the Reels" listed them, "Finish Reels 1 and 3" said to make Reel 1 first, and nothing made one: a circle.
    const skill = studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/skills/brimm-edit/SKILL.md"];
    const row = (start) => skill.split("\n").find((line) => line.startsWith(start));
    assert.match(row('| "Show me the Reels" |'), /When it says brimm-video cannot make Reels from this video yet, say so\. For now she cuts them in OpusClip; BRIMM Ops writes their post text \("New short video from a clip", on the episode's Reels card\)\. Never send a client or group session's Reels to OpusClip\. \|$/);
    assert.match(row('| "Finish Reels 1 and 3" / "Drop 2" |'), /When it says brimm-video cannot make Reels from this video yet, say so, as for "Show me the Reels": never offer to make one/);
    const notReady = skill.slice(skill.indexOf("## Not ready yet"), skill.indexOf("## By hand in Final Cut"));
    assert.ok(notReady.includes(`- A Reel from Claude's suggestions: say brimm-video can't make it yet, and where she makes it for now, as "Show me the Reels" says. Never offer to make one here. A Reel of a private video with a client or a group, even once the client agreed: "That isn't ready yet; ask Jason." Never OpusClip.`), notReady);
    assert.doesNotMatch(skill, /make Reel \d|make it first/);
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
  it("have the skill open an episode in HyperFrames with app, and take it over by the rules it has for open, with app in open's place", () => {
    // `app` begins with open's own claim and bring (edit.js claimAndBring): another Mac's claim refuses it in open's words, and a bring
    // or a claim Dropbox undid ends in open's words too, to say "take it over" again. So her yes is asked for once, and the take-over
    // is run again unasked only in the conversation she said yes in, exactly as for open (build plan PR 4, "The skill").
    const skill = studioFiles({ checkout: CHECKOUT, node: NODE })[".claude/skills/brimm-edit/SKILL.md"];
    const rowOf = (start) => skill.split("\n").filter((line) => line.startsWith(start));
    const OPEN_HER = '| "Open the Pricing episode in HyperFrames" / "Open it in HyperFrames" |';
    assert.equal(rowOf(OPEN_HER).length, 1, "the skill has not one row for opening an episode in HyperFrames");
    const [app] = rowOf(OPEN_HER);
    assert.ok(app.startsWith(`${OPEN_HER} \`app "<episode>"\`: it opens in HyperFrames on her Mac. If it says another Mac has it, ask her whether to take it over; if yes, \`app "<episode>" --take-over\`.`), app);
    // Everything open's row says from its take-over on, with app run in open's place.
    const [open] = rowOf('| "Open the Pricing episode" |');
    assert.ok(open, "the skill has no row for opening an episode");
    const takeOver = open.slice(open.indexOf("If it says another Mac has it"), open.lastIndexOf(" |"));
    assert.ok(takeOver.includes("Never take an episode over unasked otherwise."), takeOver);
    assert.ok(app.endsWith(`${takeOver.replaceAll('`open "<episode>"', '`app "<episode>"')} |`), app);
    // The two rows are twins and neither runs the other's command: this one runs app, in the two forms the help gives it, and never open.
    assert.doesNotMatch(app, /`open /);
    assert.doesNotMatch(open, /`app /);
    assert.deepEqual([...new Set([...app.matchAll(/`(app[^`]*)`/g)].map((m) => m[1]))], ['app "<episode>"', 'app "<episode>" --take-over']);
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
    for (const used of ["kind --private", "kind --version-of", "kind --not-a-session", "kind --again", "kind --clear-session", "kind --here", "teachings --transcript-only", "reel --client-agreed", "principles --name", "open --take-over", "app --take-over", "title --approve", "text --line", "graphic --at-words", "cut --words", "finish --yes"]) {
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
      'app "<episode>" --take-over [--take-over]', // this Mac is not set up for HyperFrames, which app says before it looks at a claim (and no other Mac has the episode)
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
        // The guide works only on a Mac on the light import: anywhere else every form says to ask Jason before its words are
        // read, so a guide span is run on one, where a form edit.js does not take prints the help and ends with 2.
        ...(span.startsWith("guide") ? { settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 } } : {}),
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
    for (const span of [...new Set(commands.filter((c) => c.includes(" ") || ["episodes", "behind", "status", "guide"].includes(c)))]) {
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
    for (const span of ['kind "<label>" <kind> --private no --again --clear-session', 'reel "<label>" 2 --client-agreed', 'teachings "<label>" --transcript-only', 'principles "<label>" edit 3 --name "<words>"', 'app "<episode>"', 'app "<episode>" --take-over']) assert.ok(ran.includes(span), span);
    assert.deepEqual(inert, KNOWN_INERT, "the flags that change nothing in these worlds are not the known ones");
  });
  it("has the comment at the top of studio.js name the check behind makes of her folder's lock, which edit.js has", () => {
    const head = source("studio.js").split("\n").filter((line) => line.startsWith("//")).join("\n");
    for (const words of ["`behind`", "lockLoosened", ".claude/settings.local.json", "turn hooks off"]) assert.ok(head.includes(words), words);
    assert.match(source("loosened.js"), /\nexport function lockLoosened\(/);
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
  it("guides her one step at a time, a video waiting for her answer first, and takes her word for the BRIMM Ops page", () => {
    const guide = sectionOf(skill, "## Guide her");
    assert.ok(guide.trimEnd().split("\n").length <= 30, `${guide.split("\n").length} lines`);
    for (const words of [
      "run `guide`. Say only the one next step it gives, then ask; never read the list out.",
      "A video waiting for her answer comes first, whatever she said",
      'one `AskUserQuestion`: "Is this video a private session with a client or a group?": "Yes", "No", "It is a Zoom download"',
      "`guide drop zoom`", "`guide drop`", "`guide wait`", "`guide page`", '`guide "<video>"`', '`guide "<video>" show`',
      "held in her drop folder: `guide drop zoom`",
      '"Done?": "Done", "Not yet", "Something\'s different"', '`guide "<video>" done <step>`', '`guide "<video>" finished`',
      '"I posted it"', '"I\'ve done that"', '"guide me"', '"That one is all done"', '"Forget that one"',
      'tell her to choose "Client or group session" and "Yes"',
      "Claude cannot see or press anything on the BRIMM Ops page",
      "isn't set up for the guide yet"
    ]) assert.ok(guide.includes(words), words);
    assert.doesNotMatch(guide, /https?:|claude\.ai/);
    // Her word that she is done with a video ends its guidance, and nothing she says brings it back: Claude asks first, on its own
    // words, never those of the release ("I'm done with it for now"), which hands the episode to the other Mac.
    const finished = guide.split("\n").find((line) => line.includes('`guide "<video>" finished`'));
    const asked = finished.indexOf('ask on one `AskUserQuestion`: "Stop guiding <video>?": "Yes", "No"');
    assert.ok(asked >= 0 && finished.indexOf('Only on "Yes"') > asked && finished.indexOf("`guide") > asked, finished);
    assert.ok(finished.includes("the guide will no longer bring it up"), finished);
    assert.ok(!guide.includes("I'm done with it"), guide);
    assert.ok(rowOf(`"Hand it to Jason" / "I'm done with it for now"`).includes('`release "<episode>"`'));
  });
  it("tells her when a video is ready or read, from a wait run in the background, and opens the page once in this chat", () => {
    const guide = sectionOf(skill, "## Guide her");
    assert.ok(guide.trimEnd().split("\n").length <= 30, `${guide.split("\n").length} lines`);
    for (const words of [
      '"Tell me when it\'s ready"', '"Let me know when Claude has read it"', '`guide "<video>" tell`',
      "the Bash tool's run_in_background", "once per video, never Monitor",
      "I'll tell you here; the Mac doing the work shows a notice too", "tell her its one line in plain words",
      "with any time it gives", "offer to tell her here when it's ready",
      "If nothing listed is coming in, being imported or waiting for her answer, ask where she dropped it, then run `guide wait` again.",
      "If it says it is still on its way, offer to wait again.",
      "`guide page` the first time in this chat"
    ]) assert.ok(guide.includes(words), words);
    assert.ok(!guide.includes("the first time in a session"), guide);
    assert.ok(sectionOf(skill, "## The card").includes("offer to tell her here when Claude has read it"));
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

describe("her folder's CLAUDE.md and skill under the open lock (design 2026-10-26, section 7)", () => {
  // The open lock's CLAUDE.md and skill are files of their own (studio/CLAUDE-open.md, studio/SKILL-open.md): the strict lock's are
  // kept as they are, so that a Mac with the strict lock, as both are until Jason opens one, keeps today's folder.
  let w;
  before(() => {
    w = openWorld();
  });
  after(() => w.done());
  const openFiles = () => studioFiles({ checkout: CHECKOUT, node: NODE, folder: w.folder, lock: "open", facts: w.facts });
  const openSkill = () => openFiles()[".claude/skills/brimm-edit/SKILL.md"];
  const strict = studioFiles({ checkout: CHECKOUT, node: NODE });
  const strictSkill = strict[".claude/skills/brimm-edit/SKILL.md"];
  /** The strict skill's lines that word the card itself, which the open skill takes from what episodes and kind print instead: the
      card's paragraph, its two questions, the seven orders of its answers, and the Zoom card's sentence. */
  const wordsTheCard = (line) => /^`episodes` names a video waiting for her answer/.test(line) || /^1\. "What is <label>\?"/.test(line) || /^ {3}- /.test(line)
    || /^2\. "Is it a private session with a client or a group\?"/.test(line) || /^When she answered anything but "Client or group session", and the Came line says/.test(line);

  it("keeps the skill under 160 lines, running only commands edit.js has, each of them one the strict skill runs, whose flags its checks run", () => {
    const skill = openSkill();
    assert.match(skill, /^---\nname: brimm-edit\ndescription: [^\n]+\n---\n/);
    assert.ok(skill.split("\n").length < 160, `${skill.split("\n").length} lines`);
    const given = commandsIn(skill);
    assert.ok(given.length >= 10, given.join(" "));
    const ranByStrict = new Set(commandsIn(strictSkill));
    for (const span of given) {
      assert.ok(COMMAND_NAMES.includes(span.split(" ")[0]), `the open skill runs "${span}", which edit.js does not have`);
      assert.ok(ranByStrict.has(span), `the open skill runs "${span}", which the strict skill's checks of each command and flag do not run`);
    }
    // No picture command yet (K2, K3).
    assert.doesNotMatch(skill, /`picture\b/);
  });
  it("keeps every line of the strict skill in the open skill, but the lines that word the card itself", () => {
    const strictLines = strictSkill.split("\n");
    const open = new Set(openSkill().split("\n"));
    const replaced = strictLines.filter(wordsTheCard);
    assert.equal(replaced.length, 11, replaced.join("\n"));
    for (const line of strictLines.filter((l) => !wordsTheCard(l))) assert.ok(open.has(line), `the open skill lacks the strict skill's line: ${line.slice(0, 90)}`);
    for (const line of replaced) assert.ok(!open.has(line), `the open skill still words the card itself: ${line.slice(0, 90)}`);
  });
  it("has the skill open an episode in HyperFrames in the very row the strict skill has, and run app in no other form", () => {
    const rowOf = (skill) => skill.split("\n").filter((line) => line.startsWith('| "Open the Pricing episode in HyperFrames" / "Open it in HyperFrames" |'));
    assert.equal(rowOf(strictSkill).length, 1, "the strict skill has not one row for opening an episode in HyperFrames");
    assert.deepEqual(rowOf(openSkill()), rowOf(strictSkill));
    const apps = (skill) => [...new Set(commandsIn(skill).filter((span) => span.split(" ")[0] === "app"))];
    assert.deepEqual(apps(openSkill()), apps(strictSkill));
    assert.deepEqual(apps(openSkill()), ['app "<episode>"', 'app "<episode>" --take-over']);
  });
  it("has the skill ask the card exactly as episodes prints it, and never word it itself", () => {
    const skill = openSkill();
    const card = sectionOf(skill, "## The card");
    for (const words of [
      "The card's words are a proposal, for Jason and Sallie to settle",
      "`episodes` prints, under each video waiting for her answer, a line `Card: {…}`.",
      "Ask it with one `AskUserQuestion` exactly as that line gives it: its questions and answers, in that order, word for word, never two videos in one card.",
      "Never word this card yourself.",
      'When it also prints `Card if not a session: {…}`, and she answered anything but "Client or group session", ask that card next, as given; `kind` prints one after it says to ask first, too.',
      "If `kind` says to ask her on the card first, ask the card it prints after that line, as given, and run `kind` again only with her answers.",
      "say its Seen and Came lines, when given, in one line", 'she can say "which one is it?" first'
    ]) assert.ok(card.includes(words), words);
    assert.ok(!skill.includes("Never word a card yourself"), "the skill still words the guide's cards and the correction card");
    assert.ok(!skill.includes('"Finished by your editor", "Raw with retakes", "iPhone clip", "Client or group session"'));
    assert.ok(!card.includes('"What is <label>?"'), card);
    // It listens for kind's refusal of a video with no answer on the card in edit.js's own words.
    assert.ok(NO_RECEIPT.startsWith("Ask her on the card first"), NO_RECEIPT);
    // The table of what to run for each answer stays, Maybe rows and all.
    assert.ok(card.includes('| "A new version of <name>", and No |') && card.includes('| "A finished version of <name>", and No |'), card);
  });
  it("has the skill ask the not-a-session card as printed, and add --not-a-session only on its answer", () => {
    const zoom = sectionOf(openSkill(), "## The card").split("\n").find((line) => line.includes("`--not-a-session`"));
    assert.ok(zoom, "the card does not say when --not-a-session is added");
    for (const words of ["`Card if not a session: {…}`", "on one `AskUserQuestion`", "A bare yes or no in the chat is unclear: ask again.",
      'Only on "It is not a session", run the same `kind` with `--not-a-session` added, as `kind "<label>" finished --private no --not-a-session`',
      'on "It is a client or group session", `kind "<label>" session --private yes`']) assert.ok(zoom.includes(words), words);
    assert.ok(!zoom.includes("It came from Zoom (or: it is sound alone)"), zoom);
  });
  it("has the skill read a session's words from the file brimm-video names, show them as written, and send her to a new chat for anything else", () => {
    const sessions = sectionOf(openSkill(), "## A client or group session");
    assert.ok(sessions.includes(`When brimm-video says a session's words are in a file for this chat alone, read that file with Read and show it exactly as written. Then tell her: "This chat now runs brimm-video only; start a new chat for anything else."`), sessions);
    // It listens for the line edit.js prints in their place.
    assert.ok(wordsLine("Session, 2026-10-14", "/x/words.txt").includes("a session's words are in a file for this chat alone"));
  });
  it("has the skill tell her when the folder is not trusted yet, and when a chat holds a session's words", () => {
    const skill = openSkill();
    const start = sectionOf(skill, "## At the start of each session");
    assert.ok(start.includes(`If \`behind\` says Claude Code has not trusted this folder yet, tell her: "Open this folder again in the Claude app and choose to trust it, then start a new chat."`), start);
    // Whole-branch review, note f: Claude Code ignores this folder's allow rules until it is trusted, so the skill stops there, and
    // the `episodes` that the strict skill's line, kept as it is, says to run after the other lines of `behind` is not run.
    assert.ok(start.includes(`then start a new chat." Then stop: run nothing else, not even \`episodes\`, whatever the paragraph above says to run next, since Claude Code ignores this folder's allow rules until it is trusted.`), start);
    assert.ok(UNTRUSTED.startsWith("Claude Code has not trusted this folder yet"), UNTRUSTED);
    const sessions = sectionOf(skill, "## A client or group session");
    assert.ok(sessions.includes(`If a refusal says "This chat holds a session's words", say that to her in plain words.`), sessions);
    for (const refusal of [HELD_REFUSED, HELD_NARROWED]) assert.ok(refusal.startsWith("This chat holds a session's words"), refusal);
  });
  it("tells Claude in the open lock's CLAUDE.md what it may help with, where it writes, how it reads a command's saved output, and what never leaves the chat", () => {
    const md = openFiles()["CLAUDE.md"];
    for (const words of ["brimm-edit skill", "graphics, research, writing, other programs", "only through brimm-video's commands", "Nothing here posts, sends or publishes anything.",
      "~/BRIMM Video Workshop", "printf", "python3 -c", "node -e", "base64 -d", "never a heredoc", "cat", "Claude's own Write, Edit and Read do not work in the workshop", "When a command's long output is saved to a file, read that file with `cat` or `head`, never with Claude's own Read.", "posted by hand", "never go into a web search, a picture's description, a drawing or the workshop",
      "Never rate, report or share a chat about a session", "a chat that has a session's teachings is for brimm-video only", "Never show her command names, paths or flags.", "suggest she asks Jason"]) assert.ok(md.includes(words), words);
    assert.ok(!md.includes("do not run any other program"), md);
    assert.ok(!md.includes("write a file with Write"), md);
    assert.ok(!md.includes("{{"), md);
    assert.ok(md.trimEnd().split("\n").length <= 12, "kept as short as it was, but for the line about a command's saved output");
  });
  it("keeps the strict lock's CLAUDE.md and skill as they are: the strict folder runs nothing but brimm-video, and words its own card", () => {
    assert.ok(strict["CLAUDE.md"].includes("Everything is done through brimm-video's commands. Do not open, read or change any code, and do not run any other program."));
    for (const words of ["Workshop", "heredoc", "teachings"]) assert.ok(!strict["CLAUDE.md"].includes(words), words);
    assert.ok(strictSkill.includes('1. "What is <label>?", with these answers, in this order (a Maybe line wins over a Guess line):'));
    for (const words of ["Card: {", "a file for this chat alone", "not trusted this folder", "This chat holds a session's words"]) assert.ok(!strictSkill.includes(words), words);
    assert.notEqual(openSkill(), strictSkill);
  });
});
