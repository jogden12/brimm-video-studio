// R4c fix 1: the words that were left unpinned, and the footage-not-made line that no longer promises a retry.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readTrouble } from "../edit.js";
import { midSentence } from "../guide.js";
import { notWritten } from "../plan.js";
import { shownStep } from "../importing.js";
import { footageNotMadeWords } from "../app.js";
import { stringsOf } from "./studio-name.test.js";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..");
const has = (file, text) => stringsOf(readFileSync(join(TOOL, file), "utf8")).some((s) => s.text.includes(text));

describe("R4c fix 1", () => {
  it("footage that could not be made promises no retry", () => {
    assert.equal(footageNotMadeWords("Pricing talk"), "Some of its footage could not be made for HyperFrames, and opening it again won't change that. Tell Jason.");
  });
  it("readTrouble says what to do for a record not here whole, and a folder that cannot be read", () => {
    assert.equal(readTrouble({ why: "it has no whole record, so its import has not finished, or it is not an episode", code: "NONE" }),
      "It is not ready: it has no whole record, so its import has not finished, or it is not an episode. Dropbox may still be bringing its record. Wait a few minutes and ask again. If it says this again, tell Jason.");
    assert.equal(readTrouble({ why: "the folder X could not be read (it is not there)", code: "UNREADABLE" }),
      "The folder X could not be read (it is not there). Ask again in a few minutes. If it says this again, tell Jason.");
    assert.equal(readTrouble({ why: 'Dropbox has kept a conflicted copy in this episode: a. Say "sort out the conflict"', code: "CONFLICTED" }),
      'Dropbox has kept a conflicted copy in this episode: a. Say "sort out the conflict".');
  });
  it("a plan's conflicted copy says what she can say", () => {
    assert.equal(notWritten({ code: "CONFLICTED" }), 'Dropbox has kept a conflicted copy of it: say "sort out the conflict".');
  });
  it("a step in the middle of a sentence keeps Dropbox's capital", () => {
    assert.equal(midSentence(shownStep("Late check")), "Dropbox's check of its copies");
    assert.equal(midSentence("Writing the transcript"), "writing the transcript");
    assert.equal(midSentence("Claude reads it"), "Claude reads it");
  });
  it("pins the lines of join, retry and resolve that no world reaches", () => {
    assert.ok(has("join.js", ": copied into Dropbox, but the check of its copies could not be kept ("));
    assert.ok(has("join.js", ": the launch agent could not be asked to make the check of its copies ("));
    assert.ok(has("edit.js", "whose copies Dropbox found a problem with"));
    assert.ok(has("edit.js", "which stopped at "));
    assert.ok(has("edit.js", "Nothing was written, and nothing deleted: the plan's files could not be written ("));
  });
});
