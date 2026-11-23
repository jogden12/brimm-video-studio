// Reel Kit 1.2.0's Python packages, locked by hash (plan Task 2). Reads the committed lock files only; no test runs uv.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PIN } from "../reel-kit.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (key) => readFileSync(join(here, "..", PIN.locks[key].file));
/** The package entries of a lock file: [{ name, version, hashes }]. */
function entries(text) {
  const out = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const m = /^([A-Za-z0-9_.-]+)==([^\s\;]+)/.exec(line);
    if (m) { cur = { name: m[1].toLowerCase().replace(/[_.]/g, "-"), version: m[2], hashes: 0 }; out.push(cur); }
    if (cur && /--hash=sha256:[0-9a-f]{64}/.test(line)) cur.hashes++;
  }
  return out;
}

describe("Reel Kit's Python lock files", () => {
  it("locks every package of 1.2.0's requirements.txt by an exact version", () => {
    const names = entries(read("main").toString()).map((e) => e.name);
    for (const n of ["numpy", "scipy", "pillow", "faster-whisper", "yt-dlp", "opencv-python-headless", "onnxruntime", "fonttools", "pymunk"]) assert.ok(names.includes(n), `${n} is locked`);
  });
  it("gives every package line at least one --hash=sha256:", () => {
    for (const key of ["main", "mp"]) {
      const list = entries(read(key).toString());
      assert.ok(list.length > 0, `${key} has packages`);
      for (const e of list) assert.ok(e.hashes >= 1, `${key}: ${e.name} has a hash`);
    }
  });
  it("locks mediapipe==1.2.2 in the mp lock", () => {
    const e = entries(read("mp").toString()).find((x) => x.name === "mediapipe");
    assert.equal(e?.version, "1.2.2");
  });
  it("carries no local path and no uv command line", () => {
    for (const key of ["main", "mp"]) assert.doesNotMatch(read(key).toString(), /\/Users\/|Dropbox|uv pip compile/);
  });
  it("matches the pin's sha256 for each lock file", () => {
    for (const key of ["main", "mp"]) assert.equal(createHash("sha256").update(read(key)).digest("hex"), PIN.locks[key].sha256, key);
  });
});
