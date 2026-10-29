// What pins the words about what the guide says on a Mac whose settings have the app off, and about how it reads Downloads (plan PR 17): the help, the README
// and the spec say it. They fail on purpose when the guide, its help or its README rows change without the others, so that a change to one is a change to all in
// the same commit (architecture 6.4). The stage's own words are guide.test.js's and edit-guide-app.test.js's, and where the guide reads, and how often, is
// edit-guide-downloads.test.js's. Both skills are as they were: no sentence of either changes, since the new line has no offer to make.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HELP } from "../edit.js";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const readme = read("README.md");
const spec = read("docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md");
const row = (start) => readme.split("\n").find((line) => line.startsWith(start)) ?? "";
const section = (text, from, to) => text.slice(text.indexOf(from), text.indexOf(to));

describe("what pins the guide's line for a Mac with the app off and its one listing of Downloads (plan PR 17)", () => {
  it("has the help say what the guide says on a Mac that is not set up for HyperFrames, from column 40, and keep what it said", () => {
    const lines = HELP.split("\n");
    const at = lines.findIndex((line) => line.startsWith('  node edit.js guide ["<video>"]'));
    let end = at + 1;
    while (/^ {40}\S/.test(lines[end])) end += 1;
    const block = lines.slice(at, end);
    assert.ok(block.length >= 10 && block.slice(1).every((line) => /^ {40}\S/.test(line) && line.length <= 122), block.join("\n"));
    const said = block.join(" ").replace(/\s+/g, " ");
    assert.ok(said.includes("On a Mac that Jason has not set up for HyperFrames it says that this Mac is not set up, where it would say to open the video there or that its video is being made."), said);
    for (const words of ["A raw video and an iPhone clip are followed through HyperFrames", "then to open it there", "and once it is exported, to hand it off", "A finished video whose hand-off is written is told to hand off the Reels", "A raw video that goes the Final Cut way keeps its Final Cut steps"]) assert.ok(said.includes(words), words);
  });
  it("says in the README's rows for guide what it says on a Mac with the app off, what it says of a clip beside a project, and what it reads of a video she set aside and how often it reads Downloads", () => {
    const first = row('| `guide ["<video>"]`');
    for (const words of [
      "On a Mac whose settings have the app off it says that this Mac isn't set up for HyperFrames, as `app` does there, where it would say to open the video there or that its video is being made, whether the project's folder is on this Mac or not (plan PR 17)",
      "a project here that the app opened is still said to be in HyperFrames, and an export is still found, since `finish` needs no setting",
      "An iPhone clip is told its video is being made only while no project is here, as a raw video is",
      "beside a project the clip's own next step stands",
      "A raw video or an iPhone clip she has set aside is read for nothing of its project or Downloads either (plan PR 17)",
      "Downloads is listed once for a whole pass of the guide, by the first video that looks in it, and every other is given that listing",
      "a pass in which no video looks in it lists nothing, and a Downloads folder this Mac will not let be read is tried once and is no export seen for any video"
    ]) assert.ok(first.includes(words), words);
    // What it said before is still said.
    for (const words of ['A video she has set aside ("that one is all done") stays set aside, and nothing of its Reel projects or Downloads is read for it.', "then it says to open the video there", "These only read, and write nothing"]) assert.ok(first.includes(words), words);
  });
  it("says in the spec, at 4.5 and 6.2, what the guide says on a Mac with the app off, and that Downloads is listed once for a pass", () => {
    const four = section(spec, "### 4.5 The hand-off to BRIMM Ops", "### 4.6 ");
    for (const words of [
      "On a Mac whose settings have the app off the step is that this Mac isn't set up for HyperFrames (\"This Mac isn't set up for HyperFrames yet: ask Jason.\"), which is what `app` says there",
      "nothing on that Mac opens a project, so the guide sends her neither to open it, whether the project's folder is on this Mac or not, nor to wait for its video to be made",
      "a project here that the app opened is still \"In HyperFrames\", and an export is still found, since `finish` needs no setting",
      "An iPhone clip is told its video is being made by the same rule as a raw video: only while no main project is here.",
      "Downloads is listed once for a whole pass of the guide (one `guide`, one look of `guide wait` or of `guide … tell`), by the first video that looks in it for an export, and every other is given that listing",
      "a pass in which none looks lists nothing, and a folder this Mac will not let be read is tried once and is no export seen for any video",
      "The same holds of the project and Downloads of a raw video or an iPhone clip she has said is finished."
    ]) assert.ok(four.includes(words), `${words} in 4.5`);
    const gate = section(spec, "### 6.2 The gate, and what a new command needs", "### 6.3 ");
    assert.ok(gate.includes("Downloads is listed once for a pass, for the first video that looks in it (4.5)."), "6.2 says it is listed once for a pass");
  });
});
