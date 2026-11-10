// The Getting Started guide: the page the setup engine writes into BRIMM Video Work at the end of a setup.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { GUIDE_NAME, guideData, fillGuide, writeGuide } from "../setup/guide.js";
import { REPAIR, UPDATE_SAY } from "../build.js";
import { folderWords } from "../settings.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const template = readFileSync(join(here, "..", "setup", "guide-template.html"), "utf8");
const fonts = join(here, "..", "brand", "fonts");
const home = "/Users/sallie";
const settings = { machine: "Sallie's MacBook", root: `${home}/Library/CloudStorage/Dropbox-BRIMM/BRIMM Video`, dropPath: `${home}/BRIMM Video Work/Drop`, exportsPath: `${home}/Movies/Exports` };
const build = { version: "1.2.3", build: "abc1234", support: "help@example.test" };
const now = new Date(2026, 10, 9, 12);
const data = (over = {}) => guideData({ home, settings, build, missing: [], notes: ["A note."], now, ...over });
const page = (over) => fillGuide(template, data(over), { fonts });
const bare = (html) => html.replace(/data:[^")]+/g, "");

describe("the Getting Started guide", () => {
  it("the guide's data has this Mac's name, its folders in Finder's words, the version and the support contact", () => {
    const d = data();
    assert.equal(GUIDE_NAME, "BRIMM Video Studio Getting Started");
    assert.equal(d.machine, "Sallie's MacBook");
    assert.equal(d.drop, folderWords(settings.dropPath, home));
    assert.equal(d.exports, folderWords(settings.exportsPath, home));
    assert.equal(d.root, folderWords(settings.root, home));
    assert.equal(d.studio, folderWords(`${home}/BRIMM Video Studio`, home));
    assert.equal(d.version, "1.2.3");
    assert.equal(d.build, "abc1234");
    assert.equal(d.support, "help@example.test");
    assert.equal(d.update, UPDATE_SAY);
    assert.equal(d.repair, REPAIR);
    assert.deepEqual(d.notes, ["A note."]);
    assert.deepEqual(d.toInstall, ["Nothing: every app is here."]);
    assert.deepEqual(data({ missing: ["HyperFrames", "Dropbox"] }).toInstall, ["HyperFrames", "Dropbox"]);
  });

  it("the date is spelled in the Mac's own time", () => {
    assert.equal(data().date, "9 November 2026");
    assert.equal(data({ now: new Date(2026, 0, 1, 0, 5) }).date, "1 January 2026");
  });

  it("every key the template asks for is given, and a template that asks for one more throws", () => {
    assert.ok(page().includes("Sallie&#39;s MacBook") || page().includes("Sallie's MacBook"));
    assert.throws(() => fillGuide(`${template}{{nothing}}`, data(), { fonts }), /nothing/);
    assert.throws(() => fillGuide("{{list:machine}}", data(), { fonts }), /machine/);
    assert.throws(() => fillGuide("{{font:nope.woff2}}", data(), { fonts }), /nope/);
  });

  it("a value is escaped: a Mac named with < or & cannot write HTML", () => {
    const html = page({ settings: { ...settings, machine: "<b>A&B</b>" }, notes: ["<i>x</i>"] });
    assert.ok(html.includes("&lt;b&gt;A&amp;B&lt;/b&gt;"));
    assert.ok(html.includes("<li>&lt;i&gt;x&lt;/i&gt;</li>"));
    assert.ok(!html.includes("<b>A&B</b>"));
  });

  it("the guide says Auto, never Full; telemetry off; never render in the cloud; and the HeyGen sign-in", () => {
    const html = page();
    for (const say of [
      "In HyperFrames, the agent is Claude Code with Auto access, never Full.",
      "Telemetry stays off.",
      "HyperFrames asks you to sign in to HeyGen the first time it opens.",
      "Never render in the cloud: every video is made on this Mac.",
      "The BRIMM does not use an AI avatar, lip-sync, or an AI-generated Sallie, her face or her voice, for now.",
    ]) assert.ok(html.includes(say), say);
  });

  it("the guide says where to start, how an update arrives, Repair, and who to ask", () => {
    const html = page({ missing: ["Dropbox"] });
    for (const say of ["BRIMM Video Studio", UPDATE_SAY.replace(/"/g, "&quot;"), REPAIR, "help@example.test", "<li>Dropbox</li>", "Code tab"]) assert.ok(html.includes(say), say);
  });

  it("the guide's colours are the brand's, and its fonts are held in the page itself", () => {
    const brand = readFileSync(join(here, "..", "brand", "brand.md"), "utf8").toLowerCase();
    const html = page().toLowerCase();
    for (const colour of ["#e8e3da", "#1f2d42", "#c1ad97"]) {
      assert.ok(brand.includes(colour), colour);
      assert.ok(html.includes(colour), colour);
    }
    assert.equal((page().match(/url\("data:/g) ?? []).length, 4);
    assert.ok(/@page\s*{[^}]*letter/i.test(page()));
  });

  it("the guide loads nothing from the network", () => {
    const html = page();
    assert.ok(!/<script/i.test(html) && !/<link/i.test(html) && !/src=["']?http/i.test(html));
    for (const m of html.matchAll(/url\(\s*["']?([^)"']{0,12})/g)) assert.ok(m[1].startsWith("data:"), m[1]);
    assert.ok(!/https?:\/\//i.test(bare(html)));
  });

  it("the guide is written into BRIMM Video Work, and the PDF's place is named beside it", () => {
    const h = mkdtempSync(join(tmpdir(), "guide-"));
    const written = writeGuide({ home: h, data: data(), template, fonts });
    assert.equal(written.html, join(h, "BRIMM Video Work", `${GUIDE_NAME}.html`));
    assert.equal(written.pdf, join(h, "BRIMM Video Work", `${GUIDE_NAME}.pdf`));
    assert.ok(existsSync(written.html));
    assert.ok(!existsSync(written.pdf));
    assert.ok(readFileSync(written.html, "utf8").includes("Sallie's MacBook") || readFileSync(written.html, "utf8").includes("Sallie&#39;s MacBook"));
  });

  it("the guide never says node or Terminal", () => {
    assert.ok(!/node|terminal/i.test(bare(page({ missing: ["Dropbox"] }))));
  });

  it("tool/setup/guide.js does not import tool/guide.js", () => {
    assert.ok(!readFileSync(join(here, "..", "setup", "guide.js"), "utf8").includes("../guide.js"));
  });
});
