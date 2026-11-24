// Reel Kit's quiet environment and the npx that serves only the pinned HyperFrames (reel-kit.js; plan Task 4, Decision 1).
// The shim is run by /bin/sh from a temp bin, with a stand-in "cli" that prints its arguments: no real npx, no network.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reelKitEnv, npxShim, reelKitHome, PIN } from "../reel-kit.js";

const HOME = "/Users/someone";
const base = { HOME, LANG: "en_GB.UTF-8", ANTHROPIC_API_KEY: "k", ANTHROPIC_BASE_URL: "u", CLAUDE_CODE_SESSION_ID: "s", CODEX_THREAD_ID: "t", HTTPS_PROXY: "p", http_proxy: "p", ALL_PROXY: "p" };
const env = () => reelKitEnv({ home: HOME, node: "/opt/node/bin/node", base });
const V = PIN.hyperframes.version;

describe("reelKitEnv", () => {
  it("always sets REEL_KIT_HOME to BRIMM Video Work's .reel-kit", () => {
    const e = env();
    assert.equal(e.REEL_KIT_HOME, reelKitHome(HOME));
    assert.equal(e.REEL_KIT_HOME, `${HOME}/BRIMM Video Work/.reel-kit`);
    assert.equal(e.HF_HOME, `${HOME}/BRIMM Video Work/.reel-kit/hf`);
    assert.equal(e.PATH, `${HOME}/BRIMM Video Work/.reel-kit/tools/bin:/usr/bin:/bin`);
    assert.equal(e.HOME, HOME);
    assert.equal(e.LANG, "en_GB.UTF-8");
    assert.equal(reelKitEnv({ home: HOME, node: "/n/node", base: { HOME } }).LANG, "en_US.UTF-8");
  });
  it("turns the network sources off and HyperFrames' own calls home off", () => {
    const e = env();
    for (const k of ["HF_HUB_OFFLINE", "PIP_NO_INDEX", "UV_OFFLINE", "PYTHONNOUSERSITE"]) assert.equal(e[k], "1", k);
    for (const k of ["HYPERFRAMES_NO_TELEMETRY", "HYPERFRAMES_SKIP_SKILLS", "HYPERFRAMES_NO_UPDATE_CHECK", "HYPERFRAMES_NO_AUTO_INSTALL", "HYPERFRAMES_NO_OPTIONAL_INSTALL"]) assert.equal(e[k], "1", k);
  });
  it("passes nothing of Anthropic's and no proxy from the base", () => {
    const keys = Object.keys(env());
    assert.deepEqual(keys.filter((k) => /ANTHROPIC|CLAUDE|CODEX|GROK|PROXY/i.test(k)), []);
    assert.equal(base.HOME, HOME);
  });
  it("throws on a relative HOME or node", () => {
    assert.throws(() => reelKitEnv({ home: "rel", node: "/n/node", base: { HOME: "rel" } }), /HOME/);
    assert.throws(() => reelKitEnv({ home: HOME, node: "node", base }), /node/);
    assert.throws(() => reelKitEnv({ home: HOME, node: "/n/node", base: {} }), /HOME/);
  });
});

describe("npxShim", () => {
  const dir = mkdtempSync(join(tmpdir(), "rk-npx-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "bin"));
  const cli = join(dir, "it's cli.mjs");
  writeFileSync(cli, "console.log(JSON.stringify(process.argv.slice(2)));\n");
  const shim = join(dir, "bin", "npx");
  writeFileSync(shim, npxShim({ node: process.execPath, cli, version: V }));
  chmodSync(shim, 0o755);
  const run = (...args) => spawnSync("/bin/sh", [shim, ...args], { env: { PATH: `${join(dir, "bin")}:/usr/bin:/bin` }, encoding: "utf8" });

  it("runs the pinned cli for npx -y hyperframes@<pin> with the network off", () => {
    const r = run("-y", `hyperframes@${V}`, "--version");
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), ["--version"]);
    assert.deepEqual(JSON.parse(run("-y", `hyperframes@${V}`, "render", "a b", "$x").stdout), ["render", "a b", "$x"]);
  });
  it("refuses npx -y hyperframes@latest and npx anything-else", () => {
    const cases = [["-y", "hyperframes@latest"], ["-y", `hyperframes@${V}x`], ["-y", `hyperframes@${V}0`], ["--yes", `hyperframes@${V}`], [`hyperframes@${V}`],
      ["-y", "other@1"], [], ["x", "-y", `hyperframes@${V}`], ["-y"]];
    for (const args of cases) {
      const r = run(...args);
      assert.equal(r.status, 1, JSON.stringify(args));
      assert.equal(r.stdout, "");
      assert.equal(r.stderr, `This npx runs only HyperFrames ${V}.\n`);
    }
  });
  it("quotes both paths", () => {
    assert.match(npxShim({ node: "/a b/node", cli: "/c'd/x.mjs", version: V }), /exec '\/a b\/node' '\/c'\\''d\/x\.mjs' "\$@"/);
  });
});
