// What pins the words about the guide's Reels stage (plan PR 16, group C): the help, the README, both skills and the spec say what the guide does
// for a finished video whose Reel is exported from HyperFrames and not in its hand-off. They fail on purpose when the stage, its help or its README
// rows change without the others, so that a change to one is a change to all in the same commit (architecture 6.4). The stage's own words and the
// order it comes in are guide.test.js's and edit-guide-reels.test.js's.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HELP } from "../edit.js";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const readme = read("README.md");
const spec = read("docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md");
const skills = { strict: read("tool/studio/SKILL.md"), open: read("tool/studio/SKILL-open.md") };
const row = (start) => readme.split("\n").find((line) => line.startsWith(start)) ?? "";
const section = (text, from, to) => text.slice(text.indexOf(from), text.indexOf(to));
const guideSection = (skill) => section(skill, "## Guide her", "## What she says, and what to run");

describe("C. what pins the guide's Reels stage: the help, the README, the skills and the spec", () => {
  it("has the help say that a finished video is told to hand off the Reels once a Reel is exported and not in its hand-off, from column 40", () => {
    const lines = HELP.split("\n");
    const at = lines.findIndex((line) => line.startsWith('  node edit.js guide ["<video>"]'));
    let end = at + 1;
    while (/^ {40}\S/.test(lines[end])) end += 1;
    const block = lines.slice(at, end);
    assert.ok(block.length >= 9 && block.slice(1).every((line) => /^ {40}\S/.test(line) && line.length <= 122), block.join("\n"));
    const said = block.join(" ").replace(/\s+/g, " ");
    assert.ok(said.includes("A finished video whose hand-off is written is told to hand off the Reels once a Reel is exported from HyperFrames that the hand-off does not hold."), said);
    // What it said before is still said: the raw video, the iPhone clip and the Final Cut way.
    for (const words of ["A raw video and an iPhone clip are followed through HyperFrames", "and once it is exported, to hand it off", "A raw video that goes the Final Cut way keeps its Final Cut steps"]) assert.ok(said.includes(words), words);
  });
  it("says in the README's rows for guide what the stage is, when, where it comes, and what it leaves out", () => {
    const first = row('| `guide ["<video>"]`');
    for (const words of [
      "A finished video whose hand-off is written is followed one step further (plan PR 16)",
      "has an export that `finish \"<episode>\" reels` would take now",
      "for the Reel projects alone (in Downloads, by the records in the project's `renders/`, or in what the other Mac released)",
      "or two that began in one minute, which `finish` asks the final one of",
      'it says which Reels are exported and to say "hand off the Reels", ahead of the BRIMM Ops page\'s steps and of done',
      "A Reel open and not exported, one already in the hand-off, an export older than the project's last change and a Downloads folder this Mac will not let be read are no such stage",
      // A Reel project on the other Mac: `finish` would take its export, and the guide does not look, for the reason it gives the main video (review F3).
      "A Reel project that is not on this Mac is not looked at either, though `finish … reels` would take its export from Downloads or from what the other Mac released: as for the main video, the guide reads Downloads only for a project that is here, and `app` says what is on the other Mac.",
      // Where `finish` would go no further and a look that costs no other read can tell (review F1, F2a and F2c), and the two refusals it does not look for (F2b, F2d).
      "Nor is it said where `finish … reels` would go no further and a look that costs no other read can tell: another run (a bring, a read or an ask) is at work on the episode, the other Mac has it open, the chain of its versions has a gap, Dropbox undid this Mac's last change to its record, the hand-off on file cannot be added to, or the record lacks the Reel; while a finish runs it says so instead",
      "a hand-off that went to the page under another id and a Reel number another version of the video gave under the same id: `finish` says each in its own words, ending \"Ask Jason\", and the guide goes on saying the stage until he has settled it",
      // The hand-off is read as a regular file alone, on a Mac whose settings say version 2 (review F4 and F5).
      "Its hand-off is read as a regular file alone, so that a pipe where it should be is never waited for and a link there is read as unreadable, though `finish` follows one; this holds on a Mac whose settings say hand-off version 2: on any other, `writesV2For` first reads each hand-off of `final/` and `history/` with a plain read, as it does for every command that asks it.",
      'A video she has set aside ("that one is all done") stays set aside',
      "only when the video has a hand-off and a Reel project on this Mac"
    ]) assert.ok(first.includes(words), words);
    assert.ok(row('| `guide "<video>" done').includes("nothing noted skips these, and a finished video's Reels not yet handed off do not"));
    assert.ok(row("| `tool/guide.js`, `tool/guide-note.js`").includes("where a raw video and an iPhone clip are in HyperFrames and a finished video's Reels are exported"));
  });
  it("says in the README's paragraph on the Reels of a video her editor finished that the guide tells her to hand them off", () => {
    const paragraph = readme.split("\n").find((line) => line.startsWith("**The Reels of a video her editor finished**"));
    assert.ok(paragraph, "the README has the paragraph");
    assert.ok(paragraph.includes('The guide tells her too: once a Reel of the video is exported from HyperFrames and is not in its hand-off, "what\'s next?" says so, ahead of the BRIMM Ops page\'s steps (plan PR 16).'));
  });
  it("has both skills offer to hand off the Reels at that stage, in the very line of their section on the guide, and stay under 160 lines", () => {
    const offer = '"Shall I hand off the Reels?" once she has exported a Reel of a finished video';
    for (const [which, skill] of Object.entries(skills)) {
      const guide = guideSection(skill);
      assert.ok(guide.trimEnd().split("\n").length <= 30, `${which}: ${guide.split("\n").length} lines`);
      const next = guide.split("\n").find((line) => line.startsWith("- Any other next step:"));
      assert.ok(next && next.includes(offer), `${which}: ${next}`);
      assert.ok(next.indexOf('"Shall I hand it off?" once she has exported it') < next.indexOf(offer) && next.indexOf(offer) < next.indexOf('"Shall I show it in Final Cut?"'), `${which}: the offers are in the order of the stages`);
      assert.ok(skill.split("\n").length < 160, `${which}: ${skill.split("\n").length} lines`);
    }
    // The two skills' sections on the guide, and their rows and section on handing off, are the same words.
    assert.equal(guideSection(skills.open), guideSection(skills.strict));
    const reelsRow = (skill) => skill.split("\n").filter((line) => line.startsWith('| "Hand off the Reels" / "Add the Reels to the hand-off" |'));
    assert.equal(reelsRow(skills.strict).length, 1);
    assert.deepEqual(reelsRow(skills.open), reelsRow(skills.strict));
    const handOff = (skill) => skill.slice(skill.indexOf("## In HyperFrames, to hand it off"));
    assert.equal(handOff(skills.open), handOff(skills.strict));
  });
  it("says in the spec, at 4.5, 6.1, 6.2 and 8.7, the stage, where it comes, what it leaves out and how it reads", () => {
    const four = section(spec, "### 4.5 The hand-off to BRIMM Ops", "### 4.6 ");
    for (const words of [
      "**Reels exported, waiting for the hand-off** (a finished video; plan PR 16)",
      'You have exported Reel 2 from HyperFrames. Say "hand off the Reels" to add it to the hand-off.',
      "Two or more are named together",
      "or two that began in one minute",
      "none: a Reel open and not exported, one already in the hand-off",
      "A Reel project that is not on this Mac is not looked at either, though that command would take its export from Downloads or from what the other Mac released: as for the main video (PR 10), Downloads is read only for a project that is here, and `app` says what is on the other Mac.",
      "Nor where that command would go no further and a look that costs no other read can tell: another run is at work on the episode (a bring, a read or an ask; a finish at work is the stage below), the other Mac has the episode open, the chain of the video's versions has a gap, Dropbox undid this Mac's last change to the record, the hand-off on file cannot be added to, or the record lacks the Reel.",
      "a hand-off that went to the page under another id, and a Reel number another version of the video gave under the same id (8.7). That command says each in its own words, ending \"Ask Jason\", and the guide goes on saying the stage until Jason has settled it.",
      "Its finish is running. The panel shows how far it is.",
      "before the BRIMM Ops page's steps and before done",
      "after her word that the video is finished: that stands"
    ]) assert.ok(four.includes(words), `${words} in 4.5`);
    assert.ok(section(spec, "### 6.1 Commands", "### 6.2 ").includes("`guide` gains states (4.5), a finished video's Reels among them,"), "6.1 names the stage in the guide's row");
    assert.ok(section(spec, "### 6.1 Commands", "### 6.2 ").includes("the guide sends her there too, once a Reel is exported (4.5)"), "6.1 says the guide sends her to the Reels form");
    const gate = section(spec, "### 6.2 The gate, and what a new command needs", "### 6.3 ");
    assert.ok(gate.includes("**`guide`** goes in no list") && gate.includes("nothing of their projects or Downloads is read"), "6.2 says what the guide reads for a video the gate holds");
    const reels = section(spec, "### 8.7 Reels of a finished video", "### 8.8 What must not change");
    for (const words of [
      "**The guide says it** (4.5; plan PR 16)", "as a regular file alone", "a pipe or a link where a file should be is never waited for",
      "It says nothing where `finish … reels` would go no further and a look that costs no other read can tell (4.5).",
      "a hand-off that went to the page under another id and a Reel number another version gave under the same id (each ends \"Ask Jason\", and the guide goes on saying the stage until Jason has settled it)",
      "a file of the episode not whole in Dropbox (it comes right as Dropbox syncs), and the shape and sound of the exported file",
      // Only on a Mac whose settings say hand-off version 2 (review F5); a link is read as unreadable (F4).
      "That holds on a Mac whose settings say hand-off version 2: on any other, `writesV2For` first reads each hand-off of `final/` and `history/` with a plain read, as it does for `finish` and `spell`, and a pipe where one should be would be waited for.",
      "A link is read as unreadable, though `finish` follows one: Studio never makes a link there."
    ]) assert.ok(reels.includes(words), `${words} in 8.7`);
  });
});
