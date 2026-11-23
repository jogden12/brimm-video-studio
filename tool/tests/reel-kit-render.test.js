// The headless render of a Reel Kit edit (reel-kit-render.js; spec 2026-11-23 Reel Kit in Studio; plan Task 14, Decisions 6 and 7).
// Every test builds a temp home (with a space in its name, as BRIMM Video Work has) holding a made-up kit, Reel Kit's Python and a project
// whose edit she approved and the worker finalized (studio.json `ready`, with its fingerprint). Nothing real is run: Reel Kit's Python is
// the stand-in tests/stand-ins/reel-kit.mjs (its render.py and qa.py), `sandbox-exec` is tests/stand-ins/sandbox-exec.mjs (it writes down
// what it was given, then runs the rest), and the Trash is a folder of the test's own.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { metaNameOf, metaOf } from "../exports.js";
import { hfDir, kitDir, reelKitHome, venvPython } from "../reel-kit.js";
import { compositionFingerprint, projectDirOf, readState, writeState } from "../reel-kit-project.js";
import { RENDER_SAY, renderProfile, renderReelKit, renderWhy, sweepCopies, writeMeta } from "../reel-kit-render.js";
import { macLock } from "../reel-kit-worker.js";
import { workerSandbox } from "../reel-kit-worker-tools.js";
import { factsOf, workFolder } from "../settings.js";

const CHECKOUT = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const REEL_KIT = fileURLToPath(new URL("./stand-ins/reel-kit.mjs", import.meta.url));
const SANDBOX = fileURLToPath(new URL("./stand-ins/sandbox-exec.mjs", import.meta.url));
const q = (p) => `'${String(p).replace(/'/g, "'\\''")}'`;
const SLUG = "abc123-reel-2-v1";
const NAME = "Pricing, Reel 2 Reel Kit v1";
const TITLE = "Pricing, plainly";

const homes = [];
after(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
});

/** A Mac with Reel Kit in place and one finalized edit. `scenario` is baked into the Python that runs the stand-in. */
function world({ scenario = "" } = {}) {
  const home = mkdtempSync(join(tmpdir(), "rk render-"));
  homes.push(home);
  const kit = kitDir(home);
  mkdirSync(join(kit, "pipeline"), { recursive: true });
  for (const name of ["render", "qa", "build", "common"]) writeFileSync(join(kit, "pipeline", `${name}.py`), "# made up\n");
  const log = join(home, "reel-kit.log");
  mkdirSync(join(venvPython(home), ".."), { recursive: true });
  writeFileSync(venvPython(home), `#!/bin/sh\nREEL_KIT_STANDIN_LOG=${q(log)} REEL_KIT_STANDIN=${q(scenario)} exec ${q(process.execPath)} ${q(REEL_KIT)} "$@"\n`);
  chmodSync(venvPython(home), 0o755);
  const sandboxLog = join(home, "sandbox-exec.log");
  const sandboxExec = join(home, "sandbox-exec");
  writeFileSync(sandboxExec, `#!/bin/sh\nSANDBOX_EXEC_LOG=${q(sandboxLog)} exec ${q(process.execPath)} ${q(SANDBOX)} "$@"\n`);
  chmodSync(sandboxExec, 0o755);

  const work = join(workFolder(home), "Pricing");
  const dir = join(work, NAME);
  for (const folder of ["public/media", "cards/c1", "fx/f1", "work", "source", "storyboard", "renders"]) mkdirSync(join(dir, folder), { recursive: true });
  const src = join(dir, "source", "clip.mp4");
  writeFileSync(src, "THE 4K COPY");
  writeFileSync(join(dir, "edit.py"), `TITLE = "${TITLE}"\nSTYLE = "hifi"\nSRC = "${src}"\n`);
  writeFileSync(join(dir, "public", "index.html"), "<html>the composition</html>\n");
  writeFileSync(join(dir, "cards", "c1", "index.html"), "<html>a card</html>\n");
  writeFileSync(join(dir, "fx", "f1", "fx.js"), "// an effect\n");
  writeState(dir, { slug: SLUG, key: "reel 2", mode: "hifi", version: 1, title: TITLE, name: NAME, state: "ready", job: "finalize", step: "ready", approved: { at: "2026-11-23T10:00:00Z" }, fingerprint: compositionFingerprint(dir) });
  const trash = join(home, "Trash");
  mkdirSync(trash);
  const trashed = [];
  const toTrash = (path) => {
    trashed.push(path);
    renameSync(path, join(trash, basename(path)));
    return true;
  };
  const outside = join(home, "Outside");
  mkdirSync(outside);
  const entry = { key: "reel 2", name: NAME, maker: "reel-kit", mode: "hifi", version: 1, state: "made" };
  const ctx = { home, checkout: CHECKOUT, node: process.execPath, base: { HOME: home, LANG: "en_US.UTF-8" }, settings: { root: join(home, "Dropbox", "BRIMM Video"), machine: "Mac Studio" }, now: () => Date.UTC(2026, 10, 23, 15, 4, 5) };
  const deps = { sandboxExec, trash: toTrash, every: 10, wait: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 10))), log: () => {} };
  const runs = (path) => (existsSync(path) ? readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { home, kit, dir, work, src, trash, trashed, outside, entry, ctx, deps, reelKitRuns: () => runs(log), sandboxRuns: () => runs(sandboxLog) };
}

const metas = (w) => (existsSync(join(w.dir, "public", "renders")) ? readdirSync(join(w.dir, "public", "renders")).filter((n) => n.endsWith(".meta.json")) : []);

describe("the headless render", () => {
  it("renders only an approved edit whose fingerprint still matches", async () => {
    const w = world();
    assert.equal(renderWhy(w.dir, readState(w.dir)), "");
    // An edit that is not built to render yet: nothing runs.
    for (const state of ["storyboard", "working", "queued", "failed"]) {
      writeState(w.dir, { ...readState(w.dir), state });
      assert.notEqual(renderWhy(w.dir, readState(w.dir)), "", state);
      const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
      assert.equal(r.ok, false, state);
      assert.equal(r.why, renderWhy(w.dir, readState(w.dir)));
    }
    writeState(w.dir, { ...readState(w.dir), state: "ready" });
    // Changed in HyperFrames after the worker finalized it: refused, in her words, with nothing run.
    writeFileSync(join(w.dir, "public", "index.html"), "<html>changed in the app</html>\n");
    const changed = `${NAME} was changed in HyperFrames, so Reel Kit won't render it: export it from HyperFrames on This Mac.`;
    assert.equal(renderWhy(w.dir, readState(w.dir)), changed);
    assert.deepEqual(await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps), { ok: false, file: null, why: changed });
    // A ready edit with no fingerprint recorded is refused too, and so is one with a link inside its composition (fail closed).
    writeFileSync(join(w.dir, "public", "index.html"), "<html>the composition</html>\n");
    assert.equal(renderWhy(w.dir, readState(w.dir)), "");
    writeState(w.dir, { ...readState(w.dir), fingerprint: undefined });
    assert.notEqual(renderWhy(w.dir, readState(w.dir)), "");
    writeState(w.dir, { ...readState(w.dir), fingerprint: compositionFingerprint(w.dir) });
    symlinkSync(w.outside, join(w.dir, "public", "media", "elsewhere"));
    assert.notEqual(renderWhy(w.dir, readState(w.dir)), "");
    assert.equal((await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps)).ok, false);
    assert.deepEqual(w.reelKitRuns(), [], "Reel Kit's render never ran for a refused edit");
    // Her chat's mark for this very run comes off when it renders nothing.
    writeState(w.dir, { ...readState(w.dir), rendering: { pid: process.pid, at: "2026-11-23T10:00:00.000Z" } });
    await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(readState(w.dir).rendering, undefined);
    assert.deepEqual(w.sandboxRuns(), []);
    rmSync(join(w.dir, "public", "media", "elsewhere"));
    // No studio.json, and no edit.py: refused.
    assert.notEqual(renderWhy(w.dir, null), "");
    // The approved, unchanged edit renders.
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    assert.equal(readState(w.dir).state, "rendered");
  });

  it("runs render.py with --no-deliver, never without", async () => {
    const w = world();
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    const render = w.reelKitRuns().filter((run) => run.script === "render.py");
    assert.equal(render.length, 1);
    assert.deepEqual(render[0].args, [w.dir, `${SLUG}-v1`, "--no-deliver"]);
    assert.equal(render[0].folder, "pipeline");
    assert.equal(render[0].env.REEL_KIT_HOME, reelKitHome(w.home));
    assert.equal(render[0].env.HF_HUB_OFFLINE, "1");
    // It is run through sandbox-exec, with the profile Studio wrote outside the project.
    const [box] = w.sandboxRuns();
    assert.equal(box.args[0], "-f");
    const profile = box.args[1];
    assert.ok(!profile.startsWith(`${w.dir}/`), "the profile is out of the project's reach");
    assert.match(box.profile, /^\(version 1\)/);
    assert.match(box.profile, /\(deny default\)/);
    assert.deepEqual(box.args.slice(2), [venvPython(w.home), join(w.kit, "pipeline", "render.py"), w.dir, `${SLUG}-v1`, "--no-deliver"]);
    assert.equal(r.file, join(w.dir, "renders", `${SLUG}-v1.mp4`));
    // A second render (after a revise and a new go) never writes over the first.
    writeState(w.dir, { ...readState(w.dir), state: "ready", fingerprint: compositionFingerprint(w.dir) });
    const again = await renderReelKit({ ...w.ctx, now: () => Date.UTC(2026, 10, 23, 16, 30, 0) }, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(again.file, join(w.dir, "renders", `${SLUG}-v2.mp4`));
    assert.equal(readdirSync(join(w.dir, "public", "renders")).length, 2, "a record of its own for each");
    assert.ok(w.reelKitRuns().filter((run) => run.script === "render.py").every((run) => run.args.includes("--no-deliver")));
  });

  it("leaves no copy beside the source clip", async () => {
    const w = world();
    const source = join(w.dir, "source");
    // What a render without --no-deliver would have left (an earlier one, by hand), a link with such a name, and her own files.
    writeFileSync(join(source, `${TITLE} v1.mp4`), "A COPY");
    writeFileSync(join(source, `${TITLE} v1 (phone).mp4`), "A PHONE COPY");
    writeFileSync(join(w.outside, "hers.mp4"), "HERS");
    symlinkSync(join(w.outside, "hers.mp4"), join(source, `${TITLE} v2.mp4`));
    writeFileSync(join(source, "notes.mp4"), "NOT A COPY");
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    assert.deepEqual(readdirSync(w.trash).sort(), [`${TITLE} v1 (phone).mp4`, `${TITLE} v1.mp4`]);
    assert.deepEqual(readdirSync(source).sort(), [`${TITLE} v2.mp4`, "clip.mp4", "notes.mp4"], "the link was refused and left, never followed");
    assert.equal(readFileSync(join(w.outside, "hers.mp4"), "utf8"), "HERS");
    assert.equal(readFileSync(w.src, "utf8"), "THE 4K COPY");
    // sweepCopies alone: only the two names, only plain files, only to the Trash.
    writeFileSync(join(source, `${TITLE} v3.mp4`), "A COPY");
    mkdirSync(join(source, `${TITLE} v4.mp4`));
    const swept = sweepCopies(source, TITLE, { trash: w.deps.trash });
    assert.deepEqual(swept.trashed, [`${TITLE} v3.mp4`]);
    assert.deepEqual(swept.left.sort(), [`${TITLE} v2.mp4`, `${TITLE} v4.mp4`]);
    // A source folder that is a link is never looked in.
    const linked = join(w.home, "linked source");
    symlinkSync(source, linked);
    assert.deepEqual(sweepCopies(linked, TITLE, { trash: w.deps.trash }), { trashed: [], left: [], refused: true });
    // Reel Kit's own title rule: the characters a file name can't hold are left out.
    writeFileSync(join(source, "Why: costs v1.mp4"), "X");
    writeFileSync(join(source, "Why costs v1.mp4"), "A COPY");
    assert.deepEqual(sweepCopies(source, "Why costs?", { trash: w.deps.trash }).trashed, ["Why costs v1.mp4"]);
  });

  it("writes the meta record exports.js reads, pointing at the render", async () => {
    const w = world();
    const before = readState(w.dir).fingerprint;
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    const [meta, ...more] = metas(w);
    assert.deepEqual(more, []);
    const at = new Date(w.ctx.now());
    const pad = (n) => String(n).padStart(2, "0");
    assert.deepEqual(metaNameOf(meta), { project: NAME, date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, time: `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}` });
    const told = metaOf(readFileSync(join(w.dir, "public", "renders", meta), "utf8"));
    assert.deepEqual(told, { complete: true, exportedTo: join(w.dir, "renders", `${SLUG}-v1.mp4`), format: "mp4", resolution: "1080x1920" });
    assert.ok(existsSync(told.exportedTo));
    // Reel Kit's own build ran, so the fingerprint is recorded again after it, and the edit is rendered.
    const state = readState(w.dir);
    assert.equal(state.state, "rendered");
    assert.equal(state.fingerprint, compositionFingerprint(w.dir));
    assert.notEqual(state.fingerprint, before);
    assert.equal(state.rendering, undefined);
    // writeMeta alone, and a renders folder that is a link is never written through.
    const other = join(w.home, "other project");
    mkdirSync(join(other, "public"), { recursive: true });
    symlinkSync(w.outside, join(other, "public", "renders"));
    assert.throws(() => writeMeta(other, { name: NAME, file: join(other, "renders", "x.mp4"), at }));
    assert.deepEqual(readdirSync(w.outside), []);
  });

  it("keeps nothing as an export when QA fails, and says so", async () => {
    const w = world({ scenario: "qa-fail" });
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.deepEqual(r, { ok: false, file: null, why: RENDER_SAY.qaFailed });
    assert.doesNotMatch(r.why, /\/|--|\.py\b|\.json\b/);
    assert.deepEqual(metas(w), []);
    assert.deepEqual(readdirSync(join(w.dir, "source")), ["clip.mp4"]);
    const state = readState(w.dir);
    assert.equal(state.state, "ready", "it can be rendered again");
    assert.equal(state.lastRender?.qa, "failed");
    assert.equal(state.rendering, undefined);
    // Reel Kit's own build ran, so its fingerprint is the one recorded: a render again is not refused as changed in HyperFrames.
    assert.equal(renderWhy(w.dir, state), "");
    // A render that fails for another reason says so in its own line.
    const broken = world({ scenario: "fail" });
    const b = await renderReelKit(broken.ctx, { dir: broken.dir, entry: broken.entry }, broken.deps);
    assert.deepEqual(b, { ok: false, file: null, why: RENDER_SAY.failed });
    assert.deepEqual(metas(broken), []);
  });

  it("leaves out snapshots, renders, .hyperframes and the notes from the fingerprint", () => {
    const w = world();
    const start = compositionFingerprint(w.dir);
    assert.match(start, /^sha256-[0-9a-f]{64}$/);
    for (const [path, text] of [
      ["public/snapshots/a.png", "PNG"], ["public/renders/x.meta.json", "{}"], ["public/.hyperframes/transcripts/t.json", "{}"], ["public/CLAUDE.md", "notes"],
      ["public/AGENTS.md", "notes"], ["public/.DS_Store", "x"], ["cards/c1/._index.html", "x"], ["work/worker-status.json", "{}"], ["renders/r.mp4", "x"],
      ["source/other.mp4", "x"], ["storyboard/notes.json", "[]"], ["studio.json.note", "x"]
    ]) {
      mkdirSync(join(w.dir, path, ".."), { recursive: true });
      writeFileSync(join(w.dir, path), text);
      assert.equal(compositionFingerprint(w.dir), start, path);
    }
    for (const [path, text] of [["edit.py", "TITLE = \"Other\"\n"], ["fx/f1/fx.js", "// other\n"], ["cards/c1/index.html", "<html>other</html>"], ["public/index.html", "<html>other</html>"], ["public/media/new.mp4", "NEW"]]) {
      const was = compositionFingerprint(w.dir);
      mkdirSync(join(w.dir, path, ".."), { recursive: true });
      writeFileSync(join(w.dir, path), text);
      assert.notEqual(compositionFingerprint(w.dir), was, path);
    }
    // A link anywhere inside refuses it (fail closed), a link in a folder it leaves out does not.
    symlinkSync(w.outside, join(w.dir, "public", "snapshots", "elsewhere"));
    compositionFingerprint(w.dir);
    symlinkSync(w.outside, join(w.dir, "cards", "elsewhere"));
    assert.throws(() => compositionFingerprint(w.dir), (e) => e.code === "REEL_KIT_LINK_INSIDE");
    rmSync(join(w.dir, "cards", "elsewhere"));
    rmSync(join(w.dir, "edit.py"));
    symlinkSync(join(w.outside), join(w.dir, "edit.py"));
    assert.throws(() => compositionFingerprint(w.dir), (e) => e.code === "REEL_KIT_LINK_INSIDE");
  });
});

describe("where the render runs", () => {
  /** A Mac with a fixed home, as the profile reads it: nothing of this one's. */
  const FIXED = "/Users/sallie";
  const fixed = () => {
    const facts = factsOf(FIXED, { root: `${FIXED}/Dropbox/BRIMM Video`, machine: "Mac Studio" }, { tmp: "/private/tmp", uid: 501, env: {} });
    const project = `${FIXED}/BRIMM Video Work/Pricing/${NAME}`;
    const tmp = `${FIXED}/BRIMM Video Work/.reel-kit/tmp/${SLUG}.render`;
    const given = { checkout: "/Users/sallie/Studio", project, kit: kitDir(FIXED), rkHome: reelKitHome(FIXED), facts, tmp, programs: ["/opt/homebrew/Cellar/node/22.3.0/bin/node"] };
    return { facts, project, tmp, given, text: renderProfile(given) };
  };

  it("writes only the project and its own temp folder, reads an allowlist, and reaches no network", () => {
    const { project, tmp, text, given } = fixed();
    const sb = (p) => JSON.stringify(p);
    assert.match(text, /^\(version 1\)\n\(deny default\)\n/);
    assert.match(text, /\(deny network\*\)/);
    assert.doesNotMatch(text, /\(allow network/);
    assert.match(text, new RegExp(`\\(allow file-write\\*[^)]*\\(subpath ${sb(project).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
    assert.ok(text.includes(`(subpath ${sb(tmp)})`));
    // Studio's own names in the project are never written, and they come after the writes they hold back.
    const lastWrite = text.lastIndexOf("(allow file-write*");
    for (const own of ["studio.json", "CLAUDE.md", ".claude", "AGENTS.md"]) {
      const at = text.indexOf(`(subpath ${sb(`${project}/${own}`)})`, lastWrite);
      assert.ok(at > lastWrite, own);
    }
    // The home is denied whole, then only the allowlist read back in: the project, the temp folder, the kit, Reel Kit's HyperFrames, its
    // Chrome, and REEL_KIT_HOME's own folders; never its trials/ or another project.
    const denied = text.indexOf(`(deny file-read* (subpath ${sb(FIXED)})`);
    assert.ok(denied > 0, "the home is denied");
    for (const place of [project, tmp, kitDir(FIXED), hfDir(FIXED), `${FIXED}/.cache/hyperframes/chrome`, ...[".venv", ".venv-mp", "tools", "models", "vendor", "style", "fx", "cards", "hf"].map((n) => `${reelKitHome(FIXED)}/${n}`)]) {
      const at = text.indexOf(`(subpath ${sb(place)})`, denied);
      assert.ok(at > denied, place);
    }
    assert.ok(!text.includes(`${reelKitHome(FIXED)}/trials`));
    // BRIMM Video Work itself (a gated place) and the checkout are denied, before the project is read back in.
    const denials = text.slice(denied, text.indexOf("\n", denied));
    for (const place of [`${FIXED}/BRIMM Video Work`, "/Users/sallie/Studio"]) assert.ok(denials.includes(`(subpath ${sb(place)})`), place);
    // The system is read: its programs and libraries; Studio's node from where it is installed.
    for (const place of ["/System", "/usr", "/bin", "/Library", "/opt/homebrew/Cellar/node/22.3.0"]) assert.ok(text.includes(`(subpath ${sb(place)})`), place);
    // Every place it reads in the home is one the worker's sandbox reads too (one rule, two layers).
    const box = workerSandbox(given);
    const homeReads = [...text.slice(denied).matchAll(/\(allow file-read\* ((?:\(subpath "[^"]*"\) ?)+)\)/g)].flatMap((m) => [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1])).filter((p) => p.startsWith(`${FIXED}/`));
    assert.ok(homeReads.length >= 14);
    for (const place of homeReads) assert.ok(box.filesystem.allowRead.includes(place) || box.filesystem.allowWrite.includes(place), place);
  });

  it("names no network daemon among the services it may reach", async () => {
    const { text } = fixed();
    for (const service of ["com.apple.nsurlsessiond", "com.apple.dnssd.service", "com.apple.trustd", "com.apple.nsurlstorage-cache", "com.apple.networkd"]) assert.ok(!text.includes(service), service);
  });

  it("quotes every path as a string the profile reads", () => {
    const { given } = fixed();
    const text = renderProfile({ ...given, project: `${FIXED}/BRIMM Video Work/Pricing/A "quoted" \\ name` });
    assert.ok(text.includes(`(subpath "${FIXED}/BRIMM Video Work/Pricing/A \\"quoted\\" \\\\ name")`));
    assert.throws(() => renderProfile({ ...given, project: `${FIXED}/BRIMM Video Work/Pricing/A\nname` }));
  });

  it("never renders while a worker holds the Mac", async () => {
    const w = world();
    const lock = macLock(w.home);
    mkdirSync(join(lock, ".."), { recursive: true });
    writeFileSync(lock, JSON.stringify({ pid: 424242, command: "reelkit edit", nonce: "n" }));
    let held = true;
    const alive = (pid) => (pid === 424242 ? held : pid === process.pid);
    const rendering = renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, { ...w.deps, alive });
    await new Promise((r) => setTimeout(r, 120));
    assert.deepEqual(w.reelKitRuns(), [], "nothing ran while the worker held the Mac");
    held = false;
    const r = await rendering;
    assert.equal(r.ok, true, r.why);
    assert.ok(!existsSync(lock), "the render lets the Mac go when it ends");
  });
});

describe("a project's folder for its exports", () => {
  it("is public/ for a Reel Kit edit, where the app writes its own, and the project itself for a HyperFrames one", () => {
    const work = "/Users/sallie/BRIMM Video Work/Pricing";
    assert.equal(projectDirOf(work, { name: NAME, maker: "reel-kit" }), join(work, NAME, "public"));
    assert.equal(projectDirOf(work, { name: "Pricing- reel 2 3fa9c1" }), join(work, "Pricing- reel 2 3fa9c1"));
  });
});
