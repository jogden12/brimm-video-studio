// Her note on this Mac, guide.json: read safely, whatever is in it, and written whole, then renamed. Each test has a home folder
// of its own, made for it and removed after: nothing here touches this Mac's own Application Support.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { guideFile, readGuideNotes, writeGuideNotes } from "../guide-note.js";

const EMPTY = { version: 1, handoffs: {}, finished: {} };
const NOTE = { kind: "episode", step: "kit", revision: 2, at: "2026-10-25T12:00:00-05:00" };
const home = () => mkdtempSync(join(tmpdir(), "brimm-guide-"));

describe("her note on this Mac", () => {
  it("is guide.json in Application Support", () => {
    assert.equal(guideFile("/h"), "/h/Library/Application Support/BRIMM Video/guide.json");
  });
  it("reads as no note when it is missing, not JSON, or not a note", () => {
    const h = home();
    assert.deepEqual(readGuideNotes(h), EMPTY);
    mkdirSync(dirname(guideFile(h)), { recursive: true });
    for (const text of ["{ half", "[]", "null", JSON.stringify({ version: 2, handoffs: { "e-20261020-3fa9c1": NOTE }, finished: {} })]) {
      writeFileSync(guideFile(h), text);
      assert.deepEqual(readGuideNotes(h), EMPTY, text);
    }
    rmSync(h, { recursive: true, force: true });
  });
  it("keeps only the entries shaped as a note", () => {
    const h = home();
    mkdirSync(dirname(guideFile(h)), { recursive: true });
    writeFileSync(guideFile(h), JSON.stringify({ version: 1, handoffs: { "e-20261020-3fa9c1": NOTE, "e-20261020-aaaaaa": { ...NOTE, kind: "reel" }, "e-20261020-bbbbbb": { ...NOTE, step: "lunch" }, "e-20261020-cccccc": { ...NOTE, revision: 0 }, "not an id": NOTE }, finished: { "e-20261020-dddddd": "2026-10-25T12:00:00-05:00", "e-20261020-eeeeee": 7 } }));
    assert.deepEqual(readGuideNotes(h), { version: 1, handoffs: { "e-20261020-3fa9c1": NOTE }, finished: { "e-20261020-dddddd": "2026-10-25T12:00:00-05:00" } });
    rmSync(h, { recursive: true, force: true });
  });
  it("is written whole, then renamed, making its folder, and read back as written", () => {
    const h = home();
    const notes = { version: 1, handoffs: { "e-20261020-3fa9c1": NOTE }, finished: {} };
    writeGuideNotes(h, notes);
    assert.deepEqual(readGuideNotes(h), notes);
    writeGuideNotes(h, EMPTY);
    assert.deepEqual(readGuideNotes(h), EMPTY);
    assert.deepEqual(readdirSync(dirname(guideFile(h))), ["guide.json"]);
    rmSync(h, { recursive: true, force: true });
  });
  it("throws when it cannot be written, and leaves nothing half-written", () => {
    const h = home();
    mkdirSync(guideFile(h), { recursive: true });
    writeFileSync(join(guideFile(h), "x"), "");
    assert.throws(() => writeGuideNotes(h, EMPTY), (e) => typeof e.code === "string");
    assert.ok(!existsSync(`${guideFile(h)}.writing`));
    rmSync(h, { recursive: true, force: true });
  });
});
