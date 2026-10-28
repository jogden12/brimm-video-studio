// The installer, asked only what it would do. Every test here runs it with --print, which changes nothing: no test installs,
// loads or removes anything, and the installer is never run without it. It is given a home folder made for the test, and
// stand-ins for launchctl, brew, curl and npm come first on its PATH, so a test can see that none of them was run.
// The tests need a Mac, which has zsh and plutil. Anywhere else they skip themselves and say why.
// The few lines that take a launch agent away are also run alone, in zsh, never the installer whole: in a folder made for
// the test, with a stand-in for launchctl first on the PATH, so the Mac's own launchd is never asked anything.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PIN, childEnv, cliPath, toolchainDir } from "../hyperframes.js";

const INSTALL = fileURLToPath(new URL("../install.sh", import.meta.url));
const HERE = dirname(INSTALL);
const notAMac = process.platform !== "darwin" ? "the installer is for a Mac, and so is plutil, which reads what it would write" : false;
/** For a test that runs a few of the installer's lines alone: they need zsh, as the installer does, and nothing of a Mac. */
const noZsh = existsSync("/bin/zsh") ? false : "the installer is a zsh script, and there is no /bin/zsh here to run its lines with";
const PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
const MODEL = "Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin";
/** What Claude Code prints for `claude auth status --json` when it is signed in: its email is never to be shown. */
const SIGNED_IN = '{"loggedIn":true,"authMethod":"claude.ai","subscriptionType":"max","email":"sallie@example.com","orgName":"The BRIMM"}';
/** Stand-ins for the programs that say what the Mac has: Xcode's command line tools there or not, and the Mac's macOS. */
const XCODE_HERE = '[ "$1" = "-p" ] && echo /Library/Developer/CommandLineTools\n';
const XCODE_MISSING = 'echo "xcode-select: error: unable to get active developer directory" >&2\nexit 2\n';
const MACOS = (version) => `[ "$1" = "-productVersion" ] && echo ${version}\n`;
/** A PATH for a launch agent of folders on no Mac, so that this Mac's own Claude Code is not found. */
const NOWHERE_ELSE = "/nowhere/bin:/nowhere/else/bin";
/** Where a line about Final Cut Pro begins, for one of the two Macs (--machine): it is optional now, since HyperFrames is where she edits. */
const FINAL_CUT = "  Final Cut Pro, optional now (HyperFrames is where she edits):";
/** The two lines for one of the two Macs (--machine) about the Chrome the HyperFrames command line renders with and its doctor check,
    said right after the lines about the command line itself. `kept` is the folder the command line keeps that Chrome in: its own
    copy, in the home folder's cache (the pinned package's CACHE_DIR, which the H0 render test also found by hand). */
const CHROME = (kept) => `  Its Chrome:  found, or fetched from storage.googleapis.com when it is not there, by the command line's own browser ensure, once the command line is in place: the Chrome Headless Shell it renders with, its own copy, kept in ${kept} (a Chrome you use is left alone). If it cannot be had, the setup stops there, before this Mac's drop folder, its settings and its launch agent are touched`;
const DOCTOR = "  Its doctor check:  the command line's own doctor, run last, right after its Chrome. Its words are shown for Jason to read on each Mac, the installer reads none of them, and it does not stop the setup. It may say that a newer version of the command line is out: that is expected, since the pin moves only by a pull request. Nothing it suggests is installed here";

/** Ask the installer what it would do. Gives back how it ended, what it printed, each launch agent it showed, as plutil reads
    it, and what was changed: `left` is what is in the home folder afterwards, and `ran` the programs it ran that change
    something. A plist that plutil cannot read fails the test there and then. */
const ask = (...args) => askOn({}, ...args);

/** The same, of a Mac that has launch agents already: `installed` holds the text of each one's file, by its label. `kept` is
    what those files hold afterwards. `programs` names stand-ins to put in the home folder first, each by its path from
    there, such as ".local/bin/claude": a file that can be run and does nothing. `files` names plain files to put there, such
    as the transcriber's model, each by its path from there, or as [path, text] when it must hold something. `agentPath` is
    the PATH the installer is told to give a launch agent, in place of its own: folders with no programs in them, for a test
    that must not find the Claude Code of the Mac it runs on.
    For one of the two Macs (--machine) the installer asks Claude Code whether it is signed in, and its version, so such a run
    is given a stand-in for it, and no test runs the real one: `claude` is what the stand-in prints for `auth status --json`,
    by default signed in, with an email the installer must never print, and `claudeVersion` what it prints for --version.
    With `claude: null` there is no stand-in: give `agentPath` too, so that this Mac's own Claude Code is not found. `onPath` names more stand-ins to put first on
    its PATH, each with the shell text it runs, such as "xcode-select" or "sw_vers". `finalCut` is the version of a made-up
    Final Cut Pro the installer is pointed at, or null for none; without it the installer looks at this Mac's own. With
    `bare`, the Mac has no Homebrew: there is no stand-in brew, and the installer looks for programs on PATH alone, which
    holds the stand-ins and /usr/bin and /bin. `install` is the installer to ask, this checkout's unless a test gives a copy's. */
function askOn(installed, ...args) {
  return askWith({ installed }, ...args);
}
function askWith({ installed = {}, programs = [], files = [], agentPath = "", claude = SIGNED_IN, claudeVersion = "2.1.296 (Claude Code)", versionExit = 0, onPath = {}, finalCut, finalCutText, settings, bare = false, install = INSTALL }, ...args) {
  // The one rule of this file: nothing is run without --print.
  assert.ok(args.includes("--print"), "the installer is only ever asked what it would do");
  const dir = mkdtempSync(join(tmpdir(), "brimm-install-"));
  try {
    const home = join(dir, "home");
    const bin = join(dir, "bin");
    mkdirSync(home);
    mkdirSync(bin);
    const fileOf = (label) => join(home, "Library", "LaunchAgents", `${label}.plist`);
    for (const [label, text] of Object.entries(installed)) {
      mkdirSync(dirname(fileOf(label)), { recursive: true });
      writeFileSync(fileOf(label), text);
    }
    for (const program of programs) {
      mkdirSync(dirname(join(home, program)), { recursive: true });
      writeFileSync(join(home, program), "#!/bin/sh\nexit 0\n");
      chmodSync(join(home, program), 0o755);
    }
    for (const file of files) {
      const [path, text] = Array.isArray(file) ? file : [file, "made for the test"];
      mkdirSync(dirname(join(home, path)), { recursive: true });
      writeFileSync(join(home, path), text);
    }
    // npm too: it installs the HyperFrames command line, which only a real run does, so a --print that ran it would show in `ran`.
    for (const name of ["launchctl", ...(bare ? [] : ["brew"]), "curl", "npm"]) {
      writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${join(dir, "ran")}"\n`);
      chmodSync(join(bin, name), 0o755);
    }
    // The stand-in for Claude Code answers what --print asks, signed out as the real one is, with exit 1, and writes any
    // other call into `ran`, so that a --print that updated it or signed it in would show. So does xcode-select's, for any
    // call but -p.
    const ran = join(dir, "ran");
    const signedOut = claude !== null && claude.includes('"loggedIn":false');
    const stands = { ...onPath, ...(args.includes("--machine") && claude !== null ? { "claude-stand-in": `case "$*" in\n  "auth status --json") printf '%s' '${claude}'; exit ${signedOut ? 1 : 0} ;;\n  --version) echo '${claudeVersion}'; exit ${versionExit} ;;\n  *) echo "claude $*" >> "${ran}" ;;\nesac\n` } : {}) };
    for (const [name, script] of Object.entries(stands)) {
      const logged = name === "xcode-select" ? `[ "$1" = "-p" ] || echo "xcode-select $*" >> "${ran}"\n` : "";
      writeFileSync(join(bin, name), `#!/bin/sh\n${logged}${script}`);
      chmodSync(join(bin, name), 0o755);
    }
    // This Mac's settings, when a test gives them: --print reads them and must write nothing from them.
    if (settings) {
      mkdirSync(join(home, "Library", "Application Support", "BRIMM Video"), { recursive: true });
      writeFileSync(join(home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify({ version: 1, ...settings }));
    }
    let app = "";
    if (finalCut !== undefined) {
      app = join(dir, "Applications", "Final Cut Pro.app");
      if (finalCut !== null) {
        mkdirSync(join(app, "Contents"), { recursive: true });
        writeFileSync(join(app, "Contents", "Info.plist"), finalCutText ?? `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>${finalCut}</string></dict></plist>\n`);
      }
    }
    const env = {
      // The node that runs these tests is on the PATH of the installer, whatever PATH the tests were started with: with --machine it
      // reads this Mac's settings with node, before anything is changed. `bare` is a Mac with no Homebrew and no node.
      HOME: home, PATH: bare ? `${bin}:/usr/bin:/bin` : `${bin}:${process.env.PATH}:${dirname(process.execPath)}`, ...(agentPath ? { BRIMM_AGENT_PATH: agentPath } : {}),
      ...(stands["claude-stand-in"] ? { BRIMM_CLAUDE: join(bin, "claude-stand-in") } : {}), ...(app ? { BRIMM_FINAL_CUT: app } : {}), ...(bare ? { BRIMM_HOMEBREW_DIRS: "" } : {})
    };
    const r = spawnSync("/bin/zsh", [install, ...args], { encoding: "utf8", input: "", env });
    const agents = (r.stdout.match(/<\?xml[\s\S]*?<\/plist>\n/g) || []).map((text, i) => {
      const file = join(dir, `agent-${i}.plist`);
      writeFileSync(file, text);
      const lint = spawnSync("/usr/bin/plutil", ["-lint", file], { encoding: "utf8" });
      assert.equal(lint.status, 0, lint.stdout + lint.stderr);
      return { text, ...JSON.parse(spawnSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" }).stdout) };
    });
    const kept = Object.fromEntries(Object.keys(installed).map((label) => [label, readFileSync(fileOf(label), "utf8")]));
    return { status: r.status, out: r.stdout, err: r.stderr, agents, home, left: readdirSync(home, { recursive: true }).sort(), kept, ran: existsSync(join(dir, "ran")) ? readFileSync(join(dir, "ran"), "utf8") : "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** What a launch agent holds, without its own text. */
const held = ({ text, ...agent }) => agent;
/** The launch agent the Mac is given: it runs unedited.js with node, once for all the folders, whenever one of them changes and
    when it is loaded, and writes what the tool says into its own log. `option` is what unedited.js is told before the
    folders, such as --rules-only. */
const agent = (r, folders, option = []) => ({
  Label: "com.thebrimm.unedited",
  ProgramArguments: [r.agents[0].ProgramArguments[0], join(HERE, "unedited.js"), ...option, ...folders.flatMap((folder) => ["--watch", folder])],
  WatchPaths: folders,
  RunAtLoad: true,
  EnvironmentVariables: { PATH },
  StandardOutPath: join(r.home, "Library/Logs/brimm-video.log"),
  StandardErrorPath: join(r.home, "Library/Logs/brimm-video.log")
});
const changedNothing = (r) => {
  assert.deepEqual([r.left, r.ran], [[], ""]);
  assert.match(r.out, /\nNothing was changed\.\n$/);
};
/** What the installer said, without the two paths that are this Mac's own: the folder the tool is in, and the home folder made
    for the test. The tool may be checked out in a folder of any name, such as one named for a branch, and a word that must
    not be said is not to be found in that name. */
const said = (r) => r.out.replaceAll(HERE, "<the tool's folder>").replaceAll(r.home, "<home>");

/** A folder's name as a plist holds it. */
const xml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
/** The transcript tool's launch agent as its own installer writes it, watching these folders. This installer only reads it. */
const transcriptAgent = (folders) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.thebrimm.transcribe</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/someone/Claude Code/BRIMM operations/transcribe/transcribe.js</string>
${folders.map((folder) => `    <string>--watch</string>\n    <string>${xml(folder)}</string>`).join("\n")}
  </array>
  <key>WatchPaths</key>
  <array>
${folders.map((folder) => `    <string>${xml(folder)}</string>`).join("\n")}
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`;

/** The folders the transcript tool's launch agent watches in the tests that give this Mac one, and what is then in the home
    folder made for the test: that agent's file and nothing more. */
const WATCHED = ["/Volumes/Work/Main", "/Volumes/Work/Main/Zoom Video Transfer", "/Volumes/Work/R&D <raw> \"takes\""];
const LEFT = ["Library", "Library/LaunchAgents", "Library/LaunchAgents/com.thebrimm.transcribe.plist"];

describe("the installer, asked what it would do", { skip: notAMac }, () => {
  it("shows one launch agent, com.thebrimm.unedited: unedited.js on every folder named, whenever one of them changes, with a log of its own", () => {
    const r = ask("--print", "/Volumes/Work/Unedited video", "/Volumes/Work/More of it");
    assert.equal(r.status, 0, r.err);
    assert.deepEqual(r.agents.map(held), [agent(r, ["/Volumes/Work/Unedited video", "/Volumes/Work/More of it"])]);
    assert.match(r.agents[0].ProgramArguments[0], /\/node$/);
    assert.ok(existsSync(r.agents[0].ProgramArguments[1]));
    // swift, which finds the faces for the upright version, is in /usr/bin.
    assert.ok(r.agents[0].EnvironmentVariables.PATH.split(":").includes("/usr/bin"));
    assert.ok(r.out.includes(`This is what the Mac would be given, at ${r.home}/Library/LaunchAgents/com.thebrimm.unedited.plist:`), r.out);
    assert.ok(r.out.includes("  Folder to watch for unedited video:  /Volumes/Work/Unedited video\n  Folder to watch for unedited video:  /Volumes/Work/More of it\n"), r.out);
    assert.ok(r.out.includes(`  Log:  ${r.home}/Library/Logs/brimm-video.log\n`), r.out);
    // It says whether swift is on this Mac, and installs nothing for it.
    assert.match(r.out, /\n {2}Swift, to find the speaker's face: {2}(here already|not here, so the upright version is cropped at the centre\. To get it: xcode-select --install)\n/);
    // Of the transcript tool it gives nothing and says nothing: that tool's installer is in brimm-operations.
    assert.doesNotMatch(said(r), /com\.thebrimm\.transcribe|BRIMM Transcripts|brimm-transcribe\.log|transcribe\.js|for transcripts/);
    changedNothing(r);
  });
  it("refuses a line that names no folder, and says how to name one", () => {
    for (const args of [["--print"], ["--print", "--rules-only"], ["--yes", "--print"]]) {
      const r = ask(...args);
      assert.deepEqual([r.status, r.out, r.agents], [2, 'Name the folder to watch for unedited video: ./install.sh "<folder>"\n', []], args.join(" "));
      assert.deepEqual([r.left, r.ran], [[], ""]);
    }
  });
  it("refuses --unedited, which it does not know: every folder named is for unedited video", () => {
    const r = ask("--print", "--unedited", "/Volumes/Work/Unedited video");
    assert.deepEqual([r.status, r.out, r.agents], [2, "Not an option this script knows: --unedited\n", []]);
    assert.deepEqual([r.left, r.ran], [[], ""]);
  });
  it("says whether Claude Code is on this Mac, where the launch agent will look for it, and what is then sent to Claude. It installs nothing for it", () => {
    const r = ask("--print", "/Volumes/Work/Unedited video");
    assert.equal(r.status, 0, r.err);
    const found = /\n {2}Claude Code, to read each cut plan: {2}here already, at (\/\S+\/claude)\n {2}Sent to Claude for each cut plan: {2}the words of the transcript with their times, the rules' plan, and the video's file name and length, on the Claude account signed in on this Mac\. The video and its sound never leave it\. To send nothing: --rules-only\n/.exec(r.out);
    const missing = r.out.includes("\n  Claude Code, to read each cut plan:  not here, so each cut plan is the rules' alone and nothing leaves this Mac. To have Claude read it: install Claude Code and sign in to it on this Mac\n");
    assert.ok(found || missing, r.out);
    // It is looked for where the launch agent's own PATH leads, and not where this shell's does.
    if (found) assert.ok(["/opt/homebrew/bin/claude", "/usr/local/bin/claude", "/usr/bin/claude", "/bin/claude"].includes(found[1]), found[1]);
    changedNothing(r);
    // The agent is told nothing about Claude: unedited.js asks whenever Claude Code is there.
    assert.deepEqual(r.agents.map(held), [agent(r, ["/Volumes/Work/Unedited video"])]);
  });
  // The Mac a test runs on may have Claude Code where Homebrew puts programs, and that one would be found first. So these
  // two give the launch agent a PATH of folders that are on no Mac, and the home folder made for the test is the one place
  // left to look.
  const NOWHERE = "/nowhere/bin:/nowhere/else/bin";
  it("finds Claude Code in the home folder's own .local/bin, where the launch agent's PATH does not lead and unedited.js looks all the same", () => {
    const r = askWith({ programs: [".local/bin/claude"], agentPath: NOWHERE }, "--print", "/Volumes/Work/Unedited video");
    assert.equal(r.status, 0, r.err);
    const found = /\n {2}Claude Code, to read each cut plan: {2}here already, at (\/\S+\/claude)\n/.exec(r.out);
    assert.ok(found, r.out);
    assert.equal(found[1], `${r.home}/.local/bin/claude`);
    assert.deepEqual([r.left, r.ran], [[".local", ".local/bin", ".local/bin/claude"], ""]);
  });
  it("says Claude Code is not here when it is nowhere the launch agent will look, and that each plan is then the rules' alone", () => {
    const r = askWith({ agentPath: NOWHERE }, "--print", "/Volumes/Work/Unedited video");
    assert.equal(r.status, 0, r.err);
    assert.ok(r.out.includes("\n  Claude Code, to read each cut plan:  not here, so each cut plan is the rules' alone and nothing leaves this Mac. To have Claude read it: install Claude Code and sign in to it on this Mac\n"), r.out);
    assert.doesNotMatch(r.out, /here already, at|Sent to Claude/);
    // The launch agent is given the PATH that was looked along.
    assert.equal(r.agents[0].EnvironmentVariables.PATH, NOWHERE);
    changedNothing(r);
  });
  it("has the launch agent run unedited.js with --rules-only when that is asked for, wherever in the line, and says that Claude is not asked", () => {
    const lines = [
      ["--print", "/Volumes/Work/Unedited video", "--rules-only"],
      ["--rules-only", "/Volumes/Work/Unedited video", "--print"],
      ["--print", "--rules-only", "/Volumes/Work/Unedited video"]
    ];
    for (const args of lines) {
      const r = ask(...args);
      assert.equal(r.status, 0, r.err);
      assert.deepEqual(r.agents.map(held), [agent(r, ["/Volumes/Work/Unedited video"], ["--rules-only"])], args.join(" "));
      assert.ok(r.out.includes("\n  Claude, to read each cut plan:  not asked (--rules-only), so each cut plan is the rules' alone and nothing leaves this Mac\n"), r.out);
      assert.doesNotMatch(r.out, /Claude Code, to read|Sent to Claude/);
      changedNothing(r);
    }
  });
  it("writes a folder's name so that the Mac reads it back as it was given, whatever characters are in it", () => {
    const r = ask("--print", "/Volumes/Work/R&D <raw> \"takes\"");
    assert.deepEqual(r.agents[0].WatchPaths, ["/Volumes/Work/R&D <raw> \"takes\""]);
    assert.deepEqual(r.agents[0].ProgramArguments.slice(2), ["--watch", "/Volumes/Work/R&D <raw> \"takes\""]);
  });
  it("says whether the transcriber's model is here, where the transcript tool keeps it, and offers the download only when it is not", () => {
    const missing = ask("--print", "/Volumes/Work/Unedited video");
    assert.ok(missing.out.includes(`\n  Model:  to download, about 1.6 GB, to ${missing.home}/${MODEL}\n`), missing.out);
    changedNothing(missing);
    const here = askWith({ files: [MODEL] }, "--print", "/Volumes/Work/Unedited video");
    assert.equal(here.status, 0, here.err);
    assert.ok(here.out.includes("\n  Model:  here already\n"), here.out);
    assert.doesNotMatch(here.out, /to download/);
    assert.equal(here.ran, "");
  });
  // The transcript tool's launch agent goes on watching its folders, and whichever tool looked first in a folder would file the
  // video away. So a folder it watches is refused here, and its file is only ever read.
  it("refuses a folder that the transcript tool's launch agent on this Mac watches already, and leaves that agent as it is", () => {
    const installed = { "com.thebrimm.transcribe": transcriptAgent(WATCHED) };
    for (const args of [["--print", "/Volumes/Work/Main/Zoom Video Transfer"], ["/Volumes/Work/Unedited video", "/Volumes/Work/Main", "--print"], ["--print", "/Volumes/Work/R&D <raw> \"takes\"", "--rules-only"]]) {
      const r = askOn(installed, ...args);
      const folder = args.find((arg) => WATCHED.includes(arg));
      assert.deepEqual([r.status, r.agents], [2, []], args.join(" "));
      assert.equal(r.out, `A folder is for transcripts or for unedited video, and not for both: ${folder} is watched for transcripts already, by com.thebrimm.transcribe. Take it off the transcript tool's list first, or name another folder.\n`);
      assert.deepEqual([r.left, r.kept, r.ran], [LEFT, installed, ""]);
    }
    // A folder that agent does not watch is taken, and the agent is left as it is.
    const other = askOn(installed, "--print", "/Volumes/Work/Main/Unedited Video Transfer");
    assert.deepEqual([other.status, other.agents.map((a) => a.WatchPaths), other.left, other.kept, other.ran], [0, [["/Volumes/Work/Main/Unedited Video Transfer"]], LEFT, installed, ""]);
  });
  it("goes by the line alone when the transcript tool's launch agent's file cannot be read, or names no folder", () => {
    for (const text of ["not a launch agent", '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>Label</key><string>com.thebrimm.transcribe</string></dict></plist>\n']) {
      const r = askOn({ "com.thebrimm.transcribe": text }, "--print", "/Volumes/Work/Main");
      assert.deepEqual([r.status, r.agents.map((a) => a.Label), r.kept, r.ran], [0, ["com.thebrimm.unedited"], { "com.thebrimm.transcribe": text }, ""], r.out + r.err);
    }
  });
});

describe("the installer, asked what it would do to stop the watching", { skip: notAMac }, () => {
  it("names its own launch agents alone, the setup's check of Claude among them, and stops them not when it is only asked, wherever --print is and whatever folder is named", () => {
    for (const args of [["--remove", "--print"], ["--print", "--remove"], ["--print", "--remove", "/Volumes/Work/Unedited video"]]) {
      const r = ask(...args);
      assert.equal(r.status, 0, r.err);
      assert.deepEqual(r.agents, []);
      assert.equal(r.out, `This is what would be stopped:\n  com.thebrimm.unedited, and its file ${r.home}/Library/LaunchAgents/com.thebrimm.unedited.plist\n  com.thebrimm.claude-check, if a setup left it behind\n\nNothing was changed.\n`, args.join(" "));
      changedNothing(r);
    }
  });
  it("names the setup's check of Claude by its file when a setup left it behind, and leaves it as it is", () => {
    const installed = { "com.thebrimm.claude-check": "made by an earlier setup" };
    const r = askOn(installed, "--remove", "--print");
    assert.equal(r.status, 0, r.err);
    assert.ok(r.out.includes(`\n  com.thebrimm.claude-check, and its file ${r.home}/Library/LaunchAgents/com.thebrimm.claude-check.plist, which a setup left behind\n`), r.out);
    assert.doesNotMatch(r.out, /if a setup left it behind/);
    assert.deepEqual([r.kept, r.ran], [installed, ""]);
  });
  it("is never refused, and leaves the transcript tool's launch agent as it is, whatever it watches", () => {
    const installed = { "com.thebrimm.transcribe": transcriptAgent(WATCHED) };
    const r = askOn(installed, "--print", "--remove", "/Volumes/Work/Main");
    assert.equal(r.status, 0, r.err);
    assert.deepEqual([r.left, r.kept, r.ran], [LEFT, installed, ""]);
    assert.doesNotMatch(r.out, /com\.thebrimm\.transcribe/);
  });
});

describe("the installer's own text", () => {
  const text = readFileSync(INSTALL, "utf8");
  it("reads as zsh from its first line to its last", { skip: notAMac }, () => {
    const r = spawnSync("/bin/zsh", ["-n", INSTALL], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  });
  it("says in its help how to have a folder watched for unedited video", { skip: notAMac }, () => {
    const r = ask("--print", "--help");
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /^Sets the unedited-video tool up on this Mac/);
    assert.match(r.out, /\n {2}\.\/install\.sh "\/path\/to\/folder" +watch that folder for unedited video/);
    assert.doesNotMatch(r.out, /set -euo pipefail|--unedited/);
    assert.deepEqual([r.left, r.ran], [[], ""]);
  });
  it("says in its help how to keep Claude from being asked, and what leaves the Mac when it is asked, down to its last line", { skip: notAMac }, () => {
    const r = ask("--print", "--help");
    assert.match(r.out, /\n {2}\.\/install\.sh "\/path\/to\/folder" --rules-only\n/);
    const help = r.out.replace(/\s+/g, " ");
    assert.ok(help.includes("No video and no sound ever leaves the Mac. Claude is asked to read each cut plan: the words of the transcript with their times and the rules' plan are then sent to Claude through Claude Code, on the Claude account signed in on this Mac, with the video's file name and its length. With --rules-only nothing leaves the Mac."), r.out);
    // The help is the comment the file opens with, whole: it ends where the script begins.
    assert.ok(text.includes(`\n# ${r.out.trimEnd().split("\n").pop()}\nset -euo pipefail\n`), r.out);
  });
  // The lines that give the Mac its launch agent are only run when it sets the Mac up, which no test does. So they are read
  // here, not run. What --print shows and what the Mac is given come from the one writer.
  it("gives the Mac the very launch agent that --print shows, by the one writer, and has plutil check the file before it is loaded", () => {
    const print = text.slice(text.indexOf('if [[ "$print" == "yes" ]]; then', text.indexOf("\nbrew=")));
    const shown = print.slice(0, print.indexOf("\nfi\n"));
    const given = text.slice(text.lastIndexOf('\nagent "$node"'));
    assert.match(shown, /\n {2}agent "\$\{node:-\/opt\/homebrew\/bin\/node\}"\n/);
    assert.match(given, /^\nagent "\$node" > "\$AGENT_FILE"\nplutil -lint "\$AGENT_FILE" >\/dev\/null\nlaunchctl bootout "gui\/\$\(id -u\)\/\$LABEL" 2>\/dev\/null \|\| true\nlaunchctl bootstrap "gui\/\$\(id -u\)" "\$AGENT_FILE"\n/);
    // Nowhere else is a launch agent's file written or an agent loaded, and the writer is the one place the agent is made.
    const count = (what) => text.split(what).length - 1;
    assert.deepEqual([count('> "$AGENT_FILE"'), count('launchctl bootstrap "gui/$(id -u)" "$AGENT_FILE"'), count('\n  agent "'), count('\nagent "')], [1, 1, 1, 1]);
    // The one other agent is the one-shot check of Claude, loaded once and taken away (below).
    assert.equal(count("launchctl bootstrap"), 2);
    assert.match(text, /\nLABEL="com\.thebrimm\.unedited"\n/);
    assert.match(text, /\nAGENT_FILE="\$HOME\/Library\/LaunchAgents\/\$LABEL\.plist"\n/);
    assert.match(text, /\nLOG="\$HOME\/Library\/Logs\/brimm-video\.log"\n/);
  });
  // The check of Claude from the background job's own context is only made when the installer sets a Mac up, which no test
  // does. So its lines are read here, and its launch agent is written by its own writer and read by plutil.
  it("ends a Mac's setup with one real call to Claude from a launch agent's context, then takes that agent away", { skip: notAMac }, () => {
    const check = text.slice(text.indexOf("# The check of Claude"), text.indexOf("\nif [[ -n \"$machine\" ]]; then\n  say \"\"\n  say \"Done. Drop a video in:\""));
    // It is given the time, three minutes on, after which it asks Claude nothing: so one that a kill -9 or a power cut left
    // behind, which launchd runs at every login, asks nothing at the next.
    for (const step of ['check_agent "$node" "$(( $(date +%s) + 180 ))" > "$CHECK_FILE"', 'plutil -lint "$CHECK_FILE" >/dev/null', 'launchctl bootout "gui/$(id -u)/$CHECK_LABEL" 2>/dev/null || true', 'launchctl bootstrap "gui/$(id -u)" "$CHECK_FILE"', "\n  drop_check\n"])
      assert.ok(check.includes(step), `${step}\n---\n${check}`);
    // The agent is taken away (drop_check, below) after it is loaded.
    assert.ok(check.indexOf('launchctl bootstrap "gui/$(id -u)" "$CHECK_FILE"') < check.indexOf("\n  drop_check\n"));
    // With --rules-only, Claude is never asked, not even once here.
    assert.match(check, /\nif \[\[ -n "\$machine" && -z "\$rules_only" \]\] && claude="\$\(find_claude\)"; then\n/);
    // Its launch agent: unedited.js --check-claude, once, at load, with the main agent's PATH, writing into a log of its own.
    const writer = text.slice(text.indexOf("check_agent() {"), text.indexOf("\n}\n", text.indexOf("check_agent() {")) + 3);
    const xml = text.slice(text.indexOf("xml() {"), text.indexOf("\n", text.indexOf("xml() {")) + 1);
    const dir = mkdtempSync(join(tmpdir(), "brimm-check-agent-"));
    const file = join(dir, "check.plist");
    const r = spawnSync("/bin/zsh", ["-c", `${xml}${writer}\nLABEL=x; CHECK_LABEL=com.thebrimm.claude-check; HERE="/the tool"; AGENT_PATH=/opt/homebrew/bin:/usr/bin; CHECK_LOG="/home/Library/Logs/brimm-video-claude-check.log"\ncheck_agent /opt/homebrew/bin/node 1800000180 > "${file}"`], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(spawnSync("/usr/bin/plutil", ["-lint", file], { encoding: "utf8" }).status, 0);
    assert.deepEqual(JSON.parse(spawnSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" }).stdout), {
      Label: "com.thebrimm.claude-check",
      ProgramArguments: ["/opt/homebrew/bin/node", "/the tool/unedited.js", "--check-claude", "--until", "1800000180"],
      RunAtLoad: true,
      EnvironmentVariables: { PATH: "/opt/homebrew/bin:/usr/bin" },
      StandardOutPath: "/home/Library/Logs/brimm-video-claude-check.log",
      StandardErrorPath: "/home/Library/Logs/brimm-video-claude-check.log"
    });
    rmSync(dir, { recursive: true, force: true });
  });
  // The check's launch agent runs at load, so one left behind would ask Claude at every login. The check takes it away once
  // Claude has answered or 90 seconds have gone, and traps take it away however else the setup ends.
  it("takes the check agent away however the install ends, by one function, and stops the setup there on a Ctrl-C or a kill", () => {
    // The one function that takes it away: it stops the agent, if it is loaded, and deletes its file.
    assert.match(text, /\ndrop_check\(\) \{\n {2}launchctl bootout "gui\/\$\(id -u\)\/\$CHECK_LABEL" 2>\/dev\/null \|\| true\n {2}rm -f "\$CHECK_FILE"\n\}\n/);
    // The traps are set inside the check's block, before the agent's file is written: on EXIT, for a failure, and on INT and
    // TERM, which then end the setup with the codes a shell gives for them. Without that exit, zsh would go back to the wait.
    assert.match(text, /\n {2}trap drop_check EXIT\n {2}trap 'drop_check; exit 130' INT\n {2}trap 'drop_check; exit 143' TERM\n {2}check_agent "\$node"/);
    // Once the wait is over, the check takes the agent away itself, and only then lifts the traps.
    assert.match(text, /\n {2}done\n {2}drop_check\n {2}trap - EXIT INT TERM\n {2}say "From the background job: /);
  });
  /** Each of these, as install.sh has it: a line that gives a name its value, or a function, whole. */
  const valueOf = (name) => {
    const found = new RegExp(`\\n(${name}="[^"\\n]*")\\n`).exec(text);
    assert.ok(found, `${name}=, in install.sh`);
    return found[1];
  };
  const functionOf = (name) => {
    const at = text.indexOf(`\n${name}() {`);
    assert.ok(at >= 0, `${name}(), in install.sh`);
    const end = text.indexOf("\n", at + 1);
    return text.slice(at + 1, text.slice(at + 1, end).endsWith("}") ? end + 1 : text.indexOf("\n}\n", at) + 3);
  };
  /** A folder made for one test, with a stand-in for launchctl that only writes down how it was called. */
  const standIn = () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-launchctl-"));
    mkdirSync(join(dir, "bin"));
    writeFileSync(join(dir, "bin", "launchctl"), `#!/bin/sh\necho "launchctl $*" >> "${join(dir, "ran")}"\n`);
    chmodSync(join(dir, "bin", "launchctl"), 0o755);
    return {
      dir,
      /** Runs the script in zsh, with the stand-in first on the PATH and the folder as the home folder. */
      run: (script) => {
        // Every launchctl named is the stand-in, found on the PATH: none is named by its path.
        assert.doesNotMatch(script, /\/launchctl\b/);
        return spawnSync("/bin/zsh", ["-c", script], { encoding: "utf8", env: { HOME: join(dir, "home"), PATH: `${join(dir, "bin")}:/usr/bin:/bin` } });
      },
      calls: () => (existsSync(join(dir, "ran")) ? readFileSync(join(dir, "ran"), "utf8").trimEnd().split("\n") : []),
      done: () => rmSync(dir, { recursive: true, force: true })
    };
  };
  // The traps are run here, alone, in zsh, as the installer would run them, with the agent's file in a folder made for the test.
  it("stops there, with the check agent taken away, when the setup is stopped by Ctrl-C or a kill, or fails, during the check", { skip: noZsh }, () => {
    const traps = (/\n {2}(trap drop_check EXIT\n {2}trap [^\n]* INT\n {2}trap [^\n]* TERM)\n/.exec(text) || [])[1];
    assert.ok(traps, "the traps on EXIT, INT and TERM");
    for (const [how, end, code] of [["Ctrl-C", "kill -INT $$", 130], ["a kill", "kill -TERM $$", 143], ["a failure", "false", 1]]) {
      const s = standIn();
      try {
        const file = join(s.dir, "com.thebrimm.claude-check.plist");
        // The wait polls the log in a subshell, $(…), as here: that must not run the trap and take the agent away early.
        const poll = `answered="$(print -r -- polled)"\nprint -r -- "$answered, the file $([[ -e "$CHECK_FILE" ]] && print -r -- here || print -r -- gone)" >&2`;
        const r = s.run(`set -euo pipefail\nCHECK_LABEL="com.thebrimm.claude-check"\nCHECK_FILE="${file}"\n${functionOf("drop_check")}${traps}\nprint made > "$CHECK_FILE"\n${poll}\n${end}\nprint -r -- "went on"\n`);
        assert.equal(r.stderr, "polled, the file here\n", how);
        // It ends there, as a shell ends on that signal or that failure, and goes on to nothing more.
        assert.deepEqual([r.status, r.stdout], [code, ""], `${how}: ${r.stdout}${r.stderr}`);
        assert.equal(existsSync(file), false, how);
        const calls = s.calls();
        assert.ok(calls.length > 0 && calls.every((call) => call === `launchctl bootout gui/${process.getuid()}/com.thebrimm.claude-check`), `${how}: ${calls.join(" | ")}`);
      } finally {
        s.done();
      }
    }
  });
  it("says, before the wait, that it is asking Claude", () => {
    const line = 'say "Asking Claude once from the background job (up to 90 seconds)…"';
    assert.ok(text.includes(line));
    assert.ok(text.indexOf(line) < text.indexOf("for (( waited = 0; waited < 90; waited++ )); do"));
  });
  // A check agent an earlier setup left behind, by an installer from before the traps or by a kill -9, runs at every login.
  it("takes away, at the start of every setup that goes ahead, a check agent an earlier setup left behind, whether or not this one makes a check", () => {
    const ahead = text.indexOf('read -q "go?Go ahead? [y/N] "');
    const installing = text.indexOf('if [[ ${#need[@]} -gt 0 ]]; then "$brew" install "${need[@]}"; fi');
    // At the left edge, so inside no if: a setup with --rules-only, or with no Claude Code, runs it too.
    const dropped = text.indexOf("\ndrop_check\n");
    assert.ok(ahead > 0 && ahead < dropped && dropped < installing, `${ahead} < ${dropped} < ${installing}`);
  });
  it("--remove takes away the setup's check of Claude too, before it ends", () => {
    const stop = text.slice(text.indexOf('if [[ "$mode" == "remove" ]]'), text.indexOf("\nbrew="));
    assert.match(stop, /\n {4}exit 0\n {2}fi\n {2}launchctl bootout "gui\/\$\(id -u\)\/\$LABEL" 2>\/dev\/null \|\| true\n {2}rm -f "\$AGENT_FILE"\n(?: {2}#[^\n]*\n)* {2}drop_check\n {2}say "Stopped watching for unedited video\.[^"\n]*"\n {2}exit 0\nfi\n/);
  });
  // The lines --remove runs without --print are run here, alone: never the installer, which is only ever run with --print.
  it("--remove, its own lines run alone, stops both of its launch agents and deletes their files, and leaves the transcript tool's", { skip: noZsh }, () => {
    const s = standIn();
    try {
      const agents = join(s.dir, "home", "Library", "LaunchAgents");
      mkdirSync(agents, { recursive: true });
      for (const label of ["com.thebrimm.unedited", "com.thebrimm.claude-check", "com.thebrimm.transcribe"]) writeFileSync(join(agents, `${label}.plist`), "made for the test");
      const at = text.indexOf('\nif [[ "$mode" == "remove" ]]; then\n');
      assert.ok(at >= 0, "the remove mode, in install.sh");
      const block = text.slice(at + 1, text.indexOf("\nfi\n", at) + 4);
      const names = ["LABEL", "AGENT_FILE", "CHECK_LABEL", "CHECK_FILE"].map(valueOf).join("\n");
      const r = s.run(`set -euo pipefail\n${names}\n${functionOf("say")}${functionOf("drop_check")}mode="remove"\nprint="no"\n${block}print -r -- "went on"\n`);
      assert.deepEqual([r.status, r.stdout, r.stderr], [0, "Stopped watching for unedited video. The folders, the model, the programs and the transcript tool's own launch agent are still here.\n", ""]);
      assert.deepEqual(readdirSync(agents), ["com.thebrimm.transcribe.plist"]);
      assert.deepEqual(s.calls(), ["com.thebrimm.unedited", "com.thebrimm.claude-check"].map((label) => `launchctl bootout gui/${process.getuid()}/${label}`));
    } finally {
      s.done();
    }
  });
  // The lines it ends with are only said once it has set the Mac up, which no test does. So they are read here, not run.
  it("ends by saying what the folder for unedited video gives", () => {
    const closing = text.slice(text.lastIndexOf("launchctl bootstrap"));
    assert.match(closing, /\nsay "Done\. Put an unedited video in:"\n/);
    for (const named of ["<name>.cut-plan.txt", "<name>.rough-cut.mp4", "<name>.rough-cut.vertical.mp4", "<name>.fcpxml", "BRIMM Video Work", "<name>.edit-notes.txt", "<name>.reel-1.mp4"]) assert.ok(closing.includes(named), named);
    // The plan's first lines name every file that could not be made but a short clip. So it says where a clip is named.
    const told = closing.replace(/"\n +say "/g, " ");
    assert.ok(told.includes("A clip that could not be cut is named in the log and at the end of the notes, and not in <name>.cut-plan.txt."), told);
  });
  it("for one of the two Macs, makes Episodes, marks the drop folder and writes the settings through settings.js, and ends by saying where to drop a video", () => {
    const made = text.slice(text.indexOf('if [[ -n "$machine" ]]; then\n  mkdir -p'), text.indexOf("agent \"$node\" > \"$AGENT_FILE\""));
    assert.ok(made.includes('mkdir -p "$root/Episodes/.importing" "$WORK/From Final Cut"'), made);
    // A library's backups stay on Final Cut's default (B4, the lead's ruling), so no folder is made for them. The one line that names
    // them says what the open lock keeps from Claude, Final Cut's backups among it.
    const backups = text.split("\n").filter((line) => /backup/i.test(line));
    assert.equal(backups.length, 1, backups.join("\n"));
    assert.ok(backups[0].trim().startsWith('say "  Kept from Claude in her folder:  '), backups[0]);
    assert.ok(made.includes('"$node" "$HERE/settings.js" marker "$drop" "$machine"'), made);
    // It is told the settings of the switch that the installer was told (--drop, --import, --handoff, and --rules-only as readings
    // off), and checks the old drop folder again itself.
    assert.ok(made.includes('  if ! "$node" "$HERE/settings.js" write --machine "$machine" --root "$root" --checkout "$CHECKOUT" "${switch_args[@]}"; then\n'), made);
    assert.ok(made.includes('\n  fi\n  if [[ -z "$studio_why" ]]; then "$node" "$HERE/settings.js" studio --node "$node"; fi\n'), made);
    // Her folder for Claude is written only when Claude Code is new enough for its guard, and the install says so at the end
    // when it is not, and ends with 1.
    const end = text.slice(text.lastIndexOf('say "Done. Drop a video in:"'));
    assert.match(end, /\n {2}if \[\[ -n "\$studio_why" \]\]; then\n {4}say "Her folder for Claude was not written: \$studio_why\."\n {4}exit 1\n {2}fi\n {2}exit 0\n/);
    const closing = text.slice(text.lastIndexOf("launchctl bootstrap"));
    assert.match(closing, /\nif \[\[ -n "\$machine" \]\]; then\n {2}say ""\n {2}say "Done\. Drop a video in:"\n {2}say " {2}\$drop"\n/);
  });
  // The step that installs the pinned HyperFrames command line fetches from the network, so it is only run when a Mac is set up for
  // real, on Jason's yes, which no test does. Its lines are read here, not run. (What it looks at, whether the command line is here
  // already, is also what --print says, and is asked there, above.)
  it("installs the pinned HyperFrames command line only for a Mac set up with --machine, and only when it is not here already: after node is in place, before anything of the Mac is written, with none of its scripts run and telemetry off (its lines, read, not run)", () => {
    const install = 'install --prefix "$TOOLCHAIN" --ignore-scripts --no-fund --no-audit --save-exact "hyperframes@$HYPERFRAMES_VERSION"';
    // What the installer does, without the comments that say what it does not.
    const code = text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
    assert.equal(code.split(" install --prefix ").length - 1, 1, "npm is asked once");
    assert.equal(code.split("npx").length - 1, 0, "and never through npx, which runs whatever hyperframes it finds first");
    const guard = 'if [[ -n "$machine" ]] && ! toolchain_here "$TOOLCHAIN" "$node"; then\n';
    const start = text.indexOf(guard);
    assert.ok(start > 0, "the step runs for --machine, when the command line is not here already");
    const step = text.slice(start, text.indexOf("\nfi\n", start) + 4);
    const asked = step.split("\n").find((line) => line.includes(install));
    assert.ok(asked, `${install}\n---\n${step}`);
    // npm is told the folder, to run no script of the package's, to fetch exactly the pinned version; and the command line's
    // telemetry is off, and node's folder leads npm's PATH, so that the node it runs is the one that was checked.
    assert.match(asked, /^ {2}if ! env PATH="\$\{node:h\}:\$PATH" HYPERFRAMES_NO_TELEMETRY=1 "\$npm" install --prefix /, asked);
    // The folder is made first, and a failed install takes it away again and stops there.
    assert.ok(step.indexOf('mkdir -p "$TOOLCHAIN"') < step.indexOf(install), step);
    assert.ok(step.includes(`${asked}\n    drop_toolchain\n`), step);
    // What npm fetched is checked against the pin before anything else is done with it: the same look as the summary's, and a
    // mismatch takes the folder away and stops the setup, before the Mac's drop folder, settings and launch agent are touched.
    const checkAt = step.indexOf('  if ! toolchain_here "$TOOLCHAIN" "$node"; then\n');
    assert.ok(checkAt > step.indexOf(install), step);
    assert.match(step.slice(checkAt), /^ {2}if ! toolchain_here "\$TOOLCHAIN" "\$node"; then\n(?: {4}[^\n]*\n)* {4}drop_toolchain\n(?: {4}[^\n]*\n)* {4}exit 1\n {2}fi\n/);
    assert.equal(step.split("exit 1").length - 1, 3, "npm missing, npm failed, and the download not the pin's each stop the setup");
    // After node is in place, and before the second look at the settings, the folders, the marker and the settings.
    for (const later of ['if ! settings_plan "$node"; then', 'mkdir -p "${folders[@]}"', '"$node" "$HERE/settings.js" marker "$drop" "$machine"', '"$node" "$HERE/settings.js" write ']) {
      assert.ok(start > text.indexOf('if node_old "$node" say; then\n  exit 1\nfi') && start < text.indexOf(later), later);
    }
    // The check reads the version installed and the lock file's entry for the command line, with node, and gives back only what is
    // shaped as a version and an integrity string are: nothing else a lock file holds is ever repeated.
    const holds = functionOf("toolchain_holds");
    for (const read of ['"node_modules/hyperframes/package.json"', '"package-lock.json"', 'read("package-lock.json")?.packages?.["node_modules/hyperframes"]', "locked?.integrity", "/^sha512-[A-Za-z0-9+\\/]{86}==$/"]) assert.ok(holds.includes(read), `${read}\n---\n${holds}`);
    // The folder is taken away by one function, which removes the folder of the pinned version under .toolchain and nothing else.
    assert.equal(code.split("rm -rf").length - 1, 1, "rm -rf, once");
    assert.match(functionOf("drop_toolchain"), /^drop_toolchain\(\) \{\n(?: {2}#[^\n]*\n)* {2}\[\[ "\$TOOLCHAIN" == "\$WORK\/\.toolchain\/hyperframes-"\[0-9\]\* \]\] \|\| return 0\n {2}rm -rf "\$TOOLCHAIN"\n\}\n$/);
    // The pin is read from its two top-level lines alone: GSAP's, nested in the pin file, are indented further.
    assert.ok(text.includes(`HYPERFRAMES_VERSION="$(sed -n 's/^  "version": "\\([^"]*\\)",\\{0,1\\}$/\\1/p' "$HERE/hyperframes.pin.json" 2>/dev/null || true)"`), "the sed of the pin's version");
    assert.ok(text.includes(`HYPERFRAMES_INTEGRITY="$(sed -n 's/^  "integrity": "\\([^"]*\\)",\\{0,1\\}$/\\1/p' "$HERE/hyperframes.pin.json" 2>/dev/null || true)"`), "the sed of the pin's integrity string");
    assert.ok(text.includes('\nTOOLCHAIN="$WORK/.toolchain/hyperframes-$HYPERFRAMES_VERSION"\n'), "the folder is hyperframes.js's toolchainDir");
  });
  it("says in its help that --machine also installs the HyperFrames command line the pin names, with npm and none of its scripts, unless it is here already, and stops if the download is not the pin's", { skip: notAMac }, () => {
    const r = ask("--print", "--help");
    assert.equal(r.status, 0, r.err);
    const help = r.out.replace(/\s+/g, " ");
    for (const said of [
      "With --machine it also installs the HyperFrames command line that tool/hyperframes.pin.json pins, with npm and none of the package's own scripts, into ~/BRIMM Video Work/.toolchain/hyperframes-<version>, unless that folder holds it already",
      "It stops, and takes that folder away again, if the download's integrity string is not the pin's."
    ]) assert.ok(help.includes(said), `${said}\n---\n${r.out}`);
    assert.deepEqual([r.left, r.ran], [[], ""]);
  });
  it("says in its help that --machine then has the command line find or fetch the Chrome it renders with and run its doctor check, and that a Chrome that cannot be had stops the setup and the check never does", { skip: notAMac }, () => {
    const r = ask("--print", "--help");
    assert.equal(r.status, 0, r.err);
    const help = r.out.replace(/\s+/g, " ");
    for (const said of [
      "It then has that command line find or fetch the Chrome it renders with, with its own browser ensure, into ~/.cache/hyperframes/chrome, and stops, before the Mac's drop folder, its settings and its launch agent are touched, if it cannot be had.",
      "Last it runs the command line's own doctor, whose words are shown for Jason and which does not stop the setup."
    ]) assert.ok(help.includes(said), `${said}\n---\n${r.out}`);
    assert.deepEqual([r.left, r.ran], [[], ""]);
  });
  // The Chrome the command line renders with is found or fetched, and its doctor check run, on a real setup only (on Jason's yes), which no
  // test does. So the lines of that step are read here, not run.
  it("has the pinned command line find or fetch its Chrome and then run its doctor check only for a Mac set up with --machine, once the command line is in place and checked: a Chrome that cannot be had stops the setup before anything of the Mac is written, and the check never does (its lines, read, not run)", () => {
    // What the installer does, without the comments that say what it does not.
    const code = text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
    // The command line is run by one function, and asked for its Chrome and its check and nothing else: no other command is run through it.
    const runs = code.split("\n").filter((line) => /\brun_hyperframes\b/.test(line) && !line.startsWith("run_hyperframes() {"));
    assert.equal(runs.length, 2, runs.join("\n"));
    assert.ok(runs[0].includes("run_hyperframes browser ensure") && runs[1].includes("run_hyperframes doctor"), runs.join("\n"));
    // What each prints goes to the terminal as it comes: nothing is captured, piped or redirected, and none of doctor's words is read.
    for (const run of runs) assert.doesNotMatch(run.replaceAll("||", ""), /[|>]|\$\(/, run);
    // The step is the block that asks for the Chrome: it is for --machine alone.
    const asked = text.indexOf("\n  if ! run_hyperframes browser ensure; then\n");
    assert.ok(asked > 0, "the Chrome is asked for, and a refusal is looked at");
    const start = text.lastIndexOf('\nif [[ -n "$machine" ]]; then\n', asked) + 1;
    assert.ok(start > 0 && !text.slice(start, asked).includes("\nfi\n"), "the --machine guard is the step's own: no other block ends between it and the Chrome");
    const block = text.slice(start, text.indexOf("\nfi\n", asked) + 4);
    assert.ok(block.includes("run_hyperframes doctor"), "and the check is in the same block");
    // It comes once the command line is in place and checked, installed now or here already: after the step that installs it, and after
    // node is in place; and before anything of the Mac is written, or the model fetched.
    const toolchainStep = text.indexOf('if [[ -n "$machine" ]] && ! toolchain_here "$TOOLCHAIN" "$node"; then\n');
    assert.ok(toolchainStep > 0 && start > text.indexOf("\nfi\n", toolchainStep) + 4, "after the step that installs the command line");
    assert.ok(start > text.indexOf('if node_old "$node" say; then\n  exit 1\nfi'), "after node is in place");
    for (const later of ['if [[ ! -f "$MODEL" ]]; then', 'if ! settings_plan "$node"; then', 'mkdir -p "${folders[@]}"', '"$node" "$HERE/settings.js" marker "$drop" "$machine"', '"$node" "$HERE/settings.js" write ', 'agent "$node" > "$AGENT_FILE"']) {
      assert.ok(start < text.indexOf(later), later);
    }
    // The Chrome first, then the check, and the check is the step's last.
    assert.ok(block.indexOf("run_hyperframes browser ensure") < block.indexOf("run_hyperframes doctor"), block);
    // A Chrome that cannot be had stops the setup there, with the words that say what was kept and that nothing of the Mac was touched.
    const refused = block.slice(block.indexOf("  if ! run_hyperframes browser ensure; then\n"), block.indexOf("\n  fi\n", asked - start) + 6);
    assert.match(refused, /^ {2}if ! run_hyperframes browser ensure; then\n(?: {4}[^\n]*\n)* {4}exit 1\n {2}fi\n$/, refused);
    for (const said of [
      "could not find or fetch its Chrome (what it said is above).",
      "The command line $HYPERFRAMES_VERSION stays in $TOOLCHAIN: it is installed, and was checked against the pin.",
      "Stopped before this Mac's drop folder, its settings and its launch agent were touched: they are as they were. What this run installed first stays.",
      "then run this again"
    ]) assert.ok(refused.includes(said), `${said}\n---\n${refused}`);
    assert.equal(block.split("exit").length - 1, 1, "the Chrome stops the setup, and nothing else in the step does");
    // The check never stops it: its status is looked at, and said when it is not 0, and the setup goes on.
    const checked = block.slice(block.indexOf("  doctor_status=0\n"));
    assert.ok(checked.startsWith("  doctor_status=0\n  run_hyperframes doctor || doctor_status=$?\n"), checked);
    assert.ok(!checked.includes("exit"), checked);
    assert.ok(checked.includes('say "doctor ended with status $doctor_status (what it said is above). That does not stop the setup."'), checked);
  });
  it("runs the command line by node and the toolchain's program, each by its absolute path and never through npx, with the variables hyperframes.js gives it that never change (read from childEnv, so that the two cannot drift)", () => {
    const fn = functionOf("run_hyperframes");
    // The program is hyperframes.js's cliPath: in the toolchain, which is in the work folder under the home folder, so its path is
    // absolute. The installer's three lines, expanded, give the very path cliPath gives for a home folder named $HOME.
    const line = (name) => (new RegExp(`\\n${name}="([^"\\n]*)"\\n`).exec(text) || [])[1];
    assert.ok(line("HYPERFRAMES_PROGRAM") && line("TOOLCHAIN") && line("WORK"), "the program, the toolchain and the work folder, in install.sh");
    const expanded = line("HYPERFRAMES_PROGRAM").replace("$TOOLCHAIN", line("TOOLCHAIN")).replace("$WORK", line("WORK")).replace("$HYPERFRAMES_VERSION", PIN.version);
    assert.equal(expanded, cliPath("$HOME"));
    assert.ok(expanded.startsWith("$HOME/"), "under the home folder, so it is absolute");
    // The run: node, then the program, then the arguments as they were given, each quoted whole (the folder has a space in its name).
    assert.ok(fn.includes('"$node" "$HYPERFRAMES_PROGRAM" "$@"'), fn);
    assert.doesNotMatch(fn, /npx/, "never through npx, which would run whatever hyperframes it found first");
    // The variables childEnv gives the command line that are the same whoever the Mac and node are: told apart by asking it twice.
    const asked = (home, lang, node) => childEnv({ base: { HOME: home, LANG: lang }, node });
    const one = asked("/Users/one", "en_US.UTF-8", "/opt/homebrew/bin/node");
    const two = asked("/Users/two", "fr_FR.UTF-8", "/usr/local/bin/node");
    const fixed = Object.entries(one).filter(([name, value]) => two[name] === value);
    assert.ok(fixed.some(([name, value]) => name === "HYPERFRAMES_NO_TELEMETRY" && value === "1"), `telemetry off is among them: ${JSON.stringify(fixed)}`);
    // The command line's own update check, its background install of a newer version and its install of a missing optional package are
    // off too: nothing is installed on a Mac without Jason's yes, and the installer's own runs of the command line are no exception.
    for (const name of ["HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL"]) {
      assert.ok(fixed.some(([fixedName, value]) => fixedName === name && value === "1"), `${name} is among them: ${JSON.stringify(fixed)}`);
    }
    assert.ok(fixed.length >= 5, JSON.stringify(fixed));
    // Every one is given to the run, as the same value; and node's folder leads the PATH, as childEnv has it, so that it is the node checked.
    for (const [name, value] of fixed) assert.ok(fn.includes(` ${name}=${value} `), `${name}=${value}\n---\n${fn}`);
    assert.ok(fn.includes('env PATH="${node:h}:$PATH" '), fn);
    assert.deepEqual(one.PATH.split(":").slice(0, 1), ["/opt/homebrew/bin"], "childEnv has node's folder first too");
    // It is defined once, and the Chrome's run and the check's go through it alone (the test above).
    assert.equal(text.split("run_hyperframes() {").length - 1, 1, "defined once");
  });
  // The function alone, in zsh, with a stand-in for node that writes down how it was run: no test runs the step, and none runs the pinned
  // command line, whose program here is a path that holds nothing. What this sees is what a read of the text cannot: that a program in a
  // folder with a space in its name (BRIMM Video Work) reaches node whole, that the variables and the PATH arrive, and that node's exit
  // status is the function's, whichever it is.
  it("hands node the program by its whole path, with the variables that never change and node's folder first on the PATH, and gives back node's exit status (the function alone, with a stand-in for node)", { skip: noZsh }, () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-run-hyperframes-")));
    try {
      mkdirSync(join(dir, "bin"));
      mkdirSync(join(dir, "home"));
      const log = join(dir, "log");
      // It ends with 3 for doctor and 0 for anything else, and writes down its arguments one to a line and the few variables.
      writeFileSync(join(dir, "bin", "node"), `#!/bin/sh\n{\n  for a in "$@"; do printf 'arg:%s\\n' "$a"; done\n  printf 'telemetry:%s\\nskills:%s\\nupdates:%s\\nautoinstall:%s\\noptionalinstall:%s\\npath:%s\\nhome:%s\\n' "$HYPERFRAMES_NO_TELEMETRY" "$HYPERFRAMES_SKIP_SKILLS" "$HYPERFRAMES_NO_UPDATE_CHECK" "$HYPERFRAMES_NO_AUTO_INSTALL" "$HYPERFRAMES_NO_OPTIONAL_INSTALL" "$PATH" "$HOME"\n} >> "$STAND_IN_LOG"\ncase "$*" in *" doctor") exit 3 ;; esac\nexit 0\n`);
      chmodSync(join(dir, "bin", "node"), 0o755);
      const program = join(dir, "BRIMM Video Work", ".toolchain", `hyperframes-${PIN.version}`, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
      const script = `set -euo pipefail\nnode=${JSON.stringify(join(dir, "bin", "node"))}\nHYPERFRAMES_PROGRAM=${JSON.stringify(program)}\n${functionOf("run_hyperframes")}run_hyperframes browser ensure\nprint -r -- "ensure: $?"\nended=0\nrun_hyperframes doctor || ended=$?\nprint -r -- "doctor: $ended"\n`;
      // The PATH it is started with holds neither the stand-in's folder nor Homebrew's, so that the stand-in's folder on the PATH it sees
      // can only be the function's doing.
      const r = spawnSync("/bin/zsh", ["-c", script], { encoding: "utf8", env: { HOME: join(dir, "home"), PATH: "/usr/bin:/bin", STAND_IN_LOG: log } });
      assert.deepEqual([r.status, r.stdout, r.stderr], [0, "ensure: 0\ndoctor: 3\n", ""]);
      const said = readFileSync(log, "utf8").trimEnd().split("\n");
      const run = (command) => [`arg:${program}`, ...command.map((word) => `arg:${word}`), "telemetry:1", "skills:1", "updates:1", "autoinstall:1", "optionalinstall:1"];
      // Two runs, each handed the program whole and then the arguments, with all five variables (telemetry, the skills download, the
      // update check, the background install and the install of a missing optional package off), and node's folder first on the PATH.
      const paths = said.filter((line) => line.startsWith("path:"));
      assert.equal(paths.length, 2, said.join("\n"));
      for (const path of paths) assert.equal(path, `path:${join(dir, "bin")}:/usr/bin:/bin`);
      assert.deepEqual(said.filter((line) => !line.startsWith("path:")), [...run(["browser", "ensure"]), `home:${join(dir, "home")}`, ...run(["doctor"]), `home:${join(dir, "home")}`]);
      // The program is not run by the stand-in or by anything else, and nothing is made but the log.
      assert.deepEqual(readdirSync(dir).sort(), ["bin", "home", "log"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("names the lock-down check by a title that is a step of the setup guide it sends Jason to, and so does the README", () => {
    const TITLE = "Check that her Claude folder only runs BRIMM Video";
    const guide = readFileSync(new URL("../../docs/setup/sallies-laptop.md", import.meta.url), "utf8");
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    assert.ok(text.includes(`the setup guide's \\"${TITLE}\\", in the Code tab`), "install.sh");
    assert.ok(text.includes("the setup guide (docs/setup/sallies-laptop.md)"), "install.sh");
    assert.ok(readme.includes(`the setup guide's lock-down check, "${TITLE}"`), "README.md");
    // A step of the guide is a numbered line that opens with its title in bold, so a person sent there finds it by that name.
    const steps = [...guide.slice(guide.indexOf("\n## Steps\n")).matchAll(/^\d+\. \*\*([^*]+):\*\*/gm)].map((m) => m[1]);
    assert.ok(steps.includes(TITLE), `no step of docs/setup/sallies-laptop.md is titled "${TITLE}":\n${steps.join("\n")}`);
  });
  it("names the lock-down checks by titles that are steps of the setup guide, for both locks", () => {
    const guide = readFileSync(new URL("../../docs/setup/sallies-laptop.md", import.meta.url), "utf8");
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const STRICT = "Check that her Claude folder only runs BRIMM Video";
    const OPEN = "Check her Claude folder's open lock";
    // The steps: each a numbered line that opens with its title in bold, numbered 1, 2, 3 and on with no gap. Those whose title ends in a
    // colon are the ones the pattern above finds by their titles.
    const steps = guide.slice(guide.indexOf("\n## Steps\n"), guide.indexOf("\n## If something goes wrong\n"));
    const numbers = [...steps.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));
    assert.deepEqual(numbers, numbers.map((n, i) => i + 1), numbers.join(" "));
    const numberOf = Object.fromEntries([...steps.matchAll(/^(\d+)\. \*\*([^*]+):\*\*/gm)].map((m) => [m[2], Number(m[1])]));
    assert.deepEqual([numberOf[STRICT], numberOf[OPEN]], [9, 10], JSON.stringify(numberOf));
    for (const title of [STRICT, OPEN]) {
      assert.ok(text.includes(`the setup guide's \\"${title}\\", in the Code tab`), `install.sh: ${title}`);
      assert.ok(readme.includes(`"${title}"`), `README.md: ${title}`);
    }
    // The steps after the open-lock check moved on by one, and so did every reference to them.
    assert.equal(numberOf["The first real run"], 11, JSON.stringify(numberOf));
    assert.ok(guide.includes("step 11 is then the first check that 12.3 opens brimm-video's timelines"), "morning check 1");
    assert.ok(guide.includes("8. **A first run:** step 11, with your own test recordings, never her episodes."), "Switching her laptop, item 8");
    assert.doesNotMatch(guide, /\bstep 10 is then|\*\*A first run:\*\* step 10\b|ask it again after step 10\b/);
    // Each "step 9's check again" names the open lock's too.
    const again = [...guide.matchAll(/step 9's check again[^.;:]*/g)].map((m) => m[0]);
    assert.ok(again.length >= 4, again.join("\n"));
    for (const said of again) assert.ok(said.includes("or step 10's, on an open-lock laptop"), said);
  });
  it("has the setup guide's open-lock check name every refusal, every hidden name and every card-free step the design lists", () => {
    const guide = readFileSync(new URL("../../docs/setup/sallies-laptop.md", import.meta.url), "utf8");
    const step = guide.split("\n").find((l) => /^\d+\. \*\*Check her Claude folder's open lock:\*\*/.test(l));
    assert.ok(step, "no step is titled Check her Claude folder's open lock");
    for (const words of ["trust", "`behind`", "`cat`", "`node -e`", "`python3`", "/System/Volumes/Data", "letter case", "`grep -r`", "`rg`", "`find`", "`mdfind`", "`osascript", "`curl`", "`nice`", "`env -u SANDBOX_RUNTIME`", "http://127.0.0.1/", "`printenv`", "HTTP_PROXY", "memory", "side-session-notes", "teachings", "words file",
      "Episodes/0000 Lock check (test)/", "removed afterwards", "never her episodes", "the deploy key", "named owner's check", "no approval card", "every mode the menu offers"]) assert.ok(step.includes(words), words);
    // It opens nothing that the design keeps for later phases, and runs no git pull of its own.
    assert.doesNotMatch(step, /`picture |OpenRouter key|`[^`]*\bgit\b[^`]*\bpull`/);
  });
  it("has the setup guide give Jason the open lock's steps alone, and Sallie hers, and says what each new line of behind means", () => {
    const guide = readFileSync(new URL("../../docs/setup/sallies-laptop.md", import.meta.url), "utf8");
    const section = (heading) => {
      const at = guide.indexOf(`\n## ${heading}`);
      assert.ok(at >= 0, heading);
      const end = guide.indexOf("\n## ", at + 1);
      return guide.slice(at, end < 0 ? undefined : end);
    };
    const jason = section("The open lock (for Jason alone)");
    for (const words of ["Finder's and QuickTime's recent", "memory/", "skills and plugins", "frontend-design", "node tool/settings.js studio --node <node> --zoom", "--lock open", "--web open", "OPEN_LOCK_CLAUDE", 'pull as under "Jason has a newer brimm-video", above', "--user-deny"]) assert.ok(jason.includes(words), words);
    const sallie = section("The open lock (for Sallie)");
    for (const words of ["Zoom recording into her drop folder rather than copy it", "delete Zoom's original", "add this folder", "No sandbox", "`/sandbox`", "`/memory`"]) assert.ok(sallie.includes(words), words);
    const wrong = section("If something goes wrong");
    for (const words of ["sandbox", "Edit(", "additionalDirectories", "--add-dir", "flag", "SessionStart", "plugin", "hooks:", "the workshop holds", "No sandbox", "memory", "looks like a secret", "proxy port", "Claude Code has not trusted this folder yet", "Read deny rule", "This chat holds a session's words", "brimm-video was run inside Claude Code's sandbox", "`/sandbox exclude`", 'choose the one-time "Yes" only']) assert.ok(wrong.includes(words), words);
  });
  // A check agent a setup cut short left behind asks Claude at every login, and nothing on screen says so. So after a real
  // setup, the guide (for her laptop) and the README (for either Mac) have its file looked for, by install.sh's own name for
  // it, and say how to take that one agent away alone: --remove would stop the import's own agent too.
  it("has the setup guide and the README look for a check agent left behind after a real setup, and take that one alone away", () => {
    const guide = readFileSync(new URL("../../docs/setup/sallies-laptop.md", import.meta.url), "utf8");
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const label = (/\nCHECK_LABEL="([^"\n]+)"\n/.exec(text) || [])[1];
    assert.equal(label, "com.thebrimm.claude-check");
    assert.match(text, /\nCHECK_FILE="\$HOME\/Library\/LaunchAgents\/\$CHECK_LABEL\.plist"\n/);
    const file = `~/Library/LaunchAgents/${label}.plist`;
    const look = `\`ls ${file}\``;
    const alone = `\`launchctl bootout gui/$(id -u)/${label}; rm ${file}\``;
    // The guide's step that runs the installer for real: it checks the line the check ends with, then looks for the file.
    const step = guide.split("\n").find((line) => /^\d+\. \*\*/.test(line) && line.includes(`./install.sh --print --machine "Sallie's laptop"`));
    assert.ok(step, "the guide's step that runs the installer");
    assert.ok(text.includes('say "From the background job: '), "install.sh");
    for (const said of ['"From the background job:"', look, "No such file or directory", alone, "not `./install.sh --remove`"])
      assert.ok(step.includes(said), `${said}\n---\n${step}`);
    assert.ok(step.indexOf("without `--print`") < step.indexOf(look), step);
    const setting = readme.split("\n").find((line) => line.startsWith("**Setting a Mac up.**"));
    assert.ok(setting, "README's Setting a Mac up");
    for (const said of [look, alone, "not `--remove`"]) assert.ok(setting.includes(said), `${said}\n---\n${setting}`);
  });
  // A Mac set up with an installer from before the traps can have a check agent that a Ctrl-C left, with no time to stop
  // at, so it asks Claude at every login. A newer brimm-video reaches a Mac by a git pull, which runs no setup and so takes
  // no such agent away. So every git pull in the setup guide, and the README, look for its file after the pull too, and say
  // how to take that one agent away alone.
  it("has every git pull of a newer brimm-video in the setup guide, and the README, look for a check agent left behind, and take that one alone away", () => {
    const guide = readFileSync(new URL("../../docs/setup/sallies-laptop.md", import.meta.url), "utf8");
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const label = "com.thebrimm.claude-check";
    const file = `~/Library/LaunchAgents/${label}.plist`;
    const look = `\`ls ${file}\``;
    const alone = `\`launchctl bootout gui/$(id -u)/${label}; rm ${file}\``;
    // A line pulls when a command in it, between backticks, is a git pull: the Mac Studio's step and the update below.
    const pulls = guide.split("\n").filter((line) => /`[^`]*\bgit\b[^`]*\bpull`/.test(line));
    assert.ok(pulls.length >= 2, pulls.join("\n"));
    assert.ok(pulls.some((line) => line.startsWith('- "Jason has a newer brimm-video"')), pulls.join("\n"));
    for (const line of pulls) {
      for (const said of [look, "No such file or directory", alone, "not `./install.sh --remove`"])
        assert.ok(line.includes(said), `${said}\n---\n${line}`);
      assert.ok(line.indexOf("pull`") < line.indexOf(look), line);
    }
    const setting = readme.split("\n").find((line) => line.startsWith("**Setting a Mac up.**"));
    assert.ok(setting.includes("after a `git pull` of a newer brimm-video"), setting);
    assert.ok(setting.indexOf("after a `git pull` of a newer brimm-video") < setting.indexOf(look), setting);
  });
  it("gives the launch agent the one PATH, and looks for Claude Code along that same PATH", () => {
    // It is this PATH unless another is named in BRIMM_AGENT_PATH, as a test names one.
    assert.match(text, /\nAGENT_PATH="\$\{BRIMM_AGENT_PATH:-\/opt\/homebrew\/bin:\/usr\/local\/bin:\/usr\/bin:\/bin\}"\n/);
    assert.ok(text.includes('<dict><key>PATH</key><string>$AGENT_PATH</string></dict>'));
    assert.match(text, /\n {2}for dir in \$\{\(s\.:\.\)AGENT_PATH\} "\$HOME\/\.local\/bin"; do\n/);
  });
  it("stops its own launch agents when it is asked to stop the watching, and never writes, loads or stops the transcript tool's", () => {
    const stop = text.slice(text.indexOf('if [[ "$mode" == "remove" ]]'), text.indexOf("\nbrew="));
    assert.match(stop, /\n {2}launchctl bootout "gui\/\$\(id -u\)\/\$LABEL" 2>\/dev\/null \|\| true\n {2}rm -f "\$AGENT_FILE"\n/);
    // The transcript tool's agent is named once, and its file is only read, by plutil.
    assert.match(text, /\nTRANSCRIBE_LABEL="com\.thebrimm\.transcribe"\n/);
    const naming = text.split("\n").filter((line) => /TRANSCRIBE_LABEL|com\.thebrimm\.transcribe/.test(line) && !line.startsWith("#"));
    assert.ok(naming.length >= 2, naming.join("\n"));
    for (const line of naming) assert.doesNotMatch(line, /launchctl|rm |> ?"/, line);
    // plutil reads a launch agent's file in two places, both in watched(); its other reads are of Final Cut Pro's own
    // Info.plist and of what Claude Code says of its sign-in. None reads what settings.js says: that is read as lines.
    const reads = text.split("\n").filter((line) => line.includes("plutil -extract"));
    assert.deepEqual(reads.map((line) => (line.includes('"$file"') ? "agent" : line.includes('"$FINAL_CUT/Contents/Info.plist"') ? "Final Cut" : / -o - - /.test(line) ? "Claude" : line)), ["agent", "agent", "Final Cut", "Claude", "Claude"]);
  });
});

describe("the installer for one of the two Macs (--machine), asked what it would do", { skip: notAMac }, () => {
  /** A folder made for one test that stands for The BRIMM DB in Dropbox, with BRIMM Video in it, and what it holds. */
  function dropbox() {
    // The folder by its real path, as the installer reads it: on a Mac the temp folder is a link into /private.
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-db-")));
    const root = join(dir, "The BRIMM DB", "BRIMM Video");
    mkdirSync(root, { recursive: true });
    return { dir, root, held: () => readdirSync(dir, { recursive: true }).sort(), done: () => rmSync(dir, { recursive: true, force: true }) };
  }
  it("shows what it would make for this Mac, in Dropbox and on its own disk, and changes nothing", () => {
    const d = dropbox();
    const before = d.held();
    const r = ask("--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    const out = said(r);
    for (const line of [
      "  This Mac:  Mac Studio",
      `  BRIMM Video:  ${d.root}`,
      `  Its drop folder, to make in Dropbox and watch:  ${d.root}/Unedited Video/Mac Studio`,
      `  Its marker there, ${d.root}/Unedited Video/Mac Studio/.brimm-watched-by, saying:  Mac Studio`,
      `  Episodes, to make in Dropbox:  ${d.root}/Episodes`,
      `  The import status files, to make in Dropbox:  ${d.root}/Episodes/.importing`,
      "  On this Mac:  <home>/BRIMM Video Work/From Final Cut"
    ]) assert.ok(out.includes(`\n${line}\n`), `${line}\n---\n${out}`);
    assert.ok(out.includes(`  This Mac's settings, in <home>/Library/Application Support/BRIMM Video/settings.json:\n{\n  "version": 1,\n  "machine": "Mac Studio",\n  "root": "${d.root}",\n  "checkout": "${dirname(HERE)}"\n}\n`), out);
    changedNothing(r);
    assert.deepEqual(d.held(), before);
    d.done();
  });
  it("has the launch agent watch this Mac's drop folder alone", () => {
    const d = dropbox();
    const r = ask("--print", "--machine", "Sallie's laptop", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    assert.deepEqual(r.agents.map(held), [agent(r, [`${d.root}/Unedited Video/Sallie's laptop`])]);
    d.done();
  });
  it("tells, for her laptop, the tools it finds and the steps by hand, and never prints her email", () => {
    const d = dropbox();
    const r = askWith({ onPath: { "xcode-select": XCODE_HERE, sw_vers: MACOS("27.0.1") }, finalCut: "12.4" }, "--print", "--machine", "Sallie's laptop", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    const out = said(r);
    for (const line of [
      "  Xcode's command line tools (git, swift):  here already",
      "  Homebrew:  here already",
      "  macOS:  27.0.1",
      `${FINAL_CUT}  12.4, here`,
      "  Claude Code, signed in:  yes (max)",
      "  Claude Code's version:  2.1.296 (her folder's guard needs 2.1.295 or later)",
      "  Sallie's folder for Claude:  ~/BRIMM Video Studio (its CLAUDE.md, its settings that allow only edit.js, its skill, and Pictures/)",
      "  The Claude app's Code tab:  runs its own copy of Claude Code, updated with the app, so the setup guide's \"Check that her Claude folder only runs BRIMM Video\", in the Code tab, is what proves her folder is locked down there",
      "  At the end:  one real call to Claude from the background job (a launch agent of its own, com.thebrimm.claude-check, taken away when it answers or after 90 seconds), to prove its sign-in is seen there",
      "  By hand afterwards:  the setup guide (docs/setup/sallies-laptop.md)"
    ]) assert.ok(out.includes(`\n${line}\n`), `${line}\n---\n${out}`);
    // The checks come after the line about swift, in this order: Final Cut Pro, then the HyperFrames command line, its download's check,
    // its Chrome and its doctor check.
    const at = (line) => out.indexOf(`\n  ${line}`);
    const order = ["Swift", "Xcode's", "Homebrew:", "macOS:", "Final Cut Pro, optional now", "HyperFrames toolchain:", "Its download is checked:", "Its Chrome:", "Its doctor check:", "Claude Code, signed in:", "Claude Code's version:", "Sallie's folder", "The Claude app's Code tab:", "At the end:", "By hand afterwards:"].map(at);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), out);
    assert.ok(!order.includes(-1), out);
    assert.doesNotMatch(r.out, /sallie@example\.com|The BRIMM"|orgName/);
    // The lock-down check is named by its title, which stays when the guide's steps are numbered again.
    assert.doesNotMatch(readFileSync(INSTALL, "utf8"), /\bstep \d/i);
    changedNothing(r);
    d.done();
  });
  /** What a listing of a home folder that holds only these files says: each file and every folder above it. */
  const listing = (files) => [...new Set(files.flatMap(([path]) => path.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"))))].sort();
  /** The files of a folder that holds the command line, as npm leaves them, but for what the options change or take away. */
  const holding = ({ version = PIN.version, integrity = PIN.integrity, lock = true, program = true } = {}) => [
    [`${toolchainDir("")}/node_modules/hyperframes/package.json`, JSON.stringify({ name: "hyperframes", version })],
    ...(program ? [[`${toolchainDir("")}/node_modules/hyperframes/bin/hyperframes.mjs`, "// made for the test\n"]] : []),
    ...(lock ? [[`${toolchainDir("")}/package-lock.json`, JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/hyperframes": { version, integrity } } })]] : [])
  ];
  // Final Cut Pro is optional now: HyperFrames is where she edits. Its command line, the version tool/hyperframes.pin.json pins, is
  // kept in a folder of its own for that version (hyperframes.js, toolchainDir). The installer says what it would put there and how
  // the download is checked, and installs nothing: the step itself runs only on Jason's yes, and no test runs it.
  it("names the step that installs the pinned HyperFrames command line, with its version and its folder, and says its download is checked against the pin's integrity string. It changes nothing", () => {
    const d = dropbox();
    const r = ask("--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    // Where hyperframes.js keeps it: in the work folder, on the Mac's own disk, in a folder named for the version.
    const folder = toolchainDir(r.home);
    assert.equal(folder, `${r.home}/BRIMM Video Work/.toolchain/hyperframes-${PIN.version}`);
    for (const line of [
      `  HyperFrames toolchain:  version ${PIN.version} of its command line (not the app), to install in ${folder} with npm, none of the package's own scripts run`,
      `  Its download is checked:  against the pin's integrity string, ${PIN.integrity}, in tool/hyperframes.pin.json. If they differ, the install stops, says so, and takes that folder away again`
    ]) assert.ok(r.out.includes(`\n${line}\n`), `${line}\n---\n${r.out}`);
    // They are the pin's own version and string, and not GSAP's, which are nested in the pin file.
    assert.ok(!r.out.includes(PIN.gsap.version) && !r.out.includes(PIN.gsap.integrity), r.out);
    // Final Cut Pro is said to be optional, whether it is here or not.
    assert.ok(r.out.includes(`\n${FINAL_CUT}  `), r.out);
    changedNothing(r);
    // A folder watched on its own, without --machine, is not given the command line, and says nothing of it.
    const plain = ask("--print", "/Volumes/Work/Unedited video");
    assert.equal(plain.status, 0, plain.err);
    assert.doesNotMatch(plain.out, /HyperFrames|toolchain/);
    changedNothing(plain);
    d.done();
  });
  // The command line renders with a Chrome of its own. Its `browser ensure` finds the pinned one in the cache folder the command line keeps
  // it in, or fetches it there once; its `doctor` is its check of the Mac. The installer says both, with where the Chrome is kept, once
  // the command line is in place, and runs neither: the steps themselves run only on Jason's yes, and no test runs them.
  it("names the step that has the command line find or fetch its Chrome, and where it keeps it, and its doctor check that follows, right after the lines about the command line. It changes nothing", () => {
    const d = dropbox();
    const r = ask("--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    // Where the command line keeps it: in the home folder's cache, on the Mac's own disk, and never in Dropbox or in BRIMM Video Work.
    const kept = `${r.home}/.cache/hyperframes/chrome`;
    for (const line of [CHROME(kept), DOCTOR]) assert.ok(r.out.includes(`\n${line}\n`), `${line}\n---\n${r.out}`);
    // They come after the lines about the command line itself and before the ones about Claude Code.
    const at = (label) => r.out.indexOf(`\n  ${label}`);
    const order = ["HyperFrames toolchain:", "Its download is checked:", "Its Chrome:", "Its doctor check:", "Claude Code, signed in:"].map(at);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), r.out);
    assert.ok(!order.includes(-1), r.out);
    // Only said: the Chrome is not asked for and doctor is not run, so nothing is made, in the home folder or anywhere else.
    changedNothing(r);
    // A folder watched on its own, without --machine, is given neither, and says nothing of them.
    const plain = ask("--print", "/Volumes/Work/Unedited video");
    assert.equal(plain.status, 0, plain.err);
    assert.doesNotMatch(plain.out, /Chrome|doctor/);
    changedNothing(plain);
    d.done();
  });
  it("says the same of the Chrome and the check when the command line is here already, and when this Mac has no node to read it with, and runs nothing of it", () => {
    const d = dropbox();
    // A program that would leave a file in the home folder if node ran it: a print that ran the command line would show in what is left.
    const files = holding().map(([path, body]) => (path.endsWith("/bin/hyperframes.mjs") ? [path, 'import { writeFileSync } from "node:fs";\nwriteFileSync(`${process.env.HOME}/ran-by-the-command-line`, "ran");\n'] : [path, body]));
    for (const [what, options] of [["here already", { files }], ["here already, and no node", { files, bare: true }]]) {
      const r = askWith(options, "--print", "--machine", "Mac Studio", d.root);
      assert.equal(r.status, 0, `${what}: ${r.err}${r.out}`);
      // With node the lock file is read, and the command line is here already; without it nothing can be read, so it is to install.
      assert.match(r.out, options.bare ? /\n {2}HyperFrames toolchain: {2}[^\n]*to install in / : /\n {2}HyperFrames toolchain: {2}[^\n]*here already in /, what);
      for (const line of [CHROME(`${r.home}/.cache/hyperframes/chrome`), DOCTOR]) assert.ok(r.out.includes(`\n${line}\n`), `${what}\n${line}\n---\n${r.out}`);
      assert.deepEqual([r.left, r.ran], [listing(files), ""], what);
    }
    d.done();
  });
  it("says the HyperFrames command line is here already, and leaves it, only when its folder holds the pinned version and npm's lock file holds the pin's integrity string: anything less is to install", () => {
    const d = dropbox();
    const dir = toolchainDir("");
    const line = (how) => `  HyperFrames toolchain:  version ${PIN.version} of its command line (not the app), ${how}`;
    const ALREADY = (folder) => line(`here already in ${folder}, and npm's lock file there holds the pin's integrity string, so it is left as it is`);
    const TO_INSTALL = (folder) => line(`to install in ${folder} with npm, none of the package's own scripts run`);
    const checked = "\n  Its download is checked:  against the pin's integrity string, ";
    const right = holding();
    const r = askWith({ files: right }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    assert.ok(r.out.includes(`\n${ALREADY(toolchainDir(r.home))}\n`), r.out);
    // It has nothing to download, so it checks nothing and installs nothing, and leaves the folder as it was.
    assert.doesNotMatch(r.out, /to install in|Its download is checked/);
    assert.deepEqual([r.left, r.ran], [listing(right), ""]);
    const WRONG = `sha512-${"A".repeat(86)}==`;
    for (const [what, files] of [
      ["another integrity string in the lock file", holding({ integrity: WRONG })],
      ["none in the lock file", holding({ integrity: null })],
      ["none in the lock file's entry for it", [...holding({ lock: false }), [`${dir}/package-lock.json`, JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/hyperframes": { version: PIN.version } } })]]],
      ["a string that holds an escape, which is never repeated", holding({ integrity: `\u001b[31m${PIN.integrity}` })],
      ["another version installed", holding({ version: "0.8.207" })],
      ["no lock file", holding({ lock: false })],
      ["no program", holding({ program: false })],
      ["a lock file that is not JSON", [...holding({ lock: false }), [`${dir}/package-lock.json`, "not JSON"]]]
    ]) {
      const s = askWith({ files }, "--print", "--machine", "Mac Studio", d.root);
      assert.equal(s.status, 0, `${what}: ${s.err}${s.out}`);
      const folder = toolchainDir(s.home);
      assert.ok(s.out.includes(`\n${TO_INSTALL(folder)}${checked}${PIN.integrity}, in tool/hyperframes.pin.json.`), `${what}\n---\n${s.out}`);
      assert.doesNotMatch(s.out, /here already in|\u001b/, what);
      // Only said: what is there is read, and none of it is changed.
      assert.deepEqual([s.left, s.ran], [listing(files), ""], what);
    }
    // A Mac with no node cannot read the lock file, so it says the command line is to install there, whatever the folder holds.
    const bare = askWith({ bare: true, files: right }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(bare.status, 0, bare.err + bare.out);
    assert.ok(bare.out.includes(`\n${TO_INSTALL(toolchainDir(bare.home))}\n`), bare.out);
    d.done();
  });
  // The pin is read from tool/hyperframes.pin.json by sed, as the Claude Code version the open lock was checked on is read from
  // studio.js, so that a Mac with no node yet can say what it would install. A pin read as nothing would name no folder and no version,
  // and npm would be asked for hyperframes@, which is whichever is newest: so the installer refuses first, as it does for settings.
  it("refuses, before it changes anything, a pin it cannot read a version and the registry's integrity string from, rather than ask npm for whichever version is newest", () => {
    const d = dropbox();
    const copy = realpathSync(mkdtempSync(join(tmpdir(), "brimm-checkout-")));
    const tool = join(copy, "BRIMM video", "tool");
    cpSync(HERE, tool, { recursive: true, filter: (src) => src !== join(HERE, "tests") });
    const pin = join(tool, "hyperframes.pin.json");
    const WHY = "The pin of the HyperFrames command line, tool/hyperframes.pin.json, does not hold a version like 0.8.208 and the registry's integrity string for it, so the installer changed nothing.\n\nNothing was changed.\n";
    const pinned = (more) => JSON.stringify({ version: PIN.version, integrity: PIN.integrity, ...more }, null, 2);
    try {
      for (const [what, text] of [
        ["no pin file", null],
        ["an empty one", ""],
        ["one that is not JSON", "version 0.8.208"],
        ["only GSAP's version and string, nested in it", JSON.stringify({ gsap: PIN.gsap }, null, 2)],
        ["a version that is a name", pinned({ version: "latest" })],
        ["a version with a range in it", pinned({ version: "^0.8.208" })],
        ["a string cut short", pinned({ integrity: PIN.integrity.slice(0, 40) })],
        ["a string that is not sha512's", pinned({ integrity: PIN.integrity.replace("sha512-", "sha1-") })]
      ]) {
        if (text === null) rmSync(pin, { force: true });
        else writeFileSync(pin, text);
        const r = askWith({ install: join(tool, "install.sh") }, "--print", "--machine", "Mac Studio", d.root);
        assert.deepEqual([r.status, r.out], [2, WHY], what);
        assert.deepEqual([r.left, r.ran], [[], ""], what);
      }
      // The pin put back as it is, the same copy of the installer goes ahead.
      writeFileSync(pin, readFileSync(join(HERE, "hyperframes.pin.json")));
      const fine = askWith({ install: join(tool, "install.sh") }, "--print", "--machine", "Mac Studio", d.root);
      assert.equal(fine.status, 0, fine.err + fine.out);
      assert.ok(fine.out.includes(`version ${PIN.version} of its command line`), fine.out);
    } finally {
      rmSync(copy, { recursive: true, force: true });
      d.done();
    }
  });
  // The Code tab runs the Claude app's own copy of Claude Code, not the Terminal's, and the app keeps each copy in a folder named
  // for its version, running the newest (2026-10-25, on the Mac Studio). The installer says which that is, and whether her folder's
  // guard can rest on it; only the Terminal's decides whether her folder is written, and /status in the Code tab proves it.
  it("says the newest copy of Claude Code the Claude app keeps, which its Code tab runs, and whether her folder's guard can rest on it", () => {
    const copy = (v) => `Library/Application Support/Claude/claude-code/${v}/a93ded4b1b47/claude.app/Contents/MacOS/claude`;
    const line = (rest) => `  The Claude app's own Claude Code:  ${rest}`;
    const cases = [
      [[], line("no copy found here (in ~/Library/Application Support/Claude/claude-code), so only /status in the Code tab can say its version")],
      [["2.1.304", "2.1.308", "2.1.40"], line("2.1.308, the newest copy the app keeps here (her folder's guard needs 2.1.295 or later; /status in the Code tab says which copy runs)")],
      [["2.1.200", "notes"], line("2.1.200, the newest copy the app keeps here, older than the 2.1.295 her folder's guard needs: on it the guard could let a call through. In the app, choose Claude > Check for Updates, then check /status in the Code tab")]
    ];
    for (const [versions, expected] of cases) {
      const d = dropbox();
      const r = askWith({ files: versions.map(copy), onPath: { "xcode-select": XCODE_HERE, sw_vers: MACOS("27.0.1") }, finalCut: "12.4" }, "--print", "--machine", "Sallie's laptop", d.root);
      assert.equal(r.status, 0, r.err + r.out);
      const out = said(r);
      assert.ok(out.includes(`\n${expected}\n`), `${expected}\n---\n${out}`);
      assert.ok(out.indexOf("\n  The Claude app's Code tab:") < out.indexOf("\n  The Claude app's own Claude Code:"), out);
      // Her folder is written, or not, by the Terminal's version alone, as before: this line only says.
      assert.ok(out.includes("\n  Claude Code's version:  2.1.296 (her folder's guard needs 2.1.295 or later)\n"), out);
      assert.match(r.out, /\nNothing was changed\.\n$/);
      d.done();
    }
  });
  it("with --rules-only, asks Claude nothing at the end of the setup either, so nothing leaves this Mac", () => {
    const d = dropbox();
    const r = askWith({ onPath: { "xcode-select": XCODE_HERE, sw_vers: MACOS("27.0.1") }, finalCut: "12.4" }, "--print", "--machine", "Sallie's laptop", "--rules-only", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    assert.doesNotMatch(r.out, /\n {2}At the end:/);
    assert.ok(r.out.includes("\n  Claude, to read each cut plan:  not asked (--rules-only), so each cut plan is the rules' alone and nothing leaves this Mac\n"), r.out);
    // Her folder for Claude is still written, so Claude Code's sign-in and version are still told.
    assert.ok(r.out.includes("\n  Claude Code's version:  2.1.296 (her folder's guard needs 2.1.295 or later)\n"), r.out);
    changedNothing(r);
    d.done();
  });
  it("names a check agent an earlier setup left behind, which it takes away first, with --rules-only and with no Claude Code too, and changes nothing", () => {
    const d = dropbox();
    const installed = { "com.thebrimm.claude-check": "made by an earlier setup" };
    const LEFT_LINE = (r) => `\n  Left behind by an earlier setup:  its check of Claude, com.thebrimm.claude-check, at ${r.home}/Library/LaunchAgents/com.thebrimm.claude-check.plist. launchd runs it at every login, so this setup takes it away first\n`;
    for (const [how, given, more] of [["a setup that makes the check", {}, []], ["--rules-only", {}, ["--rules-only"]], ["no Claude Code", { claude: null, agentPath: NOWHERE_ELSE }, []]]) {
      const r = askWith({ installed, ...given }, "--print", "--machine", "Sallie's laptop", ...more, d.root);
      assert.equal(r.status, 0, `${how}: ${r.err}${r.out}`);
      assert.ok(r.out.includes(LEFT_LINE(r)), `${how}\n---\n${r.out}`);
      assert.deepEqual([r.kept, r.ran], [installed, ""], how);
      // And when there is none, it says nothing of one.
      const none = askWith(given, "--print", "--machine", "Sallie's laptop", ...more, d.root);
      assert.doesNotMatch(none.out, /Left behind/, how);
    }
    d.done();
  });
  it("says how to get Homebrew, Xcode's tools, Final Cut and Claude's sign-in when they are missing, and the macOS that Final Cut 12.4 needs", () => {
    const d = dropbox();
    const r = askWith({ bare: true, claude: '{"loggedIn":false}', onPath: { "xcode-select": XCODE_MISSING, sw_vers: MACOS("26.5") }, finalCut: null }, "--print", "--machine", "Sallie's laptop", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    for (const line of [
      "  Xcode's command line tools (git, swift):  not here. Jason runs: xcode-select --install",
      '  Homebrew:  not here. In Terminal, Sallie runs this (it asks for her password, which she types herself): /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      "  macOS:  26.5; Final Cut Pro 12.4 needs macOS 26.6 or later (System Settings > General > Software Update)",
      `${FINAL_CUT}  not here. To have it, install it from the App Store (on her Apple ID, or shared by Family Sharing) before the first push.`,
      "  Claude Code, signed in:  no. In Terminal, run: claude auth login (Sallie signs in to her own Claude account in the browser; signing in to the Claude app does not sign in this command), then run this again.",
      "  Programs to install with Homebrew:  ffmpeg whisper-cpp node"
    ]) assert.ok(r.out.includes(`\n${line}\n`), `${line}\n---\n${r.out}`);
    changedNothing(r);
    d.done();
  });
  it("says that a Final Cut Pro older than 12.4 was not what phase 0 checked, and how to update it, on the macOS 12.4 needs or not, as on her laptop", () => {
    const d = dropbox();
    for (const [macos, macosLine, after] of [
      ["26.5", "26.5; Final Cut Pro 12.4 needs macOS 26.6 or later (System Settings > General > Software Update)", "update macOS first, then App Store > Updates"],
      ["26.6", "26.6", "update it in App Store > Updates"],
      ["27.0.1", "27.0.1", "update it in App Store > Updates"]
    ]) {
      const r = askWith({ onPath: { "xcode-select": XCODE_HERE, sw_vers: MACOS(macos) }, finalCut: "12.3" }, "--print", "--machine", "Sallie's laptop", d.root);
      assert.ok(r.out.includes(`\n  macOS:  ${macosLine}\n${FINAL_CUT}  12.3, here; phase 0 was checked with 12.4: ${after}\n`), r.out);
    }
    const newer = askWith({ onPath: { sw_vers: MACOS("27.0.1") }, finalCut: "12.4.1" }, "--print", "--machine", "Sallie's laptop", d.root);
    assert.ok(newer.out.includes(`\n${FINAL_CUT}  12.4.1, here\n`), newer.out);
    d.done();
  });
  it("says when Claude Code is older than her folder's guard needs, or its version cannot be read, or it is not here: the install then does not write her folder", () => {
    const d = dropbox();
    for (const [given, line] of [
      [{ claudeVersion: "2.1.290 (Claude Code)" }, "  Claude Code's version:  2.1.290, older than the 2.1.295 her folder's guard needs: on it the guard could let a call through. In Terminal: claude update, then run this again. Until then the install does not write her folder for Claude."],
      [{ claudeVersion: "2.0.9" }, "  Claude Code's version:  2.0.9, older than the 2.1.295 her folder's guard needs: on it the guard could let a call through. In Terminal: claude update, then run this again. Until then the install does not write her folder for Claude."],
      [{ claudeVersion: "unknown" }, "  Claude Code's version:  could not be read (claude --version), so the install does not write her folder for Claude."],
      [{ claude: null, agentPath: NOWHERE_ELSE }, "  Claude Code's version:  not here, so the install does not write her folder for Claude until it is."]
    ]) {
      const r = askWith({ onPath: { "xcode-select": XCODE_HERE }, ...given }, "--print", "--machine", "Sallie's laptop", d.root);
      assert.equal(r.status, 0, r.out);
      assert.ok(r.out.includes(`\n${line}\n`), `${line}\n---\n${r.out}`);
      // It says what to run, and runs none of it.
      assert.equal(r.ran, "", line);
    }
    const newer = askWith({ claudeVersion: "2.2.0 (Claude Code)" }, "--print", "--machine", "Sallie's laptop", d.root);
    assert.ok(newer.out.includes("\n  Claude Code's version:  2.2.0 (her folder's guard needs 2.1.295 or later)\n"), newer.out);
    d.done();
  });
  it("goes on to the end when a check fails: macOS, Final Cut's version and Claude Code's each unreadable, and Xcode's tools missing", () => {
    const d = dropbox();
    const r = askWith({ onPath: { "xcode-select": XCODE_MISSING, sw_vers: "exit 1\n" }, finalCut: "12.4", finalCutText: "not a plist", claudeVersion: "", versionExit: 3, claude: '{"loggedIn":false}' }, "--print", "--machine", "Sallie's laptop", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    for (const line of [
      "  Xcode's command line tools (git, swift):  not here. Jason runs: xcode-select --install",
      "  macOS:  could not be read",
      `${FINAL_CUT}  of a version that could not be read, here; phase 0 was checked with 12.4: update it in App Store > Updates`,
      "  Claude Code, signed in:  no. In Terminal, run: claude auth login (Sallie signs in to her own Claude account in the browser; signing in to the Claude app does not sign in this command), then run this again.",
      "  Claude Code's version:  could not be read (claude --version), so the install does not write her folder for Claude."
    ]) assert.ok(r.out.includes(`\n${line}\n`), `${line}\n---\n${r.out}`);
    changedNothing(r);
    d.done();
  });
  it("writes nothing from this Mac's settings when it only prints, her folder for Claude among them", () => {
    const d = dropbox();
    const r = askWith({ settings: { machine: "Sallie's laptop", root: d.root, checkout: dirname(HERE) } }, "--print", "--machine", "Sallie's laptop", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    assert.deepEqual(r.left.filter((n) => n.startsWith("BRIMM Video Studio")), []);
    assert.equal(r.ran, "");
    d.done();
  });
  it("says when Claude Code's answer about its sign-in cannot be read", () => {
    const d = dropbox();
    const r = askWith({ claude: "not JSON", onPath: { "xcode-select": XCODE_HERE } }, "--print", "--machine", "Sallie's laptop", d.root);
    assert.ok(r.out.includes("\n  Claude Code, signed in:  could not be checked (claude auth status said nothing that could be read)\n"), r.out);
    d.done();
  });
  it("says which Claude model reads each plan", () => {
    const d = dropbox();
    const r = askWith({ programs: [".local/bin/claude"] }, "--print", "--machine", "Mac Studio", d.root);
    assert.ok(r.out.includes("\n  Claude model, named in unedited.js:  claude-opus-5-5\n"), r.out);
    d.done();
  });
  it("refuses a drop folder another Mac's marker names", () => {
    const d = dropbox();
    const drop = join(d.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, ".brimm-watched-by"), "Sallie's laptop\n");
    const r = ask("--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 2);
    assert.match(r.out, /^The folder .*\/Unedited Video\/Mac Studio is watched by Sallie's laptop already\. A drop folder is watched by one Mac only\.\n$/);
    const mine = ask("--print", "--machine", "Sallie's laptop", d.root);
    assert.equal(mine.status, 0, mine.out);
    d.done();
  });
  it("refuses BRIMM Video inside a folder the transcript tool watches, which would be woken by every change", () => {
    const d = dropbox();
    const r = askOn({ "com.thebrimm.transcribe": transcriptAgent([join(d.dir, "The BRIMM DB")]) }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 2);
    assert.match(r.out, /^BRIMM Video must not be inside a folder the transcript tool watches: .* is inside .*The BRIMM DB, which com\.thebrimm\.transcribe watches\. Put it beside BRIMM VIDEO Transfer\.\n$/);
    d.done();
  });
  it("refuses a name a Mac cannot have, and a folder that is not BRIMM Video", () => {
    const d = dropbox();
    for (const [args, why] of [
      [["--machine", "Mac: Studio", d.root], "A Mac's name cannot hold any of / \\ : * ? \" < > |, a control character, or a space or a dot at its start, and can be 40 characters long at most: Mac: Studio"],
      [["--machine", " Mac Studio", d.root], "A Mac's name cannot hold any of / \\ : * ? \" < > |, a control character, or a space or a dot at its start, and can be 40 characters long at most:  Mac Studio"],
      [["--machine", "", d.root], "Name this Mac: --machine \"Mac Studio\" or --machine \"Sallie's laptop\"."],
      [["--machine", "Mac Studio", d.dir], `The folder for --machine is BRIMM Video, in The BRIMM DB in Dropbox, and this is not: ${d.dir}`]
    ]) {
      const r = ask("--print", ...args);
      assert.deepEqual([r.status, r.out], [2, `${why}\n`], args.join(" "));
    }
    d.done();
  });
  it("says how it is used when --machine has no folder, or more than one", () => {
    const d = dropbox();
    for (const args of [["--machine", "Mac Studio"], ["--machine", "Mac Studio", d.root, d.root + " 2"]]) {
      const r = ask("--print", ...args);
      assert.deepEqual([r.status, r.out], [2, 'With --machine, name the one folder BRIMM Video: ./install.sh --machine "Mac Studio" "<path to BRIMM Video>"\n'], args.join(" "));
    }
    d.done();
  });
});

describe("what the final review found in the installer", { skip: notAMac }, () => {
  it("refuses an option where the Mac's name should be, so --machine --print is never taken for a name", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-db-")));
    const root = join(dir, "The BRIMM DB", "BRIMM Video");
    mkdirSync(root, { recursive: true });
    const r = ask("--machine", "--print", root);
    assert.deepEqual([r.status, r.out], [2, "Name this Mac after --machine, as --machine \"Mac Studio\": --print is an option, not a name.\n"]);
    assert.deepEqual([r.left, r.ran], [[], ""]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the drop folder kept on the Mac (--machine)", { skip: notAMac }, () => {
  it("7b. says to mark the drop folder Make available offline in Finder, once, so a video from another device comes down at once", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-db-")));
    const root = join(dir, "The BRIMM DB", "BRIMM Video");
    mkdirSync(root, { recursive: true });
    const r = ask("--print", "--machine", "Mac Studio", root);
    assert.ok(r.out.includes(`\n  Once, in Finder:  Control-click ${root}/Unedited Video/Mac Studio and choose Make available offline, so that a video dropped there from another device is brought down at once\n`), r.out);
    const text = readFileSync(INSTALL, "utf8");
    const closing = text.slice(text.lastIndexOf("launchctl bootstrap"));
    assert.ok(closing.includes('say "Once, in Finder: Control-click that folder and choose Make available offline, so that a video dropped there from'), closing);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the drop folder the installer switches (--machine, --drop), asked what it would do", { skip: notAMac }, () => {
  const ADVICE = "Deal with each first (for example, try a failed import again with retry, or take the video out of the old folder), then run this again.";
  /** A folder made for one test that stands for BRIMM Video in Dropbox. `old` and `drop` make this Mac's folders in it. */
  function box() {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-db-")));
    const root = join(dir, "The BRIMM DB", "BRIMM Video");
    mkdirSync(root, { recursive: true });
    const folder = (parent, machine = "Mac Studio") => {
      mkdirSync(join(root, parent, machine), { recursive: true });
      return join(root, parent, machine);
    };
    const status = (video, more = {}, machine = "Mac Studio") => {
      mkdirSync(join(root, "Episodes", ".importing"), { recursive: true });
      writeFileSync(join(root, "Episodes", ".importing", `${video} (${machine}) 1.json`), JSON.stringify({ version: 1, machine, pid: 4242, video, bytes: 5, seconds: 120, step: "Making the rough cut", at: "2026-10-23T09:00:00-04:00", ...more }));
    };
    return { dir, root, folder, status, held: () => readdirSync(dir, { recursive: true }).sort(), mine: (more = {}) => ({ machine: "Mac Studio", root, checkout: dirname(HERE), ...more }), done: () => rmSync(dir, { recursive: true, force: true }) };
  }
  /** The settings the installer shows, as it says it would write them. */
  const shown = (r) => JSON.parse(/settings\.json:\n(\{[\s\S]*?\n\})\n/.exec(r.out)[1]);
  /** What is in the home folder of a Mac that was given settings, and nothing more. */
  const SETTINGS_LEFT = ["Library", "Library/Application Support", "Library/Application Support/BRIMM Video", "Library/Application Support/BRIMM Video/settings.json"];
  /** The run was refused by these lines, ended with 2, and changed nothing: the home folder holds the settings it was given, if any. */
  const refusedWith = (r, lines, given = false) => {
    assert.deepEqual([r.status, r.out], [2, `${lines.join("\n")}\n\nNothing was changed.\n`], r.out);
    assert.deepEqual([r.agents, r.left, r.ran], [[], given ? SETTINGS_LEFT : [], ""]);
  };

  it("--drop Drop shows Drop/<this Mac> as the folder it would make, mark and watch, writes drop in the settings, and says the old one is left as it is", () => {
    const d = box();
    const old = d.folder("Unedited Video");
    const before = d.held();
    const r = ask("--print", "--machine", "Mac Studio", "--drop", "Drop", "--handoff", "2", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    const out = said(r);
    for (const line of [
      `  Its drop folder, to make in Dropbox and watch:  ${d.root}/Drop/Mac Studio`,
      `  Its marker there, ${d.root}/Drop/Mac Studio/.brimm-watched-by, saying:  Mac Studio`,
      // What the check found, and what Jason does: he checks it is still empty before he deletes it, as the closing line says.
      `  The old drop folder:  ${old}, no longer watched once this is done, and left as it is. The check found no video in it now. Jason checks it is still empty, then deletes it by hand, so that no video is dropped there by habit: a video there is never imported`,
      `  Once, in Finder:  Control-click ${d.root}/Drop/Mac Studio and choose Make available offline, so that a video dropped there from another device is brought down at once`
    ]) assert.ok(out.includes(`\n${line}\n`), `${line}\n---\n${out}`);
    assert.deepEqual(shown(r), { version: 1, machine: "Mac Studio", root: d.root, checkout: dirname(HERE), handoffVersion: 2, drop: "Drop" });
    assert.deepEqual(r.agents.map(held), [agent(r, [`${d.root}/Drop/Mac Studio`])]);
    changedNothing(r);
    assert.deepEqual(d.held(), before);
    d.done();
  });
  // Under the light import nothing is sent to Claude when a video is dropped: the installer says what it sends then, and ends by
  // saying to ask Claude what is waiting, not to open a video by its name. Today's import keeps today's lines.
  const TODAY_SENT = "  Sent to Claude for each cut plan:  the words of the transcript with their times, the rules' plan, and the video's file name and length, on the Claude account signed in on this Mac. The video and its sound never leave it. To send nothing: --rules-only";
  const LIGHT_SENT = "  Sent to Claude:  nothing when a video is dropped, since this Mac's import is the light one. Claude reads a video only once its person has said what it is, on the Claude account signed in on this Mac, and never a session's file name. The video and its sound never leave it. To send nothing: --rules-only";
  it("says under the light import, told or in the settings, that nothing is sent to Claude when a video is dropped, and today's line otherwise", () => {
    const d = box();
    for (const [settings, args] of [[undefined, ["--import", "light"]], [d.mine({ import: "light" }), []], [d.mine({ import: "full" }), ["--import", "light"]]]) {
      const r = askWith({ settings }, "--print", "--machine", "Mac Studio", ...args, d.root);
      assert.equal(r.status, 0, r.err + r.out);
      assert.ok(r.out.includes(`\n${LIGHT_SENT}\n`), r.out);
      assert.doesNotMatch(r.out, /file name and length/);
    }
    for (const [settings, args] of [[undefined, []], [d.mine({ import: "light" }), ["--import", "full"]], [d.mine(), []]]) {
      const r = askWith({ settings }, "--print", "--machine", "Mac Studio", ...args, d.root);
      assert.equal(r.status, 0, r.err + r.out);
      assert.ok(r.out.includes(`\n${TODAY_SENT}\n`), r.out);
      assert.ok(!r.out.includes(LIGHT_SENT), r.out);
    }
    d.done();
  });
  it("ends under the light import by saying to ask Claude what is waiting, and today's import by opening the video: its closing lines, read, not run", () => {
    const text = readFileSync(INSTALL, "utf8");
    const closing = text.slice(text.lastIndexOf('say "Done. Drop a video in:"'));
    assert.ok(closing.includes(`  if [[ -n "$light_import" ]]; then
    say "in Claude, say \\"what's waiting?\\". What the tool did is in $LOG"
  else
    say "in Claude, say \\"open\\" and the video's name. What the tool did is in $LOG"
  fi`), closing);
    // The help says so too.
    const help = text.slice(0, text.indexOf("set -euo pipefail")).replace(/\n# ?/g, " ").replace(/\s+/g, " ");
    assert.ok(help.includes("Under the light import (--import light, or settings that say so) nothing is sent when a video is dropped: Claude reads a video only once its person has said what it is, and never a session's file name."), help);
  });
  it("says at its end that the old folder, the one settings.js checked, is no longer watched, and that Jason checks it is still empty, then deletes it: its closing lines, read, not run", () => {
    const text = readFileSync(INSTALL, "utf8");
    const closing = text.slice(text.lastIndexOf('say "Done. Drop a video in:"'));
    const said = closing.replace(/"\n +say "/g, " ");
    assert.ok(said.includes('if [[ -n "$old_folder" && -d "$old_folder" ]]; then'), said);
    assert.ok(said.includes('say "The old drop folder, $old_folder, is no longer watched. Jason checks it is still empty, then deletes it by hand, so that no video is dropped there by habit: a video there is never imported."'), said);
    assert.ok(!text.includes("once it is empty"), "no word of waiting for it to be empty: the switch is refused while it is not");
  });
  it("names as the old drop folder the one the settings name, of their Mac in their BRIMM Video, when it is told another Mac or another BRIMM Video", () => {
    // The old folder is the one settings.js checked, the file's: never the told Mac's folder, which may be the other Mac's, live.
    const d = box();
    const mine = d.folder("Unedited Video");
    writeFileSync(join(mine, ".brimm-watched-by"), "Mac Studio\n");
    const theirs = d.folder("Unedited Video", "Sallie's laptop");
    writeFileSync(join(theirs, "Her talk.mov"), "video");
    const OLD = (folder) => `  The old drop folder:  ${folder}, no longer watched once this is done, and left as it is. The check found no video in it now. Jason checks it is still empty, then deletes it by hand, so that no video is dropped there by habit: a video there is never imported\n`;
    const other = askWith({ settings: d.mine() }, "--print", "--machine", "Sallie's laptop", "--drop", "Drop", d.root);
    assert.equal(other.status, 0, other.err + other.out);
    assert.ok(other.out.includes(`\n${OLD(mine)}`), other.out);
    assert.doesNotMatch(other.out, /The old drop folder: {2}[^\n]*Sallie's laptop/);
    // Only BRIMM Video told anew, the drop folder named the same: the folder left behind is named all the same.
    const moved = join(d.dir, "Moved", "BRIMM Video");
    mkdirSync(moved, { recursive: true });
    const root = askWith({ settings: d.mine() }, "--print", "--machine", "Mac Studio", moved);
    assert.equal(root.status, 0, root.err + root.out);
    assert.ok(root.out.includes(`\n${OLD(mine)}`), root.out);
    assert.ok(root.out.includes(`\n  Its drop folder, to make in Dropbox and watch:  ${moved}/Unedited Video/Mac Studio\n`), root.out);
    d.done();
  });
  it("says nothing of an old folder when the drop folder is not switched, or the old folder is not there", () => {
    const d = box();
    for (const [args, settings] of [[[], undefined], [["--drop", "Drop"], undefined], [[], d.mine({ drop: "Drop" })], [["--drop", "Drop"], d.mine({ drop: "Drop" })]]) {
      const r = askWith({ settings }, "--print", "--machine", "Mac Studio", ...args, d.root);
      assert.equal(r.status, 0, r.err + r.out);
      assert.doesNotMatch(r.out, /The old drop folder/, args.join(" "));
    }
    // Switched back, the folder it came from is the old one, and is left as it is.
    d.folder("Drop");
    const back = askWith({ settings: d.mine({ drop: "Drop" }) }, "--print", "--machine", "Mac Studio", "--drop", "Unedited Video", d.root);
    assert.equal(back.status, 0, back.err + back.out);
    assert.ok(back.out.includes(`\n  Its drop folder, to make in Dropbox and watch:  ${d.root}/Unedited Video/Mac Studio\n`), back.out);
    assert.ok(back.out.includes(`\n  The old drop folder:  ${d.root}/Drop/Mac Studio, no longer watched once this is done`), back.out);
    d.done();
  });
  it("keeps a Mac on Drop when it is run again without --drop: the plist, the summary and the settings all name Drop/<this Mac>", () => {
    const d = box();
    const r = askWith({ settings: d.mine({ drop: "Drop", later: { x: 1 } }) }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    assert.deepEqual(r.agents.map(held), [agent(r, [`${d.root}/Drop/Mac Studio`])]);
    assert.ok(r.out.includes(`\n  Its drop folder, to make in Dropbox and watch:  ${d.root}/Drop/Mac Studio\n`), r.out);
    assert.ok(r.out.includes(`\n  Its marker there, ${d.root}/Drop/Mac Studio/.brimm-watched-by, saying:  Mac Studio\n`), r.out);
    assert.deepEqual(shown(r), { version: 1, machine: "Mac Studio", root: d.root, checkout: dirname(HERE), drop: "Drop", later: { x: 1 } });
    // Nothing is changed: the home folder holds the settings it was given, as they were.
    assert.deepEqual([r.left, r.ran], [SETTINGS_LEFT, ""]);
    assert.match(r.out, /\nNothing was changed\.\n$/);
    d.done();
  });
  it("shows every setting it keeps, and writes what it is told over them: --import full, --handoff, --drop, and --rules-only as readings off", () => {
    const d = box();
    const kept = d.mine({ import: "light", readings: true, handoffVersion: 1, drop: "Unedited Video", later: { x: 1 } });
    const r = askWith({ settings: kept }, "--print", "--machine", "Mac Studio", "--import", "full", "--handoff", "2", "--rules-only", d.root);
    assert.equal(r.status, 0, r.err + r.out);
    assert.deepEqual(shown(r), { ...kept, version: 1, import: "full", readings: false, handoffVersion: 2 });
    // Not told, they stay as the file has them, readings on included: no --rules-only never writes readings on.
    const quiet = askWith({ settings: d.mine({ readings: false }) }, "--print", "--machine", "Mac Studio", d.root);
    assert.deepEqual(shown(quiet), { ...d.mine({ readings: false }), version: 1 });
    const on = askWith({ settings: d.mine({ readings: true, import: "full" }) }, "--print", "--machine", "Mac Studio", d.root);
    assert.deepEqual(shown(on), { ...d.mine({ readings: true, import: "full" }), version: 1 });
    d.done();
  });
  it("writes readings off, with --rules-only, for a Mac that has no settings yet, with and without node here", () => {
    const d = box();
    const withNode = ask("--print", "--machine", "Mac Studio", "--rules-only", d.root);
    assert.deepEqual(shown(withNode), { version: 1, machine: "Mac Studio", root: d.root, checkout: dirname(HERE), readings: false });
    const bare = askWith({ bare: true }, "--print", "--machine", "Mac Studio", "--rules-only", d.root);
    assert.equal(bare.status, 0, bare.err + bare.out);
    assert.deepEqual(shown(bare), { version: 1, machine: "Mac Studio", root: d.root, checkout: dirname(HERE), readings: false });
    d.done();
  });
  it("takes the light import, now that her chat's question is built: --print shows \"import\": \"light\" in the settings it would write, and changes nothing", () => {
    const d = box();
    for (const settings of [undefined, d.mine(), d.mine({ import: "full" })]) {
      const r = askWith({ settings }, "--print", "--machine", "Mac Studio", "--import", "light", d.root);
      assert.equal(r.status, 0, r.err + r.out);
      assert.ok(r.out.includes('\n  "import": "light"'), r.out);
      assert.deepEqual(shown(r), { ...(settings || d.mine()), version: 1, import: "light" });
      assert.deepEqual([r.left, r.ran], [settings ? SETTINGS_LEFT : [], ""]);
      assert.match(r.out, /\nNothing was changed\.\n$/);
    }
    // With the switch of the drop folder and the hand-off told beside it, as the switch to the light import is made.
    const all = ask("--print", "--machine", "Mac Studio", "--drop", "Drop", "--import", "light", "--handoff", "2", d.root);
    assert.equal(all.status, 0, all.err + all.out);
    assert.deepEqual(shown(all), { version: 1, machine: "Mac Studio", root: d.root, checkout: dirname(HERE), drop: "Drop", import: "light", handoffVersion: 2 });
    changedNothing(all);
    d.done();
  });
  it("refuses a value that will not do, and settings in the file that will not do, by settings.js's words", () => {
    const d = box();
    refusedWith(ask("--print", "--machine", "Mac Studio", "--drop", "Elsewhere", d.root), ['Not written: --drop takes Drop or "Unedited Video".']);
    refusedWith(ask("--print", "--machine", "Mac Studio", d.root, "--handoff", "3"), ["Not written: --handoff takes 1 or 2."]);
    refusedWith(askWith({ settings: d.mine({ import: "ligth" }) }, "--print", "--machine", "Mac Studio", d.root), ['This Mac\'s settings could not be written (the import must be "full" or "light"). Jason puts that setting right by hand, or runs install.sh --machine on it, which writes this Mac\'s name, BRIMM Video and the checkout every time, the import, the hand-off version and the drop folder when told --import, --handoff or --drop, and readings off with --rules-only.'], true);
    // What it is told mends that one.
    const mended = askWith({ settings: d.mine({ import: "ligth" }) }, "--print", "--machine", "Mac Studio", "--import", "full", d.root);
    assert.equal(mended.status, 0, mended.out);
    assert.equal(shown(mended).import, "full");
    d.done();
  });
  it("refuses to switch while the old folder holds a video, naming it by its file name when the import is today's, and says what to do", () => {
    const d = box();
    const old = d.folder("Unedited Video");
    writeFileSync(join(old, "Talk.mov"), "video");
    writeFileSync(join(old, ".brimm-watched-by"), "Mac Studio\n");
    const before = d.held();
    refusedWith(ask("--print", "--machine", "Mac Studio", "--drop", "Drop", d.root), [
      "Not written: the drop folder would change from Unedited Video to Drop, and work is not finished in the old one:",
      `  Talk.mov: waits in ${old}.`,
      ADVICE
    ]);
    assert.deepEqual(d.held(), before);
    // It says nothing of the switch, and is not refused, when no switch is asked for.
    assert.equal(ask("--print", "--machine", "Mac Studio", d.root).status, 0);
    d.done();
  });
  it("refuses to switch while an import of this Mac failed or its late check found a problem, by the video's file name, or its label, and never by the status file's name", () => {
    const d = box();
    d.status("Budget.mov", { failed: "the sound could not be read for Budget.mov" });
    d.status("Talk.mov", { problem: "Talk.rough-cut.mp4 is short" });
    d.status("Light.mov", { failed: "ffprobe", label: "Video of 22 Oct, 10:40 (Mac Studio)" });
    d.status("Theirs.mov", { failed: "the sound could not be read" }, "Sallie's laptop");
    const r = ask("--print", "--machine", "Mac Studio", "--drop", "Drop", d.root);
    assert.equal(r.status, 2, r.out);
    const gone = ", and its video is not in the old folder now: only its status file, in " + `${d.root}/Episodes/.importing` + ", holds this, and a person takes it away by hand";
    assert.equal(r.out, [
      "Not written: the drop folder would change from Unedited Video to Drop, and work is not finished in the old one:",
      `  Budget.mov: its import failed${gone}.`,
      `  Video of 22 Oct, 10:40 (Mac Studio): its import failed${gone}.`,
      ADVICE,
      "  Talk.mov: it was copied in, but its late check found a problem, and its video is not in the old folder now.",
      "A late check needs its video: where the video is no longer in the old folder, the check cannot be made again, and Jason looks at it.",
      "",
      "Nothing was changed.",
      ""
    ].join("\n"));
    assert.doesNotMatch(r.out, /\(Mac Studio\) 1\.json|Theirs|Light\.mov|sound could not/);
    d.done();
  });
  it("under the light import, names a waiting video by its label when it has one, and by what it is and its size when it has none: no part of a client's file name is shown", () => {
    const d = box();
    const old = d.folder("Unedited Video");
    writeFileSync(join(old, "Coaching call Jane Doe.mp4"), "12345");
    writeFileSync(join(old, "Sales call Jane Doe's firm.mov"), "12345");
    const light = d.mine({ import: "light" });
    const counted = askWith({ settings: light }, "--print", "--machine", "Mac Studio", "--drop", "Drop", d.root);
    assert.equal(counted.status, 2, counted.out);
    // Two alike are both said, so that each is one to take out.
    assert.ok(counted.out.includes(`\n  A video of 5 bytes: waits in ${old}.\n  A video of 5 bytes: waits in ${old}.\n`), counted.out);
    d.status("Coaching call Jane Doe.mp4", { bytes: 5, label: "Video of 22 Oct, 10:40 (Mac Studio)" });
    const labelled = askWith({ settings: light }, "--print", "--machine", "Mac Studio", "--drop", "Drop", d.root);
    assert.ok(labelled.out.includes(`\n  Video of 22 Oct, 10:40 (Mac Studio): waits in ${old}.\n  A video of 5 bytes: waits in ${old}.\n`), labelled.out);
    for (const r of [counted, labelled]) assert.doesNotMatch(r.out, /Jane|Doe|Coaching|Sales call/);
    d.done();
  });
  it("is not stopped by videos in the new folder, and looks at the old one only when the folder changes", () => {
    const d = box();
    writeFileSync(join(d.folder("Drop"), "Early.mov"), "video");
    const r = ask("--print", "--machine", "Mac Studio", "--drop", "Drop", d.root);
    assert.equal(r.status, 0, r.out);
    // Already on Drop: a stray video in the old folder is no hindrance to a run that keeps Drop.
    writeFileSync(join(d.folder("Unedited Video"), "Stray.mov"), "video");
    const again = askWith({ settings: d.mine({ drop: "Drop" }) }, "--print", "--machine", "Mac Studio", "--drop", "Drop", d.root);
    assert.equal(again.status, 0, again.out);
    d.done();
  });
  it("refuses --drop, --import and --handoff without --machine, and with no value after them, before anything else", () => {
    const d = box();
    for (const option of ["--drop", "--import", "--handoff"]) {
      const without = ask("--print", option, "Drop", "/Volumes/Work/Unedited video");
      assert.deepEqual([without.status, without.out], [2, '--drop, --import and --handoff are for one of the two Macs, set up with --machine: ./install.sh --machine "Mac Studio" --drop Drop "<path to BRIMM Video>"\n'], option);
      assert.deepEqual([without.agents, without.left, without.ran], [[], [], ""]);
    }
    for (const [args, said] of [
      [["--machine", "Mac Studio", d.root, "--drop"], 'Say which folder after --drop, as --drop Drop or --drop "Unedited Video".'],
      [["--machine", "Mac Studio", "--import", "--print", d.root], "Say which import after --import, as --import light or --import full."],
      [["--machine", "Mac Studio", d.root, "--handoff"], "Say which version after --handoff, as --handoff 1 or --handoff 2."]
    ]) {
      const r = ask("--print", ...args);
      assert.deepEqual([r.status, r.out, r.left, r.ran], [2, `${said}\n`, [], ""], args.join(" "));
    }
    d.done();
  });
  it("refuses plainly, before any change, when node is not here and it is told --drop, --import or --handoff, or this Mac has settings", () => {
    const d = box();
    const WHY = "Node is not on this Mac, and the installer needs it to read and check this Mac's settings before it changes anything. Install it with Homebrew (brew install node; Homebrew is at https://brew.sh), then run this again.";
    for (const [args, settings] of [[["--drop", "Drop"], undefined], [["--import", "full"], undefined], [["--handoff", "2"], undefined], [[], d.mine()]]) {
      const r = askWith({ bare: true, settings }, "--print", "--machine", "Mac Studio", ...args, d.root);
      assert.deepEqual([r.status, r.out], [2, `${WHY}\n\nNothing was changed.\n`], args.join(" "));
      assert.deepEqual([r.left, r.ran], [settings ? ["Library", "Library/Application Support", "Library/Application Support/BRIMM Video", "Library/Application Support/BRIMM Video/settings.json"] : [], ""]);
    }
    // With no settings and none of those options, a Mac with no node is set up as it always was: Homebrew installs node first.
    const fresh = askWith({ bare: true }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(fresh.status, 0, fresh.out);
    assert.ok(fresh.out.includes("\n  Programs to install with Homebrew:  ffmpeg whisper-cpp node\n"), fresh.out);
    d.done();
  });
  it("shows no account's email when it shows the settings, those of the teachings from sessions among them, and says nothing of one anywhere else", () => {
    const d = box();
    const teachings = { on: true, at: "2026-10-22T20:00:00-04:00", accounts: { cli: "jason@example.com", app: "sallie@example.com" } };
    const r = askWith({ settings: d.mine({ drop: "Drop", sessionTeachings: teachings }) }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.out + r.err);
    assert.deepEqual(shown(r).sessionTeachings, { on: true, at: teachings.at, accounts: { cli: "(not shown)", app: "(not shown)" } });
    assert.doesNotMatch(r.out + r.err, /jason@|sallie@|example\.com/);
    d.done();
  });
  it("keeps a Mac on its drop folder whatever else its settings hold: a field that JSON writes as an escape does not make it fall back to Unedited Video", () => {
    const d = box();
    // The installer read the drop folder back out of the JSON with plutil, which could not read this one, and fell back quietly:
    // the settings it printed said Drop, and the launch agent it showed watched Unedited Video.
    const r = askWith({ settings: d.mine({ drop: "Drop", later: "\u0000" }) }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.out + r.err);
    assert.deepEqual(shown(r), { version: 1, machine: "Mac Studio", root: d.root, checkout: dirname(HERE), drop: "Drop", later: "\u0000" });
    assert.deepEqual(r.agents.map(held), [agent(r, [`${d.root}/Drop/Mac Studio`])]);
    assert.ok(r.out.includes(`\n  Its drop folder, to make in Dropbox and watch:  ${d.root}/Drop/Mac Studio\n`), r.out);
    assert.doesNotMatch(r.out, /The old drop folder/);
    d.done();
  });
  it("refuses, and changes nothing, when what settings.js said of the drop folder cannot be read: it never falls back to Unedited Video", () => {
    const d = box();
    const said = (lines) => `printf '%s\\n' ${lines.map((l) => `'${l}'`).join(" ")}\n`;
    const answers = (lines) => `if [ "$2" = plan ]; then ${said(lines)}exit 0; fi\nexec "${process.execPath}" "$@"\n`;
    const cannot = (lines) => ["The installer could not read what settings.js said of the import and the drop folder, so it changed nothing. It said:", ...lines, "", "Nothing was changed.", ""].join("\n");
    for (const lines of [
      ["{", '  "version": 1', "}"],
      ["{", '  "version": 1', "}", "The import will be: full", "The drop folder is now: Unedited Video", "The drop folder will be: Elsewhere"],
      ["{", '  "version": 1', "}", "The import will be: full", "The drop folder will be: Drop", "The drop folder is now: Unedited Video"],
      ["{", '  "version": 1', "}", "The drop folder is now: Unedited Video", "The drop folder will be: Drop"],
      ["{", '  "version": 1', "}", "The import will be: heavy", "The drop folder is now: Unedited Video", "The drop folder will be: Drop"],
      ["nothing of the kind"]
    ]) {
      const r = askWith({ onPath: { node: answers(lines) } }, "--print", "--machine", "Mac Studio", "--drop", "Drop", d.root);
      assert.deepEqual([r.status, r.out], [2, cannot(lines)], lines.join(" | "));
      assert.deepEqual([r.agents, r.left, r.ran], [[], [], ""]);
    }
    // What it says whole is read: its own three lines, and the settings above them are what is shown.
    const good = askWith({ onPath: { node: answers(["{", '  "version": 1', "}", "The import will be: full", "The drop folder is now: Unedited Video", "The drop folder will be: Drop"]) } }, "--print", "--machine", "Mac Studio", "--drop", "Drop", d.root);
    assert.equal(good.status, 0, good.out);
    assert.deepEqual(shown(good), { version: 1 });
    assert.ok(good.out.includes(`\n  Its drop folder, to make in Dropbox and watch:  ${d.root}/Drop/Mac Studio\n`), good.out);
    d.done();
  });
  it("takes the settings from what settings.js says, and not from what node says of itself on its standard error: a warning is shown and changes nothing", () => {
    const d = box();
    // A node that says something on the way, as a runtime warning would, and then runs as the real one does.
    const noisy = `echo "(node:1) Warning: made for the test" >&2\nexec "${process.execPath}" "$@"\n`;
    const r = askWith({ onPath: { node: noisy }, settings: d.mine({ drop: "Drop" }) }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(r.out.includes("(node:1) Warning: made for the test"), r.out);
    assert.deepEqual(shown(r), { version: 1, machine: "Mac Studio", root: d.root, checkout: dirname(HERE), drop: "Drop" });
    assert.deepEqual(r.agents.map(held), [agent(r, [`${d.root}/Drop/Mac Studio`])]);
    d.done();
  });
  /** A node that says it is `version` and says no more: `-e` is the installer's own check of it, which fails for an old one. */
  const NODE_OF = (version) => `case "$1" in\n  --version) echo v${version} ;;\n  -e) exit ${Number(version.split(".")[0]) >= 22 ? 0 : 1} ;;\nesac\n`;
  const OLD_NODE = "Node here is v20.1.0, and the tool needs 22 or later. Run: brew upgrade node";
  it("treats a node older than 22 as no node when the settings are to be read and checked: refused before any change, with the node's own words", () => {
    const d = box();
    for (const [args, settings] of [[["--drop", "Drop"], undefined], [["--import", "full"], undefined], [["--handoff", "2"], undefined], [[], d.mine()]]) {
      const r = askWith({ onPath: { node: NODE_OF("20.1.0") }, settings }, "--print", "--machine", "Mac Studio", ...args, d.root);
      assert.deepEqual([r.status, r.out], [2, `${OLD_NODE}\n\nNothing was changed.\n`], args.join(" "));
      assert.deepEqual([r.left, r.ran, r.agents], [settings ? SETTINGS_LEFT : [], "", []]);
    }
    d.done();
  });
  it("goes on as it always did with a node older than 22 when there are no settings to read and no option of the switch: the print shows the plan whole", () => {
    const d = box();
    const r = askWith({ onPath: { node: NODE_OF("20.1.0") } }, "--print", "--machine", "Mac Studio", d.root);
    assert.equal(r.status, 0, r.out + r.err);
    assert.deepEqual(shown(r), { version: 1, machine: "Mac Studio", root: d.root, checkout: dirname(HERE) });
    assert.deepEqual(r.agents.map(held), [agent(r, [`${d.root}/Unedited Video/Mac Studio`])]);
    // The agent is shown with the node found, old as it is: that one is looked at again when the Mac is set up for real.
    assert.ok(r.agents[0].ProgramArguments[0].startsWith(dirname(r.home)), r.agents[0].ProgramArguments[0]);
    assert.match(r.out, /\nNothing was changed\.\n$/);
    assert.doesNotMatch(r.out, /Node here is/);
    d.done();
  });
  it("writes the check of node's version once, and the real run's refusal of an old node uses it, where it was", () => {
    const text = readFileSync(INSTALL, "utf8");
    assert.equal(text.split("process.versions.node.split").length - 1, 1, "the check of node's version, once");
    assert.equal(text.split("the tool needs 22 or later").length - 1, 1, "and what is said of it, once");
    // The real run says it, with exit 1, after the programs are installed, as it did.
    assert.ok(text.indexOf('if node_old "$node" say; then\n  exit 1\nfi') > text.indexOf('if [[ ${#need[@]} -gt 0 ]]; then "$brew" install "${need[@]}"; fi'), "the real run's refusal");
  });
  it("tells an old node from a new one, and says so only when asked: its own lines run alone in zsh", { skip: noZsh }, () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-node-"));
    try {
      const fn = (() => {
        const t = readFileSync(INSTALL, "utf8");
        const at = t.indexOf("\nnode_old() {");
        assert.ok(at >= 0, "node_old(), in install.sh");
        return t.slice(at + 1, t.indexOf("\n}\n", at) + 3);
      })();
      const say = 'say() { print -r -- "$@"; }\n';
      const nodeAt = (name, version) => {
        writeFileSync(join(dir, name), `#!/bin/sh\n${NODE_OF(version)}`);
        chmodSync(join(dir, name), 0o755);
        return join(dir, name);
      };
      const run = (script) => spawnSync("/bin/zsh", ["-c", `set -euo pipefail\n${say}${fn}${script}`], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
      const old = nodeAt("old", "20.1.0");
      const fresh = nodeAt("new", "22.3.0");
      assert.deepEqual(((r) => [r.status, r.stdout])(run(`node_old "${old}" && print old\nprint -r -- went on`)), [0, "old\nwent on\n"]);
      assert.deepEqual(((r) => [r.status, r.stdout])(run(`node_old "${fresh}" && print old\nprint -r -- went on`)), [0, "went on\n"]);
      assert.deepEqual(((r) => [r.status, r.stdout])(run(`node_old "${old}" say && print old`)), [0, `${OLD_NODE}\nold\n`]);
      assert.deepEqual(((r) => [r.status, r.stdout])(run(`node_old "${fresh}" say && print old\nprint -r -- went on`)), [0, "went on\n"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("still refuses a drop folder another Mac's marker names, in the folder the settings name", () => {
    const d = box();
    const drop = d.folder("Drop");
    writeFileSync(join(drop, ".brimm-watched-by"), "Sallie's laptop\n");
    const r = ask("--print", "--machine", "Mac Studio", "--drop", "Drop", d.root);
    assert.deepEqual([r.status, r.out], [2, `The folder ${drop} is watched by Sallie's laptop already. A drop folder is watched by one Mac only.\n`]);
    d.done();
  });
  it("asks settings.js before it says anything or changes anything, and has write told the same options, in the real run", () => {
    const text = readFileSync(INSTALL, "utf8");
    // The check is made where the Mac's own folders are worked out, before the summary.
    // It is asked by one function, with the node to ask, and asked again in the real run (below).
    assert.ok(text.includes('"$1" "$HERE/settings.js" plan --machine "$machine" --root "$root" --checkout "$CHECKOUT" "${switch_args[@]}"'), "plan, in install.sh");
    assert.equal(text.split('"$HERE/settings.js" plan ').length - 1, 1, "asked in one place");
    const planAt = text.indexOf('settings_plan "$settings_node"');
    assert.ok(planAt > 0, "the first check");
    assert.ok(planAt < text.indexOf('say "The unedited-video tool"'), "the check is made before the summary");
    assert.ok(planAt < text.indexOf('drop="$root/$drop_name/$machine"'), "and before the drop folder is worked out");
    // Nothing is changed before it: the first change, the removal of a left-behind check, comes after "Go ahead".
    assert.ok(planAt < text.indexOf('read -q "go?Go ahead? [y/N] "'), "and before the question");
    // The real run's write is told what the check was, and so checks the old folder again; the marker is made first, as it was.
    const writeAt = text.indexOf('if ! "$node" "$HERE/settings.js" write --machine "$machine" --root "$root" --checkout "$CHECKOUT" "${switch_args[@]}"; then');
    assert.ok(writeAt > text.indexOf('"$node" "$HERE/settings.js" marker "$drop" "$machine"'), "the write, after the marker");
    assert.ok(text.includes('[[ -z "$rules_only" ]] || switch_args+=(--readings off)'), "--rules-only is written as readings off");
  });
  it("prints every line of its help that shows a way to run it at the same indent, two spaces, as the first ones: none at the left edge", () => {
    const r = ask("--print", "--help");
    const shown = r.out.split("\n").filter((line) => /^ *\.\/install\.sh/.test(line));
    assert.ok(shown.length >= 8, r.out);
    for (const line of shown) assert.ok(line.startsWith("  ./install.sh"), `${line}\n---\n${r.out}`);
    // The text that goes with each is set in the same column as theirs.
    const columns = new Set(r.out.split("\n").filter((line) => /^ {20,}\S/.test(line)).map((line) => /^ */.exec(line)[0].length));
    assert.deepEqual([...columns], [35], r.out);
  });
  it("refuses --drop, --import and --handoff with --remove, which changes no settings, plainly and before anything else", () => {
    const d = box();
    for (const args of [["--drop", "Drop"], ["--import", "full"], ["--handoff", "2"], ["--machine", "Mac Studio", "--drop", "Drop", d.root]]) {
      const r = ask("--print", "--remove", ...args);
      assert.deepEqual([r.status, r.out], [2, "--remove stops the watching and changes no settings, so it does not take --drop, --import or --handoff.\n"], args.join(" "));
      assert.deepEqual([r.agents, r.left, r.ran], [[], [], ""]);
    }
    // --remove alone is as it was.
    assert.equal(ask("--print", "--remove").status, 0);
    d.done();
  });
  /** Lines of install.sh, from the first that is found to the end of the second, whole. */
  const piece = (from, to) => {
    const text = readFileSync(INSTALL, "utf8");
    const at = text.indexOf(from);
    assert.ok(at >= 0, `${from}, in install.sh`);
    const end = text.indexOf(to, at);
    assert.ok(end >= 0, `${to}, in install.sh`);
    return text.slice(at, end + to.length);
  };
  it("asks settings.js again in the real run, right before the folders and the marker are made, after the question, the programs and the model", () => {
    const text = readFileSync(INSTALL, "utf8");
    const again = text.indexOf('if ! settings_plan "$node"; then');
    assert.ok(again > 0, "the second check");
    assert.ok(again > text.indexOf('read -q "go?Go ahead? [y/N] "'), "after the question");
    assert.ok(again > text.indexOf('curl -L --fail --progress-bar -o "$MODEL.part" "$MODEL_URL"'), "after the model is fetched");
    assert.ok(again < text.indexOf('mkdir -p "${folders[@]}" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"'), "before the folders are made");
    assert.ok(again < text.indexOf('"$node" "$HERE/settings.js" marker "$drop" "$machine"'), "and before the marker");
  });
  it("stops, and says what was and was not touched, when the second check refuses: its own lines run alone in zsh", { skip: noZsh }, () => {
    const block = piece('# Things can change while', '\n  fi\nfi\n');
    const r = spawnSync("/bin/zsh", ["-c", `set -euo pipefail\nsay() { print -r -- "$@"; }\nsettings_plan() { planned="Not written: the drop folder would change from Unedited Video to Drop, and work is not finished in the old one:\n  Talk.mov: waits in /x."; return 1; }\nmachine="Mac Studio"\nnode=/x/node\n${block}\nprint -r -- went on`], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
    assert.deepEqual([r.status, r.stdout, r.stderr], [1, [
      "",
      "Not written: the drop folder would change from Unedited Video to Drop, and work is not finished in the old one:",
      "  Talk.mov: waits in /x.",
      "",
      "Stopped before this Mac's drop folder, its settings and its launch agent were touched: they are as they were. What this run installed or downloaded first stays. Deal with what is said above, then run this again.",
      ""
    ].join("\n"), ""]);
    // When it agrees, it says nothing and goes on.
    const fine = spawnSync("/bin/zsh", ["-c", `set -euo pipefail\nsay() { print -r -- "$@"; }\nsettings_plan() { return 0; }\nmachine="Mac Studio"\nnode=/x/node\n${block}\nprint -r -- went on`], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
    assert.deepEqual([fine.status, fine.stdout], [0, "went on\n"]);
  });
  it("says plainly what it made, and that the settings and the launch agent are as they were, when write refuses after the marker: its own lines run alone in zsh", { skip: noZsh }, () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-write-"));
    try {
      const calls = join(dir, "calls");
      // A node that writes down how it was called, and refuses a write, as settings.js does when a video has come into the old folder.
      writeFileSync(join(dir, "node"), `#!/bin/sh\necho "$2" >> "${calls}"\nif [ "$2" = write ]; then echo "Not written: the drop folder would change from Unedited Video to Drop, and work is not finished in the old one:"; exit 1; fi\n`);
      chmodSync(join(dir, "node"), 0o755);
      const block = piece('if [[ -n "$machine" ]]; then\n  mkdir -p "$root/Episodes/.importing"', '\nfi\n');
      const script = `set -euo pipefail\nsay() { print -r -- "$@"; }\nnode="${dir}/node"\nHERE=settings\nmachine="Mac Studio"\nroot="${dir}/BRIMM Video"\nWORK="${dir}/Work"\ndrop="${dir}/BRIMM Video/Drop/Mac Studio"\nCHECKOUT=/x\nswitch_args=(--drop Drop)\nstudio_why=""\nmkdir -p "$drop"\n${block}\nprint -r -- went on`;
      const r = spawnSync("/bin/zsh", ["-c", script], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
      assert.deepEqual([r.status, r.stdout, r.stderr], [1, [
        "Not written: the drop folder would change from Unedited Video to Drop, and work is not finished in the old one:",
        "",
        `The settings were not written, so they and the launch agent are as they were. This run did make ${dir}/BRIMM Video/Drop/Mac Studio and its marker, and the folders for Episodes and its status files and for Final Cut's work, which a later run uses. Deal with what is said above, then run this again.`,
        ""
      ].join("\n"), ""]);
      // The marker was asked for, then the write, and nothing after it: her folder for Claude is not written.
      assert.deepEqual(readFileSync(calls, "utf8").trim().split("\n"), ["marker", "write"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("tells, in the README, how to have Claude asked again: without --rules-only for a folder, and with --machine, where readings stay off, node settings.js set --readings on", () => {
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const line = readme.split("\n").find((l) => l.startsWith("Add `--rules-only` to that line"));
    assert.ok(line, "README's --rules-only paragraph");
    assert.ok(line.includes("To have Claude asked again, run the line again without `--rules-only`"), line);
    assert.ok(line.includes("with `--machine`, `--rules-only` wrote `readings: false` into this Mac's settings, and a run without it leaves that as it is: turn the readings on with `node settings.js set --readings on`"), line);
  });
  it("says in its help what the three options do, and that a switch is refused while the old folder holds work", () => {
    const r = ask("--print", "--help");
    const help = r.out.replace(/\s+/g, " ");
    for (const said of ["--drop Drop", '--drop "Unedited Video"', "--import light", "--handoff 2", "BRIMM Video/Drop/<this Mac>", "no longer watched", "left as it is", "refused", "--rules-only also writes readings off"]) assert.ok(help.includes(said), `${said}\n---\n${r.out}`);
    assert.ok(help.includes("The switch is refused while it holds a video; Jason checks it is still empty, then deletes it by hand, so that none is dropped there by habit."), r.out);
  });
});

/** A copy of this checkout's tool, in a folder made for the test, with OPEN_LOCK_CLAUDE set to `version` in its studio.js, as the commit
    that names it after the checks by hand will: the installer there reads it by sed, as it reads this checkout's null. Its tests are
    not copied. Gives its install.sh, and done(). */
function checkoutWithOpenLock(version) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-checkout-")));
  const tool = join(dir, "BRIMM video", "tool");
  cpSync(HERE, tool, { recursive: true, filter: (src) => src !== join(HERE, "tests") });
  const studio = join(tool, "studio.js");
  const text = readFileSync(studio, "utf8");
  assert.ok(text.includes("\nexport const OPEN_LOCK_CLAUDE = null;\n"), "studio.js names no Claude Code for the open lock");
  writeFileSync(studio, text.replace("\nexport const OPEN_LOCK_CLAUDE = null;\n", `\nexport const OPEN_LOCK_CLAUDE = "${version}";\n`));
  return { install: join(tool, "install.sh"), done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the installer and her folder's lock (the open lock, K1), asked what it would do", { skip: notAMac }, () => {
  let copy;
  before(() => {
    copy = checkoutWithOpenLock("2.1.308");
  });
  after(() => copy.done());
  /** The installer `install` asked what it would do for her laptop, this Mac's settings being `settings` (none when not given), its
      Claude Code `version`, the files `files` in its home, and `more` options told. */
  const askLaptop = ({ install = INSTALL, settings, version = "2.1.308", files = [], more = [] } = {}) => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-db-")));
    const root = join(dir, "The BRIMM DB", "BRIMM Video");
    mkdirSync(root, { recursive: true });
    try {
      return askWith({ install, settings: settings && { machine: "Sallie's laptop", root, checkout: dirname(dirname(install)), ...settings }, claudeVersion: `${version} (Claude Code)`, files, onPath: { "xcode-select": XCODE_HERE, sw_vers: MACOS("27.0.1") }, finalCut: "12.4" }, "--print", "--machine", "Sallie's laptop", ...more, root);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  /** The app's own copy of Claude Code `version`, by its path from the home folder. */
  const appCopy = (version) => `Library/Application Support/Claude/claude-code/${version}/a93ded4b1b47/claude.app/Contents/MacOS/claude`;
  const has = (r, line) => assert.ok(r.out.includes(`\n${line}\n`), `${line}\n---\n${r.out}`);
  const STRICT = "  Her folder's lock:  strict (Claude runs only brimm-video's commands there)";
  const OPEN = "  Her folder's lock:  open: Claude may help with anything but the never list, and its commands run in Claude Code's sandbox with no network";
  const WAITS = "  The open lock:  waits for the checks by hand in the Code tab (no Claude Code version is named for it yet), so her folder keeps the strict lock";
  const STRICT_FOLDER = "  Sallie's folder for Claude:  ~/BRIMM Video Studio (its CLAUDE.md, its settings that allow only edit.js, its skill, and Pictures/)";
  const USER_ADDED = "  Her user settings, ~/.claude/settings.json:  the Read deny rules for the places above, added (every Claude Code session on this Mac takes them; they hold Claude's file tools, not a script)";
  const USER_LEFT = "  Her user settings:  left as they are (--user-deny adds deny rules for the places above)";

  it("says which lock her folder gets, and that the open lock waits for the checks by hand while no version is named for it", () => {
    // This checkout names none: settings that say open get the strict lock, and the installer says why.
    for (const [settings, said, unsaid] of [[undefined, [STRICT], [WAITS, OPEN]], [{ lock: "strict" }, [STRICT], [WAITS, OPEN]], [{ lock: "open" }, [STRICT, WAITS], [OPEN]]]) {
      const r = askLaptop({ settings });
      assert.equal(r.status, 0, r.err + r.out);
      for (const line of [STRICT_FOLDER, ...said]) has(r, line);
      for (const line of unsaid) assert.ok(!r.out.includes(line), `${line}\n---\n${r.out}`);
      assert.ok(r.out.indexOf(STRICT_FOLDER) < r.out.indexOf(STRICT) && r.out.indexOf(STRICT) < r.out.indexOf("\n  The Claude app's Code tab:"), r.out);
      assert.match(r.out, /\nNothing was changed\.\n$/);
    }
    // A checkout that names one: open when this Mac's settings say so, and only then.
    for (const [settings, line] of [[undefined, STRICT], [{ lock: "strict" }, STRICT], [{ lock: "open" }, OPEN]]) {
      const r = askLaptop({ install: copy.install, settings });
      assert.equal(r.status, 0, r.err + r.out);
      has(r, line);
      assert.ok(!r.out.includes(WAITS), r.out);
    }
  });
  it("for an open lock, names the workshop, the places kept from Claude in Finder's words, the web tools held and the proxy port", () => {
    const r = askLaptop({ install: copy.install, settings: { lock: "open" } });
    assert.equal(r.status, 0, r.err + r.out);
    const lines = [
      "  Sallie's folder for Claude:  ~/BRIMM Video Studio (its CLAUDE.md, its settings, its skill, and Pictures/)",
      OPEN,
      "  The workshop, where Claude's commands write:  ~/BRIMM Video Workshop",
      "  Kept from Claude in her folder:  BRIMM Video (all but Assets), BRIMM VIDEO Transfer, Zoom's recordings (~/Documents/Zoom), Final Cut's backups, BRIMM Video Work, brimm-video's own settings, Claude's and the Claude app's own files, Dropbox's own files, brimm-video's logs, and the folders that hold secrets",
      "  The web tools:  held (until node tool/settings.js studio --web open, on Jason's yes)",
      "  Her folder's proxy port:  picked when her folder is written",
      USER_LEFT,
      "  The Claude app's Code tab:  runs its own copy of Claude Code, updated with the app, so the setup guide's \"Check her Claude folder's open lock\", in the Code tab, is what proves her folder is locked down there"
    ];
    for (const line of lines) has(r, line);
    const at = lines.map((line) => r.out.indexOf(`\n${line}\n`));
    assert.deepEqual(at, [...at].sort((a, b) => a - b), r.out);
    assert.ok(!r.out.includes(STRICT_FOLDER) && !r.out.includes("Check that her Claude folder only runs BRIMM Video"), r.out);
    // This Mac's settings name where Zoom keeps its recordings, the port, and the web tools opened.
    const told = askLaptop({ install: copy.install, settings: { lock: "open", web: "open", zoomFolder: "/Volumes/Recordings/Zoom", proxyPort: 47123 } });
    assert.equal(told.status, 0, told.err + told.out);
    assert.ok(told.out.includes(", Zoom's recordings (/Volumes/Recordings/Zoom), "), told.out);
    has(told, "  The web tools:  open");
    has(told, "  Her folder's proxy port:  47123, which nothing on this Mac may listen on");
    // None of it is said of the strict lock.
    for (const strict of [askLaptop({ settings: { lock: "open", proxyPort: 47123 } }), askLaptop({ install: copy.install })]) assert.doesNotMatch(strict.out, /Workshop|Kept from Claude|The web tools|proxy port|Her user settings/);
  });
  it("does not write her folder when Claude Code is older than the version the open lock was checked on", () => {
    const old = askLaptop({ install: copy.install, settings: { lock: "open" }, version: "2.1.300" });
    assert.equal(old.status, 0, old.err + old.out);
    has(old, "  Claude Code's version:  2.1.300, older than the 2.1.308 her folder's open lock was checked on. In Terminal: claude update, then run this again. Until then the install does not write her folder for Claude.");
    const fine = askLaptop({ install: copy.install, settings: { lock: "open" }, files: [appCopy("2.1.308")] });
    has(fine, "  Claude Code's version:  2.1.308 (her folder's guard needs 2.1.295 or later, and its open lock was checked on 2.1.308)");
    has(fine, "  The Claude app's own Claude Code:  2.1.308, the newest copy the app keeps here (her folder's guard needs 2.1.295 or later; /status in the Code tab says which copy runs)");
    // The Claude app's own copy, which the Code tab runs, older than that too.
    const app = askLaptop({ install: copy.install, settings: { lock: "open" }, files: [appCopy("2.1.300")] });
    has(app, "  The Claude app's own Claude Code:  2.1.300, the newest copy the app keeps here, older than the 2.1.308 her folder's open lock was checked on. In the app, choose Claude > Check for Updates, then run this again. Until then the install does not write her folder for Claude.");
    // With the strict lock, only the guard's version counts, as before.
    const strict = askLaptop({ install: copy.install, version: "2.1.300", files: [appCopy("2.1.300")] });
    has(strict, "  Claude Code's version:  2.1.300 (her folder's guard needs 2.1.295 or later)");
    has(strict, "  The Claude app's own Claude Code:  2.1.300, the newest copy the app keeps here (her folder's guard needs 2.1.295 or later; /status in the Code tab says which copy runs)");
    // The real run then writes no folder, and says why at its end, as for the guard's version.
    const text = readFileSync(INSTALL, "utf8");
    for (const why of [
      'studio_why="Claude Code here is $claude_version, older than the $OPEN_LOCK_CLAUDE her folder\'s open lock was checked on. In Terminal: claude update, then run this again"',
      'studio_why="${studio_why:-The Claude app\'s own Claude Code is $app_newest, older than the $OPEN_LOCK_CLAUDE her folder\'s open lock was checked on. In the app, choose Claude > Check for Updates, then run this again}"'
    ]) assert.ok(text.includes(why), why);
    // It reads the version the open lock was checked on from studio.js, as it reads the Claude model from unedited.js.
    assert.ok(text.includes(`OPEN_LOCK_CLAUDE="$(sed -n 's/^export const OPEN_LOCK_CLAUDE = "\\([0-9][0-9.]*\\)";$/\\1/p' "$HERE/studio.js")"`), "the sed of OPEN_LOCK_CLAUDE");
  });
  it("names her user settings' deny rules, and adds them only with --user-deny", () => {
    const r = askLaptop({ install: copy.install, settings: { lock: "open" }, more: ["--user-deny"] });
    assert.equal(r.status, 0, r.err + r.out);
    has(r, USER_ADDED);
    assert.ok(!r.out.includes(USER_LEFT), r.out);
    assert.ok(r.out.indexOf("\n  Her folder's proxy port:") < r.out.indexOf(`\n${USER_ADDED}\n`), r.out);
    assert.deepEqual(r.left.filter((name) => name.startsWith(".claude")), []);
    assert.equal(r.ran, "");
    assert.match(r.out, /\nNothing was changed\.\n$/);
    // The real run adds them through settings.js, once her folder's settings are written, and only when told.
    const text = readFileSync(INSTALL, "utf8");
    const runs = text.split("\n").filter((line) => line.includes('"$HERE/settings.js" user-deny'));
    assert.equal(runs.length, 1, runs.join("\n"));
    // Earlier note (e): and only when her folder was written, never when studio_why says it was not, since the deny rules are those
    // of the places her open folder keeps from Claude.
    assert.ok(runs[0].includes('[[ -n "$user_deny" && -z "$studio_why" ]]'), runs[0]);
    assert.ok(text.indexOf(runs[0]) > text.indexOf('if [[ -z "$studio_why" ]]; then "$node" "$HERE/settings.js" studio --node "$node"; fi'), "after her folder");
    // Refused, changing nothing, where her folder gets the strict lock: the rules are the open lock's places.
    for (const [install, settings] of [[INSTALL, { lock: "open" }], [copy.install, undefined]]) {
      const s = askLaptop({ install, settings, more: ["--user-deny"] });
      assert.equal(s.status, 2, s.out);
      assert.ok(s.out.includes("--user-deny adds deny rules for the places her folder's open lock keeps from Claude, and her folder gets the strict lock on this Mac, so it is not taken here.\n\nNothing was changed.\n"), s.out);
      assert.equal(s.ran, "");
    }
    // It is for one of the two Macs, and --remove takes none.
    const lone = ask("--print", "--user-deny", "/tmp/folder");
    assert.equal(lone.status, 2);
    assert.ok(lone.out.includes("--user-deny is for one of the two Macs, set up with --machine"), lone.out);
    const removing = ask("--print", "--remove", "--user-deny");
    assert.equal(removing.status, 2);
    assert.ok(removing.out.includes("--remove stops the watching and changes no settings, so it does not take --user-deny."), removing.out);
  });
});
