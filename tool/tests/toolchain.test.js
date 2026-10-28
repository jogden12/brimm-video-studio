// What the pinned command line's folder on this Mac holds (hyperframes.js toolchainHolds and toolchainDiffers; architecture
// 2026-10-27, 5.3 and the commands table: `behind` also checks the toolchain). It reads what install.sh's toolchain_holds and
// toolchain_here read: the version installed, the integrity string npm's lock file keeps for it, and whether the program is there.
// Every folder here is in a home of the test's own (toolchain-world.js), and nothing is run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as hf from "../hyperframes.js";
import { OTHER_INTEGRITY, toolchainIn } from "./toolchain-world.js";

const { PIN, cliPath } = hf;
const NOTHING = { version: "", integrity: "", program: false };

/** Every file under `dir` with what it holds, to see that nothing was written. */
function treeOf(dir, at = dir) {
  let out = {};
  for (const entry of readdirSync(at, { withFileTypes: true })) {
    const path = join(at, entry.name);
    out = entry.isDirectory() ? { ...out, ...treeOf(dir, path) } : { ...out, [path.slice(dir.length)]: readFileSync(path, "utf8") };
  }
  return out;
}

describe("toolchainHolds: what the folder of the pinned command line holds", () => {
  it("reads the version installed, the integrity string the lock file keeps for it, and that the program is there", () => {
    const m = toolchainIn();
    assert.deepEqual(hf.toolchainHolds(m.home), { version: PIN.version, integrity: PIN.integrity, program: true });
    m.done();
  });
  it("reads whatever is there, apart: another version, another integrity string, none, no program", () => {
    for (const [what, over, expected] of [
      ["another version", { version: "0.8.207" }, { version: "0.8.207", integrity: PIN.integrity, program: true }],
      ["another integrity string", { integrity: OTHER_INTEGRITY }, { version: PIN.version, integrity: OTHER_INTEGRITY, program: true }],
      ["no integrity string in the lock file", { integrity: "" }, { version: PIN.version, integrity: "", program: true }],
      ["no lock file", { integrity: null }, { version: PIN.version, integrity: "", program: true }],
      ["no package.json", { version: null }, { version: "", integrity: PIN.integrity, program: true }],
      ["no program", { program: false }, { version: PIN.version, integrity: PIN.integrity, program: false }]
    ]) {
      const m = toolchainIn(over);
      assert.deepEqual(hf.toolchainHolds(m.home), expected, what);
      m.done();
    }
  });
  it("reads nothing of a home with no toolchain, and of a home that is not there", () => {
    const m = toolchainIn({ version: null, integrity: null, program: false });
    assert.deepEqual(hf.toolchainHolds(m.home), NOTHING);
    m.done();
    assert.deepEqual(hf.toolchainHolds(join(tmpdir(), "brimm-no-such-home", String(process.pid))), NOTHING);
  });
  it("takes a version or an integrity string only when it is shaped as one, as the installer does", () => {
    for (const version of ["0.8", "v0.8.208", "0.8.208-beta", "0.8.208 ", "", "latest", " 0.8.208", "0.8.208\n"]) {
      const m = toolchainIn({ version });
      assert.equal(hf.toolchainHolds(m.home).version, "", JSON.stringify(version));
      m.done();
    }
    for (const integrity of ["sha512-short==", `sha1-${"A".repeat(86)}==`, `sha512-${"A".repeat(86)}`, `sha512-${"A".repeat(87)}==`, `sha512-${"!".repeat(86)}==`, `${PIN.integrity}\n`]) {
      const m = toolchainIn({ integrity });
      assert.equal(hf.toolchainHolds(m.home).integrity, "", JSON.stringify(integrity));
      m.done();
    }
  });
  it("never throws: a file that is not JSON, a JSON that is not an object, a folder where a file should be, a program that is a folder", () => {
    const hyperframes = (m) => join(m.dir, "node_modules", "hyperframes");
    for (const [what, spoil, expected] of [
      ["a package.json that is not JSON", (m) => writeFileSync(join(hyperframes(m), "package.json"), "{"), { version: "", integrity: PIN.integrity, program: true }],
      ["a package.json that is null", (m) => writeFileSync(join(hyperframes(m), "package.json"), "null"), { version: "", integrity: PIN.integrity, program: true }],
      ["a package.json that is a list", (m) => writeFileSync(join(hyperframes(m), "package.json"), "[1]"), { version: "", integrity: PIN.integrity, program: true }],
      ["a package.json that is a text", (m) => writeFileSync(join(hyperframes(m), "package.json"), '"0.8.208"'), { version: "", integrity: PIN.integrity, program: true }],
      ["a lock file that is not JSON", (m) => writeFileSync(join(m.dir, "package-lock.json"), "{"), { version: PIN.version, integrity: "", program: true }],
      ["a lock file with no packages", (m) => writeFileSync(join(m.dir, "package-lock.json"), "{}"), { version: PIN.version, integrity: "", program: true }],
      ["a lock file whose packages is a number", (m) => writeFileSync(join(m.dir, "package-lock.json"), '{"packages":5}'), { version: PIN.version, integrity: "", program: true }],
      ["a lock file whose entry is a text", (m) => writeFileSync(join(m.dir, "package-lock.json"), '{"packages":{"node_modules/hyperframes":"x"}}'), { version: PIN.version, integrity: "", program: true }],
      ["a package.json that is a folder", (m) => (rmSync(join(hyperframes(m), "package.json")), mkdirSync(join(hyperframes(m), "package.json"))), { version: "", integrity: PIN.integrity, program: true }],
      ["a program that is a folder", (m) => (rmSync(cliPath(m.home)), mkdirSync(cliPath(m.home))), { version: PIN.version, integrity: PIN.integrity, program: false }]
    ]) {
      const m = toolchainIn();
      spoil(m);
      let held;
      assert.doesNotThrow(() => (held = hf.toolchainHolds(m.home)), what);
      assert.deepEqual(held, expected, what);
      m.done();
    }
  });
  it("never throws for a folder that cannot be looked into, and reads nothing of it", { skip: process.getuid && process.getuid() === 0 ? "root can look into any folder" : false }, () => {
    const m = toolchainIn();
    try {
      chmodSync(join(m.dir, "node_modules"), 0o000);
      let held;
      assert.doesNotThrow(() => (held = hf.toolchainHolds(m.home)));
      assert.deepEqual(held, { version: "", integrity: PIN.integrity, program: false });
    } finally {
      chmodSync(join(m.dir, "node_modules"), 0o755);
      m.done();
    }
  });
  it("reads nothing of a home that is not an absolute path, so that no folder of the one it runs in is read for it", () => {
    for (const home of [undefined, null, 5, {}, "", "relative/home", "."]) {
      let held;
      assert.doesNotThrow(() => (held = hf.toolchainHolds(home)), String(home));
      assert.deepEqual(held, NOTHING, String(home));
    }
  });
  it("runs nothing and writes nothing: the folder is as it was", () => {
    const m = toolchainIn();
    const before = treeOf(m.home);
    hf.toolchainHolds(m.home);
    hf.toolchainHolds(m.home);
    assert.deepEqual(treeOf(m.home), before);
    m.done();
  });
});

describe("toolchainDiffers: whether what the folder holds is the pin, and if not what it has, in the words Jason reads", () => {
  const PINNED = { version: PIN.version, integrity: PIN.integrity, program: true };
  it("is empty when the pinned version is installed, with its program and the pin's integrity string in the lock file", () => {
    assert.equal(hf.toolchainDiffers(PINNED), "");
  });
  it("says none when no version can be read, or the program is missing, whatever else is there", () => {
    for (const held of [
      NOTHING,
      { version: "", integrity: PIN.integrity, program: true },
      { ...PINNED, program: false },
      { version: "0.8.207", integrity: PIN.integrity, program: false },
      { version: PIN.version, integrity: OTHER_INTEGRITY, program: false }
    ]) assert.equal(hf.toolchainDiffers(held), "none", JSON.stringify(held));
  });
  it("says the version when it is another, before anything about the integrity string", () => {
    assert.equal(hf.toolchainDiffers({ ...PINNED, version: "0.8.207" }), "version 0.8.207");
    assert.equal(hf.toolchainDiffers({ ...PINNED, version: "0.9.0", integrity: OTHER_INTEGRITY }), "version 0.9.0");
    assert.equal(hf.toolchainDiffers({ ...PINNED, version: "0.9.0", integrity: "" }), "version 0.9.0");
  });
  it("says the pinned version is not as the pin has it when only the integrity string differs or is missing", () => {
    const words = `version ${PIN.version}, but not as the pin has it`;
    assert.equal(hf.toolchainDiffers({ ...PINNED, integrity: OTHER_INTEGRITY }), words);
    assert.equal(hf.toolchainDiffers({ ...PINNED, integrity: "" }), words);
  });
  it("takes anything that is not what toolchainHolds gives for a toolchain that is not the pin", () => {
    for (const held of [undefined, null, {}, "x", 5, { version: PIN.version }, { integrity: PIN.integrity, program: true }, { ...PINNED, program: "yes" }]) assert.notEqual(hf.toolchainDiffers(held), "", JSON.stringify(held));
  });
});
