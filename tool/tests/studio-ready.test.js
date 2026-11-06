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
  const notReady = skill.slice(skill.indexOf("## Not ready yet"), skill.indexOf("## In HyperFrames, to hand it off"));
  it("names nothing that is ready", () => {
    for (const word of LANDED) assert.doesNotMatch(notReady, new RegExp(`\\b${word}\\b`, "i"), word);
  });
  it("says what is not ready, and no longer a logo, a look or her hand edits, which were Final Cut's (Phase 2)", () => {
    assert.doesNotMatch(skill.split("also for a video it says was edited in Final Cut before").join(""), /A logo or a look on a Reel|Bringing in her hand edits|Final Cut/);
    assert.ok(notReady.includes('- Archiving, checking the setup, freeing space: "That isn\'t ready yet; ask Jason."'), notReady);
  });
});
