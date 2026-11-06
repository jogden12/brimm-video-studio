// Plain words for what is wrong (review changes R4c): no "Not right:", no "late check", and, where there is something she can try first,
// a bare "Ask Jason" says what to try. File problems are told by the file and its kind (episode.js fileProblemWords), so that a rule
// about one file (a hand-edited script) never depends on a sentence. Statuses keep their stored words and are shown in plain ones.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileProblems, fileProblemWords, filesProblems } from "../episode.js";
import { shownStep } from "../importing.js";
import { footageNotInWords, footageNotMadeWords, noWords, notWholeYet } from "../app.js";
import { reelNotWholeYet } from "../app-reel.js";
import { stringsOf } from "./studio-name.test.js";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("file problems, by the file and its kind", () => {
  const listed = { files: { "a.mp4": 30, "b.txt": 12, "c.srt": 9, "record/0001.json": 5 } };
  const folder = mkdtempSync(join(tmpdir(), "plain-words-"));
  writeFileSync(join(folder, "a.mp4"), "x".repeat(10));
  writeFileSync(join(folder, "b.txt"), "x".repeat(14));
  writeFileSync(join(folder, "a (1).mp4"), "x".repeat(30));
  it("is a list of { file, kind } with the sizes, and the old strings are made of it", () => {
    const found = fileProblems(folder, listed);
    assert.deepEqual(found.map((p) => [p.file, p.kind]), [["a.mp4", "short"], ["b.txt", "different"], ["c.srt", "missing"]]);
    assert.deepEqual(found.map((p) => [p.size, p.bytes]), [[10, 30], [14, 12], [null, 9]]);
    assert.deepEqual(found[0].kept, ["a (1).mp4"]);
    assert.deepEqual(filesProblems(folder, listed), [
      "a.mp4 is short: 10 bytes of 30, and Dropbox may have kept it as a (1).mp4",
      "b.txt is 14 bytes, not the 12 the record lists",
      "c.srt is missing"
    ]);
  });
  it("is told in the words of the three cases", () => {
    const [short, different, missing] = fileProblems(folder, listed);
    assert.equal(fileProblemWords(missing), "A file of this video is missing: c.srt. Dropbox may still be bringing it. Wait a few minutes and ask again. If it is still missing, tell Jason.");
    assert.equal(fileProblemWords(short), "A file of this video is not all here yet: a.mp4. Dropbox is still bringing it. Ask again in a few minutes. Dropbox may have kept it as a (1).mp4.");
    assert.equal(fileProblemWords(different), "A file of this video is not the one Studio saved: b.txt. If you changed it, tell me what you changed. If not, tell Jason.");
    rmSync(folder, { recursive: true, force: true });
  });
});

describe("a status keeps its stored step and is shown in plain words", () => {
  it("says Dropbox's check of the copies for the three steps that name the late check", () => {
    for (const stored of ["Waiting for its late check", "Waiting for the late check"]) assert.equal(shownStep(stored), "Waiting for Dropbox's check of its copies");
    assert.equal(shownStep("Late check"), "Dropbox's check of its copies");
  });
  it("leaves every other step as it is", () => {
    for (const step of ["Copying the video", "Reading the video", "Making the rough cut", ""]) assert.equal(shownStep(step), step);
  });
});

describe("what she can try is told", () => {
  it("says, of footage that could not be made, to open it again in a few minutes and to tell Jason if it says so again", () => {
    assert.equal(footageNotMadeWords("Pricing talk"), "Some of its footage could not be made for HyperFrames, and opening it again won't change that. Tell Jason.");
    assert.equal(footageNotInWords("Pricing talk"), 'Some of its footage could not be put into the project. Say "open Pricing talk in HyperFrames" again. If it says this again, tell Jason.');
  });
  it("ends the not-whole-yet lines with tell Jason", () => {
    assert.match(notWholeYet("Pricing talk"), /If it says this again, tell Jason\.$/);
    assert.match(reelNotWholeYet(2, "Pricing talk"), /If it says this again, tell Jason\.$/);
  });
  it("says words that are not yet on this Mac may be on their way", () => {
    assert.equal(noWords("Pricing talk"), "The words of Pricing talk are not on this Mac yet, so there is nothing for HyperFrames to start from. Dropbox may still be bringing them: say it again in a few minutes. If it says this again, tell Jason.");
  });
});

describe("small words", () => {
  it("the skill says the video has no plan", () => {
    for (const name of ["SKILL.md", "SKILL-open.md"]) {
      const text = readFileSync(join(TOOL, "studio", name), "utf8");
      assert.ok(text.includes("If it says the video has no plan,"), name);
      assert.ok(!text.includes("is no plan"), name);
    }
  });
});

describe("no line she is told holds the late check or Not right", () => {
  // The files whose strings are said to her. Log lines (for Jason) are left alone; so are the stored words, which older Macs read.
  // Every module, but the two that print only to Jason's own commands (`settings switch`, the drop-folder switch), which still say "late check" to him.
  const JASON_ONLY = new Set(["switch.js", "settings.js"]);
  const SAID = readdirSync(TOOL).filter((n) => n.endsWith(".js") && !JASON_ONLY.has(n));
  const STORED = new Set(["Waiting for its late check", "Waiting for the late check", "Late check", "late check", "late-check.lock"]);
  it("holds in the strings the tool says", () => {
    const found = [];
    for (const file of SAID) {
      const src = readFileSync(join(TOOL, file), "utf8");
      const lines = src.split("\n");
      for (const piece of stringsOf(src)) {
        if (!/late[- ]checks?|Not right/i.test(piece.text) || STORED.has(piece.text)) continue;
        if (/\b(log|sayOnce)\(/.test(lines[piece.line - 1])) continue;
        found.push(`${file}:${piece.line}: ${piece.text.slice(0, 100)}`);
      }
    }
    assert.deepEqual(found, []);
  });
  it("holds in the chat's skill files", () => {
    for (const name of readdirSync(join(TOOL, "studio")).filter((n) => /^SKILL.*\.md$/.test(n))) {
      assert.doesNotMatch(readFileSync(join(TOOL, "studio", name), "utf8"), /late check|Not right:/i, name);
    }
  });
});
