// One yes at hand-off (review changes R3): when she has exported, the chat runs `finish` at once and asks one question, "I found your export.
// Hand it off?", and her yes starts the hand-off. The words are pinned here, in the skill (both files) and in what `finish` prints.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HAND_OFF_ASK, REELS_ASK } from "../finish.js";
import { rowWithRules, rulesOf } from "./skill-rows.js";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const skills = { strict: read("tool/studio/SKILL.md"), open: read("tool/studio/SKILL-open.md") };

describe("R3. one yes at hand-off", () => {
  it("has the two questions in the words Sallie sees", () => {
    assert.equal(HAND_OFF_ASK, "I found your export. Hand it off?");
    assert.equal(REELS_ASK, "I found your Reels' exports. Hand off the Reels?");
  });
  for (const [which, skill] of Object.entries(skills)) {
    it(`has ${which} run finish at once, say what it found, and ask the Hand-off question on one AskUserQuestion with Yes and Not yet`, () => {
      const rules = rulesOf(skill, '"Hand it off"').join("\n");
      assert.ok(rules.includes('When the guide says she has exported it, run `finish "<episode>"` at once: it changes nothing.'), rules);
      assert.ok(rules.includes("Tell her in plain words what it found for each part and the words on the picture, then ask what it prints after `Hand-off question:` on one `AskUserQuestion`, word for word, with the answers \"Yes\" and \"Not yet\"."), rules);
      assert.ok(rules.includes('Yes: `finish "<episode>" --yes` with the answers it asked for. Not yet: stop.'), rules);
      assert.ok(rules.includes('Never ask "Shall I hand it off?" first.'), rules);
    });
    it(`has ${which} do the same for the Reels, with the Reels' question`, () => {
      const rules = rulesOf(skill, '"Hand off the Reels"').join("\n");
      assert.ok(rules.includes('When the guide says she has exported a Reel, run `finish "<episode>" reels` at once: it changes nothing.'), rules);
      assert.ok(rules.includes('Yes: `finish "<episode>" reels --yes` with the answers it asked for. Not yet: stop.'), rules);
      assert.ok(rules.includes('Never ask "Shall I hand off the Reels?" first.'), rules);
    });
    it(`has no line of ${which} send --yes with her answers before the Hand-off question`, () => {
      const row = skill.split("\n").find((line) => line.startsWith('| "Hand it off" / "Finish the episode" |'));
      assert.ok(row.includes("The rest is in the rules for this row, below.") && !row.includes("--yes"), row);
      const reels = rulesOf(skill, '"Hand off the Reels"').join("\n");
      assert.ok(reels.includes('Her answers go back to `finish "<episode>" reels` with one flag each and no `--yes`'), reels);
      assert.ok(!skill.includes("Its questions go back to `finish \"<episode>\" reels --yes`"));
      for (const line of skill.split("\n")) {
        if (!/answers go back|questions go back/.test(line) || !line.includes("--yes")) continue;
        assert.ok(/no `--yes`|until it prints|"Yes" to/.test(line), line);
      }
    });
    it(`keeps in ${which} the old sentence about --yes, and the rows short`, () => {
      assert.ok(skill.includes("Never add `--yes` before she has said yes to what `finish` just said."));
      for (const start of ['| "Hand it off" / "Finish the episode" |', '| "Hand off the Reels" / "Add the Reels to the hand-off" |']) {
        const row = skill.split("\n").find((line) => line.startsWith(start));
        assert.ok(row && row.length <= 400, `${which}: ${row && row.length}`);
        assert.ok(rowWithRules(skill, start).includes("Hand-off question"), start);
      }
      assert.ok(skill.split("\n").every((line) => line.length <= 600));
    });
  }
});
