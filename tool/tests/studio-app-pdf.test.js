// The guide as a PDF, from tool/studio-app/Sources/GuidePDF.swift, run through studio-check's pdf command (Phase 6, Task 9). The
// command needs a window server: where there is none it ends with 3, and the test skips itself.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GUIDE_NAME, guideData, writeGuide } from "../setup/guide.js";
import { check, noChecker } from "./studio-app-check.js";

/** A page of three sections, the second and third each beginning a new page. */
const THREE_PAGES = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.8in; }
body { font-family: Helvetica; font-size: 14pt; }
section + section { break-before: page; }
</style></head><body>
<section><h1>One</h1><p>The first page.</p></section>
<section><h1>Two</h1><p>The second page.</p></section>
<section><h1>Three</h1><p>The third page.</p></section>
</body></html>`;

/** The folders this file has made, each removed when the file ends. WebKit's own folders for the checker are not among them: macOS
    makes them in the user's temp folder whatever TMPDIR says, once for each compile of the checker, and refuses to let them be
    removed. */
const folders = [];
after(() => {
  for (const dir of folders) rmSync(dir, { recursive: true, force: true });
});

/** A new folder, with `prefix` in its name, removed when the file ends. */
const newFolder = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  folders.push(dir);
  return dir;
};

/** Runs the pdf command, with a TMPDIR of its own, so that whatever the checker puts there goes with the test's folders. Where there
    is no window server the test is skipped, and this gives null. */
function makePDF(t, html, pdf) {
  const ran = check("pdf", [html, pdf], { timeout: 90000, env: { ...process.env, TMPDIR: newFolder("brimm-studio-pdf-tmp-") } });
  if (ran.status === 3) {
    t.skip("no window server");
    return null;
  }
  return ran;
}

/** A new folder for one test, with a space in its name. */
const folder = () => newFolder("brimm studio pdf-");

describe("the guide as a PDF", { skip: noChecker }, () => {
  it("page breaks become Letter pages", (t) => {
    const dir = folder();
    const html = join(dir, "three.html");
    const pdf = join(dir, "three.pdf");
    writeFileSync(html, THREE_PAGES);
    const ran = makePDF(t, html, pdf);
    if (!ran) return;
    assert.equal(ran.status, 0, ran.stderr);
    assert.deepEqual(ran.json, { pages: 3, width: 612, height: 792 });
    assert.equal(readFileSync(pdf).subarray(0, 4).toString("latin1"), "%PDF");
  });

  it("the real guide becomes a PDF of Letter pages", (t) => {
    const home = newFolder("brimm-studio-pdf-home-");
    const settings = { machine: "A Test Mac", root: join(home, "Dropbox", "BRIMM Video"), dropPath: join(home, "BRIMM Video Work", "Drop"), exportsPath: join(home, "Movies", "Exports") };
    const build = { version: "1.2.3", build: "abc1234", support: "help@example.test" };
    const data = guideData({ home, settings, build, missing: ["HyperFrames"], notes: ["A note."], now: new Date(2026, 10, 11, 12) });
    const written = writeGuide({ home, data });
    const ran = makePDF(t, written.html, written.pdf);
    if (!ran) return;
    assert.equal(ran.status, 0, ran.stderr);
    assert.ok(ran.json.pages >= 1, `pages is ${ran.json.pages}`);
    assert.equal(ran.json.width, 612);
    assert.equal(ran.json.height, 792);
    assert.equal(readFileSync(written.pdf).subarray(0, 4).toString("latin1"), "%PDF");
  });

  it("an older PDF is replaced, and no half-made file is left", (t) => {
    const dir = join(folder(), "BRIMM Video Work");
    mkdirSync(dir);
    const html = join(dir, `${GUIDE_NAME}.html`);
    const pdf = join(dir, `${GUIDE_NAME}.pdf`);
    writeFileSync(html, THREE_PAGES);
    writeFileSync(pdf, "an older guide");
    const ran = makePDF(t, html, pdf);
    if (!ran) return;
    assert.equal(ran.status, 0, ran.stderr);
    assert.deepEqual(readdirSync(dir).sort(), [`${GUIDE_NAME}.html`, `${GUIDE_NAME}.pdf`]);
    assert.equal(readFileSync(pdf).subarray(0, 4).toString("latin1"), "%PDF");
  });

  it("a part file an abandoned job left is removed by the next job", (t) => {
    const dir = folder();
    const html = join(dir, "three.html");
    const pdf = join(dir, "three.pdf");
    writeFileSync(html, THREE_PAGES);
    writeFileSync(`${pdf}.0F6B3C1E-2D4A-4E8B-9C7D-5A1B2C3D4E5F.part`, "a part file left by a job that was given up on");
    writeFileSync(`${pdf}.part`, "a part file left by an older build");
    const ran = makePDF(t, html, pdf);
    if (!ran) return;
    assert.equal(ran.status, 0, ran.stderr);
    assert.deepEqual(readdirSync(dir).sort(), ["three.html", "three.pdf"]);
  });

  it("a page that is not there makes no PDF", (t) => {
    const dir = folder();
    const pdf = join(dir, "missing.pdf");
    const ran = makePDF(t, join(dir, "missing.html"), pdf);
    if (!ran) return;
    assert.equal(ran.status, 1, ran.stderr);
    assert.equal(ran.stdout, "");
    assert.ok(!existsSync(pdf));
    assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith(".part")), []);
  });
});
