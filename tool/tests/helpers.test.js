// Where a helper is (helpers.js): the one place that knows. A helper is compiled as brimm-<name> beside the node that runs
// Studio, or run by swift from its .swift file when there is no compiled one and swift is given. The folder and the "does it
// exist" check are stand-ins here. Nothing here starts a program, and nothing compiles or runs swift.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELPERS, ownBin, helperSource, compiledHelper, helperCommand } from "../helpers.js";

const TOOL = dirname(dirname(fileURLToPath(import.meta.url)));
const BIN = "/app/BRIMM Video Studio/bin";
describe("where a helper is", () => {
  it("is one of five, each named for its Swift file beside the tool", () => {
    assert.deepEqual(HELPERS, ["faces", "progress", "uploaded", "online-only", "read-through"]);
    for (const name of ["faces", "progress", "uploaded", "online-only"]) {
      assert.ok(helperSource(name).endsWith(`/tool/${name}.swift`), name);
      assert.ok(existsSync(helperSource(name)), name);
    }
  });
  it("has one helper for each .swift file beside the tool", () => {
    assert.deepEqual(readdirSync(TOOL).filter((n) => n.endsWith(".swift")).map((n) => n.slice(0, -".swift".length)).sort(), [...HELPERS].sort());
  });
  it("is brimm-<name> in node's own folder, when it is there", () => {
    const there = (p) => p === `${BIN}/brimm-online-only`;
    assert.deepEqual(compiledHelper("online-only", { bin: BIN, exists: there }), { program: `${BIN}/brimm-online-only`, args: [] });
    assert.equal(compiledHelper("faces", { bin: BIN, exists: there }), null);
  });
  it("is looked for beside the node that runs Studio unless a folder is given", () => {
    const looked = [];
    compiledHelper("uploaded", { exists: (p) => (looked.push(p), false) });
    assert.equal(ownBin(), dirname(process.execPath));
    assert.deepEqual(looked, [join(dirname(process.execPath), "brimm-uploaded")]);
  });
  it("is the compiled one before swift, swift with its source only when there is none, and none without either", () => {
    const all = () => true;
    const none = () => false;
    assert.deepEqual(helperCommand("progress", { swift: "/usr/bin/swift", bin: BIN, exists: all }), { program: `${BIN}/brimm-progress`, args: [] });
    assert.deepEqual(helperCommand("progress", { swift: "/usr/bin/swift", bin: BIN, exists: none }), { program: "/usr/bin/swift", args: [helperSource("progress")] });
    assert.equal(helperCommand("progress", { swift: "", bin: BIN, exists: none }), null);
    assert.deepEqual(helperCommand("faces", { swift: "", bin: BIN, exists: all }), { program: `${BIN}/brimm-faces`, args: [] });
  });
  it("is never a helper it does not know, however it is spelled", () => {
    for (const name of ["online_only", "brimm-faces", "faces.swift", ""]) {
      assert.throws(() => helperCommand(name, { exists: () => true }), { message: `There is no helper named ${name}.` });
    }
  });
});
