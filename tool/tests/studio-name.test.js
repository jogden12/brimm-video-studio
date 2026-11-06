// One name for the tool on every Studio screen: "BRIMM Video Studio". This walks the strings the tool's source holds (not its
// comments) and the words of the chat's skill files, and fails if one still names the tool "brimm-video", "BRIMM video" or
// "unedited video". What stays under the old name is in ALLOWED, each with its reason: ids that records and files on disk
// carry, and the hand-off's `madeBy` and format, which the contract with BRIMM Ops names (those files are not walked at all).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STUDIO_NAME } from "../name.js";
import { dialogScript } from "../dialog.js";
import { bannerArgs } from "../unedited.js";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD = /brimm-video|BRIMM video|unedited video/;

/** The strings of a JavaScript source: its string literals and the text of its template literals, not its comments, with the
    line each starts on. Regular expressions are skipped as code. A small reader, enough for this project's own style. */
export function stringsOf(src) {
  const out = [];
  let i = 0;
  let line = 1;
  const stack = []; // the open ${ of a template: the braces counted inside it
  let depth = 0;
  let last = ""; // the last significant character of code, to tell a regular expression from a division
  const regexOk = () => last === "" || "(,=:[!&|?{};+-*%<>~^".includes(last);
  const template = (resumed) => {
    let text = "";
    const from = line;
    if (!resumed) i++;
    const at = i;
    while (i < src.length) {
      const c = src[i];
      if (c === "\\") { text += src[i] + (src[i + 1] ?? ""); if (src[i + 1] === "\n") line++; i += 2; continue; }
      if (c === "`") { i++; out.push({ text, line: from, at }); last = "`"; return; }
      if (c === "$" && src[i + 1] === "{") { i += 2; out.push({ text, line: from, at }); stack.push(depth); depth = 0; last = "{"; return; }
      if (c === "\n") line++;
      text += c; i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (const ch of src.slice(i, stop)) if (ch === "\n") line++;
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      let text = "";
      const from = line;
      i++;
      const at = i;
      while (i < src.length && src[i] !== c && src[i] !== "\n") { if (src[i] === "\\") { text += src[i] + (src[i + 1] ?? ""); i += 2; } else text += src[i++]; }
      i++;
      out.push({ text, line: from, at });
      last = c;
      continue;
    }
    if (c === "`") { template(); continue; }
    if (c === "{") { depth++; last = c; i++; continue; }
    if (c === "}") {
      if (stack.length && depth === 0) { depth = stack.pop(); i++; template(true); continue; }
      depth--; last = c; i++; continue;
    }
    if (c === "/" && regexOk()) {
      i++;
      let inClass = false;
      while (i < src.length && src[i] !== "\n" && (inClass || src[i] !== "/")) { if (src[i] === "\\") i++; else if (src[i] === "[") inClass = true; else if (src[i] === "]") inClass = false; i++; }
      i++;
      last = "/";
      continue;
    }
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return out;
}

/** What may still hold an old name, in the file it is in: the whole string (`exact`) or a part of it (`has`), and why. */
const ALLOWED = [
  { file: "episode.js", exact: "not for brimm-video", why: "the answer state a record stores for a video she left alone: an id on disk, read by every Mac and by BRIMM Ops" },
  { file: "gate.js", exact: "not for brimm-video", why: "the same stored answer state, compared with" },
  { file: "edit.js", exact: "not for brimm-video", why: "the same stored answer state" },
  { file: "finish.js", has: "brimm-video reels", why: "the format id of reels.json, a file on disk older Macs read" },
  { file: "reels.js", has: "brimm-video reels", why: "the format id of reels.json, a file on disk older Macs read" },
  { file: "teachings.js", has: "brimm-video teachings", why: "the format id of a session's teachings file on disk" },
  { file: "detached.js", has: "brimm-video.log", why: "the tool's log file name, as the launch agent writes it" },
  { file: "places.js", has: "brimm-video.log", why: "the tool's log file name" },
  { file: "places.js", has: "brimm-video-claude-check.log", why: "the check's log file name" },
  { file: "edit.js", has: "brimm-video.log", why: "the tool's log file name" }
];

// The contract with BRIMM Ops (the hand-off files and their `madeBy`) and the copies from brimm-operations: not walked.
const SKIPPED = new Set(["lib.js", "run.js", "handoff.js", "handoff-v2.js"]);

function sources() {
  const files = [];
  for (const name of readdirSync(TOOL)) if (name.endsWith(".js") && !SKIPPED.has(name)) files.push(name);
  for (const name of readdirSync(join(TOOL, "studio"))) if (/\.(mjs|md|sh)$/.test(name)) files.push(join("studio", name));
  return files;
}

const allowed = (file, text) => ALLOWED.some((a) => file === a.file && (a.exact ? text === a.exact : text.includes(a.has) && !OLD.test(text.split(a.has).join(""))));

describe("the name on every screen", () => {
  it("is BRIMM Video Studio, one constant", () => {
    assert.equal(STUDIO_NAME, "BRIMM Video Studio");
  });

  it("titles the dialog, the notice and the progress panel", () => {
    assert.match(dialogScript("Clear it?", { buttons: ["Cancel", "Clear it"] }), /with title "BRIMM Video Studio" with icon caution$/);
    const args = bannerArgs("It is ready");
    assert.match(args[1], /with title "BRIMM Video Studio"$/);
    assert.match(readFileSync(join(TOOL, "progress.swift"), "utf8"), /window\.title = "BRIMM Video Studio"/);
  });

  it("is what the chat's skill tells her when Jason has a newer one", () => {
    for (const file of ["SKILL.md", "SKILL-open.md"]) {
      assert.ok(readFileSync(join(TOOL, "studio", file), "utf8").includes("Jason has a newer BRIMM Video Studio; ask him to update this Mac when it suits."), file);
    }
  });

  it("is the only name in the strings the tool prints and the chat's files", () => {
    const found = [];
    for (const file of sources()) {
      const text = readFileSync(join(TOOL, file), "utf8");
      const pieces = /\.m?js$/.test(file) ? stringsOf(text) : text.split("\n").map((t, n) => ({ text: t, line: n + 1 }));
      for (const piece of pieces) if (OLD.test(piece.text) && !allowed(file, piece.text)) found.push(`${file}:${piece.line}: ${piece.text.slice(0, 110)}`);
    }
    assert.deepEqual(found, []);
  });

  it("has an allow-list that is all still in use", () => {
    for (const a of ALLOWED) assert.ok(stringsOf(readFileSync(join(TOOL, a.file), "utf8")).some((s) => (a.exact ? s.text === a.exact : s.text.includes(a.has))), `${a.file} no longer holds ${a.exact || a.has}`);
  });

  it("reads this project's own sources to the end (the string reader is sound)", () => {
    const sample = "const a = `x ${ {b: '}'}.b } y`; // c\nconst d = /a'b/.test(\"e\");\n";
    assert.deepEqual(stringsOf(sample).map((s) => s.text), ["x ", "}", " y", "e"]);
  });
});
