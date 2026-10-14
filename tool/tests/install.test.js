// The installer, asked only what it would do. Every test here runs it with --print, which changes nothing: no test installs,
// loads or removes anything, and the installer is never run without it. It is given a home folder made for the test, and
// stand-ins for launchctl, brew and curl come first on its PATH, so a test can see that none of them was run.
// The tests need a Mac, which has zsh and plutil. Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const INSTALL = fileURLToPath(new URL("../install.sh", import.meta.url));
const HERE = dirname(INSTALL);
const notAMac = process.platform !== "darwin" ? "the installer is for a Mac, and so is plutil, which reads what it would write" : false;
const PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
const MODEL = "Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin";

/** Ask the installer what it would do. Gives back how it ended, what it printed, each launch agent it showed, as plutil reads
    it, and what was changed: `left` is what is in the home folder afterwards, and `ran` the programs it ran that change
    something. A plist that plutil cannot read fails the test there and then. */
const ask = (...args) => askOn({}, ...args);

/** The same, of a Mac that has launch agents already: `installed` holds the text of each one's file, by its label. `kept` is
    what those files hold afterwards. `programs` names stand-ins to put in the home folder first, each by its path from
    there, such as ".local/bin/claude": a file that can be run and does nothing. `files` names plain files to put there, such
    as the transcriber's model. `agentPath` is the PATH the installer is told to give a launch agent, in place of its own:
    folders with no programs in them, for a test that must not find the Claude Code of the Mac it runs on. */
function askOn(installed, ...args) {
  return askWith({ installed }, ...args);
}
function askWith({ installed = {}, programs = [], files = [], agentPath = "" }, ...args) {
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
      mkdirSync(dirname(join(home, file)), { recursive: true });
      writeFileSync(join(home, file), "made for the test");
    }
    for (const name of ["launchctl", "brew", "curl"]) {
      writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${join(dir, "ran")}"\n`);
      chmodSync(join(bin, name), 0o755);
    }
    const r = spawnSync("/bin/zsh", [INSTALL, ...args], { encoding: "utf8", input: "", env: { HOME: home, PATH: `${bin}:${process.env.PATH}`, ...(agentPath ? { BRIMM_AGENT_PATH: agentPath } : {}) } });
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
  it("names its own launch agent alone, and stops it not when it is only asked, wherever --print is and whatever folder is named", () => {
    for (const args of [["--remove", "--print"], ["--print", "--remove"], ["--print", "--remove", "/Volumes/Work/Unedited video"]]) {
      const r = ask(...args);
      assert.equal(r.status, 0, r.err);
      assert.deepEqual(r.agents, []);
      assert.equal(r.out, `This is what would be stopped:\n  com.thebrimm.unedited, and its file ${r.home}/Library/LaunchAgents/com.thebrimm.unedited.plist\n\nNothing was changed.\n`, args.join(" "));
      changedNothing(r);
    }
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
    assert.deepEqual([count('> "$AGENT_FILE"'), count("launchctl bootstrap"), count('\n  agent "'), count('\nagent "')], [1, 1, 1, 1]);
    assert.match(text, /\nLABEL="com\.thebrimm\.unedited"\n/);
    assert.match(text, /\nAGENT_FILE="\$HOME\/Library\/LaunchAgents\/\$LABEL\.plist"\n/);
    assert.match(text, /\nLOG="\$HOME\/Library\/Logs\/brimm-video\.log"\n/);
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
    assert.ok(made.includes('mkdir -p "$root/Episodes/.importing" "$WORK/Backups" "$WORK/From Final Cut"'), made);
    assert.ok(made.includes('"$node" "$HERE/settings.js" marker "$drop" "$machine"'), made);
    assert.ok(made.includes('"$node" "$HERE/settings.js" write --machine "$machine" --root "$root" --checkout "$CHECKOUT"'), made);
    const closing = text.slice(text.lastIndexOf("launchctl bootstrap"));
    assert.match(closing, /\nif \[\[ -n "\$machine" \]\]; then\n {2}say ""\n {2}say "Done\. Drop a video in:"\n {2}say " {2}\$drop"\n/);
  });
  it("gives the launch agent the one PATH, and looks for Claude Code along that same PATH", () => {
    // It is this PATH unless another is named in BRIMM_AGENT_PATH, as a test names one.
    assert.match(text, /\nAGENT_PATH="\$\{BRIMM_AGENT_PATH:-\/opt\/homebrew\/bin:\/usr\/local\/bin:\/usr\/bin:\/bin\}"\n/);
    assert.ok(text.includes('<dict><key>PATH</key><string>$AGENT_PATH</string></dict>'));
    assert.match(text, /\n {2}for dir in \$\{\(s\.:\.\)AGENT_PATH\} "\$HOME\/\.local\/bin"; do\n/);
  });
  it("stops its own launch agent alone when it is asked to stop the watching, and never writes, loads or stops the transcript tool's", () => {
    const stop = text.slice(text.indexOf('if [[ "$mode" == "remove" ]]'), text.indexOf("\nbrew="));
    assert.match(stop, /\n {2}launchctl bootout "gui\/\$\(id -u\)\/\$LABEL" 2>\/dev\/null \|\| true\n {2}rm -f "\$AGENT_FILE"\n/);
    // The transcript tool's agent is named once, and its file is only read, by plutil.
    assert.match(text, /\nTRANSCRIBE_LABEL="com\.thebrimm\.transcribe"\n/);
    const naming = text.split("\n").filter((line) => /TRANSCRIBE_LABEL|com\.thebrimm\.transcribe/.test(line) && !line.startsWith("#"));
    assert.ok(naming.length >= 2, naming.join("\n"));
    for (const line of naming) assert.doesNotMatch(line, /launchctl|rm |> ?"/, line);
    assert.equal(text.split("plutil -extract").length - 1, 2);
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
      "  On this Mac:  <home>/BRIMM Video Work/Backups and <home>/BRIMM Video Work/From Final Cut"
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
