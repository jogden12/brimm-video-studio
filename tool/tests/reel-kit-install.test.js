// The install of a pinned Reel Kit beside Studio's toolchain (reel-kit-install.js; plan Task 5). Nothing real is run or fetched:
// every program is a stand-in (uv is tests/stand-ins/uv.mjs; npm, tar, unzip, ffmpeg, ffprobe and curl are small node scripts made
// here, each run by a /bin/sh line), the kit's setup.sh is a stand-in that only answers --check, and `fetch` serves made-up bytes
// whose SHA-256 the test's own pin holds. Only the test's node and /bin/sh run.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PIN, binDir, folderFingerprint, hfDir, kitDir, npxShim, hfCli, reelKitHome } from "../reel-kit.js";
import { PIN as HF_PIN } from "../hyperframes.js";
import { workFolder } from "../settings.js";
import { INSTALL_WHY, STEP_IDS, curlFetch, installPlan, runInstall, takeAwayScratch } from "../reel-kit-install.js";

const TOOL = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE_KIT = fileURLToPath(new URL("./fixtures/reel-kit-1.2.0/kit", import.meta.url));
const UV_STAND_IN = fileURLToPath(new URL("./stand-ins/uv.mjs", import.meta.url));
const NODE = process.execPath;
const q = (text) => `'${String(text).replace(/'/g, "'\\''")}'`;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const CREDIT = "Reel Kit is part of a made-up course, for this test.";
const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A stand-in program: `<name>.mjs` holding `source`, run by a /bin/sh script `<name>` with this test's node. */
function standIn(dir, name, source) {
  writeFileSync(join(dir, `${name}.mjs`), source);
  writeFileSync(join(dir, name), `#!/bin/sh\nexec ${q(NODE)} ${q(join(dir, `${name}.mjs`))} "$@"\n`);
  chmodSync(join(dir, name), 0o755);
  return join(dir, name);
}

/** Reel Kit's setup.sh as a stand-in: it writes how it was run to the log in HOME, answers only --check, runs its "render test"
    through the npx it finds on PATH (Studio's, in tools/bin), and ends READY unless HOME holds setup-not-ready. */
const setupSh = (hfVersion) => `#!/bin/sh
echo "$*" >> "$HOME/setup-stand-in.log"
[ "$1" = "--check" ] || { echo "setup stand-in: run without --check"; exit 3; }
v=$(npx -y hyperframes@${hfVersion} --version) || { echo "NOT READY: npx did not run HyperFrames"; exit 1; }
echo "STATUS hyperfrm  OK      hyperframes $v"
if [ -f "$HOME/setup-not-ready" ]; then echo "STATUS venv      MISSING"; echo "NOT READY: apply the fixes above, then run setup again"; exit 1; fi
echo "${CREDIT}"
echo "READY"
`;

/** A pinned HyperFrames as a stand-in, put in place by the npm stand-in: --version (its own, from the folder npm put it in) and
    browser ensure, each written to HOME's log with the program's own path. */
const HF_SOURCE = `import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
const cli = fileURLToPath(import.meta.url);
appendFileSync(process.env.HOME + "/hf-stand-in.log", JSON.stringify({ args, cli, offline: ["HF_HUB_OFFLINE", "PIP_NO_INDEX", "UV_OFFLINE"].filter((k) => k in process.env) }) + "\\n");
if (args[0] === "--version") { console.log(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version); process.exit(0); }
if (args[0] === "browser" && args[1] === "ensure") process.exit(0);
process.exit(2);
`;

/** A Mac's world for one install: a home, a dropped kit (the fixture kit with a stand-in setup.sh, and its LICENSE beside it), a
    pin whose every download is one `fetch` serves, and the stand-in programs. */
function world({ vp9 = true, gsapVersion = PIN.gsap.version, integrity = PIN.hyperframes.integrity, hfVersion = PIN.hyperframes.version, bad = {} } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "rk-install-")));
  roots.push(root);
  const home = join(root, "home");
  mkdirSync(home);
  const bin = join(root, "stand-ins");
  mkdirSync(bin);
  const log = join(bin, "uv.log");

  const download = join(root, "download");
  const kit = join(download, "skills", "reel-kit");
  cpSync(FIXTURE_KIT, kit, { recursive: true });
  writeFileSync(join(kit, "setup", "setup.sh"), setupSh(hfVersion));
  writeFileSync(join(download, "LICENSE"), "A made-up licence.\n");
  const drop = { ok: true, kit, version: "1.2.0", fingerprint: folderFingerprint(kit), hyperframes: hfVersion, gsap: gsapVersion, requirementsSha: "0".repeat(64), license: join(download, "LICENSE") };

  const served = new Map();
  const serve = (url, text) => {
    served.set(url, Buffer.from(text));
    return sha(Buffer.from(text));
  };
  // The test's pin of the version in use: the made-up kit is the pinned one, and every download is one fetch serves.
  const pin = JSON.parse(JSON.stringify(PIN));
  pin.fingerprint = drop.fingerprint;
  pin.hyperframes.version = hfVersion;
  pin.uv.sha256 = serve(pin.uv.url, "a made-up uv tarball");
  pin.gsap = gsapVersion === HF_PIN.gsap.version
    ? { ...pin.gsap, version: gsapVersion }
    : { ...pin.gsap, version: gsapVersion, sha256: serve(pin.gsap.url, `/*!\n * GSAP ${gsapVersion}\n * made up\n */\n`) };
  pin.models = pin.models.map((m) => ({ ...m, sources: m.sources.map((s, i) => ({ url: s.url, sha256: serve(s.url, `model ${m.name} from source ${i}`) })) }));
  const resolveUrl = (path) => `https://huggingface.co/${pin.whisper.repo}/resolve/${pin.whisper.revision}/${path}`;
  pin.whisper.files = pin.whisper.files.map((f) => ({ path: f.path, sha256: serve(resolveUrl(f.path), `whisper ${f.path}`) }));
  pin.ffmpeg.ffmpeg.sha256 = serve(pin.ffmpeg.ffmpeg.url, "a made-up ffmpeg zip");
  pin.ffmpeg.ffprobe.sha256 = serve(pin.ffmpeg.ffprobe.url, "a made-up ffprobe zip");
  const fetched = [];
  const fetch = async (url, dest) => {
    fetched.push(url);
    if (!served.has(url)) return { code: 22 };
    writeFileSync(dest, bad[url] ?? served.get(url));
    return { code: 0 };
  };

  // uv comes out of the pinned tarball: the tar stand-in puts there a small script that runs uv.mjs with the log baked in.
  const uvWrapper = `#!/bin/sh\nUV_STAND_IN_LOG=${q(log)} exec ${q(NODE)} ${q(UV_STAND_IN)} "$@"\n`;
  const triple = basename(pin.uv.url).replace(/\.tar\.gz$/, "");
  const programs = {
    node: NODE,
    sh: "/bin/sh",
    npm: standIn(bin, "npm", `import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(bin, "npm.log"))}, JSON.stringify(args) + "\\n");
const prefix = args[args.indexOf("--prefix") + 1];
const pkg = join(prefix, "node_modules", "hyperframes");
mkdirSync(join(pkg, "bin"), { recursive: true });
writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "hyperframes", version: args.at(-1).replace("hyperframes@", "") }));
writeFileSync(join(prefix, "package-lock.json"), JSON.stringify({ packages: { "node_modules/hyperframes": { integrity: ${JSON.stringify(integrity)} } } }));
writeFileSync(join(pkg, "bin", "hyperframes.mjs"), ${JSON.stringify(HF_SOURCE)});
`),
    tar: standIn(bin, "tar", `import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
if (args[0] !== "-xzf") process.exit(2);
const into = join(args[args.indexOf("-C") + 1], ${JSON.stringify(triple)});
mkdirSync(into, { recursive: true });
writeFileSync(join(into, "uv"), ${JSON.stringify(uvWrapper)});
chmodSync(join(into, "uv"), 0o755);
`),
    unzip: standIn(bin, "unzip", `import { appendFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(bin, "unzip.log"))}, JSON.stringify(args) + "\\n");
if (args[0] !== "-x" || args[1] !== "-k") process.exit(2);
writeFileSync(join(args[3], basename(args[2], ".zip")), "#!/bin/sh\\necho Reel Kit's ffmpeg\\n");
`),
    ffmpeg: standIn(bin, "ffmpeg", `console.log("Encoders:\\n V....D libx264  H.264${vp9 ? "\\n V....D libvpx-vp9  libvpx VP9" : ""}");\n`),
    ffprobe: standIn(bin, "ffprobe", "process.exit(0);\n"),
    curl: standIn(bin, "curl", `import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(bin, "curl.log"))}, JSON.stringify(args) + "\\n");
writeFileSync(args[args.indexOf("-o") + 1], "curl got " + args.at(-1));
`)
  };
  const lines = (file) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : []);
  return {
    root, home, drop, pin, fetch, fetched, programs, bin,
    uvRuns: () => lines(log).map((line) => JSON.parse(line)),
    setupRuns: () => lines(join(home, "setup-stand-in.log")),
    npmRuns: () => lines(join(bin, "npm.log")),
    scenario: (value) => writeFileSync(join(bin, "uv-stand-in.json"), JSON.stringify(value)),
    install: (plan, more = {}) => runInstall({ home, drop, plan: plan ?? installPlan({ home, drop, pin, mode: "dev" }), programs, fetch, ...more })
  };
}

/** Everything under a folder, by its relative path: a file's SHA-256, a link's target, or "folder". */
function snapshot(dir) {
  const seen = {};
  const walk = (at, rel) => {
    for (const name of readdirSync(at).sort()) {
      const path = join(at, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const kind = lstatSync(path);
      if (kind.isSymbolicLink()) seen[relPath] = `-> ${readlinkSync(path)}`;
      else if (kind.isDirectory()) {
        seen[relPath] = "folder";
        walk(path, relPath);
      } else seen[relPath] = sha(readFileSync(path));
    }
  };
  walk(dir, "");
  return seen;
}

/** Every name under a folder, relative, that ends .new or .old: what a stage left half made. */
function leftovers(dir) {
  const found = [];
  const walk = (at, rel) => {
    let names = [];
    try {
      names = readdirSync(at);
    } catch {
      return;
    }
    for (const name of names) {
      const path = join(at, name);
      const relPath = rel ? `${rel}/${name}` : name;
      if (/\.(new|old|part)$/.test(name)) found.push(relPath);
      if (lstatSync(path).isDirectory()) walk(path, relPath);
    }
  };
  walk(dir, "");
  return found;
}

describe("installPlan", () => {
  it("plans every step, saying here already for what matches its pin", async () => {
    const w = world();
    const first = installPlan({ home: w.home, drop: w.drop, pin: w.pin, mode: "dev" });
    assert.equal(first.refused, "");
    assert.deepEqual(first.steps.map((s) => s.id), ["kit", "python", "venv", "mp", "hyperframes", "chrome", "gsap", "models", "whisper", "bin", "check"]);
    assert.deepEqual(STEP_IDS, first.steps.map((s) => s.id));
    assert.ok(first.steps.every((s) => s.needed), JSON.stringify(first.steps));
    assert.ok(first.steps.every((s) => !/here already/.test(s.words) && !s.words.includes("/")), JSON.stringify(first.steps));
    assert.equal(first.steps[0].words, "Reel Kit 1.2.0's files");

    const done = await w.install(first);
    assert.equal(done.ok, true, done.lines.join("\n"));
    const again = installPlan({ home: w.home, drop: w.drop, pin: w.pin, mode: "dev" });
    for (const step of again.steps) {
      const always = step.id === "chrome" || step.id === "check";
      assert.equal(step.needed, always, step.id);
      assert.equal(step.words.endsWith(": here already"), !always, step.words);
    }
    assert.equal(again.steps[0].words, "Reel Kit 1.2.0's files: here already");

    // A second run fetches nothing and builds nothing: each stage finds its pin already there.
    const fetchedBefore = w.fetched.length;
    const uvBefore = w.uvRuns().length;
    const second = await w.install(again);
    assert.equal(second.ok, true, second.lines.join("\n"));
    assert.equal(w.fetched.length, fetchedBefore);
    assert.equal(w.uvRuns().length, uvBefore);
    assert.equal(w.npmRuns().length, 1);
    assert.ok(second.lines.includes("Reel Kit 1.2.0's files: here already."), second.lines.join("\n"));
  });

  it("refuses an untested Reel Kit on an installed Mac", () => {
    const w = world();
    const plan = installPlan({ home: w.home, drop: { ...w.drop, fingerprint: `sha256-${"0".repeat(64)}` }, pin: w.pin, mode: "installed" });
    assert.equal(plan.refused, "This Reel Kit hasn't been tested yet: ask Jason.");
    assert.equal(plan.refused, INSTALL_WHY.untested);
    assert.deepEqual(plan.steps, []);
    assert.equal(installPlan({ home: w.home, drop: { ok: false, why: "That isn't Reel Kit." }, pin: w.pin, mode: "dev" }).refused, "That isn't Reel Kit.");
    assert.throws(() => installPlan({ home: w.home, drop: w.drop, pin: w.pin, mode: "other" }), /mode/);
    assert.equal(installPlan({ home: w.home, drop: undefined, pin: w.pin, mode: "dev" }).refused, INSTALL_WHY.noDrop);
  });

  it("refuses a dev drop of the version in use that isn't the pinned one", () => {
    const w = world();
    const plan = installPlan({ home: w.home, drop: { ...w.drop, fingerprint: `sha256-${"2".repeat(64)}` }, pin: w.pin, mode: "dev" });
    assert.equal(plan.refused, INSTALL_WHY.sameVersion("1.2.0"));
    assert.equal(plan.refused, "That Reel Kit says it is 1.2.0, the version in use, but it isn't the same as the one Studio pins, so it wasn't taken in: ask Jason.");
    assert.deepEqual(plan.steps, []);
  });

  it("refuses a Reel Kit whose HyperFrames or GSAP the pin doesn't hold", () => {
    const w = world();
    assert.equal(installPlan({ home: w.home, drop: { ...w.drop, hyperframes: "0.8.140" }, pin: w.pin, mode: "dev" }).refused, INSTALL_WHY.hyperframes);
    assert.equal(installPlan({ home: w.home, drop: { ...w.drop, gsap: "3.16.0" }, pin: w.pin, mode: "dev" }).refused, INSTALL_WHY.gsap);
  });
});

describe("runInstall", () => {
  it("installs every piece where Reel Kit looks for it", async () => {
    const w = world();
    const done = await w.install();
    assert.equal(done.ok, true, done.lines.join("\n"));
    const rkh = reelKitHome(w.home);
    const kit = kitDir(w.home, "1.2.0");
    assert.equal(folderFingerprint(kit), w.drop.fingerprint);
    assert.equal(readFileSync(join(workFolder(w.home), ".toolchain", "reel-kit-1.2.0.LICENSE"), "utf8"), "A made-up licence.\n");
    assert.ok(!existsSync(join(kit, "LICENSE")));
    for (const venv of [".venv", ".venv-mp"]) {
      assert.equal(readFileSync(join(rkh, venv, "lib", "python3.12", "site-packages", "reel-kit.pth"), "utf8"), `${join(kit, "pipeline")}\n`, venv);
      assert.match(readFileSync(join(rkh, venv, "pyvenv.cfg"), "utf8"), /relocatable = true/);
    }
    assert.equal(readFileSync(join(rkh, ".venv", "lib", "python3.12", "site-packages", "installed.txt"), "utf8").trim(), join(TOOL, w.pin.locks.main.file));
    assert.equal(readFileSync(join(rkh, ".venv-mp", "lib", "python3.12", "site-packages", "installed.txt"), "utf8").trim(), join(TOOL, w.pin.locks.mp.file));
    assert.ok(statSync(join(rkh, "tools", "uv", "uv")).isFile());
    assert.ok(statSync(join(hfDir(w.home), "node_modules", "hyperframes", "bin", "hyperframes.mjs")).isFile());
    for (const m of w.pin.models) assert.equal(sha(readFileSync(join(rkh, "models", m.name))), m.sources[0].sha256, m.name);

    // tools/bin: links to Studio's node, ffmpeg and ffprobe and uv's python3, and npx a real file of mode 0755 that serves the pin.
    const bin = binDir(w.home);
    assert.equal(readlinkSync(join(bin, "node")), NODE);
    assert.equal(readlinkSync(join(bin, "ffmpeg")), w.programs.ffmpeg);
    assert.equal(readlinkSync(join(bin, "ffprobe")), w.programs.ffprobe);
    assert.equal(readlinkSync(join(bin, "python3")), join(rkh, "tools", "python", "cpython-3.12.14-macos-aarch64-none", "bin", "python3.12"));
    assert.ok(lstatSync(join(bin, "npx")).isFile());
    assert.equal(lstatSync(join(bin, "npx")).mode & 0o777, 0o755);
    assert.equal(readFileSync(join(bin, "npx"), "utf8"), npxShim({ node: NODE, cli: hfCli(w.home), version: PIN.hyperframes.version }));

    // uv ran with the network only to fetch Python and the locked packages; python install never put a Python in ~/.local/bin.
    const runs = w.uvRuns();
    assert.deepEqual(runs.map((r) => r.args.slice(0, 2).join(" ")), ["python install", "python find", "venv --relocatable", "pip install", "venv --relocatable", "pip install"]);
    for (const r of runs) {
      assert.equal(r.env.UV_OFFLINE, undefined, r.args.join(" "));
      assert.equal(r.env.UV_PYTHON_PREFERENCE, "only-managed");
      assert.equal(r.env.UV_NO_CONFIG, "1");
      assert.equal(r.env.REEL_KIT_HOME, rkh);
    }
    assert.equal(runs[0].env.UV_PYTHON_INSTALL_BIN, "0");
    assert.deepEqual(runs[0].args, ["python", "install", "3.12.14"]);
    for (const r of runs.slice(2)) assert.equal(r.env.UV_PYTHON_DOWNLOADS, "never");

    // npm installed 0.8.139 beside Studio's own, with none of its scripts run; Chrome was fetched with the network on.
    assert.deepEqual(JSON.parse(w.npmRuns()[0]), ["install", "--prefix", `${hfDir(w.home)}.new`, "--ignore-scripts", "--no-fund", "--no-audit", "--save-exact", `hyperframes@${PIN.hyperframes.version}`]);
    const hf = readFileSync(join(w.home, "hf-stand-in.log"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    assert.deepEqual(hf[0], { args: ["browser", "ensure"], cli: hfCli(w.home), offline: [] });
    // The render test of setup --check ran HyperFrames through Studio's npx, with the network off.
    assert.deepEqual(hf[1], { args: ["--version"], cli: hfCli(w.home), offline: ["HF_HUB_OFFLINE", "PIP_NO_INDEX", "UV_OFFLINE"] });

    // Every fetch was of the pin, and nothing was left half made.
    const pinned = new Set([w.pin.uv.url, ...w.pin.models.flatMap((m) => m.sources.map((s) => s.url)), ...w.pin.whisper.files.map((f) => `https://huggingface.co/${w.pin.whisper.repo}/resolve/${w.pin.whisper.revision}/${f.path}`), w.pin.gsap.url]);
    assert.ok(w.fetched.every((url) => pinned.has(url)), w.fetched.join("\n"));
    assert.deepEqual(leftovers(workFolder(w.home)), []);
  });

  it("runs setup only with --check, and never pip", async () => {
    const w = world();
    const done = await w.install();
    assert.equal(done.ok, true, done.lines.join("\n"));
    assert.deepEqual(w.setupRuns(), ["--check"]);
    const pips = w.uvRuns().filter((r) => r.args.includes("pip"));
    assert.equal(pips.length, 2);
    for (const r of pips) {
      assert.deepEqual(r.args.slice(0, 2), ["pip", "install"]);
      for (const flag of ["--require-hashes", "--no-deps", "-r"]) assert.ok(r.args.includes(flag), `${flag}: ${r.args.join(" ")}`);
      assert.ok([w.pin.locks.main.file, w.pin.locks.mp.file].some((f) => r.args.at(-1) === join(TOOL, f)), r.args.join(" "));
    }
    // No Python was ever asked to run pip (the stand-in Pythons write each run to the uv log as "python ...").
    const log = readFileSync(join(w.bin, "uv.log"), "utf8");
    assert.doesNotMatch(log, /^python .*-m pip/m);
  });

  it("takes a download away whose sha256 is not the pin's, and stops", async () => {
    const w = world({ bad: { [PIN.uv.url]: "something else" } });
    const done = await w.install();
    assert.equal(done.ok, false);
    assert.ok(done.lines.includes(INSTALL_WHY.notPinned("Reel Kit's Python installer")), done.lines.join("\n"));
    assert.ok(done.lines.includes(INSTALL_WHY.leftAsWas), done.lines.join("\n"));
    assert.deepEqual(w.fetched, [w.pin.uv.url]);
    assert.deepEqual(w.uvRuns(), []);
    assert.deepEqual(w.npmRuns(), []);
    const rkh = reelKitHome(w.home);
    assert.ok(!existsSync(join(rkh, "tools", "uv")) && !existsSync(join(rkh, "tools", "uv.new")));
    assert.ok(!existsSync(kitDir(w.home, "1.2.0")));
    assert.deepEqual(leftovers(workFolder(w.home)), []);

    // A model whose every source is wrong stops the install too, and only after each source was tried.
    const pose = PIN.models.find((m) => m.sources.length > 1);
    const m = world({ bad: Object.fromEntries(pose.sources.map((s) => [s.url, "not the model"])) });
    const got = await m.install();
    assert.equal(got.ok, false);
    assert.ok(got.lines.includes(INSTALL_WHY.notPinned("Reel Kit's tracking and depth models")), got.lines.join("\n"));
    assert.deepEqual(m.fetched.filter((u) => pose.sources.some((s) => s.url === u)), pose.sources.map((s) => s.url));
    assert.ok(!existsSync(join(reelKitHome(m.home), "models", pose.name)));
    assert.deepEqual(leftovers(workFolder(m.home)), []);
  });

  it("refuses npm's HyperFrames when its integrity is not the pin's", async () => {
    const w = world({ integrity: `sha512-${"A".repeat(86)}==` });
    const done = await w.install();
    assert.equal(done.ok, false);
    assert.ok(done.lines.includes(INSTALL_WHY.hyperframesWrong), done.lines.join("\n"));
    assert.ok(!existsSync(hfDir(w.home)) && !existsSync(`${hfDir(w.home)}.new`));
    assert.deepEqual(leftovers(workFolder(w.home)), []);
  });

  it("leaves the version in use as it was when a stage fails", async () => {
    const w = world();
    // The version in use: 1.1.0's kit, and a main environment of its own.
    const old = kitDir(w.home, "1.1.0");
    mkdirSync(old, { recursive: true });
    writeFileSync(join(old, "VERSION"), "1.1.0\n");
    const oldPrint = folderFingerprint(old);
    const rkh = reelKitHome(w.home);
    mkdirSync(join(rkh, ".venv", "bin"), { recursive: true });
    writeFileSync(join(rkh, ".venv", "made-by-1.1.0"), "yes\n");
    writeFileSync(join(rkh, ".setup-version"), "1.1.0\n");
    w.scenario({ fail: "pip install" });
    const done = await w.install();
    assert.equal(done.ok, false);
    assert.ok(done.lines.includes(INSTALL_WHY.leftAsWas), done.lines.join("\n"));
    assert.equal(folderFingerprint(old), oldPrint);
    assert.ok(!existsSync(kitDir(w.home, "1.2.0")), "no reel-kit-1.2.0 left half made");
    assert.ok(!existsSync(join(workFolder(w.home), ".toolchain", "reel-kit-1.2.0.LICENSE")));
    assert.equal(readFileSync(join(rkh, ".venv", "made-by-1.1.0"), "utf8"), "yes\n");
    assert.equal(readFileSync(join(rkh, ".setup-version"), "utf8"), "1.1.0\n");
    // The Python made before the failing stage is taken away again: nothing of this run stays.
    assert.ok(!existsSync(join(rkh, "tools", "python")) && !existsSync(join(rkh, "tools", "uv")));
    assert.deepEqual(leftovers(workFolder(w.home)), []);
  });

  it("refuses a kit that changed while it was being copied", async () => {
    const w = world();
    // The download as it was read, then changed before the copy.
    writeFileSync(join(w.drop.kit, "pipeline", "common.py"), "# changed after it was read\n", { flag: "a" });
    const done = await w.install();
    assert.equal(done.ok, false);
    assert.ok(done.lines.includes(INSTALL_WHY.kitChanged), done.lines.join("\n"));
    assert.ok(!existsSync(kitDir(w.home, "1.2.0")));
    assert.deepEqual(leftovers(workFolder(w.home)), []);
  });

  it("writes .setup-version only after READY", async () => {
    const w = world();
    writeFileSync(join(w.home, "setup-not-ready"), "");
    const notReady = await w.install();
    assert.equal(notReady.ok, false);
    assert.ok(notReady.lines.includes(INSTALL_WHY.notReady), notReady.lines.join("\n"));
    assert.equal(notReady.credit, "");
    const marker = join(reelKitHome(w.home), ".setup-version");
    assert.ok(!existsSync(marker));
    assert.ok(!existsSync(kitDir(w.home, "1.2.0")));

    rmSync(join(w.home, "setup-not-ready"));
    const ready = await w.install();
    assert.equal(ready.ok, true, ready.lines.join("\n"));
    assert.equal(readFileSync(marker, "utf8"), "1.2.0\n");
    assert.deepEqual(w.setupRuns(), ["--check", "--check"]);
  });

  it("passes Reel Kit's credit line on once", async () => {
    const w = world();
    const done = await w.install();
    assert.equal(done.ok, true, done.lines.join("\n"));
    assert.equal(done.credit, CREDIT);
    assert.ok(!done.lines.some((line) => line.includes("Reel Kit is part of")), done.lines.join("\n"));
  });

  it("links Reel Kit's own ffmpeg when Studio's has no libvpx-vp9", async () => {
    const w = world({ vp9: false });
    const done = await w.install();
    assert.equal(done.ok, true, done.lines.join("\n"));
    const own = join(reelKitHome(w.home), "tools", "ffmpeg-9.0.2");
    assert.equal(readlinkSync(join(binDir(w.home), "ffmpeg")), join(own, "ffmpeg"));
    assert.equal(readlinkSync(join(binDir(w.home), "ffprobe")), join(own, "ffprobe"));
    for (const name of ["ffmpeg", "ffprobe"]) {
      assert.ok(lstatSync(join(own, name)).isFile());
      assert.equal(statSync(join(own, name)).mode & 0o777, 0o755);
      assert.ok(!existsSync(join(own, `${name}.zip`)));
    }
    assert.ok(w.fetched.includes(w.pin.ffmpeg.ffmpeg.url) && w.fetched.includes(w.pin.ffmpeg.ffprobe.url));

    const studio = world({ vp9: true });
    assert.equal((await studio.install()).ok, true);
    assert.equal(readlinkSync(join(binDir(studio.home), "ffmpeg")), studio.programs.ffmpeg);
    assert.ok(!studio.fetched.includes(studio.pin.ffmpeg.ffmpeg.url));
    assert.ok(!existsSync(join(reelKitHome(studio.home), "tools", "ffmpeg-9.0.2")));
  });

  it("copies Studio's GSAP when the versions match, and fetches the pinned one when they don't", async () => {
    const same = world({ gsapVersion: HF_PIN.gsap.version });
    assert.equal((await same.install()).ok, true);
    const copied = readFileSync(join(reelKitHome(same.home), "vendor", "gsap.min.js"));
    assert.ok(copied.equals(readFileSync(join(TOOL, "vendor", "gsap.min.js"))));
    assert.ok(!same.fetched.includes(same.pin.gsap.url));

    const other = world({ gsapVersion: "3.15.0" });
    assert.equal((await other.install()).ok, true);
    const fetched = readFileSync(join(reelKitHome(other.home), "vendor", "gsap.min.js"), "utf8");
    assert.match(fetched.slice(0, 400), /GSAP 3\.15\.0/);
    assert.equal(sha(fetched), other.pin.gsap.sha256);
    assert.ok(other.fetched.includes(other.pin.gsap.url));
  });

  it("puts faster-whisper medium where local_files_only finds it", async () => {
    const w = world();
    assert.equal((await w.install()).ok, true);
    const { revision, files } = w.pin.whisper;
    const repo = join(reelKitHome(w.home), "hf", "hub", "models--Systran--faster-whisper-medium");
    assert.equal(readFileSync(join(repo, "refs", "main"), "utf8"), revision);
    for (const f of files) {
      const link = join(repo, "snapshots", revision, f.path);
      assert.ok(lstatSync(link).isSymbolicLink(), f.path);
      assert.equal(readlinkSync(link), `../../blobs/${f.sha256}`);
      assert.equal(sha(readFileSync(link)), f.sha256);
      assert.ok(lstatSync(join(repo, "blobs", f.sha256)).isFile());
    }
    assert.deepEqual(readdirSync(join(repo, "snapshots")), [revision]);
    assert.deepEqual(readdirSync(join(repo, "blobs")).sort(), files.map((f) => f.sha256).sort());
  });

  it("removes the drop's scratch folder when it ends, only inside the toolchain's incoming", async () => {
    const w = world();
    const incoming = join(workFolder(w.home), ".toolchain", "incoming", "0123456789abcdef");
    mkdirSync(incoming, { recursive: true });
    writeFileSync(join(incoming, "unpacked"), "");
    w.scenario({ fail: "venv" });
    const failed = await runInstall({ home: w.home, drop: { ...w.drop, scratch: incoming }, plan: installPlan({ home: w.home, drop: w.drop, pin: w.pin, mode: "dev" }), programs: w.programs, fetch: w.fetch });
    assert.equal(failed.ok, false);
    assert.ok(!existsSync(incoming));

    const elsewhere = join(w.root, "not-incoming");
    mkdirSync(elsewhere);
    takeAwayScratch(w.home, { scratch: elsewhere });
    assert.ok(existsSync(elsewhere));
  });

  it("stops when asked, and leaves what was in use", async () => {
    const w = world();
    const stop = new AbortController();
    stop.abort();
    const done = await w.install(undefined, { signal: stop.signal });
    assert.equal(done.ok, false);
    assert.ok(done.lines.includes(INSTALL_WHY.stopped), done.lines.join("\n"));
    assert.ok(!existsSync(kitDir(w.home, "1.2.0")));
  });
});

describe("beside the version in use, and after a killed run", () => {
  it("installs a dev pin's own HyperFrames in a folder of its own, and serves it through npx", async () => {
    const w = world({ hfVersion: "0.8.150" });
    const done = await w.install();
    assert.equal(done.ok, true, done.lines.join("\n"));
    assert.ok(statSync(hfCli(w.home, "0.8.150")).isFile());
    assert.ok(!existsSync(hfDir(w.home)), "nothing written into the hyperframes-0.8.139 folder");
    assert.deepEqual(JSON.parse(w.npmRuns()[0]).slice(2, 3), [`${hfDir(w.home, "0.8.150")}.new`]);
    assert.equal(readFileSync(join(binDir(w.home), "npx"), "utf8"), npxShim({ node: NODE, cli: hfCli(w.home, "0.8.150"), version: "0.8.150" }));
    const hf = readFileSync(join(w.home, "hf-stand-in.log"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    assert.deepEqual(hf.map((r) => [r.args[0], r.cli]), [["browser", hfCli(w.home, "0.8.150")], ["--version", hfCli(w.home, "0.8.150")]]);
  });

  it("installs another version beside the one in use, leaving the shared world and 1.2.0 as they were, and runs no check", async () => {
    const w = world();
    assert.equal((await w.install()).ok, true);
    const rkh = reelKitHome(w.home);
    const shared = snapshot(rkh);
    const kit120 = folderFingerprint(kitDir(w.home, "1.2.0"));
    const hf139 = snapshot(hfDir(w.home));
    const counts = { setup: w.setupRuns().length, fetched: w.fetched.length, uv: w.uvRuns().length };

    // A 1.2.1 download, with the pin written from it (a newer HyperFrames among its values).
    const download = join(w.root, "download-1.2.1");
    const kit = join(download, "skills", "reel-kit");
    cpSync(w.drop.kit, kit, { recursive: true });
    writeFileSync(join(kit, "VERSION"), "1.2.1\n");
    writeFileSync(join(download, "LICENSE"), "A made-up licence, 1.2.1.\n");
    const drop = { ...w.drop, kit, version: "1.2.1", fingerprint: folderFingerprint(kit), hyperframes: "0.8.150", license: join(download, "LICENSE") };
    const next = { ...w.pin, version: "1.2.1", fingerprint: drop.fingerprint, hyperframes: { ...w.pin.hyperframes, version: "0.8.150" } };
    assert.equal(installPlan({ home: w.home, drop, pin: w.pin, mode: "dev" }).refused, INSTALL_WHY.noPinYet);

    const plan = installPlan({ home: w.home, drop, pin: w.pin, next, mode: "dev" });
    assert.equal(plan.refused, "");
    assert.equal(plan.beside, true);
    assert.deepEqual(plan.steps.filter((s) => s.needed).map((s) => s.id), ["kit", "hyperframes"]);
    assert.equal(plan.steps.find((s) => s.id === "python").words, "Python 3.12 for Reel Kit: kept for the version in use until this one is pinned");
    assert.equal(plan.steps.find((s) => s.id === "check").words, INSTALL_WHY.kept("Reel Kit's own check"));

    const done = await runInstall({ home: w.home, drop, plan, programs: w.programs, fetch: w.fetch });
    assert.equal(done.ok, true, done.lines.join("\n"));
    assert.ok(done.lines.includes("Reel Kit's Python packages: kept for the version in use until this one is pinned."), done.lines.join("\n"));
    assert.equal(done.credit, "");
    assert.equal(folderFingerprint(kitDir(w.home, "1.2.1")), drop.fingerprint);
    assert.equal(readFileSync(join(workFolder(w.home), ".toolchain", "reel-kit-1.2.1.LICENSE"), "utf8"), "A made-up licence, 1.2.1.\n");
    assert.ok(statSync(hfCli(w.home, "0.8.150")).isFile());
    // The version in use, its HyperFrames and everything shared are as they were; nothing was fetched, and no check ran.
    assert.deepEqual(snapshot(rkh), shared);
    assert.equal(readFileSync(join(rkh, ".setup-version"), "utf8"), "1.2.0\n");
    assert.equal(folderFingerprint(kitDir(w.home, "1.2.0")), kit120);
    assert.deepEqual(snapshot(hfDir(w.home)), hf139);
    assert.deepEqual({ setup: w.setupRuns().length, fetched: w.fetched.length, uv: w.uvRuns().length }, counts);
    assert.deepEqual(leftovers(workFolder(w.home)), []);
  });

  /** What a run killed after two swaps leaves: the new .venv and .setup-version in place, the ones in use set aside, a .new half made. */
  const killed = (w) => {
    const rkh = reelKitHome(w.home);
    mkdirSync(join(rkh, ".venv.old"), { recursive: true });
    writeFileSync(join(rkh, ".venv.old", "made-by"), "in use\n");
    mkdirSync(join(rkh, ".venv"));
    writeFileSync(join(rkh, ".venv", "made-by"), "the killed run\n");
    writeFileSync(join(rkh, ".setup-version.old"), "1.1.0\n");
    writeFileSync(join(rkh, ".setup-version"), "1.2.0\n");
    mkdirSync(join(rkh, "tools", "uv.new"), { recursive: true });
    return rkh;
  };

  it("puts back what a killed run set aside when it never committed", async () => {
    const w = world({ bad: { [PIN.uv.url]: "stops the run at Python" } });
    const rkh = killed(w);
    const done = await w.install();
    assert.equal(done.ok, false);
    assert.equal(readFileSync(join(rkh, ".venv", "made-by"), "utf8"), "in use\n");
    assert.equal(readFileSync(join(rkh, ".setup-version"), "utf8"), "1.1.0\n");
    assert.deepEqual(leftovers(workFolder(w.home)), []);
  });

  it("keeps what a killed run swapped in once it had committed, and takes its marker away", async () => {
    const w = world({ bad: { [PIN.uv.url]: "stops the run at Python" } });
    const rkh = killed(w);
    const marker = join(workFolder(w.home), ".toolchain", "reel-kit-install.committed");
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(marker, "committed\n");
    const done = await w.install();
    assert.equal(done.ok, false);
    assert.equal(readFileSync(join(rkh, ".venv", "made-by"), "utf8"), "the killed run\n");
    assert.equal(readFileSync(join(rkh, ".setup-version"), "utf8"), "1.2.0\n");
    assert.ok(!existsSync(marker));
    assert.deepEqual(leftovers(workFolder(w.home)), []);
  });

  it("leaves no commit marker after a whole install", async () => {
    const w = world();
    const done = await w.install();
    assert.equal(done.ok, true, done.lines.join("\n"));
    assert.deepEqual(done.leftOver, []);
    assert.ok(!existsSync(join(workFolder(w.home), ".toolchain", "reel-kit-install.committed")));
  });

  it("says plainly that there's nothing to set up when it is given no drop or plan", async () => {
    const w = world();
    const done = await runInstall({ home: w.home, drop: w.drop, plan: undefined, programs: w.programs, fetch: w.fetch });
    assert.deepEqual(done.lines, [INSTALL_WHY.noDrop]);
  });
});

describe("curlFetch", () => {
  it("fetches with curl -fsSL -o <dest> <url>, and nothing else", async () => {
    const w = world();
    const dest = join(w.root, "got");
    const fetch = curlFetch({ curl: w.programs.curl, home: w.home });
    const r = await fetch("https://example.invalid/a", dest);
    assert.equal(r.code, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(w.bin, "curl.log"), "utf8")), ["-fsSL", "-o", dest, "https://example.invalid/a"]);
    assert.equal(readFileSync(dest, "utf8"), "curl got https://example.invalid/a");
    assert.equal(dirname(dest), w.root);
  });
});
