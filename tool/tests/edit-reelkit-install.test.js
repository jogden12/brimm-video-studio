// `reelkit install "<download>" [--yes]` and `reelkit status` (plan Task 6): her chat's way to take in a Reel Kit download she dragged in.
// edit.js is only the wiring (the command's body is reel-kit-commands.js); readDrop, installPlan and runInstall are the modules before it.
// Nothing real is run: the first half's detached start is written down (tests/episodes.js setup), and the detached half is run here, in
// this process, with a stand-in npm (a small node script, run by a /bin/sh line) and a fetch that serves nothing. Only node and /bin/sh run.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { UNSCOPED, gateFor } from "../gate.js";
import { PIN, folderFingerprint, kitDir, pinFrom, reelKitHome } from "../reel-kit.js";
import { INSTALL_WHY, STEP_IDS } from "../reel-kit-install.js";
import { INSTALL_SAY, installLockFile, installResultFile, newPinOf } from "../reel-kit-commands.js";
import { workFolder } from "../settings.js";
import { takeEpisodeLock } from "../detached.js";
import { setup } from "./episodes.js";

const FIXTURE_KIT = fileURLToPath(new URL("./fixtures/reel-kit-1.2.0/kit", import.meta.url));
const NODE = process.execPath;
const q = (text) => `'${String(text).replace(/'/g, "'\\''")}'`;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid", broken: false };
const NOT_YET = "Nothing is installed until Jason says yes.";
/** Nothing she reads holds a path, a flag or the name of a command. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|\bnpm\b|edit\.js|reelkit|\.json\b/;

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A Reel Kit download as the 1.2.0 one is laid out: a plugin folder with skills/reel-kit (the made-up kit) and its LICENSE beside
    skills/, in a Downloads folder of its own. `version` is written into the kit's VERSION. */
function download(t, { version = "1.2.0", name = `reel-kit-plugin-${version}`, hyperframes } = {}) {
  const at = join(t.dir, "Downloads", name);
  const kit = join(at, "skills", "reel-kit");
  mkdirSync(join(at, "skills"), { recursive: true });
  cpSync(FIXTURE_KIT, kit, { recursive: true });
  writeFileSync(join(kit, "VERSION"), `${version}\n`);
  if (hyperframes) writeFileSync(join(kit, "pipeline", "common.py"), readFileSync(join(kit, "pipeline", "common.py"), "utf8").replace("hyperframes@0.8.139", `hyperframes@${hyperframes}`));
  writeFileSync(join(at, "LICENSE"), "A made-up licence.\n");
  return { at, kit, fingerprint: folderFingerprint(kit) };
}

/** The pin of the version in use on the test's Mac: Studio's own, with the made-up 1.2.0 kit as the pinned one. */
function testPin(t) {
  const pin = JSON.parse(JSON.stringify(PIN));
  pin.fingerprint = download(t, { name: "pinned-kit" }).fingerprint;
  return pinFrom(JSON.stringify(pin));
}

/** A stand-in npm, as install.sh runs it: it puts a HyperFrames of the asked version, with the pin's integrity, where --prefix says. */
function npmStandIn(t) {
  const bin = join(t.dir, "stand-ins");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "npm.mjs"), `import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(join(bin, "npm.log"))}, JSON.stringify(args) + "\\n");
const prefix = args[args.indexOf("--prefix") + 1];
const pkg = join(prefix, "node_modules", "hyperframes");
mkdirSync(join(pkg, "bin"), { recursive: true });
writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "hyperframes", version: args.at(-1).replace("hyperframes@", "") }));
writeFileSync(join(prefix, "package-lock.json"), JSON.stringify({ packages: { "node_modules/hyperframes": { integrity: ${JSON.stringify(PIN.hyperframes.integrity)} } } }));
writeFileSync(join(pkg, "bin", "hyperframes.mjs"), "process.exit(0);\\n");
`);
  writeFileSync(join(bin, "npm"), `#!/bin/sh\nexec ${q(NODE)} ${q(join(bin, "npm.mjs"))} "$@"\n`);
  chmodSync(join(bin, "npm"), 0o755);
  return { npm: join(bin, "npm"), runs: () => (existsSync(join(bin, "npm.log")) ? readFileSync(join(bin, "npm.log"), "utf8").split("\n").filter(Boolean) : []) };
}

/** Run `reelkit <words…>` on the made-up Mac `t`: { code, said }. `build` is the Mac's build (dev mode unless given). */
async function reelkit(t, words, { build = { mode: "dev" }, reelKit = {}, env = {}, deps = {} } = {}) {
  const said = [];
  const code = await editMain(["reelkit", ...words], { ...t.ctx.deps, build, env, ...deps, reelKit: { pin: t.pin, ...reelKit }, say: (line) => said.push(line) });
  return { code, said };
}

/** The made-up Mac, with its test pin and a stand-in npm. */
function mac() {
  const t = setup();
  roots.push(t.dir);
  t.dir = realpathSync(t.dir);
  t.pin = testPin(t);
  t.npm = npmStandIn(t);
  t.programs = { node: NODE, npm: t.npm.npm, ffmpeg: "/nonexistent/ffmpeg", ffprobe: "/nonexistent/ffprobe", curl: "/nonexistent/curl" };
  // No download reaches the network: a fetch that serves nothing, and notes each ask.
  t.fetched = [];
  t.fetch = async (url) => {
    t.fetched.push(url);
    return { code: 22 };
  };
  return t;
}

/** The detached half the first half started, run here: the argv after edit.js, with the stand-ins. */
async function runStarted(t, options = {}) {
  assert.equal(t.started.length, 1, "one detached run is started");
  const [cmd, args] = t.started.pop();
  assert.equal(cmd, NODE);
  assert.match(args[0], /tool\/edit\.js$/);
  assert.deepEqual(args.slice(1, 3), ["reelkit", "--now"]);
  return reelkit(t, args.slice(2), { reelKit: { programs: t.programs, fetch: t.fetch, keepAwake: () => {}, ...options.reelKit }, ...options });
}

/** Everything under a folder, by relative path: a file's SHA-256, a link's target, or "folder". {} when there is no folder. */
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
  if (existsSync(dir)) walk(dir, "");
  return seen;
}

describe("reelkit install", () => {
  it("prints the plan and installs nothing without --yes", async () => {
    const t = mac();
    const { at } = download(t);
    const home = snapshot(t.home);
    const r = await reelkit(t, ["install", at]);
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.equal(r.said.length, STEP_IDS.length + 1);
    assert.equal(r.said.at(-1), NOT_YET);
    assert.equal(r.said[0], "Reel Kit 1.2.0's files");
    assert.ok(r.said.includes("Reel Kit's own check"));
    assert.deepEqual(snapshot(t.home), home, "nothing is written in the home");
    assert.ok(!existsSync(workFolder(t.home)), "nothing is written in BRIMM Video Work");
    assert.deepEqual(t.started, [], "nothing is started");
    assert.deepEqual(t.npm.runs(), []);
  });

  it("takes away what a zip was unpacked into, without --yes and when it is refused", async () => {
    const t = mac();
    const zip = join(t.dir, "Downloads", "reel-kit.zip");
    mkdirSync(join(t.dir, "Downloads"), { recursive: true });
    writeFileSync(zip, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(60)]));
    const unzip = (from, into) => {
      mkdirSync(join(into, "reel-kit-plugin"), { recursive: true });
      cpSync(download(t, { name: "for-the-zip" }).at, join(into, "reel-kit-plugin"), { recursive: true });
    };
    const incoming = join(workFolder(t.home), ".toolchain", "incoming");
    const planned = await reelkit(t, ["install", zip], { reelKit: { unzip } });
    assert.equal(planned.said.at(-1), NOT_YET);
    assert.deepEqual(readdirSync(incoming), [], "the unpacked folder is taken away");
    const refused = await reelkit(t, ["install", zip], { build: INSTALLED, reelKit: { unzip } });
    assert.deepEqual(refused.said, [INSTALL_WHY.untested]);
    assert.deepEqual(readdirSync(incoming), [], "and so it is when the plan is refused");
  });

  it("on an installed Mac refuses a download that is not the pinned one, in one line", async () => {
    const t = mac();
    const { at } = download(t);
    for (const words of [["install", at], ["install", at, "--yes"]]) {
      const r = await reelkit(t, words, { build: INSTALLED });
      assert.deepEqual([r.code, r.said], [1, ["This Reel Kit hasn't been tested yet: ask Jason."]]);
    }
    assert.deepEqual(t.started, []);
    assert.ok(!existsSync(workFolder(t.home)));
  });

  it("refuses a path that isn't whole, and a download that isn't there, in one line each", async () => {
    const t = mac();
    const relative = await reelkit(t, ["install", "Downloads/reel-kit-plugin-1.2.0"]);
    assert.equal(relative.code, 1);
    assert.deepEqual(relative.said, [INSTALL_SAY.notWhole]);
    const gone = await reelkit(t, ["install", join(t.dir, "Downloads", "nothing here")]);
    assert.equal(gone.code, 1);
    assert.equal(gone.said.length, 1);
    const asked = await reelkit(t, ["install"]);
    assert.deepEqual([asked.code, asked.said], [2, [HELP]]);
    const more = await reelkit(t, ["install", join(t.dir, "a"), join(t.dir, "b")]);
    assert.deepEqual([more.code, more.said], [2, [HELP]]);
  });

  it("on the dev Mac installs a newer version beside the one in use and writes its pin", async () => {
    const t = mac();
    const { at, fingerprint } = download(t, { version: "1.3.0" });
    const planned = await reelkit(t, ["install", at]);
    assert.equal(planned.code, 0, planned.said.join("\n"));
    assert.ok(planned.said.includes("Python 3.12 for Reel Kit: kept for the version in use until this one is pinned"), planned.said.join("\n"));

    const started = await reelkit(t, ["install", at, "--yes"]);
    assert.equal(started.code, 0, started.said.join("\n"));
    assert.deepEqual(started.said, [INSTALL_SAY.started("1.3.0")]);
    const ran = await runStarted(t);
    assert.equal(ran.code, 0, ran.said.join("\n"));

    // Its KIT, and its own HyperFrames; nothing of the shared world.
    assert.equal(folderFingerprint(kitDir(t.home, "1.3.0")), fingerprint);
    assert.ok(!existsSync(reelKitHome(t.home)), "the venvs, tools and models are the version in use's, and are not touched");
    assert.equal(t.npm.runs().length, 1);
    assert.deepEqual(t.fetched, []);
    // Its pin, for Jason's pull request.
    const pinFile = join(workFolder(t.home), ".toolchain", "reel-kit-1.3.0.pin.json");
    const text = readFileSync(pinFile, "utf8");
    assert.ok(text.endsWith("}\n"));
    const pin = pinFrom(text);
    assert.equal(pin.version, "1.3.0");
    assert.equal(pin.fingerprint, fingerprint);
    assert.deepEqual(pin.hyperframes, t.pin.hyperframes);
    assert.deepEqual(pin.models, t.pin.models);
    assert.deepEqual(JSON.parse(text), newPinOf({ version: "1.3.0", fingerprint, hyperframes: "0.8.139", license: join(at, "LICENSE") }, t.pin));

    const status = await reelkit(t, ["status"]);
    assert.equal(status.code, 0);
    assert.ok(status.said.includes("Reel Kit 1.3.0 is installed beside 1.2.0. It is used once its pin is merged and its checks pass."), status.said.join("\n"));
    assert.ok(!existsSync(installLockFile(t.home)), "the lock is let go");
    assert.equal(JSON.parse(readFileSync(installResultFile(t.home), "utf8")).state, "done");
  });

  it("keeps using PIN.version after a newer one is installed beside it", async () => {
    const t = mac();
    const newer = download(t, { version: "1.3.0" });
    await reelkit(t, ["install", newer.at, "--yes"]);
    await runStarted(t);
    assert.ok(existsSync(kitDir(t.home, "1.3.0")));
    // The version in use is still the pin's: KIT is its folder, a download of it is planned whole, and the newer one is still only beside it.
    assert.equal(kitDir(t.home), join(workFolder(t.home), ".toolchain", "reel-kit-1.2.0"));
    const pinned = await reelkit(t, ["install", download(t).at]);
    assert.equal(pinned.code, 0, pinned.said.join("\n"));
    assert.ok(pinned.said.every((line) => !line.includes("kept for the version in use")), pinned.said.join("\n"));
    const again = await reelkit(t, ["install", download(t, { version: "1.3.0", name: "again" }).at]);
    assert.ok(again.said.includes("Reel Kit 1.3.0's files: here already"), again.said.join("\n"));
    assert.ok(again.said.includes("Reel Kit's own check: kept for the version in use until this one is pinned"), again.said.join("\n"));
  });

  it("refuses a newer version whose HyperFrames has no pin, in one line", async () => {
    const t = mac();
    const { at } = download(t, { version: "1.3.0", hyperframes: "0.9.1" });
    const r = await reelkit(t, ["install", at, "--yes"]);
    assert.deepEqual([r.code, r.said], [1, [INSTALL_WHY.hyperframes]]);
    assert.deepEqual(t.started, []);
  });

  it("runs one install at a time on this Mac, and says so", async () => {
    const t = mac();
    const { at } = download(t);
    mkdirSync(join(installLockFile(t.home), ".."), { recursive: true });
    assert.ok(takeEpisodeLock(installLockFile(t.home), "reelkit install", () => false).taken);
    // The lock above is this process's own, which is running.
    const r = await reelkit(t, ["install", at, "--yes"], { deps: { alive: () => true } });
    assert.deepEqual([r.code, r.said], [1, [INSTALL_SAY.already]]);
    assert.deepEqual(t.started, []);
    const status = await reelkit(t, ["status"], { deps: { alive: () => true } });
    assert.deepEqual(status.said, [INSTALL_SAY.atWork("", "")]);
    // The detached half finds the lock held, and writes nothing.
    const half = await reelkit(t, ["--now", "install", at], { deps: { alive: () => true }, reelKit: { programs: t.programs, fetch: t.fetch, keepAwake: () => {} } });
    assert.equal(half.code, 1);
    assert.ok(!existsSync(installResultFile(t.home)));
  });

  it("starts its detached half only for Studio, never for a chat", async () => {
    const t = mac();
    const { at } = download(t);
    const r = await reelkit(t, ["--now", "install", at], { env: { CLAUDECODE: "1" } });
    assert.equal(r.code, 2);
    assert.deepEqual(r.said, [HELP]);
    assert.ok(!existsSync(workFolder(t.home)));
  });

  it("says in status how a failed install ended, and its credit line once after READY", async () => {
    const t = mac();
    const none = await reelkit(t, ["status"]);
    assert.deepEqual([none.code, none.said], [0, [INSTALL_SAY.none]]);
    // A pinned install whose stand-in fetch serves nothing stops at its first download, and leaves the version in use as it was.
    await reelkit(t, ["install", download(t).at, "--yes"]);
    const ran = await runStarted(t);
    assert.equal(ran.code, 1);
    const failed = await reelkit(t, ["status"]);
    assert.equal(failed.code, 0);
    assert.ok(failed.said.includes(INSTALL_WHY.leftAsWas), failed.said.join("\n"));
    // A whole install's credit line is said once.
    writeFileSync(installResultFile(t.home), JSON.stringify({ version: 1, state: "done", kit: "1.2.0", lines: ["Reel Kit's own check: done."], credit: "Reel Kit is part of a made-up course.", creditShown: false, leftOver: [] }));
    const first = await reelkit(t, ["status"]);
    assert.ok(first.said.includes("Reel Kit is part of a made-up course."), first.said.join("\n"));
    const second = await reelkit(t, ["status"]);
    assert.ok(!second.said.includes("Reel Kit is part of a made-up course."), second.said.join("\n"));
  });

  it("never names a path or a command for her to type", async () => {
    const t = mac();
    const lines = [];
    const keep = (r) => lines.push(...r.said.filter((line) => line !== HELP));
    keep(await reelkit(t, ["status"]));
    keep(await reelkit(t, ["install", "Downloads/reel-kit"]));
    keep(await reelkit(t, ["install", join(t.dir, "Downloads", "gone")]));
    keep(await reelkit(t, ["install", download(t).at]));
    keep(await reelkit(t, ["install", download(t).at], { build: INSTALLED }));
    keep(await reelkit(t, ["install", download(t, { version: "1.3.0", name: "hf", hyperframes: "0.9.1" }).at]));
    const newer = download(t, { version: "1.3.0" });
    keep(await reelkit(t, ["install", newer.at]));
    keep(await reelkit(t, ["install", newer.at, "--yes"]));
    await runStarted(t);
    keep(await reelkit(t, ["status"]));
    await reelkit(t, ["install", download(t, { name: "fails" }).at, "--yes"]);
    await runStarted(t);
    keep(await reelkit(t, ["status"]));
    assert.ok(lines.length > 20);
    for (const line of lines) assert.doesNotMatch(line, PLAIN, line);
  });
});

describe("reelkit and the gate", () => {
  const UNANSWERED = { version: 3, kind: null, answer: { state: "needs your answer" }, label: "Video of 20 Oct" };
  const SESSION = { version: 3, kind: "session", answer: { state: "answered", private: "yes" }, label: "Session", session: { marked: "x", cleared: null } };
  it("lets install and status through as the commands that name no episode do, whatever record is about", () => {
    assert.ok(COMMAND_NAMES.includes("reelkit"));
    assert.ok(UNSCOPED.includes("reelkit"));
    for (const record of [UNANSWERED, SESSION]) {
      assert.equal(gateFor("reelkit", record, {}, ["install", "/a/download"]), "");
      assert.equal(gateFor("reelkit", record, {}, ["--now", "install", "/a/download"]), "");
      assert.equal(gateFor("reelkit", record, {}, ["status"]), "");
    }
  });
  it("has no other words yet: anything else is its help, and names no episode", async () => {
    const t = mac();
    for (const words of [[], ["start", "Video of 20 Oct", "main"], ["status", "Video of 20 Oct"], ["--now"], ["--now", "status"]]) {
      const r = await reelkit(t, words);
      assert.deepEqual([r.code, r.said], [2, [HELP]], words.join(" "));
    }
  });
});
