// What the app's build vendors and the seal of the vendored folder, from tool/studio-app/vendor.js (Phase 6, Task 2).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NEEDED, PIN_NAMES, SEAL, readPins, seal, sealFault, sourceName } from "../studio-app/vendor.js";

const FILE = fileURLToPath(new URL("../studio-app/vendor.js", import.meta.url));
const PIN_FILE = fileURLToPath(new URL("../studio-app/vendor.pin.json", import.meta.url));
const SHA = "a".repeat(64);

/** A pin file's text made from `pins`, in a new folder under `root`, and its path. */
function pinFileOf(root, pins, name = "pins.json") {
  const file = join(root, name);
  writeFileSync(file, `${JSON.stringify(pins)}\n`);
  return file;
}

/** The real pins, as an object to change. */
const realPins = () => JSON.parse(readFileSync(PIN_FILE, "utf8"));

/** A sealable folder in a new temp folder: the five needed files, a link and a licence. Returns { root, folder, pinFile }. */
function sealable() {
  const root = mkdtempSync(join(tmpdir(), "studio-vendor-"));
  const folder = join(root, "vendor");
  mkdirSync(join(folder, "node", "bin"), { recursive: true });
  mkdirSync(join(folder, "licenses"));
  for (const path of NEEDED) writeFileSync(join(folder, path), `program ${path}\n`);
  symlinkSync("node", join(folder, "node", "bin", "nodejs"));
  writeFileSync(join(folder, "licenses", "ffmpeg.txt"), "A licence.\n");
  const pinFile = join(root, "vendor.pin.json");
  copyFileSync(PIN_FILE, pinFile);
  return { root, folder, pinFile };
}

describe("vendor.js", () => {
  it("the pin file holds the six pins, each whole", () => {
    const read = readPins(PIN_FILE);
    assert.equal(read.fault, undefined);
    assert.deepEqual(Object.keys(read.pins), PIN_NAMES);
    assert.deepEqual(PIN_NAMES, ["node", "ffmpeg", "x264", "pkgconf", "whisper", "cmake"]);
    const starts = { node: "d916511b", ffmpeg: "8c385028", x264: "6eeb8293", pkgconf: "3a9080ac", whisper: "ff1a9053", cmake: "4e85de4d" };
    for (const name of PIN_NAMES) {
      assert.ok(read.pins[name].sha256.startsWith(starts[name]), `${name}'s SHA-256`);
      assert.match(read.pins[name].sha256, /^[0-9a-f]{64}$/);
      assert.ok(!read.pins[name].url.includes("$"), `${name}'s address holds a $`);
      assert.ok(!read.pins[name].version.includes("$"));
    }
    assert.equal(read.pins.node.version, "26.11.1");
    assert.equal(read.pins.x264.version, "b35605ace3ddf7c1a5d67a2eb553f034aef41d55");
    assert.equal(read.pins.sparkle, undefined);
  });

  it("the source zip is named for ffmpeg's version and x264's commit", () => {
    assert.equal(sourceName(readPins(PIN_FILE).pins), "ffmpeg-9.0.2-x264-b35605a-source.zip");
  });

  it("a pin with an http address, a query, a short SHA-256 or a key too many is a fault", () => {
    const root = mkdtempSync(join(tmpdir(), "studio-vendor-"));
    try {
      const good = readPins(pinFileOf(root, realPins()));
      assert.equal(good.fault, undefined);
      const changed = (change) => {
        const pins = realPins();
        change(pins);
        return readPins(pinFileOf(root, pins));
      };
      const faults = [
        changed((pins) => { pins.node.url = pins.node.url.replace("https:", "http:"); }),
        changed((pins) => { pins.node.url += "?x=1"; }),
        changed((pins) => { pins.node.url += "#top"; }),
        changed((pins) => { pins.node.url = "https://user:pass@nodejs.org/node.tar.gz"; }),
        changed((pins) => { pins.ffmpeg.sha256 = SHA.slice(1); }),
        changed((pins) => { pins.ffmpeg.sha256 = SHA.toUpperCase(); }),
        changed((pins) => { pins.ffmpeg.version = ""; }),
        changed((pins) => { pins.ffmpeg.version = "9.0.2\n9.0.3"; }),
        changed((pins) => { pins.cmake.extra = "x"; }),
        changed((pins) => { delete pins.cmake.url; }),
        changed((pins) => { pins.sparkle = { version: "2.10.1", url: "https://example.com/s.tar.xz", sha256: SHA }; }),
        changed((pins) => { delete pins.whisper; }),
      ];
      for (const [i, read] of faults.entries()) {
        assert.equal(read.pins, undefined, `case ${i} gave pins`);
        assert.equal(typeof read.fault, "string", `case ${i} gave no fault`);
        assert.ok(read.fault.length > 0 && !read.fault.includes("\n"));
      }
      assert.equal(typeof readPins(join(root, "missing.json")).fault, "string");
      writeFileSync(join(root, "bad.json"), "{ not json");
      assert.equal(typeof readPins(join(root, "bad.json")).fault, "string");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a sealed folder checks clean", () => {
    const { root, folder, pinFile } = sealable();
    try {
      assert.equal(sealFault(folder, pinFile), "The vendored programs are not sealed: run build-vendor.sh.");
      seal(folder, pinFile);
      const manifest = JSON.parse(readFileSync(join(folder, SEAL), "utf8"));
      assert.equal(manifest.version, 1);
      assert.match(manifest.pins, /^[0-9a-f]{64}$/);
      assert.equal(manifest.files["node/bin/nodejs"], "link:node");
      assert.match(manifest.files["node/bin/node"], /^[0-9a-f]{64}$/);
      assert.ok("licenses/ffmpeg.txt" in manifest.files);
      assert.equal(Object.keys(manifest.files).length, NEEDED.length + 2);
      assert.equal(sealFault(folder, pinFile), "");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a folder sealed under other pins is refused, and so is a changed file", () => {
    const { root, folder, pinFile } = sealable();
    try {
      seal(folder, pinFile);
      writeFileSync(pinFile, `${readFileSync(pinFile, "utf8")} `);
      assert.equal(sealFault(folder, pinFile), "The vendored programs were built from other pins: run build-vendor.sh again.");

      copyFileSync(PIN_FILE, pinFile);
      seal(folder, pinFile);
      writeFileSync(join(folder, "node/bin/ffmpeg"), "program node/bin/ffmpeg!\n");
      assert.equal(sealFault(folder, pinFile), "node/bin/ffmpeg is not as it was sealed.");

      writeFileSync(join(folder, "node/bin/ffmpeg"), "program node/bin/ffmpeg\n");
      assert.equal(sealFault(folder, pinFile), "");
      writeFileSync(join(folder, "node/bin/extra"), "new\n");
      assert.equal(sealFault(folder, pinFile), "node/bin/extra is not as it was sealed.");

      rmSync(join(folder, "node/bin/extra"));
      rmSync(join(folder, "node/bin/nodejs"));
      symlinkSync("elsewhere", join(folder, "node/bin/nodejs"));
      assert.equal(sealFault(folder, pinFile), "node/bin/nodejs is not as it was sealed.");

      rmSync(join(folder, "node/bin/nodejs"));
      symlinkSync("node", join(folder, "node/bin/nodejs"));
      assert.equal(sealFault(folder, pinFile), "");
      rmSync(join(folder, "node/bin/whisper-cli"));
      assert.equal(sealFault(folder, pinFile), "node/bin/whisper-cli is missing from the vendored programs.");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("the command line lists the pins and checks a folder", () => {
    const run = (...args) => spawnSync(process.execPath, [FILE, ...args], { encoding: "utf8", timeout: 20000 });
    const listed = run("pins");
    assert.equal(listed.status, 0);
    const lines = listed.stdout.split("\n").filter(Boolean);
    assert.equal(lines.length, 6);
    for (const line of lines) assert.equal(line.split("\t").length, 5);
    const node = lines[0].split("\t");
    assert.equal(node[0], "node");
    assert.equal(node[1], "26.11.1");
    assert.equal(node[3], "node-v26.11.1-darwin-arm64.tar.gz");
    assert.equal(run("source-name").stdout, "ffmpeg-9.0.2-x264-b35605a-source.zip\n");

    const root = mkdtempSync(join(tmpdir(), "studio-vendor-"));
    try {
      const checked = run("check", root);
      assert.equal(checked.status, 1);
      assert.equal(checked.stdout, "The vendored programs are not sealed: run build-vendor.sh.\n");
      assert.equal(run("seal", root).status, 0);
      assert.equal(run("check", root).status, 1);
      assert.equal(run("nonsense").status, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
