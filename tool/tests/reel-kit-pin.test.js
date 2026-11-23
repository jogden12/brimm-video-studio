// Reel Kit's pin and where Reel Kit lives on a Mac (reel-kit.js; spec 2026-11-23 Reel Kit in Studio, sections 1 and 2; plan Task 1).
// The module only reads: its own pin file, and the folders folderFingerprint is given. The folders here are made up, in a temp
// folder; the real pin's values were read from the 1.2.0 download and the registries (by-hand check RK1), not here.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PIN, pinFrom, kitDir, reelKitHome, binDir, venvPython, hfDir, hfCli, REQUIRED_PATHS, folderFingerprint } from "../reel-kit.js";
import { PIN as HF_PIN } from "../hyperframes.js";

const hex = (c) => c.repeat(64);
/** A pin of the right shape, with made-up values. */
const good = () => ({
  version: "1.2.0",
  fingerprint: `sha256-${hex("a")}`,
  required: ["SKILL.md", "VERSION", "LICENSE", "pipeline/", "setup/", "kit/", "fx/LIBRARY.md", "cards/LIBRARY.md"],
  hyperframes: { version: "0.8.139", integrity: `sha512-${"A".repeat(86)}==` },
  gsap: { version: "3.15.0", url: "https://cdn.example/gsap.min.js", sha256: hex("b") },
  uv: { version: "0.12.8", url: "https://example/uv.tar.gz", sha256: hex("c") },
  python: "3.12.9",
  locks: { main: { file: "reel-kit/requirements-1.2.0.lock", sha256: hex("0") }, mp: { file: "reel-kit/requirements-mp-1.2.0.lock", sha256: hex("0") } },
  models: [{ name: "m.onnx", bytes: 10, url: "https://example/m.onnx", sha256: hex("d") }],
  whisper: { repo: "Systran/faster-whisper-medium", revision: "1".repeat(40), files: [{ path: "model.bin", sha256: hex("e") }] },
  ffmpeg: { version: "9.0.2", ffmpeg: { url: "https://example/ffmpeg.zip", sha256: hex("f") }, ffprobe: { url: "https://example/ffprobe.zip", sha256: hex("9") } },
});
const refused = (pin, why) => assert.throws(() => pinFrom(JSON.stringify(pin)), /reel-kit\.pin\.json/, why ?? JSON.stringify(pin));

const scratch = mkdtempSync(join(tmpdir(), "reel-kit-pin-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let made = 0;
/** A made-up folder holding `files` ({ relative path: text }), written in the order given. */
function folder(files) {
  const dir = join(scratch, `f${made++}`);
  mkdirSync(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

describe("the pin", () => {
  it("takes a pin of the right shape, frozen all the way down", () => {
    const pin = pinFrom(JSON.stringify(good()));
    assert.deepEqual(pin, good());
    assert.ok(Object.isFrozen(pin) && Object.isFrozen(pin.models[0]) && Object.isFrozen(pin.locks.main) && Object.isFrozen(pin.required));
  });

  it("refuses a pin whose version is not x.y.z or whose fingerprint is not sha256-<64 hex>", () => {
    for (const version of ["latest", "1.2", "../../x", "1.2.0 ", 120, ""]) refused({ ...good(), version });
    for (const fingerprint of [hex("a"), `sha256-${"a".repeat(63)}`, `sha256-${hex("A")}`, `sha512-${hex("a")}`, `sha256-${hex("a")}\n`, null]) refused({ ...good(), fingerprint });
    for (const bad of [null, [], "1.2.0", 5]) refused(bad);
    assert.throws(() => pinFrom("{"), SyntaxError);
  });

  it("refuses a pin missing any of the keys above, or any model without url and sha256", () => {
    for (const key of Object.keys(good())) {
      const pin = good();
      delete pin[key];
      refused(pin, `without ${key}`);
    }
    const withModel = (change) => ({ ...good(), models: [{ ...good().models[0], ...change }] });
    for (const change of [{ url: undefined }, { sha256: undefined }, { sha256: "abc" }, { url: "http://example/m" }, { url: "" }, { name: "../m" }, { name: "" }, { bytes: 0 }, { bytes: 1.5 }]) refused(withModel(change));
    refused({ ...good(), models: [] });
    const at = (key, value) => ({ ...good(), [key]: value });
    refused(at("required", []));
    refused(at("required", ["/abs"]));
    refused(at("required", ["a/../b"]));
    refused(at("hyperframes", { version: "0.8.139", integrity: "sha512-abc" }));
    refused(at("hyperframes", { integrity: good().hyperframes.integrity }));
    refused(at("gsap", { ...good().gsap, sha256: undefined }));
    refused(at("uv", { ...good().uv, url: undefined }));
    refused(at("python", "3.12"));
    refused(at("python", "3.13.1"));
    refused(at("locks", { main: good().locks.main }));
    refused(at("locks", { ...good().locks, mp: { file: "/abs.lock", sha256: hex("0") } }));
    refused(at("locks", { ...good().locks, mp: { file: "x.lock", sha256: "0" } }));
    refused(at("whisper", { ...good().whisper, revision: "main" }));
    refused(at("whisper", { ...good().whisper, files: [] }));
    refused(at("whisper", { ...good().whisper, files: [{ path: "model.bin" }] }));
    refused(at("whisper", { ...good().whisper, repo: "../x" }));
    refused(at("ffmpeg", { ...good().ffmpeg, ffprobe: undefined }));
    refused(at("ffmpeg", { ...good().ffmpeg, ffmpeg: { url: "https://example/ffmpeg.zip" } }));
  });

  it("holds Reel Kit 1.2.0, its four models and the files it relies on", () => {
    assert.equal(PIN.version, "1.2.0");
    assert.deepEqual(PIN.models.map((m) => m.name), ["depth_anything_v2_small.onnx", "face_landmarker.task", "hand_landmarker.task", "pose_landmarker_full.task"]);
    assert.deepEqual(REQUIRED_PATHS, ["SKILL.md", "VERSION", "LICENSE", "pipeline/", "setup/", "kit/", "fx/LIBRARY.md", "cards/LIBRARY.md"]);
    assert.equal(REQUIRED_PATHS, PIN.required);
    assert.deepEqual([PIN.gsap.version, PIN.uv.version, PIN.ffmpeg.version, PIN.whisper.repo], ["3.15.0", "0.12.8", "9.0.2", "Systran/faster-whisper-medium"]);
    assert.match(PIN.python, /^3\.12\.\d+$/);
  });

  it("names no local path or Dropbox folder in the committed pin", () => {
    const text = readFileSync(new URL("../reel-kit.pin.json", import.meta.url), "utf8");
    assert.doesNotMatch(text, /\/Users\/|Dropbox|CloudStorage|~\//);
  });

  it("pins Reel Kit's own HyperFrames, not Studio's", () => assert.notEqual(PIN.hyperframes.version, HF_PIN.version));
});

describe("where Reel Kit lives", () => {
  it("keeps the toolchain and REEL_KIT_HOME in BRIMM Video Work, never ~/reel-kit", () => {
    assert.equal(kitDir("/h"), "/h/BRIMM Video Work/.toolchain/reel-kit-1.2.0");
    assert.equal(kitDir("/h", "1.3.0"), "/h/BRIMM Video Work/.toolchain/reel-kit-1.3.0");
    assert.equal(reelKitHome("/h"), "/h/BRIMM Video Work/.reel-kit");
    assert.equal(binDir("/h"), "/h/BRIMM Video Work/.reel-kit/tools/bin");
    assert.equal(venvPython("/h"), "/h/BRIMM Video Work/.reel-kit/.venv/bin/python");
    assert.equal(hfDir("/h"), "/h/BRIMM Video Work/.toolchain/hyperframes-0.8.139");
    assert.equal(hfCli("/h"), "/h/BRIMM Video Work/.toolchain/hyperframes-0.8.139/node_modules/hyperframes/bin/hyperframes.mjs");
  });
});

describe("the folder's fingerprint", () => {
  const files = { "SKILL.md": "skill", "VERSION": "1.2.0\n", "pipeline/common.py": "x = 1\n", "fx/a/b.html": "<b>", "Zeta.txt": "z", "é.txt": "e" };

  it("is sha256- and the SHA-256 of the sorted manifest", async () => {
    const { createHash } = await import("node:crypto");
    const sha = (text) => createHash("sha256").update(text).digest("hex");
    const one = folder({ "b.txt": "B", "a/c.txt": "C" });
    const manifest = `${sha("C")}  a/c.txt\n${sha("B")}  b.txt\n`;
    assert.equal(folderFingerprint(one), `sha256-${sha(manifest)}`);
  });

  it("gives the same fingerprint whatever order the files were written in", () => {
    const forward = folder(files);
    const backward = folder(Object.fromEntries(Object.entries(files).reverse()));
    assert.match(folderFingerprint(forward), /^sha256-[0-9a-f]{64}$/);
    assert.equal(folderFingerprint(forward), folderFingerprint(backward));
  });

  it("reads a name the same whether it was written composed or decomposed", () => {
    assert.equal(folderFingerprint(folder({ "café.txt": "x" })), folderFingerprint(folder({ "café.txt": "x" })));
  });

  it("leaves out .DS_Store and ._ files, and counts every other file", () => {
    const plain = folderFingerprint(folder(files));
    assert.equal(folderFingerprint(folder({ ...files, ".DS_Store": "junk", "fx/.DS_Store": "junk", "._SKILL.md": "fork", "fx/a/._b.html": "fork" })), plain);
    assert.notEqual(folderFingerprint(folder({ ...files, ".hidden": "" })), plain);
    assert.notEqual(folderFingerprint(folder({ ...files, "empty.txt": "" })), plain);
    const less = { ...files };
    delete less["fx/a/b.html"];
    assert.notEqual(folderFingerprint(folder(less)), plain);
  });

  it("changes the fingerprint when one byte of one file changes", () => {
    assert.notEqual(folderFingerprint(folder(files)), folderFingerprint(folder({ ...files, "pipeline/common.py": "x = 2\n" })));
  });

  it("changes the fingerprint when a file moves", () => {
    const moved = { ...files, "fx/b.html": files["fx/a/b.html"] };
    delete moved["fx/a/b.html"];
    assert.notEqual(folderFingerprint(folder(files)), folderFingerprint(folder(moved)));
  });

  it("refuses a folder with a link in it", () => {
    const toFile = folder(files);
    symlinkSync(join(toFile, "SKILL.md"), join(toFile, "fx", "link.md"));
    assert.throws(() => folderFingerprint(toFile), /link/);
    const toFolder = folder(files);
    symlinkSync(join(toFolder, "fx"), join(toFolder, "pipeline", "fx"));
    assert.throws(() => folderFingerprint(toFolder), /link/);
    const dangling = folder(files);
    symlinkSync(join(dangling, "nowhere"), join(dangling, "gone"));
    assert.throws(() => folderFingerprint(dangling), /link/);
  });
});
