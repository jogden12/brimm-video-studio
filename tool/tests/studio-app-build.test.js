// BRIMM Video Studio.app's build, tool/studio-app/build-app.sh (Phase 6, Task 15). The build is run from a temporary git repo that holds
// a copy of this checkout's tool/ (with a test, a move-app file and a .env added, which the bundle must leave out), committed, with
// origin/main at its head. Stand-ins come first on its PATH for swiftc, security, codesign and xcrun: each records "name args" into a
// `ran` file. swiftc's copies /usr/bin/true to the file after -o. No test runs the real codesign, security or xcrun, nothing is signed
// with an identity and nothing is sent to Apple. The vendor folder is made up: copies of /usr/bin/true, sealed with the real vendor.js.
// No test runs any program inside a bundle it built: such a bundle is never really sealed, and macOS would put up its "damaged" dialog.
// The bundle's JavaScript is run by the test's own node. HOME is a temporary folder. The tests need a Mac (zsh, plutil, ditto, file);
// anywhere else they skip themselves and say why. Sparkle's archive is made up too (Phase 7, Task 7): a real .tar.xz laid out as
// Sparkle's, with the framework's links, whose SHA-256 the temporary repo's sparkle.pin.json names beside a made-up public key.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, chmodSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOf } from "../build.js";
import { seal } from "../studio-app/vendor.js";
import { appCopy } from "./app-copy.js";

const TOOL = fileURLToPath(new URL("..", import.meta.url));
const VENDOR_JS = join(TOOL, "studio-app", "vendor.js");
const FAKE_ENGINE = join(TOOL, "studio-app", "dev", "fake-engine.mjs");
const notAMac = process.platform !== "darwin" || !existsSync("/bin/zsh") ? "the app is built on a Mac, which has zsh, plutil, ditto and file" : false;
const NAME = "Developer ID Application: Test Person (TEAMID)";
const HASH = "1111111111111111111111111111111111111111";
const IDENTITY = `  1) ${HASH} "${NAME}"`;
const APP = "BRIMM Video Studio.app";
const VERSION = "1.0.0-beta.1";
const KEY = `${"A1b2+/".repeat(7)}x=`;
const FEED = "https://updates.thebrimminsights.com/appcast.xml";
const FRAMEWORK = `${APP}/Contents/Frameworks/Sparkle.framework`;
/** Sparkle's five parts, in the order Sparkle's own documentation signs them: inside-out, the framework itself last. */
const SPARKLE_PARTS = [
  `${FRAMEWORK}/Versions/B/XPCServices/Installer.xpc`,
  `${FRAMEWORK}/Versions/B/XPCServices/Downloader.xpc`,
  `${FRAMEWORK}/Versions/B/Autoupdate`,
  `${FRAMEWORK}/Versions/B/Updater.app`,
  FRAMEWORK,
];
const run = (cmd, args, options = {}) => spawnSync(cmd, args, { encoding: "utf8", ...options });

/** Every file and folder under `dir`, as paths from it, sorted. */
function tree(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    out.push(path.slice(base.length + 1));
    if (entry.isDirectory()) out.push(...tree(path, base));
  }
  return out.sort();
}

function standIn(bin, name, body) {
  writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "$RAN"\n${body}`);
  chmodSync(join(bin, name), 0o755);
}

/** The files of this checkout's tool/ that git has or would add, but its tests and move-app, as paths from tool/. Only these are
    copied: never an ignored file, so no real .env is ever touched. */
function trackedTool() {
  const listed = run("git", ["-C", TOOL, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "."]);
  assert.equal(listed.status, 0, listed.stderr);
  return listed.stdout.split("\0").filter((p) => p && !p.startsWith("tests/") && !p.startsWith("move-app/") && existsSync(join(TOOL, p)));
}

/** A vendor folder in `dir`, as build-vendor.sh lays it out: node/bin with the five programs (copies of /usr/bin/true), node/lib/x.js,
    node/LICENSE and a licence, sealed with the real vendor.js. No test runs any of them: a bundle a test builds is never sealed, and
    macOS takes a program in it for a damaged app. */
function vendorFolder(dir, { sealed = true } = {}) {
  const folder = join(dir, "vendor");
  mkdirSync(join(folder, "node", "bin"), { recursive: true });
  mkdirSync(join(folder, "node", "lib"));
  mkdirSync(join(folder, "licenses"));
  for (const name of ["node", "npm", "ffmpeg", "ffprobe", "whisper-cli"]) copyFileSync("/usr/bin/true", join(folder, "node", "bin", name));
  writeFileSync(join(folder, "node", "lib", "x.js"), "export {};\n");
  writeFileSync(join(folder, "node", "LICENSE"), "node's licence.\n");
  writeFileSync(join(folder, "licenses", "ffmpeg-COPYING.GPLv3"), "A licence.\n");
  if (sealed) assert.equal(run(process.execPath, [VENDOR_JS, "seal", folder]).status, 0);
  return folder;
}

/** A made-up Sparkle archive in `dir`, packed with tar -cJf as Sparkle's own is, with no folder at its top: Sparkle.framework, whose
    Versions/B holds Sparkle, Autoupdate, Updater.app and the two XPC services (each program a copy of /usr/bin/true, never run), with
    Versions/Current and the top-level links; LICENSE; and bin/ with generate_appcast and generate_keys. */
function sparkleArchive(dir, name = "Sparkle-made-up.tar.xz") {
  const packed = join(dir, `${name}.packed`);
  const framework = join(packed, "Sparkle.framework");
  const b = join(framework, "Versions", "B");
  for (const d of ["Updater.app/Contents/MacOS", "XPCServices/Installer.xpc/Contents/MacOS", "XPCServices/Downloader.xpc/Contents/MacOS", "Resources"]) {
    mkdirSync(join(b, d), { recursive: true });
  }
  for (const program of ["Sparkle", "Autoupdate", "Updater.app/Contents/MacOS/Updater", "XPCServices/Installer.xpc/Contents/MacOS/Installer", "XPCServices/Downloader.xpc/Contents/MacOS/Downloader"]) {
    copyFileSync("/usr/bin/true", join(b, program));
  }
  writeFileSync(join(b, "Resources", "Info.plist"), "a made-up Info.plist\n");
  symlinkSync("B", join(framework, "Versions", "Current"));
  for (const link of ["Sparkle", "Autoupdate", "Updater.app", "XPCServices", "Resources"]) symlinkSync(`Versions/Current/${link}`, join(framework, link));
  writeFileSync(join(packed, "LICENSE"), "Sparkle's made-up licence.\n");
  mkdirSync(join(packed, "bin"));
  for (const program of ["generate_appcast", "generate_keys"]) {
    writeFileSync(join(packed, "bin", program), "#!/bin/sh\nexit 0\n");
    chmodSync(join(packed, "bin", program), 0o755);
  }
  const archive = join(dir, name);
  const packing = run("/usr/bin/tar", ["-cJf", archive, "-C", packed, "Sparkle.framework", "LICENSE", "bin"]);
  assert.equal(packing.status, 0, packing.stderr);
  rmSync(packed, { recursive: true, force: true });
  return archive;
}

/** A world: a temporary folder with a repo holding a copy of tool/ (with tool/tests/x.test.js, tool/move-app/x and tool/.env added),
    committed, `bin/` of stand-ins, `tmp/` as TMPDIR, `home/` as HOME, a sealed vendor folder, and a made-up Sparkle archive whose
    SHA-256, with a made-up public key, is in the repo's committed sparkle.pin.json. `identities` is what the stand-in
    security lists; `behind` leaves origin/main one commit behind the head. `build(...args)` runs the copy's build-app.sh with the
    `ran` file emptied first. */
function world({ identities = [IDENTITY], behind = false } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-studio-build-")));
  const repo = join(dir, "repo");
  const bin = join(dir, "bin");
  const tmp = join(dir, "tmp");
  const home = join(dir, "home");
  for (const d of [repo, bin, tmp, home]) mkdirSync(d);
  const tool = join(repo, "tool");
  for (const path of trackedTool()) {
    mkdirSync(dirname(join(tool, path)), { recursive: true });
    copyFileSync(join(TOOL, path), join(tool, path));
  }
  mkdirSync(join(tool, "tests"));
  writeFileSync(join(tool, "tests", "x.test.js"), "// a test\n");
  mkdirSync(join(tool, "move-app"));
  writeFileSync(join(tool, "move-app", "x"), "the old app\n");
  writeFileSync(join(tool, ".env"), "NOT_READ=1\n");
  const sparkle = sparkleArchive(dir);
  const pinFile = join(tool, "studio-app", "sparkle.pin.json");
  const pin = JSON.parse(readFileSync(pinFile, "utf8"));
  writeFileSync(pinFile, `${JSON.stringify({ ...pin, sha256: createHash("sha256").update(readFileSync(sparkle)).digest("hex"), publicKey: KEY }, null, 2)}\n`);
  const git = (...args) => {
    const r = run("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "-C", repo, ...args], { env: { PATH: "/usr/bin:/bin", HOME: dir } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git("init", "-q", "-b", "main");
  git("add", ".");
  git("commit", "-q", "-m", "one");
  const first = git("rev-parse", "HEAD");
  writeFileSync(join(repo, "other.txt"), "more\n");
  git("add", ".");
  git("commit", "-q", "-m", "two");
  const head = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", behind ? first : head);
  // It marks its output with an extended attribute, as a real build can: a zip made without --norsrc --noextattr then holds a ._ entry.
  standIn(bin, "swiftc", 'while [ $# -gt 0 ]; do if [ "$1" = -o ]; then shift; cp /usr/bin/true "$1"; /usr/bin/xattr -w com.example.mark yes "$1"; fi; shift; done\n');
  standIn(bin, "security", `printf '%s\\n' ${identities.map((i) => `'${i}'`).join(" ")} '     ${identities.length} valid identities found'\n`);
  standIn(bin, "codesign", "");
  standIn(bin, "xcrun", "");
  standIn(bin, "generate_appcast", "");
  standIn(bin, "generate_keys", "");
  const env = { PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin:${dirname(process.execPath)}`, HOME: home, TMPDIR: tmp, RAN: join(dir, "ran") };
  const script = join(tool, "studio-app", "build-app.sh");
  const vendor = vendorFolder(dir);
  const ran = () => (existsSync(join(dir, "ran")) ? readFileSync(join(dir, "ran"), "utf8") : "");
  return {
    dir, repo, tool, tmp, home, head, first, bin, env, git, vendor, sparkle, pinFile, ran,
    /** The options every build needs, into `out`. */
    needed: (out) => ["--out", out, "--version", VERSION, "--build", "7", "--vendor", vendor, "--sparkle", sparkle],
    build: (...args) => {
      rmSync(join(dir, "ran"), { force: true });
      return run("/bin/zsh", [script, ...args], { env, cwd: dir });
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** One build of `w` into a new out folder: the result, what ran, and the paths in it. */
function built(w, name, ...extra) {
  const out = join(w.dir, name);
  const r = w.build(...w.needed(out), ...extra);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { r, ran: w.ran(), out, app: join(out, APP), zip: join(out, `BRIMM-Video-Studio-${VERSION}.zip`) };
}

const runnable = (file) => {
  try {
    accessSync(file, constants.X_OK);
    return statSync(file).isFile();
  } catch {
    return false;
  }
};
const plistValue = (app, key) => run("plutil", ["-extract", key, "raw", "-o", "-", join(app, "Contents", "Info.plist")]).stdout.trim();
/** The `codesign --force` lines of `ran`, each with its path made relative to the app. */
const forced = (ran) => ran.split("\n").filter((l) => l.startsWith("codesign --force"));
const inApp = (line) => line.slice(line.indexOf(APP));
/** The forced lines before the first one under Contents/Frameworks/: node's programs. */
const nodeLines = (force) => {
  const first = force.findIndex((l) => inApp(l).startsWith(`${APP}/Contents/Frameworks/`));
  return first === -1 ? force.slice(0, -1) : force.slice(0, first);
};

describe("build-app.sh: one build, read by many tests", { skip: notAMac }, () => {
  let w;
  let plain;
  let signed;
  before(() => {
    w = world();
    plain = built(w, "out");
    signed = built(w, "signed", "--sign");
  });
  after(() => w?.cleanup());

  it("the bundle holds Studio's tool without tests, move-app, studio-app or a .env, and the programs appCopy names", () => {
    // The commit really holds tool/.env, so that leaving it out is the build's doing.
    assert.equal(w.git("ls-files", "--", "tool/.env"), "tool/.env");
    const listing = tree(plain.app);
    for (const path of listing) {
      assert.equal(/(^|\/)(tests|move-app|studio-app)(\/|$)/.test(path), false, path);
      assert.equal(/(^|\/)\.env(\.|$)/.test(path), false, path);
    }
    const bin = join(plain.app, "Contents", "Resources", "node", "bin");
    const copy = appCopy();
    try {
      const names = readdirSync(bin);
      for (const name of readdirSync(copy.tools)) assert.ok(names.includes(name), name);
      assert.ok(names.includes("whisper-cli"));
      assert.equal(names.includes("whisper-cpp"), false);
    } finally {
      copy.done();
    }
    assert.ok(runnable(join(plain.app, "Contents", "MacOS", "BRIMM Video Studio")));
    const tool = join(plain.app, "Contents", "Resources", "Studio", "tool");
    for (const path of ["install.sh", "unedited.js", "busy.js", "setup/engine.js"]) assert.ok(existsSync(join(tool, path)), path);
    assert.equal(existsSync(join(plain.app, "Contents", "Resources", "FAKE-ENGINE.txt")), false);
    assert.equal(existsSync(join(tool, "setup", "sample-guide.html")), false, "only a stand-in build holds the sample guide");
    assert.deepEqual(readFileSync(join(tool, "setup", "engine.js")), readFileSync(join(w.tool, "setup", "engine.js")));
    const res = join(plain.app, "Contents", "Resources");
    assert.equal(readFileSync(join(res, "node", "LICENSE"), "utf8"), "node's licence.\n");
    assert.ok(existsSync(join(res, "node", "lib", "x.js")));
    assert.ok(existsSync(join(res, "Licenses", "ffmpeg-COPYING.GPLv3")));
    const source = run(process.execPath, [VENDOR_JS, "source-name"]).stdout.trim();
    assert.equal(
      readFileSync(join(res, "Licenses", "ffmpeg-source.txt"), "utf8").trim(),
      `ffmpeg and x264 are free software under the GNU General Public License. The source this copy was built from, with the build's own script, is at https://updates.thebrimminsights.com/source/${source}.`,
    );
    assert.equal(existsSync(join(res, "AppIcon.icns")), false, "there is no icon yet");
    assert.deepEqual(readdirSync(w.tmp), [], "its temporary folder is taken away");
  });

  it("the bundle's own Studio loads, and its engine answers a status", () => {
    // The test's own node runs the bundle's JavaScript: nothing inside the bundle is run, and a status starts no program. The bundle's
    // bin is given as --tools but is not on PATH.
    const tools = join(plain.app, "Contents", "Resources", "node", "bin");
    const tool = join(plain.app, "Contents", "Resources", "Studio", "tool");
    const home = join(w.dir, "engine-home");
    mkdirSync(home);
    const env = { HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "en_US.UTF-8", TMPDIR: w.tmp };
    const r = run(process.execPath, [join(tool, "setup", "engine.js"), "--run", "status", "--app", plain.app, "--tools", tools, "--protocol", "1"], { env, timeout: 60000 });
    assert.equal(r.status, 0, `${r.signal ?? ""} ${r.stdout}${r.stderr}`);
    const events = r.stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const [summary, done] = events.slice(-2);
    assert.equal(summary.event, "summary");
    assert.equal(summary.id, "status");
    assert.equal(summary.needs, "setup");
    assert.equal(done.event, "done");
    // Every module of the bundle's tool/ and tool/setup/ loads, so nothing that was left behind was needed.
    const modules = [
      ...readdirSync(tool).filter((n) => n.endsWith(".js")).map((n) => `./${n}`),
      ...readdirSync(join(tool, "setup")).filter((n) => n.endsWith(".js")).map((n) => `./setup/${n}`),
    ];
    assert.ok(modules.length > 50, modules.length);
    const script = `const failed = []; for (const m of ${JSON.stringify(modules)}) { try { await import(m); } catch (e) { failed.push(m + ": " + e.message); } } console.log(JSON.stringify(failed));`;
    const loaded = run(process.execPath, ["--input-type=module", "-e", script], { cwd: tool, env, timeout: 120000 });
    assert.equal(loaded.status, 0, loaded.stderr);
    assert.deepEqual(JSON.parse(loaded.stdout.trim().split("\n").pop()), []);
  });

  it("build.json is whole and names the commit", () => {
    const build = buildOf(join(plain.app, "Contents", "Resources", "Studio"));
    assert.equal(build.broken, false);
    assert.equal(build.version, VERSION);
    assert.equal(build.build, 7);
    assert.equal(build.commit, w.head);
    assert.equal(build.channel, "stable");
  });

  it("the Info.plist names the bundle, the program and the scheme, as install.sh needs them", () => {
    assert.equal(run("plutil", ["-lint", join(plain.app, "Contents", "Info.plist")]).status, 0);
    const id = plistValue(plain.app, "CFBundleIdentifier");
    assert.equal(id, "com.thebrimm.video-studio");
    assert.match(id, /^[A-Za-z0-9.-]+$/);
    const exe = plistValue(plain.app, "CFBundleExecutable");
    assert.equal(exe, "BRIMM Video Studio");
    assert.equal(exe.includes("/"), false);
    assert.ok(runnable(join(plain.app, "Contents", "MacOS", exe)));
    assert.equal(plistValue(plain.app, "CFBundleURLTypes.0.CFBundleURLSchemes.0"), "brimm-video-studio");
    assert.equal(plistValue(plain.app, "LSMinimumSystemVersion"), "13.0");
    assert.equal(plistValue(plain.app, "CFBundleVersion"), "7");
    assert.equal(plistValue(plain.app, "CFBundleShortVersionString"), "1.0.0-beta.1");
  });

  it("the Info.plist names the feed and the repo's public key", () => {
    assert.equal(plistValue(plain.app, "SUFeedURL"), FEED);
    assert.equal(plistValue(plain.app, "SUPublicEDKey"), KEY);
    assert.equal(plistValue(signed.app, "SUPublicEDKey"), KEY);
  });

  it("the framework is in the bundle with its links", () => {
    const framework = join(plain.app, "Contents", "Frameworks", "Sparkle.framework");
    assert.ok(lstatSync(join(framework, "Versions", "Current")).isSymbolicLink(), "Versions/Current is a link");
    assert.ok(lstatSync(join(framework, "Sparkle")).isSymbolicLink(), "the top-level Sparkle is a link");
    assert.ok(lstatSync(join(framework, "Versions", "B", "Sparkle")).isFile(), "Versions/B/Sparkle is a file");
    for (const part of ["Versions/B/Autoupdate", "Versions/B/Updater.app/Contents/MacOS/Updater", "Versions/B/XPCServices/Downloader.xpc/Contents/MacOS/Downloader"]) {
      assert.ok(lstatSync(join(framework, part)).isFile(), part);
    }
    assert.equal(readFileSync(join(plain.app, "Contents", "Resources", "Licenses", "Sparkle-LICENSE"), "utf8"), "Sparkle's made-up licence.\n");
    // Only the framework is taken from the archive: its programs for making a release stay out of the app.
    assert.deepEqual(readdirSync(join(plain.app, "Contents", "Frameworks")), ["Sparkle.framework"]);
    assert.equal(tree(plain.app).some((p) => p.includes("generate_")), false);
  });

  it("compiles the app from the commit's Sources, sorted, with the phase's flags", () => {
    const swift = plain.ran.split("\n").find((l) => l.startsWith("swiftc -O -swift-version 5"));
    assert.ok(swift, plain.ran);
    const m = swift.match(
      /^swiftc -O -swift-version 5 -target arm64-apple-macos13\.0 -module-cache-path (\S+) -F (\S+) -framework Sparkle -Xlinker -rpath -Xlinker @executable_path\/\.\.\/Frameworks -o (.+\/BRIMM Video Studio) (\S+\.swift( \S+\.swift)*)$/,
    );
    assert.ok(m, swift);
    assert.ok(m[1].startsWith(`${w.tmp}/`), "the module cache is in a temporary folder");
    assert.ok(m[2].startsWith(`${w.tmp}/`) && m[2].endsWith("/sparkle"), "Sparkle is found where its archive was unpacked, in the temporary folder");
    const names = m[4].split(" ").map((p) => p.split("/").pop());
    const expected = readdirSync(join(w.tool, "studio-app", "Sources")).filter((n) => n.endsWith(".swift")).sort();
    assert.deepEqual(names, expected);
    // The five helpers, from build-helpers.js, into the bundle's bin.
    const helpers = plain.ran.split("\n").filter((l) => l.startsWith("swiftc -O -target"));
    assert.equal(helpers.length, 5, plain.ran);
    for (const line of helpers) assert.match(line, /\/Contents\/Resources\/node\/bin\/brimm-/);
  });

  it("every program inside is signed before the app, node alone with its entitlements, and --deep is only on the verify", () => {
    const lines = signed.ran.split("\n");
    const force = forced(signed.ran);
    assert.ok(force.length >= 16, signed.ran);
    assert.ok(force[force.length - 1].endsWith(`/${APP}`), force[force.length - 1]);
    const node = nodeLines(force);
    assert.ok(node.length >= 10, signed.ran);
    for (const line of node) assert.match(inApp(line), /^BRIMM Video Studio\.app\/Contents\/Resources\/node\//, line);
    for (const line of force) {
      // The certificate is named by its SHA-1, never by its name, which an expired one from before a renewal shares.
      assert.ok(line.startsWith(`codesign --force --options runtime --timestamp --sign ${HASH} `), line);
      assert.equal(line.includes(NAME), false, line);
      assert.equal(line.includes("--deep"), false, line);
    }
    const entitled = force.filter((l) => l.includes("--entitlements"));
    assert.equal(entitled.length, 1);
    assert.ok(entitled[0].endsWith("/Contents/Resources/node/bin/node"), entitled[0]);
    assert.match(entitled[0], /--entitlements \S*node\.entitlements /);
    const relative = node.map(inApp);
    assert.deepEqual(relative, [...relative].sort(), "sorted by path");
    for (const name of ["node", "npm", "ffmpeg", "ffprobe", "whisper-cli", "brimm-faces"]) {
      assert.ok(relative.includes(`${APP}/Contents/Resources/node/bin/${name}`), name);
    }
    assert.equal(relative.some((p) => p.endsWith("x.js") || p.endsWith("LICENSE")), false);
    const verify = lines.filter((l) => l.startsWith("codesign --verify"));
    assert.equal(verify.length, 1);
    assert.ok(verify[0].startsWith("codesign --verify --deep --strict --verbose=2 "), verify[0]);
    assert.ok(verify[0].endsWith(`/${APP}`));
    assert.ok(lines.indexOf(verify[0]) > lines.indexOf(force[force.length - 1]));
    assert.match(signed.r.stdout, new RegExp(`^Signed as ${NAME.replace(/[()]/g, "\\$&")}\\.$`, "m"));
  });

  it("Sparkle's five parts are signed after node's programs and before the app, the downloader alone keeping its entitlements", () => {
    for (const [ran, start] of [
      [signed.ran, `codesign --force --options runtime --timestamp --sign ${HASH} `],
      [plain.ran, "codesign --force --sign - --timestamp=none "],
    ]) {
      const force = forced(ran);
      const node = nodeLines(force);
      const rest = force.slice(node.length);
      assert.deepEqual(rest.map(inApp), [...SPARKLE_PARTS, APP], ran);
      for (const line of rest) {
        assert.ok(line.startsWith(start), line);
        assert.equal(line.includes("--entitlements"), false, line);
        assert.equal(line.includes("--deep"), false, line);
      }
      const keeping = force.filter((l) => l.includes("--preserve-metadata"));
      assert.equal(keeping.length, 1, ran);
      assert.ok(keeping[0].startsWith(`${start}--preserve-metadata=entitlements `), keeping[0]);
      assert.equal(inApp(keeping[0]), SPARKLE_PARTS[1]);
    }
  });

  it("node.entitlements holds the three entitlements, each true", () => {
    const file = join(TOOL, "studio-app", "node.entitlements");
    assert.equal(run("plutil", ["-lint", file]).status, 0);
    assert.deepEqual(JSON.parse(run("plutil", ["-convert", "json", "-o", "-", file]).stdout), {
      "com.apple.security.cs.allow-jit": true,
      "com.apple.security.cs.allow-unsigned-executable-memory": true,
      "com.apple.security.cs.disable-library-validation": true,
    });
  });

  it("without --sign every program is sealed ad hoc, in the same order", () => {
    const force = forced(plain.ran);
    for (const line of force) assert.ok(line.startsWith("codesign --force --sign - --timestamp=none "), line);
    assert.deepEqual(force.map(inApp), forced(signed.ran).map(inApp));
    assert.equal(/^security /m.test(plain.ran), false, "the keychain is not asked without --sign");
    assert.match(plain.r.stdout, /sealed ad hoc/);
  });

  it("the notarizing lines are printed and none is run", () => {
    const out = signed.r.stdout;
    assert.ok(out.includes("Not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:"), out);
    assert.ok(out.includes(`xcrun notarytool submit "${signed.zip}" --keychain-profile "BRIMM notary" --wait`), out);
    assert.ok(out.includes(`xcrun stapler staple "${signed.app}"`), out);
    assert.ok(out.includes(`ditto -c -k --norsrc --noextattr --keepParent "${signed.app}" "${signed.zip}"`), out);
    assert.ok(out.includes(`spctl --assess --type execute -vv "${signed.app}"`), out);
    assert.equal(/^xcrun /m.test(signed.ran), false);
    assert.equal(/^xcrun /m.test(plain.ran), false);
    assert.equal(plain.r.stdout.includes("notarytool"), false);
  });

  it("the release line is printed after the notarizing lines, and nothing of it is run", () => {
    const lines = signed.r.stdout.split("\n");
    const release = `Then the release: zsh tool/studio-app/release.sh --app "${signed.app}" --releases <folder> --sparkle "${w.sparkle}" --print`;
    const at = lines.indexOf(release);
    assert.ok(at !== -1, signed.r.stdout);
    assert.ok(at > lines.findIndex((l) => l.includes("spctl --assess")), signed.r.stdout);
    assert.ok(at > lines.indexOf("The zip is made again after stapling, since a zip made before it has no ticket."), signed.r.stdout);
    for (const ran of [signed.ran, plain.ran]) assert.equal(/release\.sh|^generate_/m.test(ran), false, ran);
    assert.equal(plain.r.stdout.includes("release.sh"), false, plain.r.stdout);
  });

  it("the zip holds no ._ file and no extended attribute's shadow", () => {
    const listing = run("/usr/bin/unzip", ["-Z1", plain.zip]).stdout.split("\n").filter(Boolean);
    assert.ok(listing.includes(`${APP}/Contents/MacOS/BRIMM Video Studio`), listing.join("\n"));
    assert.equal(listing.some((p) => p.split("/").some((part) => part.startsWith("._")) || p.startsWith("__MACOSX")), false);
  });

  it("says what it made: the app, the zip, the commit, the version and build", () => {
    const out = plain.r.stdout;
    assert.ok(out.includes(plain.app), out);
    assert.ok(out.includes(plain.zip), out);
    assert.ok(out.includes(w.head), out);
    assert.ok(out.includes(VERSION) && out.includes("build 7"), out);
  });
});

describe("build-app.sh: --print, the refusals and the options", { skip: notAMac }, () => {
  const WATCHED = "That folder is watched or is in Dropbox, and a build never writes there.";

  it("--print writes nothing and starts no compiler, ditto or tar", () => {
    const w = world();
    try {
      // Stand-ins that record, then run the real one: --print must start neither.
      standIn(w.bin, "ditto", 'exec /usr/bin/ditto "$@"\n');
      standIn(w.bin, "tar", 'exec /usr/bin/tar "$@"\n');
      const out = join(w.dir, "out");
      const r = w.build(...w.needed(out), "--print");
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(existsSync(out), false);
      assert.deepEqual(readdirSync(w.tmp), []);
      assert.equal(/^swiftc /m.test(w.ran()), false);
      assert.equal(/^codesign /m.test(w.ran()), false);
      assert.ok(r.stdout.includes(w.head), r.stdout);
      assert.ok(r.stdout.includes(join(out, APP)), r.stdout);
      assert.ok(r.stdout.includes(join(out, `BRIMM-Video-Studio-${VERSION}.zip`)), r.stdout);
      assert.ok(r.stdout.includes(VERSION) && r.stdout.includes("build 7"), r.stdout);
      assert.match(r.stdout, /ad hoc/);
      const withSign = w.build(...w.needed(out), "--print", "--sign");
      assert.equal(withSign.status, 0, withSign.stdout);
      assert.ok(withSign.stdout.includes(NAME), withSign.stdout);
      assert.equal(/^codesign /m.test(w.ran()), false);
      assert.equal(/^(ditto|tar) /m.test(w.ran()), false, w.ran());
      assert.equal(existsSync(out), false);
    } finally {
      w.cleanup();
    }
  });

  /** An out folder holding an earlier app and zip, made by hand, and a way to see that it is just as it was. */
  const earlier = (w) => {
    const out = join(w.dir, "out");
    mkdirSync(join(out, APP), { recursive: true });
    writeFileSync(join(out, APP, "old.txt"), "the earlier app\n");
    writeFileSync(join(out, `BRIMM-Video-Studio-${VERSION}.zip`), "the earlier zip\n");
    writeFileSync(join(out, "keep.txt"), "mine\n");
    const before = tree(out);
    return {
      out,
      same: () => {
        assert.deepEqual(tree(out), before);
        assert.equal(readFileSync(join(out, APP, "old.txt"), "utf8"), "the earlier app\n");
        assert.equal(readFileSync(join(out, `BRIMM-Video-Studio-${VERSION}.zip`), "utf8"), "the earlier zip\n");
      },
    };
  };

  it("a git archive that fails stops the build with 1, though tar is given nothing, and leaves --out as it was", () => {
    const w = world();
    try {
      const { out, same } = earlier(w);
      standIn(w.bin, "git", 'case " $* " in *" archive "*) echo "fatal: the archive failed" >&2; exit 128 ;; esac\nexec /usr/bin/git "$@"\n');
      const r = w.build(...w.needed(out));
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, /^The commit's tool could not be unpacked\.$/m);
      same();
      assert.deepEqual(readdirSync(w.tmp), []);
    } finally {
      w.cleanup();
    }
  });

  it("a move into --out that fails half way puts back the earlier app and zip", () => {
    const w = world();
    try {
      const { out, same } = earlier(w);
      // mv fails only when it would put the new zip under its own name: the new app is in place by then.
      const zip = join(out, `BRIMM-Video-Studio-${VERSION}.zip`);
      standIn(w.bin, "mv", `for last; do :; done\ncase "$1" in *.new) if [ "$last" = "${zip}" ]; then : > "${join(w.dir, "mv-failed")}"; exit 1; fi ;; esac\nexec /bin/mv "$@"\n`);
      const r = w.build(...w.needed(out));
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.ok(existsSync(join(w.dir, "mv-failed")), "the stand-in's failure was reached");
      assert.match(r.stdout, /^The app and its zip could not be moved into /m);
      same();
    } finally {
      w.cleanup();
    }
  });

  it("a vendor folder that is not sealed, or was sealed under other pins, stops the build before anything is written", () => {
    const w = world();
    try {
      const out = join(w.dir, "out");
      rmSync(join(w.vendor, "manifest.json"));
      const unsealed = w.build(...w.needed(out));
      assert.equal(unsealed.status, 1);
      assert.match(unsealed.stdout, /^The vendored programs are not sealed: run build-vendor\.sh\.$/m);
      const pins = JSON.parse(readFileSync(join(TOOL, "studio-app", "vendor.pin.json"), "utf8"));
      pins.node.version = "26.0.0";
      const other = join(w.dir, "other.pin.json");
      writeFileSync(other, `${JSON.stringify(pins)}\n`);
      seal(w.vendor, other);
      const moved = w.build(...w.needed(out));
      assert.equal(moved.status, 1);
      assert.match(moved.stdout, /^The vendored programs were built from other pins: run build-vendor\.sh again\.$/m);
      assert.equal(existsSync(out), false);
      assert.deepEqual(readdirSync(w.tmp), []);
      assert.equal(w.ran(), "");
    } finally {
      w.cleanup();
    }
  });

  it("it refuses a commit that is not on origin/main unless --any-commit, and uncommitted changes in tool/", () => {
    const behind = world({ behind: true });
    try {
      const out = join(behind.dir, "out");
      const r = behind.build(...behind.needed(out));
      assert.equal(r.status, 1);
      assert.match(r.stdout, /not on origin\/main/);
      assert.equal(existsSync(out), false);
      assert.equal(behind.build(...behind.needed(out), "--any-commit", "--print").status, 0);
    } finally {
      behind.cleanup();
    }
    const dirty = world();
    try {
      const out = join(dirty.dir, "out");
      writeFileSync(join(dirty.tool, "new.txt"), "not committed\n");
      for (const extra of [[], ["--any-commit"]]) {
        const r = dirty.build(...dirty.needed(out), ...extra);
        assert.equal(r.status, 1);
        assert.match(r.stdout, /not committed/);
        assert.equal(existsSync(out), false);
      }
      rmSync(join(dirty.tool, "new.txt"));
      writeFileSync(join(dirty.tool, "busy.js"), "// changed\n", { flag: "a" });
      assert.equal(dirty.build(...dirty.needed(out)).status, 1);
      assert.equal(existsSync(out), false);
    } finally {
      dirty.cleanup();
    }
  });

  it("it refuses an unknown option, a missing one, a version that is no semver, and --fake-engine with --sign, each with 2", () => {
    const w = world();
    try {
      const out = join(w.dir, "out");
      const all = w.needed(out);
      const without = (name) => {
        const i = all.indexOf(name);
        return [...all.slice(0, i), ...all.slice(i + 2)];
      };
      const cases = [
        [...all, "--nope"],
        without("--out"),
        without("--version"),
        without("--build"),
        without("--vendor"),
        without("--sparkle"),
        [...all, "--channel"],
        [...all, "--sparkle"],
        ["--out", out, "--version", "1.0", "--build", "7", "--vendor", w.vendor, "--sparkle", w.sparkle],
        ["--out", out, "--version", VERSION, "--build", "0", "--vendor", w.vendor, "--sparkle", w.sparkle],
        [...all, "--channel", "nightly"],
      ];
      for (const args of cases) {
        const r = w.build(...args);
        assert.equal(r.status, 2, `${args.join(" ")}: ${r.stdout}${r.stderr}`);
        assert.equal(r.stdout.trim().split("\n").length, 1, r.stdout);
      }
      assert.match(w.build("--out", out, "--version", "1.0", "--build", "7", "--vendor", w.vendor, "--sparkle", w.sparkle).stdout, /^The version is not one like 1\.0\.0 or 1\.0\.0-beta\.1\.$/m);
      const fake = w.build(...all, "--fake-engine", "--sign");
      assert.equal(fake.status, 2);
      assert.equal(fake.stdout.trim(), "A build with the stand-in engine is never signed with the Developer ID.");
      assert.equal(existsSync(out), false);
      assert.equal(w.ran(), "");
    } finally {
      w.cleanup();
    }
  });

  it("--sparkle is needed", () => {
    const w = world();
    try {
      const out = join(w.dir, "out");
      const all = w.needed(out).slice(0, -2);
      for (const extra of [[], ["--print"]]) {
        const r = w.build(...all, ...extra);
        assert.equal(r.status, 2, r.stdout + r.stderr);
        assert.equal(r.stdout.trim(), "Say where Sparkle is: --sparkle and the archive fetch-sparkle.sh fetched.");
      }
      // It comes after the version's and the build's faults.
      const version = w.build("--out", out, "--version", "1.0", "--build", "7", "--vendor", w.vendor);
      assert.equal(version.status, 2);
      assert.equal(version.stdout.trim(), "The version is not one like 1.0.0 or 1.0.0-beta.1.");
      const build = w.build("--out", out, "--version", VERSION, "--build", "0", "--vendor", w.vendor);
      assert.equal(build.status, 2);
      assert.equal(build.stdout.trim(), "The build is not a whole number above 0.");
      assert.equal(existsSync(out), false);
      assert.equal(w.ran(), "");
    } finally {
      w.cleanup();
    }
  });

  it("an archive that is not the pinned one, or a pin with no public key, stops the build before anything is written", () => {
    const w = world();
    try {
      const out = join(w.dir, "out");
      const all = w.needed(out).slice(0, -2);
      const other = join(w.dir, "other.tar.xz");
      writeFileSync(other, "not Sparkle's archive\n");
      for (const archive of [other, join(w.dir, "missing.tar.xz")]) {
        for (const extra of [[], ["--print"], ["--sign"]]) {
          const r = w.build(...all, "--sparkle", archive, ...extra);
          assert.equal(r.status, 1, r.stdout + r.stderr);
          assert.equal(r.stdout.trim(), "That is not the pinned Sparkle archive, so it was not unpacked.");
          assert.equal(existsSync(out), false);
          assert.deepEqual(readdirSync(w.tmp), []);
          assert.equal(w.ran(), "");
        }
      }
      // The pin with no public key is committed, and origin/main moved to it, so that the build refuses neither an uncommitted change
      // nor the commit.
      writeFileSync(w.pinFile, `${JSON.stringify({ ...JSON.parse(readFileSync(w.pinFile, "utf8")), publicKey: "" }, null, 2)}\n`);
      w.git("add", ".");
      w.git("commit", "-q", "-m", "three");
      w.git("update-ref", "refs/remotes/origin/main", w.git("rev-parse", "HEAD"));
      for (const extra of [[], ["--print"], ["--sign"]]) {
        const r = w.build(...w.needed(out), ...extra);
        assert.equal(r.status, 1, r.stdout + r.stderr);
        assert.equal(r.stdout.trim(), "The update key's public half is not in sparkle.pin.json yet. Reading it is a by-hand step.");
        assert.equal(existsSync(out), false);
        assert.deepEqual(readdirSync(w.tmp), []);
        assert.equal(w.ran(), "");
      }
    } finally {
      w.cleanup();
    }
  });

  it("signing needs exactly one Developer ID Application identity", () => {
    for (const [identities, n] of [[[], 0], [[IDENTITY, IDENTITY.replace("1) 1111", "3) 3333")], 2]]) {
      const w = world({ identities });
      try {
        const out = join(w.dir, "out");
        const r = w.build(...w.needed(out), "--sign");
        assert.equal(r.status, 1);
        assert.match(r.stdout, new RegExp(`^Signing needs exactly one Developer ID Application identity in the keychain, and this Mac found ${n} Developer ID Application identities\\.$`, "m"));
        assert.equal(/^codesign /m.test(w.ran()), false);
        assert.equal(existsSync(out), false);
      } finally {
        w.cleanup();
      }
    }
  });

  it("it replaces only its own app and zip", () => {
    const w = world();
    try {
      const out = join(w.dir, "out");
      mkdirSync(out);
      writeFileSync(join(out, "keep.txt"), "mine\n");
      built(w, "out");
      writeFileSync(join(out, APP, "stale.txt"), "from before\n");
      const again = built(w, "out");
      assert.equal(readFileSync(join(out, "keep.txt"), "utf8"), "mine\n");
      assert.deepEqual(readdirSync(out).sort(), [APP, `BRIMM-Video-Studio-${VERSION}.zip`, "keep.txt"].sort());
      assert.equal(existsSync(join(again.app, "stale.txt")), false);
    } finally {
      w.cleanup();
    }
  });

  it("an out folder the launch agent watches, or in Dropbox or the drop folder, is refused", () => {
    const w = world();
    try {
      const watched = join(w.dir, "watched");
      mkdirSync(watched);
      mkdirSync(join(w.home, "Library", "LaunchAgents"), { recursive: true });
      writeFileSync(
        join(w.home, "Library", "LaunchAgents", "com.thebrimm.unedited.plist"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.thebrimm.unedited</string><key>WatchPaths</key><array><string>${watched}</string></array></dict></plist>\n`,
      );
      const drop = join(w.home, "BRIMM Video Work", "Drop");
      mkdirSync(drop, { recursive: true });
      for (const out of [join(watched, "x"), join(w.home, "Dropbox", "x"), join(drop, "x")]) {
        const r = w.build(...w.needed(out));
        assert.equal(r.status, 1, out);
        assert.equal(r.stdout.trim(), WATCHED);
        assert.equal(existsSync(out), false);
      }
      assert.equal(w.ran(), "");
      assert.deepEqual(readdirSync(w.tmp), []);
    } finally {
      w.cleanup();
    }
  });

  it("--fake-engine leaves only the stand-in and the real guide's page in the bundle's tool", () => {
    const w = world();
    try {
      const { app, r } = built(w, "out", "--fake-engine");
      const tool = join(app, "Contents", "Resources", "Studio", "tool");
      assert.deepEqual(tree(tool), ["package.json", "setup", "setup/engine.js", "setup/sample-guide.html"]);
      assert.deepEqual(readFileSync(join(tool, "setup", "engine.js")), readFileSync(FAKE_ENGINE));
      const guide = readFileSync(join(tool, "setup", "sample-guide.html"), "utf8");
      for (const words of ["Studio Test Mac", VERSION, 'url("data:font/']) assert.ok(guide.includes(words), words);
      assert.equal(guide.includes("{{"), false);
      assert.ok(existsSync(join(app, "Contents", "Resources", "FAKE-ENGINE.txt")));
      assert.ok(existsSync(join(app, "Contents", "Resources", "Studio", "build.json")));
      assert.ok(r.stdout.includes("This build's setup is a stand-in: it is for looking at the windows, and sets up nothing."), r.stdout);
      // The helpers are still there: the bin is the same as a real build's.
      assert.ok(existsSync(join(app, "Contents", "Resources", "node", "bin", "brimm-faces")));
      // It carries Sparkle as a real build does, signed in the same order.
      assert.ok(lstatSync(join(app, "Contents", "Frameworks", "Sparkle.framework", "Versions", "Current")).isSymbolicLink());
      const force = forced(w.ran());
      assert.deepEqual(force.slice(nodeLines(force).length).map(inApp), [...SPARKLE_PARTS, APP]);
    } finally {
      w.cleanup();
    }
  });

  it("a sample guide that cannot be made stops the build", () => {
    const w = world();
    try {
      // The change is committed, and origin/main moved to it, so that the build refuses neither an uncommitted change nor the commit.
      writeFileSync(join(w.tool, "studio-app", "sample-guide.js"), "process.exit(1);\n");
      w.git("add", ".");
      w.git("commit", "-q", "-m", "three");
      w.git("update-ref", "refs/remotes/origin/main", w.git("rev-parse", "HEAD"));
      const out = join(w.dir, "out");
      const r = w.build(...w.needed(out), "--fake-engine");
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, /^The real guide's page could not be made with sample details\.$/m);
      assert.equal(existsSync(out), false);
      assert.deepEqual(readdirSync(w.tmp), []);
    } finally {
      w.cleanup();
    }
  });
});
