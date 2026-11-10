// The sweep (10 November 2026): the lines that send a person to Jason, as an installed Mac says them. An installed Mac has no Jason at hand,
// no install.sh and no Terminal, so such a line names the support contact its build.json names, or ends before those words where it names
// none (build.js saidHere and askWords). A checkout says every line as it always did. Every Mac here is made up in a temp home, and no
// program is real.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILD_FILE, saidHere } from "../build.js";
import { editMain } from "../edit.js";
import { guardAnswer } from "../open-lock.js";
import { NEWEST_VERSION, recordFile } from "../episode.js";
import { setup, episodeFor, FOLDER, ID } from "./episodes.js";

const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid", broken: false };
const UNNAMED = { ...INSTALLED, support: "" };
const DEV = { mode: "dev" };
/** What no line of an installed Mac holds. */
const NEVER = /Jason|install\.sh|Terminal|\bnode\b/;

/** A command on the made-up Mac `t`, whose BRIMM Video Studio is `build`. */
async function on(t, build, argv, more = {}) {
  const said = [];
  const code = await editMain(argv, { ...t.ctx.deps, build, ...more, say: (line) => said.push(line) });
  return { code, said };
}
/** The same command on a checkout, on an installed Mac with a support contact, and on one with none: what each says. */
async function thrice(argv, { before = () => {}, more = () => ({}) } = {}) {
  const out = [];
  for (const build of [DEV, INSTALLED, UNNAMED]) {
    const t = setup();
    const made = before(t) || {};
    out.push((await on(t, build, argv, more(t, made))).said);
    t.done();
  }
  for (const line of [...out[1], ...out[2]]) assert.doesNotMatch(line, NEVER, line);
  return out;
}

describe("a command's refusal, on an installed Mac", () => {
  it("names the support contact for a Mac that is not set up for HyperFrames (edit.js refuse)", async () => {
    const [dev, installed, unnamed] = await thrice(["app", FOLDER], { before: (t) => episodeFor(t) });
    assert.deepEqual(dev, ["This Mac isn't set up for HyperFrames yet: ask Jason."]);
    assert.deepEqual(installed, ["This Mac isn't set up for HyperFrames yet: ask help@example.invalid."]);
    assert.deepEqual(unnamed, ["This Mac isn't set up for HyperFrames yet."]);
  });

  it("names the support contact where there is no reference folder (references.js refuse)", async () => {
    const [dev, installed, unnamed] = await thrice(["refs"]);
    assert.deepEqual(dev, ["There's no reference folder on this Mac yet: ask Jason."]);
    assert.deepEqual(installed, ["There's no reference folder on this Mac yet: ask help@example.invalid."]);
    assert.deepEqual(unnamed, ["There's no reference folder on this Mac yet."]);
  });
});

describe("what is said of an episode, on an installed Mac", () => {
  it("says an episode a newer BRIMM Video Studio wrote is for an update, in the list of episodes", async () => {
    const before = (t) => {
      const found = episodeFor(t);
      writeFileSync(recordFile(found.folder, 2), JSON.stringify({ version: NEWEST_VERSION + 1, id: ID, rev: 2, kind: "podcast" }));
    };
    const [dev, installed, unnamed] = await thrice(["episodes"], { before });
    assert.equal(dev[1], "  An episode a newer BRIMM Video Studio wrote (3fa9c1): Jason updates this Mac before it is changed here.");
    assert.equal(installed[1], '  An episode a newer BRIMM Video Studio wrote (3fa9c1). Say "update Studio" to update this Mac.');
    assert.equal(unnamed[1], installed[1]);
  });

  it("names the support contact for an episode whose record cannot be read, in the list and when it is asked for", async () => {
    const before = (t) => writeFileSync(join(t.root, "Episodes", FOLDER), "not a folder");
    for (const [argv, at] of [[["episodes"], 1], [["show", FOLDER, "transcript"], 0]]) {
      const [dev, installed, unnamed] = await thrice(argv, { before });
      assert.equal(dev[at].trim(), "An episode of 2026-10-14 from the Mac Studio whose record cannot be read: ask Jason.");
      assert.equal(installed[at].trim(), "An episode of 2026-10-14 from the Mac Studio whose record cannot be read: ask help@example.invalid.");
      assert.equal(unnamed[at].trim(), "An episode of 2026-10-14 from the Mac Studio whose record cannot be read.");
    }
  });
});

describe("the guard on her folder, on an installed Mac", () => {
  /** A call the strict guard refuses, on a Mac with no settings: `checkout` is where the guard's own copy is, whose build.json says which Mac it is. */
  const refusal = async (checkout, deps = {}) => {
    const home = mkdtempSync(join(tmpdir(), "brimm-guard-"));
    try {
      const folder = join(home, "BRIMM Video Studio");
      mkdirSync(folder, { recursive: true });
      return await guardAnswer({ tool_name: "Bash", tool_input: { command: "ls" } }, { checkout, node: "/opt/homebrew/bin/node", folder, deps });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  };

  it("names the support contact in what it refuses, by the build of the copy it runs from, and Jason on a checkout", async () => {
    const dev = "In this folder Claude runs only BRIMM Video Studio's own commands. Ask Jason for anything else.";
    assert.deepEqual(await refusal("/checkout"), { decision: "deny", reason: dev });
    assert.deepEqual(await refusal("/checkout", { build: DEV }), { decision: "deny", reason: dev });
    assert.deepEqual(await refusal("/checkout", { build: INSTALLED }), { decision: "deny", reason: "In this folder Claude runs only BRIMM Video Studio's own commands. Ask help@example.invalid for anything else." });
    assert.deepEqual(await refusal("/checkout", { build: UNNAMED }), { decision: "deny", reason: "In this folder Claude runs only BRIMM Video Studio's own commands." });
    // With no build given it reads the build.json of its own copy, as the hook does.
    const app = mkdtempSync(join(tmpdir(), "brimm-guard-app-"));
    try {
      const { mode, broken, ...written } = INSTALLED;
      writeFileSync(join(app, BUILD_FILE), JSON.stringify(written));
      assert.deepEqual(await refusal(app), { decision: "deny", reason: "In this folder Claude runs only BRIMM Video Studio's own commands. Ask help@example.invalid for anything else." });
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });
});

describe("the tool's own lines that name Jason, install.sh or Terminal", () => {
  // The lines of tool/*.js that an installed Mac may say as they are written, each with why. Every other line that names Jason must end in
  // words saidHere knows (so that whoever says it can pass it through), or be made with askWords or behind isInstalled. A new line that
  // sends her to Jason fails here until it ends as saidHere knows, or is listed with its reason.
  const STAYS = [
    // The command lines' own help: Claude and Jason read it, and it is a list of commands for a Terminal.
    ["edit.js", /^ {30,}\S/, "edit.js --help"],
    ["settings.js", /^ {30,}\S/, "settings.js --help"],
    // A checkout's own lines: each is said only where the Mac is not installed (its installed line is beside it, or it is git's).
    ["edit.js", "so it is not updated from here. Ask Jason to update it when it suits.", "update, on a checkout"],
    ["edit.js", "Her folder for Claude is out of date: an older BRIMM Video Studio wrote it. Ask Jason", "behind, on a checkout"],
    ["edit.js", "is not the one Studio needs. Ask Jason to update it when it suits.", "behind, on a checkout"],
    ["edit.js", "Jason has a newer BRIMM Video Studio (${n} change", "behind, on a checkout: git's count"],
    ["plan.js", "Jason has a newer BRIMM Video Studio. Ask him to update this Mac", "notWritten, on a checkout"],
    ["settings.js", "const MEND_SETTING = ", "a checkout's mend: mendFor says Repair on an installed Mac"],
    ["settings.js", "const USER_UNREAD = ", "a checkout's line: userUnread says an installed Mac's"],
    ["settings.js", "The drop folder is switched by the installer", "settings.js set, Jason's own command: an installed Mac has no Terminal to run it in"],
    // Said through code that knows the build, where it is said.
    ["edit.js", "line.replace(/^\\(Jason: (.)/", "loosenedNote, which takes Jason out of a lock note"],
    ["edit.js", 'const NEEDS_JASON = "A conflict needs Jason', "always said after a sentence, and saidHere knows that end"],
    ["episode.js", 'new Error("Jason has a newer BRIMM Video Studio', "episode.js knows no build: forThisMac gives the error again where it is said"],
    ["episode.js", "tell Jason.${as}", "episode.js knows no build: edit.js fileProblemSaid says it"],
    ["loosened.js", "(Jason: ", "a lock note: edit.js loosenedNote says it"],
    // Not said to the person at the Mac.
    ["hyperframes.js", '"denied", "', "the table of why a HyperFrames command is never run: said to nobody"],
    ["project.js", "No generated people.", "The BRIMM's rule in a project's notes, for the app's agent"],
    // No installed wording yet: the way out is a command, and what an installed Mac does about it waits for the app's own setup.
    ["unedited.js", "com.thebrimm.claude-check", "a launch agent an old or cut-short setup left behind"]
  ];
  const stays = (file, line) => STAYS.some(([f, words]) => f === file && (words instanceof RegExp ? words.test(line) : line.includes(words)));

  it("each end as saidHere knows, are made for this Mac where they are written, or are listed above with why they stay", () => {
    const tool = new URL("..", import.meta.url);
    const loose = [];
    for (const file of readdirSync(tool).filter((name) => name.endsWith(".js") && name !== "build.js").sort()) {
      let comment = false;
      readFileSync(new URL(file, tool), "utf8").split("\n").forEach((line, i) => {
        const text = line.trim();
        if (comment) {
          comment = !text.includes("*/");
          return;
        }
        if (text.startsWith("/*")) {
          comment = !text.includes("*/");
          return;
        }
        if (text.startsWith("//") || text.startsWith("*")) return;
        // Made for this Mac where it is written.
        if (/askWords\(|isInstalled\(|saidHere\(|asSaid\(|asHere\(|mendFor\(|forJason\(|installed \? /.test(line) || stays(file, line)) return;
        for (const found of line.matchAll(/Jason|install\.sh|Terminal/g)) {
          if (found[0] !== "Jason") {
            loose.push(`${file}:${i + 1}: ${text.slice(0, 160)}`);
            continue;
          }
          // The line's own words up to the end of the string this Jason is in: a quote, or a full stop before a closing single quote.
          const rest = line.slice(found.index);
          const end = rest.search(/(?<!\\)["`]|(?<=\.)'(?=[;),\s]|$)/);
          const written = line.slice(0, found.index + (end === -1 ? rest.length : end));
          // A reason that ends a sentence someone else closes (workcopy.js) is tried with its full stop.
          const ok = [written, `${written}.`].some((words) => !saidHere(words, INSTALLED).slice(found.index).includes("Jason"));
          if (!ok) loose.push(`${file}:${i + 1}: ${text.slice(0, 160)}`);
        }
      });
    }
    assert.deepEqual(loose, []);
  });
});
