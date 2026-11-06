// Studio retired Final Cut (Phase 2). This walks the strings the tool's source holds (not its comments) and the words of the chat's
// skill files the way studio-name.test.js does, and fails if one a person can be shown still names Final Cut, "Share it" (its
// export step), "push" as a command or "fcpxml". What stays is in ALLOWED, each with its reason; nothing is added to make this pass.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stringsOf } from "./studio-name.test.js";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..");
const GONE = /final cut|share it|fcpxml|\bpush(?:ed|es|ing)?\b/i;
const GUIDE_LINE = `It was edited in Final Cut before. Studio doesn't use Final Cut now: say "open it in HyperFrames" to edit it there, from the recording.`;

/** What may still say it, in the file it is in: the whole string (`exact`) or a part of it (`has`), and why. None is a word she is shown. */
const ALLOWED = [
  { file: "guide.js", has: GUIDE_LINE, why: "F6's one line for an episode edited in Final Cut before: the guide's word, and the one place she is told" },
  { file: "cuts.js", exact: ".fcpxml", why: "the file ending an earlier import's outputs had; unedited.js still clears it when it redoes a video. A path, never printed" },
  { file: "names.js", has: ".fcpxml", why: "where an old record's timeline file sits in the episode's folder (edit.js reads it to tell an old import); a path, never printed" },
  { file: "edit.js", exact: "pushed", why: "the record field of an old Final Cut timeline, left out of the compare of two copies of a record (twice); a field name, never printed" },
  { file: "episode.js", exact: "push", why: "the stored `how` of an old version in a record, read as before; a stored value, never printed" },
  { file: "places.js", exact: "Final Cut Backups", why: "ruling 3: her folder keeps its deny entry for Final Cut's backups; a path in the settings file, not said to her (twice)" }
];

function sources() {
  const files = [];
  for (const name of readdirSync(TOOL)) if (name.endsWith(".js")) files.push(name);
  for (const name of readdirSync(join(TOOL, "studio"))) if (/\.md$/.test(name)) files.push(join("studio", name));
  return files;
}

const plain = (text) => text.replaceAll("\\'", "'");
const holds = (a, text) => (a.exact ? text === a.exact : plain(text).includes(a.has) && !GONE.test(plain(text).split(a.has).join("")));
const allowed = (file, text) => ALLOWED.some((a) => file.endsWith(a.file) && holds(a, text));
const pathOf = (file) => (file.endsWith(".md") ? join("studio", file) : file);

describe("Final Cut is not in the words she can be shown", () => {
  it("is in no string the tool prints and no line of the chat's files, but the one line for an old episode", () => {
    const found = [];
    for (const file of sources()) {
      const text = readFileSync(join(TOOL, file), "utf8");
      const pieces = file.endsWith(".js") ? stringsOf(text) : text.split("\n").map((t, n) => ({ text: t, line: n + 1 }));
      for (const piece of pieces) if (GONE.test(piece.text) && !allowed(file, piece.text)) found.push(`${file}:${piece.line}: ${piece.text.slice(0, 110)}`);
    }
    assert.deepEqual(found, []);
  });

  it("has an allow-list that is all still in use", () => {
    for (const a of ALLOWED) {
      const text = readFileSync(join(TOOL, pathOf(a.file)), "utf8");
      const pieces = a.file.endsWith(".js") ? stringsOf(text).map((s) => s.text) : text.split("\n");
      assert.ok(pieces.some((s) => (a.exact ? s === a.exact : plain(s).includes(a.has))), `${a.file} no longer holds: ${a.why}`);
    }
  });
});
