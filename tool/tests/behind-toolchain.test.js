// `behind` also checks the toolchain (architecture 2026-10-27, the commands table; plan PR 4, "The words"): on a Mac whose settings turn
// the app on, one line says when the pinned HyperFrames command line is not the one in this Mac's toolchain folder, with the other
// lines `behind` says whatever git answers. On any other Mac it says nothing new. git is a stand-in, as for every test of `behind`,
// and the toolchain folders are made in each test's own home (toolchain-world.js): no real one is read, and nothing is run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { PIN } from "../hyperframes.js";
import { writeSettings } from "../settings.js";
import { writeStudio } from "../studio.js";
import { setup } from "./episodes.js";
import { OTHER_INTEGRITY, putToolchain } from "./toolchain-world.js";

const NEWEST = "This Mac has the newest brimm-video.";
const OFFLINE = "Could not check for a newer brimm-video. Is this Mac offline?";
const NODE = "/opt/homebrew/bin/node";
/** The line `behind` says of a toolchain that is not the pin, by what this Mac has. */
const line = (what) => `HyperFrames' command line on this Mac is not the one Studio needs. Ask Jason to update it when it suits. (Jason: Studio is pinned to version ${PIN.version}, and this Mac has ${what}; the installer puts the pinned one in place.)`;

/** Run `behind` with deps, git being `run`: { code, said, text }. */
async function on(deps, run) {
  const said = [];
  const code = await editMain(["behind"], { ...deps, run, say: (text) => said.push(text) });
  return { code, said, text: said.join("\n") };
}
/** git finds this checkout up to date; git cannot reach GitHub; git finds `n` changes there that this checkout has not. */
const upToDate = async () => ({ code: 0, stderr: "", stdout: "0\n" });
const unreachable = async () => ({ code: 128, stderr: "fatal: Could not read from remote repository." });
const behindBy = (n) => {
  let calls = 0;
  return async () => (++calls === 1 ? { code: 0, stderr: "" } : { code: 0, stderr: "", stdout: `${n}\n` });
};

/** A made-up Mac whose settings turn the app on (or not), with the toolchain folder `over` makes (putToolchain), or none. */
function mac({ app = true, toolchain = null } = {}) {
  const t = setup();
  if (app) writeSettings(t.home, { app: "hyperframes" });
  if (toolchain) putToolchain(t.home, toolchain);
  return t;
}

describe("behind: on a Mac whose app is off, nothing is new", () => {
  it("says only what it always said, with no toolchain, a toolchain that is not the pin, or the pin in place", async () => {
    for (const [what, toolchain] of [["no toolchain", null], ["another version", { version: "0.8.207" }], ["another integrity string", { integrity: OTHER_INTEGRITY }], ["no program", { program: false }], ["the pin in place", {}]]) {
      for (const set of [false, "off"]) {
        const t = mac({ app: false, toolchain });
        if (set) writeSettings(t.home, { app: set });
        const r = await on(t.ctx.deps, upToDate);
        assert.deepEqual([r.code, r.said], [0, [NEWEST]], `${what}, app ${set || "unset"}`);
        const offline = await on(t.ctx.deps, unreachable);
        assert.deepEqual([offline.code, offline.said], [0, [OFFLINE]], `${what}, app ${set || "unset"}`);
        t.done();
      }
    }
  });
});

describe("behind: on a Mac whose app is on, it says when the toolchain is not the pin", () => {
  it("says nothing new when the pinned command line is in place: its version, its program and the pin's integrity string", async () => {
    const t = mac({ toolchain: {} });
    const r = await on(t.ctx.deps, upToDate);
    assert.deepEqual([r.code, r.said], [0, [NEWEST]]);
    t.done();
  });
  it("says there is none when this Mac has no toolchain", async () => {
    const t = mac();
    const r = await on(t.ctx.deps, upToDate);
    assert.deepEqual([r.code, r.said], [0, [NEWEST, line("none")]]);
    t.done();
  });
  it("says the version when it is another", async () => {
    const t = mac({ toolchain: { version: "0.8.207" } });
    const r = await on(t.ctx.deps, upToDate);
    assert.deepEqual([r.code, r.said], [0, [NEWEST, line("version 0.8.207")]]);
    t.done();
  });
  it("says the pinned version is not as the pin has it when its integrity string is another, or is not in the lock file", async () => {
    for (const [what, toolchain] of [["another integrity string", { integrity: OTHER_INTEGRITY }], ["none in the lock file", { integrity: "" }], ["no lock file", { integrity: null }]]) {
      const t = mac({ toolchain });
      const r = await on(t.ctx.deps, upToDate);
      assert.deepEqual([r.code, r.said], [0, [NEWEST, line(`version ${PIN.version}, but not as the pin has it`)]], what);
      t.done();
    }
  });
  it("says there is none when the pinned version is installed without its program, or no version can be read", async () => {
    for (const [what, toolchain] of [["no program", { program: false }], ["no package.json", { version: null }], ["another version without its program", { version: "0.8.207", program: false }]]) {
      const t = mac({ toolchain });
      const r = await on(t.ctx.deps, upToDate);
      assert.deepEqual([r.code, r.said], [0, [NEWEST, line("none")]], what);
      t.done();
    }
  });
  it("says it once, as one line, naming no path, and not as Sallie's own words: she is told to ask Jason", async () => {
    const t = mac();
    const r = await on(t.ctx.deps, upToDate);
    const said = r.said.filter((text) => text.includes("HyperFrames' command line"));
    assert.equal(said.length, 1);
    assert.doesNotMatch(said[0], /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs/);
    assert.match(said[0], /^HyperFrames' command line on this Mac is not the one Studio needs\. Ask Jason to update it when it suits\. \(Jason: /);
    t.done();
  });
  it("says it whatever git answers: when it is offline, and when Jason has a newer brimm-video", async () => {
    const t = mac();
    const offline = await on(t.ctx.deps, unreachable);
    assert.deepEqual([offline.code, offline.said], [0, [OFFLINE, line("none")]]);
    const newer = await on(t.ctx.deps, behindBy(3));
    assert.deepEqual([newer.code, newer.said], [0, ["Jason has a newer brimm-video (3 changes). Ask him to update this Mac when it suits.", line("none")]]);
    t.done();
  });
  it("is read again each time: a toolchain the installer put in place since is no longer said", async () => {
    const t = mac();
    assert.deepEqual((await on(t.ctx.deps, upToDate)).said, [NEWEST, line("none")]);
    putToolchain(t.home);
    assert.deepEqual((await on(t.ctx.deps, upToDate)).said, [NEWEST]);
    t.done();
  });
  it("comes after the line about her folder being out of date, with the other lines", async () => {
    const t = mac();
    const folder = writeStudio(t.home, { checkout: "/checkout", node: NODE });
    const skill = join(folder, ".claude", "skills", "brimm-edit", "SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace(/\| "Show me the Reels".*\n/, ""));
    const stale = `Her folder for Claude is out of date: an older brimm-video wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node ${NODE}, then start a new session in her Claude folder)`;
    const r = await on(t.ctx.deps, upToDate);
    assert.deepEqual([r.code, r.said], [0, [NEWEST, stale, line("none")]]);
    const offline = await on(t.ctx.deps, unreachable);
    assert.deepEqual(offline.said, [OFFLINE, stale, line("none")]);
    t.done();
  });
  it("only looks at the toolchain's folder: it changes nothing in it, and installs nothing", async () => {
    const t = mac({ toolchain: { version: "0.8.207" } });
    const dir = join(t.home, "BRIMM Video Work", ".toolchain", `hyperframes-${PIN.version}`);
    const files = () => ["package-lock.json", join("node_modules", "hyperframes", "package.json")].map((file) => readFileSync(join(dir, file), "utf8"));
    const before = files();
    await on(t.ctx.deps, upToDate);
    assert.deepEqual(files(), before);
    assert.deepEqual(readdirSync(dir).sort(), ["node_modules", "package-lock.json"]);
    t.done();
  });
});
