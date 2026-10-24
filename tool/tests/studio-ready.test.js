// What her skill says is not ready yet (phase 4): each slice, once it has landed, is gone from there, so Claude never tells
// her to do by hand what brimm-video does now.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { studioFiles } from "../studio.js";

/** The words of each slice of phase 4 that has landed, and of the switch's fork (F10: the card, sessions and their teachings,
    what Claude found). None may be left under "Not ready yet". Each task adds its own. */
const LANDED = ["captions", "spelling", "words on screen", "lower third", "graphic", "Pictures folder", "make it Bright", "style", "cut", "Hormozi",
  "card", "session", "teachings", "principles", "Reel ideas", "new version", "spellings", "what did Claude find"];

describe("her skill's Not ready yet", () => {
  const skill = studioFiles({ checkout: "/c", node: "/n" })[".claude/skills/brimm-edit/SKILL.md"];
  const notReady = skill.slice(skill.indexOf("## Not ready yet"), skill.indexOf("## By hand in Final Cut")).replace(/Final Cut/g, "");
  it("names nothing that is ready", () => {
    for (const word of LANDED) assert.doesNotMatch(notReady, new RegExp(`\\b${word}\\b`, "i"), word);
  });
  it("tells Claude the times in the cut plan, the notes and the markers are the recording's, never to be given as a time on her timeline", () => {
    assert.ok(skill.includes("Times in the cut plan, in Claude's notes and inside a marker's words are the recording's, not her timeline's: never pass one as `--at`. To keep a cut found there, pass its words."), skill);
  });
  it("says what is not, and what to do meanwhile: a logo or a look on a Reel, and bringing in her hand edits", () => {
    assert.ok(skill.includes('- A logo or a look on a Reel: "That comes with the brand templates, later. For now, do it by hand in Final Cut."'), notReady);
    assert.ok(skill.includes('- Bringing in her hand edits: "That part of brimm-video isn\'t ready yet. Make your changes by hand last, after brimm-video\'s, or finish that timeline by hand in Final Cut."'), notReady);
  });
});
