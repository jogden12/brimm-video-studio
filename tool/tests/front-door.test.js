// The front door (design 2026-11-18): a Claude session in Studio accepts any input — a script, an idea, a HyperFrames package or a
// recording — and determines what kind of video it is. front-door.js is pure here: a text or a file description goes in, and a
// classification and parsed structure come out. Nothing is read or written.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyText, parseScript, toCueString, toShotString } from "../front-door.js";

// --- classifyText: what a text is ---

describe("classifyText, a text with no file", () => {
  it("classifies a short idea as a bare idea", () => {
    const got = classifyText("I want to make a video about boundaries in coaching");
    assert.equal(got.kind, "idea");
  });

  it("classifies a longer idea with bullet points as an idea with notes", () => {
    const got = classifyText([
      "Video about boundaries in coaching",
      "",
      "- Why boundaries matter",
      "- How to set them",
      "- What happens when a client pushes back",
      "- Sallie's own experience"
    ].join("\n"));
    assert.equal(got.kind, "idea-with-notes");
  });

  it("classifies a text with teleprompter lines as a script", () => {
    const got = classifyText([
      "Boundaries are one of the most important things in coaching.",
      "",
      "When a client pushes back on a boundary, it's actually a sign of trust.",
      "",
      "They're testing whether you'll hold the line."
    ].join("\n"));
    assert.equal(got.kind, "script");
  });

  it("classifies a text with shot markers as a script", () => {
    const got = classifyText([
      "SHOT 1: Medium shot at desk",
      "Boundaries are important.",
      "",
      "SHOT 2: Close-up",
      "When a client pushes back..."
    ].join("\n"));
    assert.equal(got.kind, "script");
  });

  it("classifies a text with graphic annotations as a script", () => {
    const got = classifyText([
      "Boundaries are important.",
      "[GRAPHIC: Title card saying Boundaries Matter]",
      "",
      "When a client pushes back...",
      "[ON SCREEN: Key phrase]"
    ].join("\n"));
    assert.equal(got.kind, "script");
  });

  it("classifies a text with VOICEOVER as a script", () => {
    const got = classifyText([
      "VOICEOVER:",
      "Boundaries are one of the most important things in coaching.",
      "",
      "ON SCREEN: Boundaries Matter"
    ].join("\n"));
    assert.equal(got.kind, "script");
  });

  it("returns idea for an empty or very short text", () => {
    assert.equal(classifyText("").kind, "idea");
    assert.equal(classifyText("boundaries").kind, "idea");
  });
});

// --- parseScript: a script text into lines, cues and shots ---

describe("parseScript, plain teleprompter text", () => {
  it("splits paragraphs into lines", () => {
    const got = parseScript([
      "Boundaries are one of the most important things in coaching.",
      "",
      "When a client pushes back on a boundary, it's actually a sign of trust.",
      "",
      "They're testing whether you'll hold the line."
    ].join("\n"));
    assert.deepEqual(got.lines, [
      "Boundaries are one of the most important things in coaching.",
      "When a client pushes back on a boundary, it's actually a sign of trust.",
      "They're testing whether you'll hold the line."
    ]);
    assert.deepEqual(got.cues, []);
    assert.deepEqual(got.shots, []);
  });

  it("joins consecutive non-blank lines into one paragraph", () => {
    const got = parseScript([
      "Boundaries are one of the",
      "most important things in coaching.",
      "",
      "When a client pushes back."
    ].join("\n"));
    assert.equal(got.lines.length, 2);
    assert.equal(got.lines[0], "Boundaries are one of the most important things in coaching.");
    assert.equal(got.lines[1], "When a client pushes back.");
  });

  it("trims and ignores empty lines", () => {
    const got = parseScript("\n\n  Hello world.  \n\n\n  Second line.  \n\n");
    assert.deepEqual(got.lines, ["Hello world.", "Second line."]);
  });
});

describe("parseScript, a script with graphic annotations", () => {
  it("extracts [GRAPHIC: ...] as cues and keeps the text before it as a line", () => {
    const got = parseScript([
      "Boundaries are important.",
      "[GRAPHIC: Title card saying Boundaries Matter]",
      "",
      "When a client pushes back."
    ].join("\n"));
    assert.deepEqual(got.lines, ["Boundaries are important.", "When a client pushes back."]);
    assert.equal(got.cues.length, 1);
    assert.equal(got.cues[0].show, "Title card saying Boundaries Matter");
    assert.equal(got.cues[0].kind, "graphic");
    assert.equal(got.cues[0].words, "Boundaries are important.");
  });

  it("extracts [ON SCREEN: ...] as a words cue", () => {
    const got = parseScript([
      "Boundaries are important.",
      "[ON SCREEN: Key phrase about boundaries]"
    ].join("\n"));
    assert.equal(got.cues.length, 1);
    assert.equal(got.cues[0].kind, "words");
    assert.equal(got.cues[0].show, "Key phrase about boundaries");
  });

  it("extracts [B-ROLL: ...] as a b-roll cue", () => {
    const got = parseScript([
      "She sorts through the invoices.",
      "[B-ROLL: Hands sorting papers on desk]"
    ].join("\n"));
    assert.equal(got.cues.length, 1);
    assert.equal(got.cues[0].kind, "b-roll");
    assert.equal(got.cues[0].show, "Hands sorting papers on desk");
  });

  it("extracts [SCREEN: ...] as a screen cue", () => {
    const got = parseScript([
      "Let me show you the inventory sheet.",
      "[SCREEN: Inventory spreadsheet scrolling]"
    ].join("\n"));
    assert.equal(got.cues.length, 1);
    assert.equal(got.cues[0].kind, "screen");
    assert.equal(got.cues[0].show, "Inventory spreadsheet scrolling");
  });

  it("handles multiple cues in one script", () => {
    const got = parseScript([
      "First paragraph.",
      "[GRAPHIC: Title card]",
      "",
      "Second paragraph.",
      "[ON SCREEN: Subtitle text]",
      "",
      "Third paragraph.",
      "[GRAPHIC: Closing card]"
    ].join("\n"));
    assert.equal(got.cues.length, 3);
    assert.equal(got.lines.length, 3);
  });

  it("matches annotations case-insensitively", () => {
    const got = parseScript([
      "Some words.",
      "[graphic: A chart]"
    ].join("\n"));
    assert.equal(got.cues.length, 1);
    assert.equal(got.cues[0].kind, "graphic");
  });
});

describe("parseScript, a script with shot markers", () => {
  it("extracts SHOT N: lines as shots and keeps the text under them as lines", () => {
    const got = parseScript([
      "SHOT 1: Medium shot at desk",
      "Boundaries are important.",
      "",
      "SHOT 2: Close-up",
      "When a client pushes back."
    ].join("\n"));
    assert.deepEqual(got.lines, ["Boundaries are important.", "When a client pushes back."]);
    assert.equal(got.shots.length, 2);
    assert.equal(got.shots[0].what, "Medium shot at desk");
    assert.equal(got.shots[1].what, "Close-up");
  });

  it("gives shots a kind when the description names one", () => {
    const got = parseScript([
      "SHOT 1: TALKING | Medium shot at desk",
      "Some words.",
      "",
      "SHOT 2: SCREEN | The inventory sheet",
      "More words.",
      "",
      "SHOT 3: B-ROLL | Sorting invoices",
      "Even more words."
    ].join("\n"));
    assert.equal(got.shots[0].kind, "talking");
    assert.equal(got.shots[1].kind, "screen");
    assert.equal(got.shots[2].kind, "b-roll");
  });

  it("defaults shot kind to talking when not specified", () => {
    const got = parseScript([
      "SHOT 1: At the desk, talking to camera",
      "Some words."
    ].join("\n"));
    assert.equal(got.shots[0].kind, "talking");
  });

  it("matches SHOT markers case-insensitively", () => {
    const got = parseScript([
      "Shot 1: At the desk",
      "Some words."
    ].join("\n"));
    assert.equal(got.shots.length, 1);
  });
});

describe("parseScript, a voiceover script", () => {
  it("strips VOICEOVER: markers and treats the text as lines", () => {
    const got = parseScript([
      "VOICEOVER:",
      "Boundaries are important.",
      "",
      "When a client pushes back."
    ].join("\n"));
    assert.deepEqual(got.lines, ["Boundaries are important.", "When a client pushes back."]);
    assert.deepEqual(got.shots, []);
  });

  it("extracts ON SCREEN: as a words cue when it starts a line", () => {
    const got = parseScript([
      "VOICEOVER:",
      "Boundaries are important.",
      "",
      "ON SCREEN: Boundaries Matter",
      "",
      "When a client pushes back."
    ].join("\n"));
    assert.equal(got.cues.length, 1);
    assert.equal(got.cues[0].kind, "words");
    assert.equal(got.cues[0].show, "Boundaries Matter");
    assert.deepEqual(got.lines, ["Boundaries are important.", "When a client pushes back."]);
  });
});

describe("parseScript, cue words come from the nearest line", () => {
  it("ties a cue to the line before it", () => {
    const got = parseScript([
      "First paragraph.",
      "",
      "Boundaries are important.",
      "[GRAPHIC: Title card]",
      "",
      "Third paragraph."
    ].join("\n"));
    assert.equal(got.cues[0].words, "Boundaries are important.");
  });

  it("ties a cue to the line after it when no line comes before in the same section", () => {
    const got = parseScript([
      "[GRAPHIC: Opening title card]",
      "Boundaries are important."
    ].join("\n"));
    assert.equal(got.cues[0].words, "Boundaries are important.");
  });

  it("gives a default seconds based on the cue kind", () => {
    const got = parseScript([
      "Some words.",
      "[GRAPHIC: A chart showing growth]"
    ].join("\n"));
    assert.equal(typeof got.cues[0].seconds, "number");
    assert.ok(got.cues[0].seconds >= 2 && got.cues[0].seconds <= 10);
  });
});

describe("parseScript, edge cases", () => {
  it("returns empty arrays for an empty string", () => {
    const got = parseScript("");
    assert.deepEqual(got.lines, []);
    assert.deepEqual(got.cues, []);
    assert.deepEqual(got.shots, []);
  });

  it("handles a script that is all annotations and no spoken text", () => {
    const got = parseScript([
      "[GRAPHIC: Title card]",
      "[ON SCREEN: Subtitle]"
    ].join("\n"));
    assert.equal(got.cues.length, 2);
    assert.deepEqual(got.lines, []);
  });

  it("does not treat a bracketed phrase inside a sentence as an annotation", () => {
    const got = parseScript("She said [pause] and then continued.");
    assert.deepEqual(got.cues, []);
    assert.equal(got.lines.length, 1);
  });

  it("handles a mix of shots, cues and plain text", () => {
    const got = parseScript([
      "SHOT 1: TALKING | Medium shot",
      "Boundaries are important.",
      "[GRAPHIC: Title card]",
      "",
      "SHOT 2: SCREEN | Inventory sheet",
      "Let me show you the numbers.",
      "[SCREEN: Spreadsheet view]",
      "",
      "That wraps up today's video."
    ].join("\n"));
    assert.equal(got.lines.length, 3);
    assert.equal(got.shots.length, 2);
    assert.equal(got.cues.length, 2);
  });
});

// --- toCueString and toShotString: parsed objects to pipe-delimited strings for packageOf ---

describe("toCueString, a parsed cue to a pipe-delimited string", () => {
  it("produces a cue string from a parsed cue object", () => {
    const got = toCueString({ kind: "graphic", seconds: 4, words: "Boundaries are important.", show: "Title card" });
    assert.equal(got, "graphic | 4 | Boundaries are important. | Title card");
  });

  it("handles a words cue", () => {
    const got = toCueString({ kind: "words", seconds: 3, words: "Some spoken line.", show: "Key phrase" });
    assert.equal(got, "words | 3 | Some spoken line. | Key phrase");
  });

  it("handles a cue with empty words", () => {
    const got = toCueString({ kind: "graphic", seconds: 4, words: "", show: "Opening card" });
    assert.equal(got, "graphic | 4 |  | Opening card");
  });
});

describe("toShotString, a parsed shot to a pipe-delimited string", () => {
  it("produces a shot string from a parsed shot object", () => {
    const got = toShotString({ kind: "talking", what: "Medium shot at desk" });
    assert.equal(got, "talking | Medium shot at desk");
  });

  it("handles a screen shot", () => {
    const got = toShotString({ kind: "screen", what: "Inventory spreadsheet" });
    assert.equal(got, "screen | Inventory spreadsheet");
  });
});
