// What the app's build vendors and the seal of the vendored folder, from tool/studio-app/vendor.js (Phase 6, Task 2).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NEEDED, PIN_NAMES, SEAL, readPins, seal, sealFault, sourceName } from "../studio-app/vendor.js";

const FILE = fileURLToPath(new URL("../studio-app/vendor.js", import.meta.url));
const PIN_FILE = fileURLToPath(new URL("../studio-app/vendor.pin.json", import.meta.url));
const SHA = "a".repeat(64);
const STUDIO_APP = fileURLToPath(new URL("../studio-app/", import.meta.url));
const IS_MAIN = fileURLToPath(new URL("../is-main.js", import.meta.url));
const notAMac = process.platform !== "darwin" || !existsSync("/bin/zsh") ? "the vendor build runs on a Mac, which has zsh and plutil" : false;

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

const WATCHED_SENTENCE = "That folder is watched or is in Dropbox, and a build never writes there.";

/** A world for one test: a temporary folder with a copy of tool/studio-app/ (and the one file it imports) whose pin file the test may
    rewrite, a temporary HOME, `bin/` holding a stand-in curl that records its arguments into `ran` and copies
    $FAKE_DOWNLOADS/<the address's last part> to the file after --output, and `fake/` for the stand-in's downloads. The stand-in is
    first on PATH and the folder of this test's own node is last. Gives back `build(...args)` and the pieces a test looks at. */
function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "studio-vendor-build-")));
  const home = join(root, "home");
  const bin = join(root, "bin");
  const fake = join(root, "fake");
  const copy = join(root, "tool", "studio-app");
  for (const dir of [home, bin, fake]) mkdirSync(dir);
  cpSync(STUDIO_APP, copy, { recursive: true });
  copyFileSync(IS_MAIN, join(root, "tool", "is-main.js"));
  const ran = join(root, "ran");
  writeFileSync(ran, "");
  writeFileSync(
    join(bin, "curl"),
    `#!/bin/sh
echo "curl $*" >> "$RAN"
out=
last=
while [ $# -gt 0 ]; do
  if [ "$1" = "--output" ]; then out=$2; fi
  last=$1
  shift
done
cp "$FAKE_DOWNLOADS/\${last##*/}" "$out"
`,
  );
  chmodSync(join(bin, "curl"), 0o755);
  const env = {
    HOME: home,
    RAN: ran,
    FAKE_DOWNLOADS: fake,
    PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin:${dirname(process.execPath)}`,
  };
  const pinFile = join(copy, "vendor.pin.json");
  /** Puts fake downloads in place for every pin, and writes the pin file to match their bytes (or, for `wrong`, a pin that does not). */
  const stage = (wrong = "") => {
    const pins = JSON.parse(readFileSync(pinFile, "utf8"));
    for (const name of PIN_NAMES) {
      const file = pins[name].url.split("/").pop();
      const bytes = `the fake bytes of ${name}\n`;
      writeFileSync(join(fake, file), bytes);
      pins[name].sha256 = name === wrong ? SHA : createHash("sha256").update(bytes).digest("hex");
    }
    writeFileSync(pinFile, `${JSON.stringify(pins, null, 2)}\n`);
    return pins;
  };
  const build = (...args) => spawnSync("/bin/zsh", [join(copy, "build-vendor.sh"), ...args], { encoding: "utf8", env, cwd: root, timeout: 60000 });
  return { root, home, ran, fake, copy, pinFile, stage, build, ranText: () => readFileSync(ran, "utf8"), out: join(root, "out") };
}

describe("build-vendor.sh", { skip: notAMac }, () => {
  it("--print fetches nothing and makes no folder", () => {
    const w = world();
    try {
      const printed = w.build("--out", w.out, "--print");
      assert.equal(printed.status, 0, printed.stderr);
      assert.equal(existsSync(w.out), false);
      assert.doesNotMatch(w.ranText(), /curl/);
      for (const name of PIN_NAMES) assert.match(printed.stdout, new RegExp(`${name} .*https://`), `${name} is named with its address`);
      assert.match(printed.stdout, /Nothing was changed/);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("an unknown option, no --out, or a folder with a space ends with 2", () => {
    const w = world();
    try {
      const space = join(w.root, "a folder");
      for (const args of [["--out", w.out, "--bogus"], ["--print"], ["--out"], ["--out", w.out, "--print", "--fetch"], ["--out", space, "--print"], ["--out", space]]) {
        const made = w.build(...args);
        assert.equal(made.status, 2, `${args.join(" ")}: ${made.stdout}${made.stderr}`);
        assert.equal(`${made.stdout}${made.stderr}`.trim().split("\n").length, 1, `${args.join(" ")} says one line`);
      }
      assert.match(w.build("--out", space, "--print").stdout, /configure cannot take a path with a space: pick a folder without one\.$/m);
      assert.equal(existsSync(space), false);
      assert.equal(existsSync(w.out), false);
      assert.doesNotMatch(w.ranText(), /curl/);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("a folder the launch agent watches, the drop folder or Dropbox is refused", () => {
    const w = world();
    try {
      const watched = join(w.root, "watched");
      mkdirSync(watched);
      mkdirSync(join(w.home, "Library", "LaunchAgents"), { recursive: true });
      writeFileSync(
        join(w.home, "Library", "LaunchAgents", "com.thebrimm.unedited.plist"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.thebrimm.unedited</string><key>WatchPaths</key><array><string>${watched}</string></array></dict></plist>\n`,
      );
      const drop = join(w.home, "BRIMM Video Work", "Drop");
      mkdirSync(drop, { recursive: true });
      symlinkSync(drop, join(w.home, "BRIMM-Drop-link"));
      mkdirSync(join(w.home, "Dropbox"));
      mkdirSync(join(w.home, "Library", "CloudStorage"));
      const targets = [
        join(watched, "x"),
        join(w.home, "Dropbox", "x"),
        join(w.home, "Library", "CloudStorage", "x"),
        join(w.home, "BRIMM-Drop-link", "x"),
        join(w.home, "DROPBOX-Work", "x"),
        join(w.home, "dropbox", "x"),
      ];
      for (const target of targets) {
        for (const mode of ["--print", "--fetch"]) {
          const made = w.build("--out", target, mode);
          assert.equal(made.status, 1, `${target} ${mode}: ${made.stdout}${made.stderr}`);
          assert.equal(made.stdout.trim(), WATCHED_SENTENCE);
        }
        assert.equal(existsSync(target), false, `${target} was made`);
      }
      assert.deepEqual(readdirSync(drop), []);
      assert.doesNotMatch(w.ranText(), /curl/);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("--fetch keeps a download whose SHA-256 is the pin's", () => {
    const w = world();
    try {
      const pins = w.stage();
      const made = w.build("--out", w.out, "--fetch");
      assert.equal(made.status, 0, `${made.stdout}${made.stderr}`);
      const files = readdirSync(join(w.out, "downloads")).sort();
      assert.deepEqual(files, PIN_NAMES.map((name) => pins[name].url.split("/").pop()).sort());
      assert.equal(existsSync(join(w.out, "build")), false);
      assert.equal(existsSync(join(w.out, "vendor")), false);
      const lines = w.ranText().split("\n").filter(Boolean);
      assert.equal(lines.length, 6);
      for (const line of lines) {
        assert.match(line, /--proto =https/);
        assert.match(line, /--proto-redir =https/);
        assert.match(line, /--fail --location/);
        assert.match(line, /--output \S+\.part /);
      }
      // A second run finds all six there with the right SHA-256 and fetches nothing.
      const again = w.build("--out", w.out, "--fetch");
      assert.equal(again.status, 0, `${again.stdout}${again.stderr}`);
      assert.equal(w.ranText().split("\n").filter(Boolean).length, 6);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("a download that is not the pinned one is set aside and nothing is unpacked", () => {
    const w = world();
    try {
      const pins = w.stage("ffmpeg");
      const made = w.build("--out", w.out);
      assert.equal(made.status, 1, `${made.stdout}${made.stderr}`);
      assert.match(made.stdout, /ffmpeg's download is not the pinned one, so it was set aside and nothing was unpacked\.$/m);
      const file = pins.ffmpeg.url.split("/").pop();
      assert.equal(existsSync(join(w.out, "downloads", `${file}.rejected`)), true);
      assert.equal(existsSync(join(w.out, "downloads", file)), false);
      assert.equal(existsSync(join(w.out, "downloads", `${file}.part`)), false);
      assert.equal(existsSync(join(w.out, "build")), false);
      assert.equal(existsSync(join(w.out, "vendor")), false);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });
});
