// What pins the words about finish "<episode>" reels (plan PR 9, group 14): the help, the README and the spec say what the form does, and the
// tests of the skill (studio.test.js) say what Sallie's chat runs for it. They fail on purpose when the form, its help or its README
// paragraph change without the others, so that a change to one is a change to all in the same commit (architecture 6.4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HELP } from "../edit.js";

describe("14. what pins them: the help, the README and the spec", () => {
  it("gives the Reels form its usage in the help, with the flags it takes and no other, and says what it does from column 40", () => {
    const lines = HELP.split("\n");
    const at = lines.findIndex((line) => line.startsWith('  node edit.js finish "<episode>" reels'));
    assert.ok(at > 0, "the help has the usage of the form");
    let end = at + 1;
    while (/^ {21}\S/.test(lines[end])) end += 1;
    assert.deepEqual([...lines.slice(at, end).join(" ").matchAll(/--[a-z-]+/g)].map((m) => m[0]), ["--yes", "--take", "--final", "--without"]);
    const description = [];
    for (let i = end; i < lines.length && !lines[i].startsWith("  node edit.js"); i++) description.push(lines[i]);
    assert.ok(description.length >= 4 && description.every((line) => /^ {40}\S/.test(line)), description.join("\n"));
    const said = description.join(" ").replace(/\s+/g, " ");
    for (const words of ["a video her editor finished", "the Reels made from it in HyperFrames", "the next revision of the hand-off", "under the same id", "the hand-off the video has already", "never writes its first"]) assert.ok(said.includes(words), `${words} in: ${said}`);
  });
  it("says in the README what the form does: where it is used, what the next revision keeps and adds, and that it never writes the first hand-off", () => {
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const paragraph = readme.split("\n").find((line) => line.startsWith("**The Reels of a video her editor finished**"));
    assert.ok(paragraph, "the README has a paragraph for the form");
    for (const words of [
      '`node tool/edit.js finish "<episode>" reels`',
      "the next revision of the hand-off the video has already, under the same id",
      "`main`, its suggestions and the Reels it holds as they were",
      "never writes a finished video's first hand-off",
      "a Reel number is never given twice",
      "puts nothing back over a record written above its own that no longer says this finish",
      "one that is not in the folder at all is not, and she is told to ask Jason",
      "is not made again without them",
      "the spelling reaches the Reels it holds too",
      "the new title goes in once the Reel is exported again",
      "a Reel whose word times cannot be read keeps its captions",
      "`--take`, `--final` and `--without`",
      'say "hand off the Reels"',
      // The Reels the hand-off holds are not read by a finish that adds another (the review of PR 9, M2; plan PR 17).
      "the other Reels are copied from it as they were, and the files of those Reels in `final/` are not read (their captions and word times are not used, so a file Dropbox has not brought down cannot stop the finish)"
    ]) assert.ok(paragraph.includes(words), `${words} in the README's paragraph`);
  });
  it("says in the spec, at 8.7, 4.3, 6.1 and 6.3, the form, the hand-off it adds to and the words she says", () => {
    const spec = readFileSync(new URL("../../docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md", import.meta.url), "utf8");
    const section = (from, to) => spec.slice(spec.indexOf(from), spec.indexOf(to));
    const reels = section("### 8.7 Reels of a finished video", "### 8.8 What must not change");
    assert.ok(reels.includes("it says it is not there, and to ask Jason"), "8.7 says a hand-off that is not there is not brought");
    assert.ok(reels.includes("The spelling reaches the Reels the hand-off holds as well"), "8.7 says a spelling reaches the Reels held");
    assert.ok(reels.includes("that the new title goes in once the Reel is exported again"), "8.7 says what a changed title waits for");
    assert.ok(reels.includes('Reel 2\'s captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".'), "8.7 gives the words that say a Reel keeps its captions");
    assert.ok(reels.includes("is not made again, since the new one would hold none"), "8.7 says a spelling does not make a hand-off again without its Reels");
    assert.ok(reels.includes("None of the files in `final/` of the Reels it holds is read for it (their captions and word times are not used), so a file of theirs that Dropbox has not brought down cannot stop the finish; a spelling later reads them when it needs them (below)."), "8.7 says the Reels the hand-off holds are not read by a finish that adds another");
    for (const words of ["The hand-off on file is its base, and it never writes the first", "`nextHandoff`", "Numbers.", "`expectRev`", "The late check puts nothing back over a later write.", "A spelling later"]) assert.ok(reels.includes(words), `${words} in 8.7`);
    assert.ok(section("### 4.3 ", "### 4.4 ").includes("never writes the first one"), "4.3");
    assert.ok(section("### 6.1 Commands", "### 6.2 ").includes('`finish "<episode>" reels` hands off the Reels of a video her editor finished'), "6.1");
    assert.ok(section("### 6.3 What she says", "### 6.4 ").includes('| "Hand off the Reels" / "Add the Reels to the hand-off" | `finish "<episode>" reels`'), "6.3");
  });
});
