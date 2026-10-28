// A stand-in for the pinned HyperFrames command line, for tests (plan PR 4): no test runs the real one. It answers `--version`,
// `open <project> --json`, `catch-up <project> --json` and `history --dir <project> --json` as the pinned version does, from PR 1's
// fixtures (tests/fixtures/hyperframes-0.8.208/), and nothing else, which it ends with 2.
//
// It is run in PR 1's environment (hyperframes.js childEnv), which carries no variable of a test's, so it reads how to answer
// `open` from `hyperframes-stand-in.json` in its HOME ({ "open": "opened", "not-installed" or "open-failed" }, "opened" when there
// is none), and writes each run, its arguments and the names of its environment, as a line of `hyperframes-stand-in.log` there.
// It hands the chat over, as the real one does, only when the environment carries CLAUDE_CODE_SESSION_ID.
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const json = (url) => JSON.parse(readFileSync(url, "utf8"));
const fixture = (name) => json(new URL(`../fixtures/hyperframes-0.8.208/${name}`, import.meta.url));
const VERSION = json(new URL("../../hyperframes.pin.json", import.meta.url)).version;

const args = process.argv.slice(2);
const home = process.env.HOME;
// macOS puts __CF_USER_TEXT_ENCODING in the environment of every program it starts, whatever it was given: it is the system's,
// not the caller's, so it is left out of what the stand-in says it was given.
const given = Object.keys(process.env).filter((name) => name !== "__CF_USER_TEXT_ENCODING").sort();
appendFileSync(join(home, "hyperframes-stand-in.log"), `${JSON.stringify({ args, env: given })}\n`);

/** How the test asked `open` to answer. */
function told() {
  try {
    return json(join(home, "hyperframes-stand-in.json"));
  } catch {
    return {};
  }
}

const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const is = (...expected) => args.length === expected.length && expected.every((word, i) => word === null || args[i] === word);

/** The exit status, once what the pinned version prints is printed. */
function answer() {
  if (is("--version")) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (is("open", null, "--json")) {
    const project = args[1];
    const open = told().open ?? "opened";
    if (open === "opened") {
      const chat = process.env.CLAUDE_CODE_SESSION_ID;
      print(chat ? { ...fixture("open-opened-handed-over.json"), project, handedOver: { engine: "claude", sessionId: chat } } : { ...fixture("open-opened.json"), project });
      return 0;
    }
    print({ ...fixture("open-not-installed.json"), project, reason: open });
    return 1;
  }
  if (is("catch-up", null, "--json")) {
    print({ ...fixture("catch-up-empty.json"), project: args[1] });
    return 0;
  }
  if (is("history", "--dir", null, "--json")) {
    print(fixture("history-empty.json"));
    return 0;
  }
  process.stderr.write(`The stand-in answers --version, open, catch-up and history only, not: ${args.join(" ")}\n`);
  return 2;
}

process.exitCode = answer();
