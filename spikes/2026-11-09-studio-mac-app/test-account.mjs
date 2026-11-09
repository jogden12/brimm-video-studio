// What in-test-account.zsh asks node for in the spare account (spike only; see README.md), run on the node inside BRIMM Node Spike.app,
// with Studio's own code from the copy of tool/ that stage.sh put beside this file in /Users/Shared/BRIMM Studio spikes.
//   toolchain  S3: whether the HyperFrames command line in this account's toolchain folder is the pin, by Studio's own toolchainHolds and
//              toolchainDiffers (hyperframes.js), as `behind` and install.sh ask.
//   sharp      S3: loads sharp from the command line's own folder and makes a small picture with it, so that its native code runs in
//              the signed node (disable-library-validation is what lets it load).
//   project    S6: writes a test project with Studio's own projectFiles and writeProject (project.js), as explainer.js openVoiceProject
//              writes a HeyGen explainer's: upright, ten seconds, on the brand's mist, with no media at all. Its link to the command
//              line (node_modules/.bin/hyperframes) is this account's, and its notes start from the guidance the pinned package ships.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const toolDir = join(dirname(fileURLToPath(import.meta.url)), "tool");
const from = (file) => import(pathToFileURL(join(toolDir, file)).href);
const say = (line = "") => console.log(line);
const home = homedir();
const { PIN, cliPath, toolchainDiffers, toolchainDir, toolchainHolds } = await from("hyperframes.js");

async function toolchain() {
  const held = toolchainHolds(home);
  const differs = toolchainDiffers(held);
  if (differs === "") {
    say(`The HyperFrames command line ${PIN.version} is installed in ${toolchainDir(home)}, and npm's lock file holds the pin's integrity string (Studio's own toolchainHolds).`);
    return 0;
  }
  say(`What is in ${toolchainDir(home)} is not the pin: ${differs}.`);
  return 1;
}

async function sharp() {
  const require = createRequire(join(toolchainDir(home), "package.json"));
  let loaded;
  try {
    loaded = require("sharp");
  } catch (e) {
    say(`sharp did not load in this node: ${e.message.split("\n")[0]}`);
    return 1;
  }
  const png = await loaded({ create: { width: 8, height: 8, channels: 3, background: "#1d2b53" } }).png().toBuffer();
  say(`sharp ${loaded.versions.sharp}, with libvips ${loaded.versions.vips}, loads in ${process.execPath}, and made a picture of ${png.length} bytes.`);
  return 0;
}

async function project() {
  const { projectFiles, projectName, writeProject } = await from("project.js");
  const { guidanceOf } = await from("app.js");
  const { localStamp } = await from("episode.js");
  const { teleprompterText } = await from("sentences.js");
  // A made-up episode's id, six hex characters as Studio's are.
  const id = "5b1e70";
  const name = projectName({ name: "Spike test", part: "main", number: 1, id });
  const dir = join(home, "BRIMM Video Work", "Spike S6", name);
  const input = {
    kind: "main", number: 1, short: true, id, name: "Spike test", spellings: [], logos: [],
    facts: { seconds: 10, width: 1080, height: 1920, fps: 30 }, words: [], plan: null, graphicCues: [],
    cli: cliPath(home), guidance: readFileSync(guidanceOf(home), "utf8"), createdAt: localStamp(new Date()),
    explainer: { voice: "heygen", teleprompter: teleprompterText(["This is a test page for BRIMM Video Studio's spikes.", "Nothing here is posted."]) }
  };
  writeProject(dir, projectFiles({ ...input, references: [] }));
  say(`Written: ${dir}`);
  return 0;
}

const steps = { toolchain, sharp, project };
const step = steps[process.argv[2]];
if (!step) {
  say("test-account.mjs: say toolchain, sharp or project.");
  process.exit(2);
}
process.exit(await step());
