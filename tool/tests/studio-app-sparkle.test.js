// Sparkle's own pin, and fetching and unpacking the pinned archive: tool/studio-app/sparkle.js, fetch-sparkle.sh and common.zsh's
// unpack_sparkle (Phase 7, Task 5). Nothing is fetched: curl is a stand-in, and the archive is a made-up one packed here.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_KEY, readSparklePin } from "../studio-app/sparkle.js";

const STUDIO_APP = fileURLToPath(new URL("../studio-app/", import.meta.url));
const PIN_FILE = join(STUDIO_APP, "sparkle.pin.json");
const IS_MAIN = fileURLToPath(new URL("../is-main.js", import.meta.url));
const SHA = "1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27";
const URL_ = "https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz";
const KEY = `${"A1b2+/".repeat(7)}x=`;
const notAMac = process.platform !== "darwin" || !existsSync("/bin/zsh") || !existsSync("/usr/bin/tar") ? "fetching Sparkle runs on a Mac, which has zsh and tar" : false;
const WATCHED_SENTENCE = "That folder is watched or is in Dropbox, and a build never writes there.";
const REJECTED_SENTENCE = "Sparkle's download is not the pinned one, so it was set aside and nothing was unpacked.";
const NOT_PINNED_SENTENCE = "That is not the pinned Sparkle archive, so it was not unpacked.";
const NO_KEY_SENTENCE = "The update key's public half is not in sparkle.pin.json yet. Reading it is a by-hand step.";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** The real pin, as an object to change. */
const realPin = () => JSON.parse(readFileSync(PIN_FILE, "utf8"));

/** A world for one test: a temporary folder holding copies of is-main.js and, in studio-app/, sparkle.js, common.zsh and
    fetch-sparkle.sh beside a pin file that names a made-up archive's SHA-256; a temporary HOME; `bin/` with a stand-in curl that writes
    `curl <args>` into `ran` and copies $FAKE_ARCHIVE to the file after --output; and the made-up archive itself, made with tar -cJf from a
    folder holding Sparkle.framework/Versions/B/Sparkle, bin/generate_appcast and bin/generate_keys. */
function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "studio-sparkle-")));
  const home = join(root, "home");
  const bin = join(root, "bin");
  const copy = join(root, "studio-app");
  const packed = join(root, "packed");
  for (const dir of [home, bin, copy]) mkdirSync(dir);
  copyFileSync(IS_MAIN, join(root, "is-main.js"));
  for (const name of ["sparkle.js", "common.zsh", "fetch-sparkle.sh"]) copyFileSync(join(STUDIO_APP, name), join(copy, name));

  mkdirSync(join(packed, "Sparkle.framework", "Versions", "B"), { recursive: true });
  mkdirSync(join(packed, "bin"));
  writeFileSync(join(packed, "Sparkle.framework", "Versions", "B", "Sparkle"), "a made-up Sparkle\n");
  writeFileSync(join(packed, "bin", "generate_appcast"), "#!/bin/sh\nexit 0\n");
  writeFileSync(join(packed, "bin", "generate_keys"), "#!/bin/sh\nexit 0\n");
  const archive = join(root, "made-up.tar.xz");
  const packing = spawnSync("/usr/bin/tar", ["-cJf", archive, "-C", packed, "Sparkle.framework", "bin"], { encoding: "utf8" });
  assert.equal(packing.status, 0, packing.stderr);

  const pinFile = join(copy, "sparkle.pin.json");
  writeFileSync(pinFile, `${JSON.stringify({ ...realPin(), sha256: sha256(readFileSync(archive)) }, null, 2)}\n`);

  const ran = join(root, "ran");
  writeFileSync(ran, "");
  writeFileSync(
    join(bin, "curl"),
    `#!/bin/sh
echo "curl $*" >> "$RAN"
out=
while [ $# -gt 0 ]; do
  if [ "$1" = "--output" ]; then out=$2; fi
  shift
done
cp "$FAKE_ARCHIVE" "$out"
`,
  );
  chmodSync(join(bin, "curl"), 0o755);
  const env = { HOME: home, RAN: ran, FAKE_ARCHIVE: archive, PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin:${dirname(process.execPath)}` };
  const fetch = (...args) => spawnSync("/bin/zsh", [join(copy, "fetch-sparkle.sh"), ...args], { encoding: "utf8", env, cwd: root, timeout: 60000 });
  const sparkle = (...args) => spawnSync(process.execPath, [join(copy, "sparkle.js"), ...args], { encoding: "utf8", timeout: 20000 });
  return { root, home, archive, pinFile, ran, env, fetch, sparkle, ranText: () => readFileSync(ran, "utf8"), out: join(root, "out") };
}

describe("sparkle.js", () => {
  it("the pin file in the repo is whole, and names the spike's archive", () => {
    const read = readSparklePin(PIN_FILE);
    assert.equal(read.fault, undefined);
    assert.equal(read.pin.version, "2.10.1");
    assert.equal(read.pin.url, URL_);
    assert.equal(read.pin.sha256, SHA);
    assert.deepEqual(Object.keys(read.pin), ["version", "url", "sha256", "publicKey"]);
    assert.ok(read.pin.publicKey === "" || PUBLIC_KEY.test(read.pin.publicKey));
    assert.equal(String(PUBLIC_KEY), "/^[A-Za-z0-9+/]{43}=$/");
  });

  it("a pin with a key it should not have, or a bad url, sha256 or public key, is a fault that names the key", () => {
    const root = mkdtempSync(join(tmpdir(), "studio-sparkle-pin-"));
    try {
      const write = (pin) => {
        const file = join(root, "pin.json");
        writeFileSync(file, `${JSON.stringify(pin)}\n`);
        return readSparklePin(file);
      };
      assert.equal(write(realPin()).fault, undefined);
      assert.equal(write({ ...realPin(), publicKey: KEY }).pin.publicKey, KEY);
      const cases = [
        [{ ...realPin(), extra: "secret-value" }, "extra", "secret-value"],
        [{ ...realPin(), version: "" }, "version", null],
        [{ ...realPin(), version: "2.10.1\n2.10.2" }, "version", "2.10.2"],
        [{ ...realPin(), url: URL_.replace("https:", "http:") }, "url", "github.com"],
        [{ ...realPin(), url: `${URL_}?x=1` }, "url", "github.com"],
        [{ ...realPin(), url: `${URL_}#top` }, "url", "github.com"],
        [{ ...realPin(), url: "https://user:hunter2@github.com/Sparkle.tar.xz" }, "url", "hunter2"],
        [{ ...realPin(), url: "nowhere at all" }, "url", "nowhere at all"],
        [{ ...realPin(), sha256: SHA.slice(1) }, "sha256", SHA.slice(1)],
        [{ ...realPin(), sha256: SHA.toUpperCase() }, "sha256", SHA.toUpperCase()],
        [{ ...realPin(), publicKey: "short=" }, "publicKey", "short="],
        [{ ...realPin(), publicKey: `${KEY.slice(0, -1)}` }, "publicKey", KEY.slice(0, -1)],
        [{ ...realPin(), publicKey: 42 }, "publicKey", null],
        [(() => { const pin = realPin(); delete pin.sha256; return pin; })(), "sha256", null],
      ];
      for (const [i, [pin, key, value]] of cases.entries()) {
        const read = write(pin);
        assert.equal(read.pin, undefined, `case ${i} gave a pin`);
        assert.equal(typeof read.fault, "string", `case ${i} gave no fault`);
        assert.ok(read.fault.includes(key), `case ${i}: ${read.fault} names ${key}`);
        assert.ok(!read.fault.includes("\n"), `case ${i} is one line`);
        if (value) assert.ok(!read.fault.includes(value), `case ${i}: ${read.fault} names the value`);
      }
      assert.equal(typeof readSparklePin(join(root, "missing.json")).fault, "string");
      writeFileSync(join(root, "bad.json"), "{ not json");
      assert.equal(typeof readSparklePin(join(root, "bad.json")).fault, "string");
      writeFileSync(join(root, "list.json"), "[]");
      assert.equal(typeof readSparklePin(join(root, "list.json")).fault, "string");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("pin prints the version, the url, its last part and the sha256", () => {
    const ran = spawnSync(process.execPath, [join(STUDIO_APP, "sparkle.js"), "pin"], { encoding: "utf8", timeout: 20000 });
    assert.equal(ran.status, 0, ran.stderr);
    assert.equal(ran.stdout, `2.10.1\t${URL_}\tSparkle-2.10.1.tar.xz\t${SHA}\n`);
    const wrong = spawnSync(process.execPath, [join(STUDIO_APP, "sparkle.js"), "nonsense"], { encoding: "utf8", timeout: 20000 });
    assert.equal(wrong.status, 2);
    assert.equal(spawnSync(process.execPath, [join(STUDIO_APP, "sparkle.js"), "pin", "more"], { encoding: "utf8", timeout: 20000 }).status, 2);
  });

  it("key says the public half, or that it is not there yet", { skip: notAMac }, () => {
    const w = world();
    try {
      // The repo's own pin has its key since by-hand check 2, so the pin with none is written here.
      writeFileSync(w.pinFile, `${JSON.stringify({ ...realPin(), publicKey: "" })}\n`);
      const none = w.sparkle("key");
      assert.equal(none.status, 1);
      assert.equal(`${none.stdout}${none.stderr}`, `${NO_KEY_SENTENCE}\n`);
      writeFileSync(w.pinFile, `${JSON.stringify({ ...realPin(), publicKey: KEY })}\n`);
      const some = w.sparkle("key");
      assert.equal(some.status, 0, some.stderr);
      assert.equal(some.stdout, `${KEY}\n`);
      writeFileSync(w.pinFile, `${JSON.stringify({ ...realPin(), publicKey: "not a key" })}\n`);
      const bad = w.sparkle("key");
      assert.equal(bad.status, 2);
      assert.ok(!`${bad.stdout}${bad.stderr}`.includes("not a key"), "the bad value is not shown");
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });
});

describe("fetch-sparkle.sh and unpack_sparkle", { skip: notAMac }, () => {
  it("an archive whose SHA-256 is not the pin's is refused before it is unpacked", () => {
    const w = world();
    try {
      assert.equal(w.sparkle("check", w.archive).status, 0);
      const changed = join(w.root, "changed.tar.xz");
      writeFileSync(changed, Buffer.concat([readFileSync(w.archive), Buffer.from("x")]));
      const checked = w.sparkle("check", changed);
      assert.equal(checked.status, 1);
      assert.equal(checked.stdout, `${NOT_PINNED_SENTENCE}\n`);
      assert.equal(w.sparkle("check", join(w.root, "no-such.tar.xz")).status, 1);

      // unpack_sparkle alone, sourced as a script that sets `here` would: it stops before tar.
      const into = join(w.root, "into");
      mkdirSync(into);
      const unpacked = spawnSync("/bin/zsh", ["-c", 'here=$1; source "$here/common.zsh"; unpack_sparkle "$2" "$3"', "zsh", join(w.root, "studio-app"), changed, into], { encoding: "utf8", env: w.env });
      assert.equal(unpacked.status, 1);
      assert.match(unpacked.stdout, /That is not the pinned Sparkle archive, so it was not unpacked\./);
      assert.deepEqual(readdirSync(into), []);

      // A stand-in curl that writes other bytes.
      writeFileSync(w.env.FAKE_ARCHIVE, "other bytes\n");
      const fetched = w.fetch("--out", w.out);
      assert.equal(fetched.status, 1, `${fetched.stdout}${fetched.stderr}`);
      assert.equal(fetched.stdout.trim().split("\n").pop(), REJECTED_SENTENCE);
      assert.match(w.ranText(), /curl --fail --location --proto =https --proto-redir =https --silent --show-error --output /);
      assert.deepEqual(readdirSync(w.out).sort(), ["Sparkle-2.10.1.tar.xz.rejected"]);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("an archive that unpacks without Sparkle's parts is refused", () => {
    const w = world();
    try {
      const packed = join(w.root, "half");
      mkdirSync(join(packed, "bin"), { recursive: true });
      writeFileSync(join(packed, "bin", "generate_keys"), "x\n");
      const half = join(w.root, "half.tar.xz");
      assert.equal(spawnSync("/usr/bin/tar", ["-cJf", half, "-C", packed, "bin"]).status, 0);
      writeFileSync(w.pinFile, `${JSON.stringify({ ...realPin(), sha256: sha256(readFileSync(half)) })}\n`);
      const into = join(w.root, "into");
      mkdirSync(into);
      const unpacked = spawnSync("/bin/zsh", ["-c", 'here=$1; source "$here/common.zsh"; unpack_sparkle "$2" "$3"', "zsh", join(w.root, "studio-app"), half, into], { encoding: "utf8", env: w.env });
      assert.equal(unpacked.status, 1);
      assert.ok(unpacked.stdout.trim().length > 0, "it says why");
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("it fetches once, checks, and unpacks", () => {
    const w = world();
    try {
      const first = w.fetch("--out", w.out);
      assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
      assert.equal(w.ranText().split("\n").filter(Boolean).length, 1);
      assert.ok(w.ranText().includes(`--output ${join(w.out, "Sparkle-2.10.1.tar.xz")}.part ${URL_}`), w.ranText());
      assert.deepEqual(readdirSync(w.out).sort(), ["Sparkle-2.10.1", "Sparkle-2.10.1.tar.xz"]);
      const unpacked = join(w.out, "Sparkle-2.10.1");
      assert.equal(readFileSync(join(unpacked, "Sparkle.framework", "Versions", "B", "Sparkle"), "utf8"), "a made-up Sparkle\n");
      assert.ok(existsSync(join(unpacked, "bin", "generate_appcast")));
      assert.ok(existsSync(join(unpacked, "bin", "generate_keys")));

      // A second run starts no curl, and unpacks into a fresh folder.
      writeFileSync(join(unpacked, "left-over"), "x\n");
      writeFileSync(w.ran, "");
      const second = w.fetch("--out", w.out);
      assert.equal(second.status, 0, `${second.stdout}${second.stderr}`);
      assert.equal(w.ranText(), "");
      assert.equal(existsSync(join(unpacked, "left-over")), false);
      assert.ok(existsSync(join(unpacked, "bin", "generate_keys")));

      // Without --out, the folder is in the home's caches.
      writeFileSync(w.ran, "");
      const cached = w.fetch();
      assert.equal(cached.status, 0, `${cached.stdout}${cached.stderr}`);
      assert.ok(existsSync(join(w.home, "Library", "Caches", "brimm-studio-app", "sparkle", "Sparkle-2.10.1", "bin", "generate_appcast")));
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("--print fetches nothing and makes no folder", () => {
    const w = world();
    try {
      const printed = w.fetch("--out", w.out, "--print");
      assert.equal(printed.status, 0, printed.stderr);
      assert.equal(existsSync(w.out), false);
      assert.equal(w.ranText(), "");
      assert.ok(printed.stdout.includes(URL_), printed.stdout);
      assert.ok(printed.stdout.includes(join(w.out, "Sparkle-2.10.1.tar.xz")), printed.stdout);
      assert.ok(printed.stdout.includes(join(w.out, "Sparkle-2.10.1")), printed.stdout);
      const home = w.fetch("--print");
      assert.equal(home.status, 0);
      assert.ok(home.stdout.includes(join(w.home, "Library", "Caches", "brimm-studio-app", "sparkle")), home.stdout);
      assert.deepEqual(readdirSync(w.home), []);
      for (const args of [["--bogus"], ["--out"], ["--out", w.out, "--print", "extra"]]) {
        const made = w.fetch(...args);
        assert.equal(made.status, 2, `${args.join(" ")}: ${made.stdout}${made.stderr}`);
      }
      assert.equal(existsSync(w.out), false);
      assert.equal(w.ranText(), "");
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
      ];
      for (const target of targets) {
        for (const mode of [["--print"], []]) {
          const made = w.fetch("--out", target, ...mode);
          assert.equal(made.status, 1, `${target} ${mode}: ${made.stdout}${made.stderr}`);
          assert.equal(made.stdout.trim(), WATCHED_SENTENCE);
        }
        assert.equal(existsSync(target), false, `${target} was made`);
      }
      assert.deepEqual(readdirSync(drop), []);
      assert.equal(w.ranText(), "");
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });
});
