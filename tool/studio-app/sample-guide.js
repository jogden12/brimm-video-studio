// The real Getting Started guide, filled with sample details, for a stand-in build (Phase 6): build-app.sh --fake-engine puts its page
// beside the stand-in engine, which hands it over as its guide, so the guide can be judged in the app's windows. It is the build's own,
// like build-info.js, and is never in the bundle.
//   node sample-guide.js <tool folder> <version> <build>
// It imports the given tool folder's own setup/guide.js, at run time, prints the whole page and ends with 0. With the wrong number of
// words it says how it is called on stderr and ends with 2.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isMain } from "../is-main.js";
import { FEED, SUPPORT } from "./build-info.js";

const USAGE = "node sample-guide.js <tool folder> <version> <build>";

/** The sample Mac the page is filled for. */
const HOME = "/Users/sample";
const SETTINGS = {
  machine: "Studio Test Mac",
  root: `${HOME}/Library/CloudStorage/Dropbox/BRIMM Video`,
  dropPath: `${HOME}/BRIMM Video Work/Drop`,
  exportsPath: `${HOME}/BRIMM Video Work/Exports`,
};
/** One app still to install and one note, so that every part of the page shows. */
const MISSING = ["HyperFrames"];
const NOTES = ["Claude Code was installed on this Mac during setup, and stays."];

/** The page of the guide in `tool`, filled for the sample Mac, as build `build` of `version`. */
export async function samplePage(tool, version, build) {
  const folder = resolve(tool);
  const { guideData, fillGuide } = await import(pathToFileURL(join(folder, "setup", "guide.js")).href);
  const template = readFileSync(join(folder, "setup", "guide-template.html"), "utf8");
  const data = guideData({ home: HOME, settings: SETTINGS, build: { version, build, feed: FEED, channel: "stable", support: SUPPORT }, missing: MISSING, notes: NOTES });
  return fillGuide(template, data);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 2;
  } else {
    samplePage(...args).then(
      (page) => process.stdout.write(page),
      (e) => {
        process.stderr.write(`${e?.message ?? String(e)}\n`);
        process.exitCode = 1;
      },
    );
  }
}
